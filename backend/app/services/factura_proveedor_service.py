from datetime import date
from decimal import Decimal
from typing import Any, TypedDict

from psycopg import errors

from app.repositories.factura_proveedor_repository import (
    FacturaProveedorRepository,
)
from app.repositories.pago_repository import PagoRepository, PagoRow
from app.schemas.facturas_proveedor import (
    FacturaProveedorCreate,
    PagoProveedorCreate,
)
from app.schemas.pagos import PagoEstadoUpdate
from app.services.empresa_service import EmpresaService
from app.services.factura_compra_calculos import (
    calcular_tipo_comprobante_compra,
)

MAX_ARCHIVO_BYTES = 3 * 1024 * 1024
_MIMES_POR_EXTENSION = {
    "pdf": "application/pdf",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}

_RESUMEN_CAMPOS = (
    "id_factura_proveedor",
    "numero_comprobante",
    "numero_completo",
    "tipo_comprobante",
    "estado_pago",
    "fecha_emision",
    "fecha_vence",
    "total",
    "saldo_pendiente",
    "id_empresa",
    "id_proveedor",
    "proveedor_razon_social",
    "id_pedido_proveedor",
    "archivo_nombre",
    "archivo_mime_type",
    "archivo_tamanio",
    "archivo_url",
)


class ArchivoFacturaEntrada(TypedDict):
    nombre: str
    mime_type: str
    contenido: bytes


class ArchivoFacturaValidado(TypedDict):
    nombre: str
    mime_type: str
    contenido: bytes
    tamanio: int


class FacturaProveedorError(Exception):
    pass


class FacturaProveedorNoEncontrado(FacturaProveedorError):
    pass


class FacturaProveedorDatosInvalidos(FacturaProveedorError):
    pass


class FacturaProveedorDuplicada(FacturaProveedorError):
    pass


class PagoFacturaDatosInvalidos(FacturaProveedorError):
    pass


