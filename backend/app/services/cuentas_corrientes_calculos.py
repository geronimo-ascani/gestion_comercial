"""Cálculos puros de cuentas corrientes, sin acceso a base de datos.

La fuente son comprobantes/facturas y pagos aprobados. Los pagos pendientes
y rechazados nunca llegan a estas funciones, por lo que no afectan saldos.
"""

from collections.abc import Mapping, Sequence
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

_CENTAVOS = Decimal("0.01")


class CuentasCorrientesDatosInvalidos(Exception):
    """Parámetros o movimientos fuera de rango."""


def _dinero(valor: Any) -> Decimal:
    return Decimal(str(valor or 0)).quantize(
        _CENTAVOS, rounding=ROUND_HALF_UP
    )


def _fecha(valor: Any) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    if isinstance(valor, str):
        return date.fromisoformat(valor[:10])
    raise CuentasCorrientesDatosInvalidos("Fecha de movimiento inválida")


def validar_rango(desde: date | None, hasta: date | None) -> tuple[date, date]:
    if desde is None or hasta is None:
        raise CuentasCorrientesDatosInvalidos(
            "'desde' y 'hasta' deben enviarse juntos"
        )
    if hasta < desde:
        raise CuentasCorrientesDatosInvalidos(
            "'desde' no puede ser posterior a 'hasta'"
        )
    return desde, hasta


def resolver_rango(
    desde: date | None, hasta: date | None
) -> tuple[date, date]:
    """Aplica valores por defecto del mes corriente y valida el resultado."""
    hoy = date.today()
    return validar_rango(
        desde or hoy.replace(day=1),
        hasta or hoy,
    )


def _movimiento(fila: Mapping[str, Any]) -> dict[str, Any]:
    signo = int(fila["signo"])
    if signo not in (-1, 1):
        raise CuentasCorrientesDatosInvalidos("Signo de movimiento inválido")
    return {
        "id_movimiento": str(fila["id_movimiento"]),
        "entidad_id": str(fila["entidad_id"]),
        "tipo_movimiento": fila["tipo_movimiento"],
        "id_origen": str(fila["id_origen"]),
        "numero": fila.get("numero"),
        "fecha": _fecha(fila["fecha"]),
        "descripcion": str(fila.get("descripcion") or ""),
        "monto": _dinero(fila["monto"]),
        "signo": signo,
        "id_medio_pago": fila.get("id_medio_pago"),
        "medio_pago": fila.get("medio_pago"),
    }


def _orden(movimiento: Mapping[str, Any]) -> tuple[Any, ...]:
    # Documentos antes que pagos cuando comparten fecha; el ID desempata.
    return (
        movimiento["fecha"],
        0 if movimiento["signo"] == 1 else 1,
        str(movimiento["id_origen"]),
        str(movimiento["id_movimiento"]),
    )


_MOVIMIENTO_PUBLICO = (
    "id_movimiento",
    "tipo_movimiento",
    "id_origen",
    "numero",
    "fecha",
    "descripcion",
    "monto",
    "signo",
    "id_medio_pago",
    "medio_pago",
)


def construir_resumenes(
    entidades: Sequence[Mapping[str, Any]],
    movimientos: Sequence[Mapping[str, Any]],
    desde: date,
    hasta: date,
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, Any]]]]:
    """Devuelve resúmenes por entidad y movimientos del periodo.

    ``saldo_inicial`` se calcula con todo lo anterior a ``desde``; por eso el
    filtro de fechas no elimina deuda histórica. Los importes del periodo son
    los únicos que cuentan en ``total_cargo`` y ``total_abono``.
    """
    desde, hasta = validar_rango(desde, hasta)
    ids = {str(entidad["id"]) for entidad in entidades}
    filas = [
        _movimiento(fila)
        for fila in movimientos
        if str(fila["entidad_id"]) in ids and _fecha(fila["fecha"]) <= hasta
    ]
    iniciales = sorted(
        (fila for fila in filas if fila["fecha"] < desde), key=_orden
    )
    del_periodo = sorted(
        (fila for fila in filas if fila["fecha"] >= desde), key=_orden
    )

    saldos_iniciales: dict[str, Decimal] = {}
    for fila in iniciales:
        id_entidad = fila["entidad_id"]
        saldos_iniciales[id_entidad] = saldos_iniciales.get(
            id_entidad, Decimal("0.00")
        ) + fila["signo"] * fila["monto"]

    por_entidad: dict[str, list[dict[str, Any]]] = {}
    for fila in del_periodo:
        por_entidad.setdefault(fila["entidad_id"], []).append(fila)

    resumenes: list[dict[str, Any]] = []
    movimientos_publicos: dict[str, list[dict[str, Any]]] = {}
    for entidad in entidades:
        id_entidad = str(entidad["id"])
        saldo = _dinero(saldos_iniciales.get(id_entidad, Decimal("0.00")))
        cargo = Decimal("0.00")
        abono = Decimal("0.00")
        cantidad_documentos = 0
        cantidad_pagos = 0
        publicados: list[dict[str, Any]] = []

        for fila in por_entidad.get(id_entidad, []):
            saldo = _dinero(saldo + fila["signo"] * fila["monto"])
            if fila["signo"] == 1:
                cargo += fila["monto"]
                cantidad_documentos += 1
            else:
                abono += fila["monto"]
                cantidad_pagos += 1
            publicado = {
                clave: fila[clave] for clave in _MOVIMIENTO_PUBLICO
            }
            publicado["saldo_resultante"] = saldo
            publicados.append(publicado)

        fechas = [
            fila["fecha"]
            for fila in filas
            if fila["entidad_id"] == id_entidad
        ]
        resumenes.append(
            {
                "id": id_entidad,
                "nombre": str(entidad["nombre"]),
                "documento": str(entidad.get("documento") or ""),
                "apellido": str(entidad.get("apellido") or ""),
                "saldo_inicial": _dinero(saldos_iniciales.get(id_entidad, 0)),
                "total_cargo": _dinero(cargo),
                "total_abono": _dinero(abono),
                "saldo_final": saldo,
                "cantidad_documentos": cantidad_documentos,
                "cantidad_pagos": cantidad_pagos,
                "ultima_actividad": max(fechas) if fechas else None,
            }
        )
        movimientos_publicos[id_entidad] = publicados

    return resumenes, movimientos_publicos


def totalizar(resumenes: Sequence[Mapping[str, Any]]) -> dict[str, Any]:
    campos = ("saldo_inicial", "total_cargo", "total_abono", "saldo_final")
    totales = {campo: Decimal("0.00") for campo in campos}
    for resumen in resumenes:
        for campo in campos:
            totales[campo] += _dinero(resumen[campo])
    totales = {campo: _dinero(valor) for campo, valor in totales.items()}
    totales["cantidad_operaciones"] = sum(
        int(resumen["cantidad_documentos"]) + int(resumen["cantidad_pagos"])
        for resumen in resumenes
    )
    totales["cantidad_entidades"] = len(resumenes)
    return totales


def saldos_por_entidad(
    movimientos: Sequence[Mapping[str, Any]],
) -> dict[str, Decimal]:
    """Saldo histórico por entidad, para los listados de clientes/proveedores."""
    saldos: dict[str, Decimal] = {}
    for fila in movimientos:
        movimiento = _movimiento(fila)
        id_entidad = movimiento["entidad_id"]
        saldos[id_entidad] = _dinero(
            saldos.get(id_entidad, Decimal("0.00"))
            + movimiento["signo"] * movimiento["monto"]
        )
    return saldos
