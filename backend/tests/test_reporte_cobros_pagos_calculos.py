from datetime import date
from decimal import Decimal

import pytest

from app.services.reporte_cobros_pagos_calculos import (
    ReporteCobrosPagosDatosInvalidos,
    agregar_pagos,
    validar_filtros,
    validar_rango,
)


def _pago(
    tipo: str,
    estado: str,
    monto: str,
    medio: str = "MP-0001",
) -> dict:
    return {
        "tipo_pago": tipo,
        "estado": estado,
        "monto": Decimal(monto),
        "id_medio_pago": medio,
        "medio_pago": f"Medio {medio}",
    }


def test_agrupacion_separa_cobros_pagos_y_estados() -> None:
    filas = [
        _pago("cobro", "aprobado", "100.00"),
        _pago("cobro", "pendiente", "20.00"),
        _pago("cobro", "rechazado", "5.00", "MP-0002"),
        _pago("pago", "aprobado", "30.00", "MP-0002"),
        _pago("pago", "pendiente", "10.00", "MP-0002"),
    ]

    totales, por_estado, por_medio = agregar_pagos(filas)

    assert totales["cobros_aprobados"] == Decimal("100.00")
    # Los cobros pendientes/rechazados no tienen workflow y no se contabilizan.
    assert "cobros_pendientes" not in totales
    assert "cobros_rechazados" not in totales
    assert totales["pagos_aprobados"] == Decimal("30.00")
    assert totales["pagos_pendientes"] == Decimal("10.00")
    assert totales["pagos_rechazados"] == Decimal("0.00")
    # Los "realizados" no incluyen pendientes ni rechazados.
    assert totales["cobros_realizados"] == Decimal("100.00")
    assert totales["pagos_realizados"] == Decimal("30.00")
    assert totales["neto_realizado"] == Decimal("70.00")

    assert por_estado[0]["estado"] == "aprobado"
    assert por_estado[0]["cobros"] == {"monto": Decimal("100.00"), "cantidad": 1}
    assert por_estado[0]["pagos"] == {"monto": Decimal("30.00"), "cantidad": 1}
    assert por_estado[1]["cobros"]["cantidad"] == 0
    assert por_estado[1]["pagos"]["cantidad"] == 1
    assert por_estado[2]["cobros"]["monto"] == Decimal("0.00")
    assert por_estado[2]["pagos"]["cantidad"] == 0

    assert por_medio == [
        {
            "id_medio_pago": "MP-0001",
            "medio_pago": "Medio MP-0001",
            "cobros_aprobados": Decimal("100.00"),
            "pagos_aprobados": Decimal("0.00"),
            "total_aprobado": Decimal("100.00"),
        },
        {
            "id_medio_pago": "MP-0002",
            "medio_pago": "Medio MP-0002",
            "cobros_aprobados": Decimal("0.00"),
            "pagos_aprobados": Decimal("30.00"),
            "total_aprobado": Decimal("30.00"),
        },
    ]


def test_agrupacion_redondea_con_half_up() -> None:
    totales, _, _ = agregar_pagos([_pago("cobro", "aprobado", "10.005")])
    assert totales["cobros_aprobados"] == Decimal("10.01")


def test_agrupacion_sin_filas_devuelve_ceros_y_listas_vacias() -> None:
    totales, por_estado, por_medio = agregar_pagos([])
    assert totales["neto_realizado"] == Decimal("0.00")
    assert len(por_estado) == 3
    assert por_medio == []


def test_validar_rango_rechaza_faltantes_e_invertido() -> None:
    with pytest.raises(ReporteCobrosPagosDatosInvalidos):
        validar_rango(None, date(2026, 11, 30))
    with pytest.raises(ReporteCobrosPagosDatosInvalidos):
        validar_rango(date(2026, 11, 30), None)
    with pytest.raises(ReporteCobrosPagosDatosInvalidos):
        validar_rango(date(2026, 11, 30), date(2026, 11, 1))

    assert validar_rango(date(2026, 11, 1), date(2026, 11, 30)) == (
        date(2026, 11, 1),
        date(2026, 11, 30),
    )


def test_validar_filtros_rechaza_cliente_y_proveedor_juntos() -> None:
    with pytest.raises(ReporteCobrosPagosDatosInvalidos):
        validar_filtros(
            date(2026, 11, 1),
            date(2026, 11, 30),
            "CLI-0001",
            "PRV-0001",
        )

    assert validar_filtros(
        date(2026, 11, 1), date(2026, 11, 30), "CLI-0001", None
    ) == (date(2026, 11, 1), date(2026, 11, 30))