class FacturaProveedorService:
    def __init__(
        self,
        repo: FacturaProveedorRepository,
        pagos: PagoRepository,
        empresas: EmpresaService,
        *,
        id_empresa: str,
    ) -> None:
        self._repo = repo
        self._pagos = pagos
        self._empresas = empresas
        self._id_empresa = id_empresa

    @staticmethod
    def _resumen(factura: dict[str, Any]) -> dict[str, Any]:
        resumen = {campo: factura[campo] for campo in _RESUMEN_CAMPOS}
        resumen["tiene_archivo"] = bool(resumen["archivo_nombre"])
        return resumen

    @staticmethod
    def _validar_archivo(
        archivo: ArchivoFacturaEntrada,
    ) -> ArchivoFacturaValidado:
        nombre = archivo["nombre"].replace("\\", "/").rsplit("/", 1)[-1].strip()
        if not nombre or any(ord(caracter) < 32 for caracter in nombre):
            raise FacturaProveedorDatosInvalidos("El nombre del archivo no es válido")
        if len(nombre) > 255:
            raise FacturaProveedorDatosInvalidos(
                "El nombre del archivo es demasiado largo"
            )

        extension = nombre.rsplit(".", 1)[-1].lower() if "." in nombre else ""
        mime_esperado = _MIMES_POR_EXTENSION.get(extension)
        mime_recibido = (archivo["mime_type"] or "").strip().lower()
        if mime_esperado is None or mime_recibido != mime_esperado:
            raise FacturaProveedorDatosInvalidos(
                "El archivo debe ser un PDF o una imagen JPG"
            )

        contenido = archivo["contenido"]
        if not contenido:
            raise FacturaProveedorDatosInvalidos("El archivo está vacío")
        if len(contenido) > MAX_ARCHIVO_BYTES:
            raise FacturaProveedorDatosInvalidos(
                "El archivo no puede superar los 3 MB"
            )

        firma_pdf = contenido.startswith(b"%PDF-")
        firma_jpg = contenido.startswith(b"\xff\xd8\xff")
        if mime_recibido == "application/pdf" and not firma_pdf:
            raise FacturaProveedorDatosInvalidos("El PDF no tiene un formato válido")
        if mime_recibido == "image/jpeg" and not firma_jpg:
            raise FacturaProveedorDatosInvalidos("El JPG no tiene un formato válido")

        return {
            "nombre": nombre,
            "mime_type": mime_recibido,
            "contenido": contenido,
            "tamanio": len(contenido),
        }

    def listar(
        self,
        estado_pago: str | None,
        id_pedido_proveedor: str | None,
        id_proveedor: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        return [
            self._resumen(factura)
            for factura in self._repo.listar(
                estado_pago,
                id_pedido_proveedor,
                id_proveedor,
                q,
                limit,
                offset,
            )
        ]

    def listar_por_pedido(
        self, id_pedido_proveedor: str
    ) -> list[dict[str, Any]]:
        return [
            self._resumen(factura)
            for factura in self._repo.listar_por_pedido(id_pedido_proveedor)
        ]

    def obtener(self, id_factura_proveedor: str) -> dict[str, Any]:
        factura = self._repo.obtener(id_factura_proveedor)
        if factura is None:
            raise FacturaProveedorNoEncontrado(id_factura_proveedor)
        factura["tiene_archivo"] = bool(factura.get("archivo_nombre"))
        factura["pagos"] = self._pagos.listar_por_factura(
            id_factura_proveedor
        )
        return factura

    def obtener_archivo(self, id_factura_proveedor: str) -> dict[str, Any]:
        archivo = self._repo.archivo(id_factura_proveedor)
        if archivo is None:
            raise FacturaProveedorNoEncontrado(id_factura_proveedor)
        return archivo

    def listar_pagos(self, id_factura_proveedor: str) -> list[PagoRow]:
        if not self._repo.existe(id_factura_proveedor):
            raise FacturaProveedorNoEncontrado(id_factura_proveedor)
        return self._pagos.listar_por_factura(id_factura_proveedor)

    def listar_pagos_globales(
        self,
        desde: date | None,
        hasta: date | None,
        id_proveedor: str | None,
        estado: str | None,
        id_medio_pago: str | None,
        limit: int,
        offset: int,
    ) -> list[dict[str, Any]]:
        if desde is not None and hasta is not None and hasta < desde:
            raise FacturaProveedorDatosInvalidos(
                "La fecha 'desde' no puede ser posterior a la fecha 'hasta'"
            )
        pagos = self._pagos.listar_pagos_proveedor(
            desde,
            hasta,
            id_proveedor,
            estado,
            id_medio_pago,
            limit,
            offset,
        )
        # El número visible de la factura es el ID generado FP-####.
        return [
            {**pago, "numero_factura": pago["id_factura_proveedor"]}
            for pago in pagos
        ]

    def crear(
        self,
        datos: FacturaProveedorCreate,
        id_empleado: str,
        archivo: ArchivoFacturaEntrada,
    ) -> dict[str, Any]:
        archivo_validado = self._validar_archivo(archivo)
        try:
            with self._repo.transaction():
                pedido = self._repo.obtener_pedido(
                    datos.id_pedido_proveedor, bloquear=True
                )
                if pedido is None:
                    raise FacturaProveedorNoEncontrado(
                        datos.id_pedido_proveedor
                    )

                empresa = self._empresas.obtener(self._id_empresa)
                condicion_proveedor = (
                    pedido["proveedor_condicion_iva_descripcion"]
                    or pedido["proveedor_condicion_iva_codigo"]
                    or ""
                )
                tipo_comprobante = calcular_tipo_comprobante_compra(
                    condicion_proveedor,
                    empresa["condicion_iva"],
                )

                id_factura = self._repo.crear(
                    {
                        "id_empresa": self._id_empresa,
                        "id_proveedor": pedido["id_proveedor"],
                        "id_pedido_proveedor": datos.id_pedido_proveedor,
                        "id_empleado": id_empleado,
                        "fecha_emision": datos.fecha_emision,
                        "fecha_vence": datos.fecha_vence,
                        "tipo_comprobante": tipo_comprobante,
                        "total": datos.total,
                        "saldo_pendiente": datos.total,
                        "estado_pago": "emitida",
                        "proveedor_razon_social": pedido[
                            "proveedor_razon_social"
                        ],
                        "proveedor_cuit": pedido["proveedor_cuit"],
                        "proveedor_domicilio": pedido[
                            "proveedor_domicilio"
                        ],
                        "proveedor_condicion_iva": condicion_proveedor,
                        "empresa_razon_social": empresa["razon_social"],
                        "empresa_cuit": empresa["cuit"],
                        "empresa_domicilio": empresa["domicilio"],
                        "empresa_condicion_iva": empresa["condicion_iva"],
                    },
                    archivo_validado,
                )
                return self.obtener(id_factura)
        except errors.UniqueViolation as exc:
            raise FacturaProveedorDuplicada(
                "Ya existe una factura con ese identificador"
            ) from exc
        except (errors.CheckViolation, errors.ForeignKeyViolation) as exc:
            raise FacturaProveedorDatosInvalidos(
                "Los datos de la factura no son válidos"
            ) from exc

    def registrar_pago(
        self,
        id_factura_proveedor: str,
        datos: PagoProveedorCreate,
    ) -> PagoRow:
        try:
            with self._repo.transaction():
                factura = self._repo.obtener(
                    id_factura_proveedor, bloquear=True
                )
                if factura is None:
                    raise FacturaProveedorNoEncontrado(
                        id_factura_proveedor
                    )
                if factura["estado_pago"] == "pagada":
                    raise PagoFacturaDatosInvalidos(
                        "La factura ya está pagada en su totalidad"
                    )
                if not self._pagos.medio_pago_existe(datos.id_medio_pago):
                    raise PagoFacturaDatosInvalidos(
                        f"No existe el medio de pago '{datos.id_medio_pago}'"
                    )

                comprometido = self._pagos.sumar_factura(
                    id_factura_proveedor, ("aprobado", "pendiente")
                )
                if comprometido + datos.monto > factura["total"]:
                    disponible = factura["total"] - comprometido
                    raise PagoFacturaDatosInvalidos(
                        "El pago excede el saldo pendiente. "
                        f"Disponible: {disponible}"
                    )

                id_pago = self._pagos.crear(
                    {
                        "estado": datos.estado,
                        "fecha_pago": datos.fecha_pago or date.today(),
                        "monto": datos.monto,
                        "referencia": datos.referencia,
                        "id_comprobante_venta": None,
                        "id_factura_proveedor": id_factura_proveedor,
                        "id_medio_pago": datos.id_medio_pago,
                    }
                )

                if datos.estado == "aprobado":
                    total_pagado = self._pagos.sumar_factura(
                        id_factura_proveedor, ("aprobado",)
                    )
                    saldo = factura["total"] - total_pagado
                    if saldo < 0:
                        saldo = Decimal("0")
                    estado_pago = "pagada" if saldo == 0 else "emitida"
                    self._repo.actualizar_pago(
                        id_factura_proveedor, estado_pago, saldo
                    )

                pago = self._pagos.obtener(id_pago)
                if pago is None:
                    raise FacturaProveedorError(
                        "No se pudo recuperar el pago registrado"
                    )
                return pago
        except errors.CheckViolation as exc:
            raise PagoFacturaDatosInvalidos(
                "Los datos del pago no son válidos"
            ) from exc

    def cambiar_estado_pago(
        self,
        id_factura_proveedor: str,
        id_pago: str,
        datos: PagoEstadoUpdate,
    ) -> PagoRow:
        """Aprueba o rechaza un pago pendiente y recalcula el saldo.

        El pendiente reserva cupo pero no descuenta saldo; al aprobarlo se
        descuenta, al rechazarlo se libera la reserva sin tocar el saldo.
        """
        with self._repo.transaction():
            factura = self._repo.obtener(id_factura_proveedor, bloquear=True)
            if factura is None:
                raise FacturaProveedorNoEncontrado(id_factura_proveedor)

            pago = self._pagos.obtener(id_pago)
            if pago is None or pago.get("id_factura_proveedor") != id_factura_proveedor:
                raise FacturaProveedorNoEncontrado(id_pago)
            if pago["estado"] != "pendiente":
                raise PagoFacturaDatosInvalidos(
                    "Solo se puede cambiar el estado de un pago pendiente"
                )

            aprobados = self._pagos.sumar_factura(
                id_factura_proveedor, ("aprobado",)
            )
            if datos.estado == "aprobado" and aprobados + pago["monto"] > factura["total"]:
                disponible = factura["total"] - aprobados
                raise PagoFacturaDatosInvalidos(
                    "El pago excede el saldo pendiente. "
                    f"Disponible: {disponible}"
                )

            if not self._pagos.actualizar_estado(
                id_pago, datos.estado, id_factura_proveedor
            ):
                raise PagoFacturaDatosInvalidos(
                    "El pago ya no está pendiente"
                )

            if datos.estado == "aprobado":
                aprobados += pago["monto"]
            saldo = factura["total"] - aprobados
            if saldo < 0:
                saldo = Decimal("0")
            estado_pago = "pagada" if saldo == 0 else "emitida"
            self._repo.actualizar_pago(id_factura_proveedor, estado_pago, saldo)

            actualizado = self._pagos.obtener(id_pago)
            if actualizado is None:
                raise FacturaProveedorError(
                    "No se pudo recuperar el pago actualizado"
                )
            return actualizado
