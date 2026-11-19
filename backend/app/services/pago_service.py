from datetime import date
from decimal import Decimal
from typing import Any

from psycopg import errors

from app.repositories.comprobante_repository import ComprobanteRepository
from app.repositories.pago_repository import PagoRepository, PagoRow
from app.schemas.pagos import PagoCreate
from app.services.comprobante_service import ComprobanteNoEncontrado


class PagoError(Exception):
    pass


class PagoDatosInvalidos(PagoError):
    pass


class PagoEstadoInvalido(PagoError):
    pass


class PagoService:
    def __init__(
        self,
        comprobantes: ComprobanteRepository,
        pagos: PagoRepository,
    ) -> None:
        self._comprobantes = comprobantes
        self._pagos = pagos

    def listar(self, id_comprobante_venta: str) -> list[PagoRow]:
        if not self._comprobantes.existe(id_comprobante_venta):
            raise ComprobanteNoEncontrado(id_comprobante_venta)
        return self._pagos.listar_por_comprobante(id_comprobante_venta)

    def listar_todos(self, limit: int, offset: int) -> list[PagoRow]:
        return self._pagos.listar_todos(limit, offset)

    def registrar(
        self, id_comprobante_venta: str, datos: PagoCreate
    ) -> PagoRow:
        try:
            with self._comprobantes.transaction():
                comprobante = self._comprobantes.obtener(
                    id_comprobante_venta, bloquear=True
                )
                if comprobante is None:
                    raise ComprobanteNoEncontrado(id_comprobante_venta)
                if comprobante["estado_pago"] == "pagada":
                    raise PagoEstadoInvalido(
                        "El comprobante ya está pagado en su totalidad"
                    )
                if not self._pagos.medio_pago_existe(datos.id_medio_pago):
                    raise PagoDatosInvalidos(
                        f"No existe el medio de pago '{datos.id_medio_pago}'"
                    )

                comprometido = self._pagos.sumar(
                    id_comprobante_venta, ("aprobado", "pendiente")
                )
                if comprometido + datos.monto > comprobante["monto"]:
                    disponible = comprobante["monto"] - comprometido
                    raise PagoDatosInvalidos(
                        "El pago excede el saldo pendiente. "
                        f"Disponible: {disponible}"
                    )

                id_pago = self._pagos.crear(
                    {
                        "estado": datos.estado,
                        "fecha_pago": datos.fecha_pago or date.today(),
                        "monto": datos.monto,
                        "referencia": datos.referencia,
                        "id_comprobante_venta": id_comprobante_venta,
                        "id_medio_pago": datos.id_medio_pago,
                    }
                )

                if datos.estado == "aprobado":
                    total_pagado = self._pagos.sumar(
                        id_comprobante_venta, ("aprobado",)
                    )
                    saldo = comprobante["monto"] - total_pagado
                    if saldo < 0:
                        saldo = Decimal("0")
                    estado_pago = "pagada" if saldo == 0 else "aprobada"
                    self._comprobantes.actualizar_pago(
                        id_comprobante_venta,
                        estado_pago,
                        saldo,
                        date.today() if saldo == 0 else None,
                    )
                    self._comprobantes.actualizar_saldo_pedido(
                        comprobante["id_pedido_cliente"], saldo
                    )

                pago = self._pagos.obtener(id_pago)
                if pago is None:
                    raise PagoError("No se pudo recuperar el pago registrado")
                return pago
        except errors.ForeignKeyViolation as exc:
            raise PagoDatosInvalidos(
                "El comprobante o el medio de pago ya no está disponible"
            ) from exc
        except errors.CheckViolation as exc:
            raise PagoDatosInvalidos(
                "Los datos del pago no son válidos"
            ) from exc
