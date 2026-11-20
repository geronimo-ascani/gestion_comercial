from datetime import date
from decimal import Decimal
from typing import Any

from psycopg import errors

from app.repositories.comprobante_repository import (
    ComprobanteRepository,
    ComprobanteRow,
)
from app.repositories.pago_repository import PagoRepository
from app.schemas.comprobantes import ComprobanteVentaCreate
from app.services.email_service import (
    AdjuntoEmail,
    EmailError,
    EmailNoConfigurado,
    EmailService,
    ErrorEnvioEmail,
)
from app.services.comprobante_pdf import generar_pdf_comprobante
from app.services.empresa_service import EmpresaError, EmpresaService

_ESTADOS_EMITIBLES = ("pendiente", "proceso", "enviado", "entregado")


class ComprobanteError(Exception):
    pass


class ComprobanteNoEncontrado(ComprobanteError):
    pass


class ComprobanteDatosInvalidos(ComprobanteError):
    pass


class ComprobanteEstadoInvalido(ComprobanteError):
    pass


class ComprobanteEmpresaNoConfigurada(ComprobanteError):
    pass


class ComprobanteEnvioSinDestinatario(ComprobanteError):
    pass


class ComprobanteEnvioNoConfigurado(ComprobanteError):
    pass


class ComprobanteEnvioFallido(ComprobanteError):
    pass


def calcular_tipo_comprobante(
    condicion_emisor: str, codigo_afip_cliente: str
) -> str:
    """Clase de comprobante según condición IVA del emisor y del cliente.

    Emisor monotributista o exento emite siempre C. Emisor responsable
    inscripto emite A a responsables inscriptos y monotributistas, y B al
    resto. La exportación (E) queda para una etapa fiscal posterior.
    """
    if condicion_emisor in ("monotributista", "exento"):
        return "C"
    if codigo_afip_cliente in ("1", "6"):
        return "A"
    return "B"


