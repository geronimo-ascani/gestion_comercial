"""Cálculos puros del reporte RF-20, sin acceso a base de datos."""

from collections.abc import Mapping, Sequence
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

_CENTAVOS = Decimal("0.01")
ESTADOS = ("aprobado", "pendiente", "rechazado")
ESTADOS_CLAVE = {
    "aprobado": "aprobados",
    "pendiente": "pendientes",
    "rechazado": "rechazados",
}
TIPOS = {"cobro": "cobros", "pago": "pagos"}


class ReporteCobrosPagosDatosInvalidos(Exception):
    """Parámetros del reporte fuera de rango."""


def validar_rango(desde: date | None, hasta: date | None) -> tuple[date, date]:
    if desde is None or hasta is None:
        raise ReporteCobrosPagosDatosInvalidos(
            "'desde' y 'hasta' deben enviarse juntos"
        )
    if hasta < desde:
        raise ReporteCobrosPagosDatosInvalidos(
            "'desde' no puede ser posterior a 'hasta'"
        )
    return desde, hasta


def _dinero(valor: Any) -> Decimal:
    return Decimal(str(valor or 0)).quantize(
        _CENTAVOS, rounding=ROUND_HALF_UP
    )


def agregar_pagos(
    filas: Sequence[Mapping[str, Any]],
) -> tuple[dict[str, Decimal], list[dict[str, Any]], list[dict[str, Any]]]:
    """Agrupa pagos por estado y medio de pago.

    Los importes "realizados" incluyen únicamente pagos aprobados: los
    pendientes reservan saldo y los rechazados no afectan balances.
    """
    totales = {
        f"{clave}_{ESTADOS_CLAVE[estado]}": Decimal("0.00")
        for clave in TIPOS.values()
        for estado in ESTADOS
    }
    por_estado = {
        estado: {
            "cobros": {"monto": Decimal("0.00"), "cantidad": 0},
            "pagos": {"monto": Decimal("0.00"), "cantidad": 0},
        }
        for estado in ESTADOS
    }
    por_medio: dict[str, dict[str, Any]] = {}

    for fila in filas:
        estado = fila["estado"]
        tipo = fila["tipo_pago"]
        if estado not in ESTADOS or tipo not in TIPOS:
            continue
        monto = _dinero(fila["monto"])
        clave_tipo = TIPOS[tipo]

        totales[f"{clave_tipo}_{ESTADOS_CLAVE[estado]}"] += monto
        grupo = por_estado[estado][clave_tipo]
        grupo["monto"] += monto
        grupo["cantidad"] += 1

        if estado == "aprobado":
            id_medio = fila["id_medio_pago"]
            medio = por_medio.setdefault(
                id_medio,
                {
                    "id_medio_pago": id_medio,
                    "medio_pago": fila.get("medio_pago") or id_medio,
                    "cobros_aprobados": Decimal("0.00"),
                    "pagos_aprobados": Decimal("0.00"),
                },
            )
            medio[f"{clave_tipo}_aprobados"] += monto

    totales["cobros_realizados"] = totales["cobros_aprobados"]
    totales["pagos_realizados"] = totales["pagos_aprobados"]
    totales["neto_realizado"] = (
        totales["cobros_realizados"] - totales["pagos_realizados"]
    )
    totales = {clave: _dinero(valor) for clave, valor in totales.items()}

    estados = [
        {
            "estado": estado,
            "cobros": {
                "monto": _dinero(por_estado[estado]["cobros"]["monto"]),
                "cantidad": por_estado[estado]["cobros"]["cantidad"],
            },
            "pagos": {
                "monto": _dinero(por_estado[estado]["pagos"]["monto"]),
                "cantidad": por_estado[estado]["pagos"]["cantidad"],
            },
        }
        for estado in ESTADOS
    ]

    medios = []
    for medio in por_medio.values():
        medio["cobros_aprobados"] = _dinero(medio["cobros_aprobados"])
        medio["pagos_aprobados"] = _dinero(medio["pagos_aprobados"])
        medio["total_aprobado"] = _dinero(
            medio["cobros_aprobados"] + medio["pagos_aprobados"]
        )
        medios.append(medio)
    medios.sort(key=lambda medio: (-medio["total_aprobado"], medio["medio_pago"]))

    return totales, estados, medios
