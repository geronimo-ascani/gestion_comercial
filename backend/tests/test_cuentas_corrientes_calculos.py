from datetime import date
from decimal import Decimal

import pytest

from app.services.cuentas_corrientes_calculos import (
    CuentasCorrientesDatosInvalidos,
    construir_resumenes,
    resolver_rango,
    saldos_por_entidad,
    totalizar,
    validar_rango,
)

_ENTIDADES = [
    {"id": "CLI-0001", "nombre": "Ana", "apellido": "Pérez", "documento": "30111111"},
    {"id": "CLI-0002", "nombre": "Luis", "apellido": "Gómez", "documento": "30222222"},
]


def _movimiento(
    entidad: str,
    fecha: str,
    signo: int,
    monto: str,
    tipo: str = "comprobante",
    origen: str = "MOV-0001",
) -> dict:
    return {
        "id_movimiento": f"{tipo}-{origen}",
        "entidad_id": entidad,
        "tipo_movimiento": tipo,
        "id_origen": origen,
        "numero": "0001-00000001" if tipo == "comprobante" else None,
        "fecha": date.fromisoformat(fecha),
        "descripcion": "Movimiento de prueba",
        "monto": Decimal(monto),
        "signo": signo,
        "id_medio_pago": "MP-0001" if tipo == "pago" else None,
        "medio_pago": "Efectivo" if tipo == "pago" else None,
    }


def _movimientos() -> list[dict]:
    return [
        _movimiento("CLI-0001", "2026-10-20", 1, "100.00", origen="CV-1"),
        _movimiento("CLI-0001", "2026-10-25", -1, "40.00", "pago", "PG-1"),
        _movimiento("CLI-0001", "2026-11-05", 1, "50.00", origen="CV-2"),
        _movimiento("CLI-0001", "2026-11-10", -1, "20.00", "pago", "PG-2"),
        _movimiento("CLI-0002", "2026-10-28", 1, "30.00", origen="CV-3"),
        _movimiento("CLI-0001", "2026-12-01", 1, "999.00", origen="CV-4"),
    ]


def test_saldo_inicial_no_se_pierde_con_el_filtro_de_fechas() -> None:
    resumenes, movimientos = construir_resumenes(
        _ENTIDADES,
        _movimientos(),
        date(2026, 11, 1),
        date(2026, 11, 30),
    )

    primero = resumenes[0]
    assert primero["id"] == "CLI-0001"
    assert primero["saldo_inicial"] == Decimal("60.00")
    assert primero["total_cargo"] == Decimal("50.00")
    assert primero["total_abono"] == Decimal("20.00")
    assert primero["saldo_final"] == Decimal("90.00")
    assert primero["cantidad_documentos"] == 1
    assert primero["cantidad_pagos"] == 1
    assert primero["ultima_actividad"] == date(2026, 11, 10)

    assert [item["saldo_resultante"] for item in movimientos["CLI-0001"]] == [
        Decimal("110.00"),
        Decimal("90.00"),
    ]
    assert movimientos["CLI-0001"][1]["medio_pago"] == "Efectivo"

    segundo = resumenes[1]
    assert segundo["saldo_inicial"] == Decimal("30.00")
    assert segundo["saldo_final"] == Decimal("30.00")
    assert segundo["cantidad_documentos"] == 0


def test_totales_agregan_saldos_y_operaciones_del_periodo() -> None:
    resumenes, _ = construir_resumenes(
        _ENTIDADES,
        _movimientos(),
        date(2026, 11, 1),
        date(2026, 11, 30),
    )

    assert totalizar(resumenes) == {
        "saldo_inicial": Decimal("90.00"),
        "total_cargo": Decimal("50.00"),
        "total_abono": Decimal("20.00"),
        "saldo_final": Decimal("120.00"),
        "cantidad_operaciones": 2,
        "cantidad_entidades": 2,
    }


def test_saldos_historicos_ignoran_entidades_sin_movimientos() -> None:
    movimientos = [
        fila
        for fila in _movimientos()
        if fila["fecha"] <= date(2026, 11, 30)
    ]
    saldos = saldos_por_entidad(movimientos)

    assert saldos == {
        "CLI-0001": Decimal("90.00"),
        "CLI-0002": Decimal("30.00"),
    }


def test_rangos_invalidos_y_valores_por_defecto() -> None:
    with pytest.raises(CuentasCorrientesDatosInvalidos):
        validar_rango(None, date(2026, 11, 30))
    with pytest.raises(CuentasCorrientesDatosInvalidos):
        validar_rango(date(2026, 11, 30), date(2026, 11, 1))

    desde, hasta = resolver_rango(date(2026, 11, 1), None)
    assert desde == date(2026, 11, 1)
    assert hasta >= desde
