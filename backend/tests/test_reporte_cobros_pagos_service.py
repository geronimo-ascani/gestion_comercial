from datetime import date
from decimal import Decimal

import pytest

from app.services.reporte_cobros_pagos_calculos import (
    ReporteCobrosPagosDatosInvalidos,
)
from app.services.reporte_cobros_pagos_service import (
    ReporteCobrosPagosService,
)

_DESDE = date(2026, 11, 1)
_HASTA = date(2026, 11, 30)


class FakePagoRepository:
    def __init__(self, filas: list[dict] | None = None) -> None:
        self.filas = filas or []
        self.llamada: tuple | None = None

    def listar_para_reporte(self, *args) -> list[dict]:
        self.llamada = args
        return self.filas


def _fila(tipo: str, estado: str, monto: str, medio: str = "MP-0001") -> dict:
    return {
        "tipo_pago": tipo,
        "estado": estado,
        "monto": Decimal(monto),
        "id_medio_pago": medio,
        "medio_pago": "Efectivo" if medio == "MP-0001" else "Transferencia",
    }


def test_servicio_reporte_devuelve_parametros_y_totales() -> None:
    repo = FakePagoRepository(
        [
            _fila("cobro", "aprobado", "100.00"),
            _fila("pago", "aprobado", "40.00", "MP-0002"),
        ]
    )
    datos = ReporteCobrosPagosService(repo).obtener(  # type: ignore[arg-type]
        _DESDE,
        _HASTA,
        id_cliente="CLI-0001",
    )

    assert datos["parametros"] == {
        "desde": _DESDE,
        "hasta": _HASTA,
        "id_cliente": "CLI-0001",
        "id_proveedor": None,
    }
    assert datos["totales"]["neto_realizado"] == Decimal("60.00")
    assert datos["por_medio_pago"][0]["medio_pago"] == "Efectivo"
    assert repo.llamada == (_DESDE, _HASTA, "CLI-0001", None)


def test_servicio_reporte_rechaza_rango_invertido() -> None:
    with pytest.raises(ReporteCobrosPagosDatosInvalidos):
        ReporteCobrosPagosService(FakePagoRepository()).obtener(  # type: ignore[arg-type]
            _HASTA,
            _DESDE,
        )


def test_servicio_reporte_rechaza_cliente_y_proveedor_juntos() -> None:
    repo = FakePagoRepository()
    with pytest.raises(ReporteCobrosPagosDatosInvalidos):
        ReporteCobrosPagosService(repo).obtener(  # type: ignore[arg-type]
            _DESDE,
            _HASTA,
            id_cliente="CLI-0001",
            id_proveedor="PRV-0001",
        )
    assert repo.llamada is None
