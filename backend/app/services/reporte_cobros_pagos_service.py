"""Orquestación del reporte de cobros y pagos (RF-20)."""

from datetime import date, datetime, timezone
from typing import Any

from app.repositories.pago_repository import PagoRepository
from app.services.reporte_cobros_pagos_calculos import (
    agregar_pagos,
    validar_rango,
)


class ReporteCobrosPagosService:
    def __init__(self, pagos: PagoRepository) -> None:
        self._pagos = pagos

    def obtener(
        self,
        desde: date | None,
        hasta: date | None,
        id_cliente: str | None = None,
        id_proveedor: str | None = None,
    ) -> dict[str, Any]:
        desde, hasta = validar_rango(desde, hasta)

        filas = self._pagos.listar_para_reporte(
            desde, hasta, id_cliente, id_proveedor
        )
        totales, por_estado, por_medio_pago = agregar_pagos(filas)

        return {
            "desde": desde,
            "hasta": hasta,
            "generado_en": datetime.now(timezone.utc),
            "parametros": {
                "desde": desde,
                "hasta": hasta,
                "id_cliente": id_cliente,
                "id_proveedor": id_proveedor,
            },
            "totales": totales,
            "por_estado": por_estado,
            "por_medio_pago": por_medio_pago,
        }