class ComprobanteService:
    def __init__(
        self,
        repo: ComprobanteRepository,
        pagos: PagoRepository,
        empresas: EmpresaService,
        email: EmailService | None = None,
        *,
        id_empresa: str,
    ) -> None:
        self._repo = repo
        self._pagos = pagos
        self._empresas = empresas
        self._email = email
        self._id_empresa = id_empresa

    def listar(
        self,
        estado_pago: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        return [
            self._resumen(row)
            for row in self._repo.listar(estado_pago, q, limit, offset)
        ]

    def obtener(self, id_comprobante_venta: str) -> dict[str, Any]:
        comprobante = self._repo.obtener(id_comprobante_venta)
        if comprobante is None:
            raise ComprobanteNoEncontrado(id_comprobante_venta)
        return self._componer(comprobante)

    def obtener_por_pedido(self, id_pedido_cliente: str) -> dict[str, Any]:
        comprobante = self._repo.buscar_por_pedido(id_pedido_cliente)
        if comprobante is None:
            raise ComprobanteNoEncontrado(id_pedido_cliente)
        return self._componer(comprobante)

    def listar_envios(self, id_comprobante_venta: str) -> list[dict[str, Any]]:
        if not self._repo.existe(id_comprobante_venta):
            raise ComprobanteNoEncontrado(id_comprobante_venta)
        return self._repo.listar_envios(id_comprobante_venta)

    def enviar(
        self,
        id_comprobante_venta: str,
        destinatario: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
    ) -> dict[str, Any]:
        comprobante = self.obtener(id_comprobante_venta)
        destino = (destinatario or comprobante["cliente"]["email"] or "").strip()
        if not destino:
            raise ComprobanteEnvioSinDestinatario(
                "El cliente no tiene un correo configurado. "
                "Indicá un destinatario para enviar el comprobante"
            )
        copias = list(cc or [])
        copias_ocultas = list(bcc or [])

        try:
            pdf = generar_pdf_comprobante(comprobante)
        except Exception as exc:
            raise ComprobanteError(
                "No se pudo generar el PDF del comprobante"
            ) from exc

        numero = comprobante["numero_completo"] or comprobante[
            "id_comprobante_venta"
        ]
        try:
            self._email_service().enviar(
                destinatario=destino,
                asunto=f"Comprobante {numero}",
                cuerpo=self._cuerpo_texto(comprobante),
                cuerpo_html=self._cuerpo_html(comprobante),
                adjuntos=[
                    AdjuntoEmail(
                        nombre=f"comprobante-{numero}.pdf",
                        contenido=pdf,
                    )
                ],
                cc=copias,
                bcc=copias_ocultas,
            )
        except EmailNoConfigurado as exc:
            self._registrar_envio(
                id_comprobante_venta,
                destino,
                "fallido",
                str(exc),
                copias,
                copias_ocultas,
            )
            raise ComprobanteEnvioNoConfigurado(str(exc)) from exc
        except EmailError as exc:
            self._registrar_envio(
                id_comprobante_venta,
                destino,
                "fallido",
                str(exc),
                copias,
                copias_ocultas,
            )
            raise ComprobanteEnvioFallido(str(exc)) from exc

        id_envio = self._registrar_envio(
            id_comprobante_venta,
            destino,
            "enviado",
            None,
            copias,
            copias_ocultas,
        )
        envio = self._repo.obtener_envio(id_envio)
        if envio is None:
            raise ComprobanteError(
                "No se pudo recuperar el envío registrado"
            )
        return envio

    def _registrar_envio(
        self,
        id_comprobante_venta: str,
        destinatario: str,
        estado: str,
        error: str | None,
        cc: list[str],
        bcc: list[str],
    ) -> int:
        with self._repo.transaction():
            return self._repo.registrar_envio(
                id_comprobante_venta, destinatario, estado, error, cc, bcc
            )

    def _email_service(self) -> EmailService:
        if self._email is None:
            self._email = EmailService()
        return self._email

    @staticmethod
    def _cuerpo_texto(comprobante: dict[str, Any]) -> str:
        return (
            f"Adjuntamos el comprobante "
            f"{comprobante['numero_completo'] or ''} correspondiente al "
            f"pedido {comprobante['id_pedido_cliente']}.\n\n"
            f"Total: {comprobante['monto']}\n"
            f"Saldo pendiente: {comprobante['saldo_pendiente']}\n\n"
            "Este documento es interno y no reemplaza a la factura fiscal."
        )

    @staticmethod
    def _cuerpo_html(comprobante: dict[str, Any]) -> str:
        return (
            "<html><body style=\"font-family:Arial,sans-serif\">"
            "<h2>Comprobante de venta</h2>"
            f"<p>Adjuntamos el comprobante "
            f"<strong>{comprobante['numero_completo'] or ''}</strong> "
            f"del pedido <strong>{comprobante['id_pedido_cliente']}</strong>."
            "</p><ul>"
            f"<li>Total: <strong>{comprobante['monto']}</strong></li>"
            f"<li>Pagado: <strong>{comprobante['total_pagado']}</strong></li>"
            f"<li>Saldo pendiente: "
            f"<strong>{comprobante['saldo_pendiente']}</strong></li>"
            "</ul>"
            "<p style=\"color:#64748b;font-size:12px\">"
            "Este documento es interno y no reemplaza a la factura fiscal."
            "</p></body></html>"
        )

    @staticmethod
    def _datos_snapshot(
        pedido: dict[str, Any],
        empresa: dict[str, Any],
        *,
        tipo_comprobante: str,
        numero: str,
        monto: Decimal,
        datos: ComprobanteVentaCreate,
        id_empleado: str | None,
    ) -> dict[str, Any]:
        """Datos inmutables que se congelan junto con la cabecera."""
        return {
            "estado_pago": "emitida",
            "fecha_emision": date.today(),
            "fecha_pago": None,
            "monto": monto,
            "saldo_pendiente": monto,
            "tipo_comprobante": tipo_comprobante,
            "numero_comprobante": numero,
            "punto_venta": empresa["punto_venta"],
            "id_pedido_cliente": pedido["id_pedido_cliente"],
            "id_empresa": empresa["id_empresa"],
            "id_empleado": id_empleado,
            "observaciones": datos.observaciones,
            "id_cliente": pedido["id_cliente"],
            "cliente_nombre": pedido["cliente_nombre"],
            "cliente_apellido": pedido["cliente_apellido"],
            "cliente_dni_cuit": pedido["cliente_dni_cuit"],
            "cliente_email": pedido["cliente_email"],
            "cliente_telefono": pedido["cliente_telefono"],
            "cliente_condicion_codigo": pedido["condicion_iva_codigo"],
            "cliente_condicion_descripcion": pedido[
                "condicion_iva_descripcion"
            ],
            "empresa_razon_social": empresa["razon_social"],
            "empresa_nombre_fantasia": empresa["nombre_fantasia"],
            "empresa_cuit": empresa["cuit"],
            "empresa_condicion_iva": empresa["condicion_iva"],
            "empresa_domicilio": empresa["domicilio"],
            "empresa_punto_venta": empresa["punto_venta"],
            "empresa_email": empresa["email"],
            "empresa_telefono": empresa["telefono"],
            "empresa_activa": empresa["activa"],
            "empresa_ingresos_brutos": empresa["ingresos_brutos"],
            "empresa_inicio_actividades": empresa["inicio_actividades"],
            "empresa_codigo_postal": empresa["codigo_postal"],
            "empresa_localidad": empresa["localidad"],
            "empresa_provincia": empresa["provincia"],
            "estado_envio": pedido["estado_envio"],
            "descuento_compra": pedido["descuento_compra"],
            "entrega_calle": pedido["entrega_calle"],
            "entrega_altura": pedido["entrega_altura"],
            "entrega_cp": pedido["entrega_cp"],
            "entrega_depto": pedido["entrega_depto"],
            "entrega_localidad": pedido["entrega_localidad"],
            "entrega_provincia": pedido["entrega_provincia"],
        }

    def emitir(
        self,
        id_pedido_cliente: str,
        datos: ComprobanteVentaCreate,
        id_empleado: str | None,
    ) -> dict[str, Any]:
        try:
            with self._repo.transaction():
                pedido = self._repo.obtener_pedido(
                    id_pedido_cliente, bloquear=True
                )
                if pedido is None:
                    raise ComprobanteNoEncontrado(id_pedido_cliente)

                existente = self._repo.buscar_por_pedido(id_pedido_cliente)
                if existente is not None:
                    return self._componer(existente)

                if pedido["estado_envio"] not in _ESTADOS_EMITIBLES:
                    raise ComprobanteEstadoInvalido(
                        "No se puede emitir el comprobante de un pedido "
                        "cancelado"
                    )

                try:
                    empresa = self._empresas.obtener_emisora(self._id_empresa)
                except EmpresaError as exc:
                    raise ComprobanteEmpresaNoConfigurada(str(exc)) from exc

                tipo_comprobante = calcular_tipo_comprobante(
                    empresa["condicion_iva"],
                    pedido["condicion_iva_codigo"],
                )
                numero = self._repo.siguiente_numero(
                    empresa["id_empresa"],
                    empresa["punto_venta"],
                    tipo_comprobante,
                )
                items = self._repo.obtener_items_pedido(id_pedido_cliente)
                monto = pedido["total"]
                id_comprobante = self._repo.crear(
                    self._datos_snapshot(
                        pedido,
                        empresa,
                        tipo_comprobante=tipo_comprobante,
                        numero=numero,
                        monto=monto,
                        datos=datos,
                        id_empleado=id_empleado,
                    )
                )
                self._repo.crear_items(id_comprobante, items)
                comprobante = self._repo.obtener(id_comprobante)
                if comprobante is None:
                    raise ComprobanteError(
                        "No se pudo recuperar el comprobante emitido"
                    )
                return self._componer(comprobante)
        except errors.UniqueViolation as exc:
            existente = self._repo.buscar_por_pedido(id_pedido_cliente)
            if existente is not None:
                return self._componer(existente)
            raise ComprobanteDatosInvalidos(
                "El pedido ya tiene un comprobante emitido"
            ) from exc
        except errors.ForeignKeyViolation as exc:
            raise ComprobanteDatosInvalidos(
                "El pedido, la empresa o el empleado ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise ComprobanteDatosInvalidos(
                "Los datos del comprobante no son válidos"
            ) from exc

    def _componer(self, row: ComprobanteRow) -> dict[str, Any]:
        pagos = self._pagos.listar_por_comprobante(
            row["id_comprobante_venta"]
        )
        total_pagado = sum(
            (
                pago["monto"]
                for pago in pagos
                if pago["estado"] == "aprobado"
            ),
            Decimal("0"),
        )
        saldo = row["monto"] - total_pagado
        empresa = {
            "id_empresa": row["id_empresa"],
            "razon_social": row["empresa_razon_social"],
            "nombre_fantasia": row["empresa_nombre_fantasia"],
            "cuit": row["empresa_cuit"],
            "condicion_iva": row["empresa_condicion_iva"],
            "domicilio": row["empresa_domicilio"],
            "punto_venta": row["empresa_punto_venta"],
            "email": row["empresa_email"],
            "telefono": row["empresa_telefono"],
            "activa": row["empresa_activa"],
            "ingresos_brutos": row["empresa_ingresos_brutos"],
            "inicio_actividades": row["empresa_inicio_actividades"],
            "codigo_postal": row["empresa_codigo_postal"],
            "localidad": row["empresa_localidad"],
            "provincia": row["empresa_provincia"],
        }
        cliente = {
            "id_cliente": row["id_cliente"],
            "nombre": row["cliente_nombre"],
            "apellido": row["cliente_apellido"],
            "dni_cuit": row["cliente_dni_cuit"],
            "email": row["cliente_email"],
            "telefono": row["cliente_telefono"],
            "condicion_iva_codigo": row["cliente_condicion_codigo"],
            "condicion_iva_descripcion": row[
                "cliente_condicion_descripcion"
            ],
        }
        return {
            "id_comprobante_venta": row["id_comprobante_venta"],
            "numero_comprobante": row["numero_comprobante"],
            "numero_completo": self._numero_completo(row),
            "punto_venta": row["punto_venta"],
            "tipo_comprobante": row["tipo_comprobante"],
            "estado_pago": row["estado_pago"],
            "fecha_emision": row["fecha_emision"],
            "fecha_pago": row["fecha_pago"],
            "monto": row["monto"],
            "saldo_pendiente": saldo,
            "total_pagado": total_pagado,
            "id_pedido_cliente": row["id_pedido_cliente"],
            "estado_envio": row["estado_envio"],
            "descuento_compra": row["descuento_compra"],
            "entrega_calle": row["entrega_calle"],
            "entrega_altura": row["entrega_altura"],
            "entrega_cp": row["entrega_cp"],
            "entrega_depto": row["entrega_depto"],
            "entrega_localidad": row["entrega_localidad"],
            "entrega_provincia": row["entrega_provincia"],
            "observaciones": row["observaciones"],
            "cae": row["cae"],
            "cae_vence": row["cae_vence"],
            "creado_en": row["creado_en"],
            "empresa": empresa,
            "cliente": cliente,
            "items": row["items"],
            "pagos": pagos,
            "id_empresa": row["id_empresa"],
            "empresa_razon_social": row["empresa_razon_social"],
            "cliente_nombre": row["cliente_nombre"],
            "cliente_apellido": row["cliente_apellido"],
            "cliente_email": row["cliente_email"],
        }

    @staticmethod
    def _resumen(row: ComprobanteRow) -> dict[str, Any]:
        return {
            "id_comprobante_venta": row["id_comprobante_venta"],
            "numero_comprobante": row["numero_comprobante"],
            "numero_completo": ComprobanteService._numero_completo(row),
            "punto_venta": row["punto_venta"],
            "tipo_comprobante": row["tipo_comprobante"],
            "estado_pago": row["estado_pago"],
            "fecha_emision": row["fecha_emision"],
            "monto": row["monto"],
            "saldo_pendiente": row["saldo_pendiente"],
            "id_pedido_cliente": row["id_pedido_cliente"],
            "cliente_nombre": row["cliente_nombre"],
            "cliente_apellido": row["cliente_apellido"],
            "cliente_email": row["cliente_email"],
            "id_empresa": row["id_empresa"],
            "empresa_razon_social": row["empresa_razon_social"],
        }

    @staticmethod
    def _numero_completo(row: ComprobanteRow) -> str | None:
        numero = row["numero_comprobante"]
        if not numero:
            return None
        return f"{row['punto_venta']}-{numero}"
