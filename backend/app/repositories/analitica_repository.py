from datetime import date
from decimal import Decimal
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

ZONA_HORARIA = "America/Argentina/Buenos_Aires"

_FECHA_VENTA = (
    f"(pv.fecha_emision AT TIME ZONE '{ZONA_HORARIA}')::date"
)
_FECHA_HORA_VENTA = (
    f"(pv.fecha_emision AT TIME ZONE '{ZONA_HORARIA}')"
)

_SELECT_VENTAS = f"""
SELECT pv.id_pedido_cliente,
       {_FECHA_HORA_VENTA} AS fecha_hora,
       pv.total,
       pv.estado_envio AS estado,
       pv.id_cliente,
       c.nombre || ' ' || c.apellido AS cliente_nombre
FROM pedido_cliente pv
JOIN cliente c ON c.id_cliente = pv.id_cliente
WHERE pv.id_empresa = %s
  AND {_FECHA_VENTA} BETWEEN %s AND %s
ORDER BY pv.fecha_emision
"""

_SELECT_ITEMS_VENTA = f"""
SELECT d.id_pedido_cliente,
       d.id_producto,
       p.nombre,
       p.id_categoria,
       cat.nombre AS nombre_categoria,
       d.cantidad,
       d.neto,
       d.subtotal,
       d.costo_unitario
FROM detalle_pedido_cliente d
JOIN producto p ON p.id_producto = d.id_producto
JOIN categoria cat ON cat.id_categoria = p.id_categoria
WHERE d.id_pedido_cliente = ANY(%s)
"""

_SELECT_PRIMERAS_COMPRAS = f"""
SELECT pv.id_cliente,
       MIN({_FECHA_VENTA}) AS primera_compra
FROM pedido_cliente pv
WHERE pv.id_empresa = %s
  AND pv.estado_envio <> 'cancelado'
GROUP BY pv.id_cliente
"""

_SELECT_COMPRAS = """
SELECT pp.id_pedido_proveedor,
       pp.estado,
       pp.fecha_pedido AS fecha,
       pp.fecha_recepcion,
       pp.total,
       pp.id_proveedor,
       pr.razon_social AS proveedor_nombre
FROM pedido_proveedor pp
JOIN proveedor pr ON pr.id_proveedor = pp.id_proveedor
WHERE {filtro}
  AND pp.id_empresa = %s
ORDER BY pp.fecha_pedido
"""

_SELECT_ITEMS_COMPRA = """
SELECT d.id_pedido_proveedor,
       d.id_producto,
       p.nombre,
       d.cantidad,
       d.precio_unitario,
       d.subtotal
FROM detalle_pedido_proveedor d
JOIN producto p ON p.id_producto = d.id_producto
WHERE d.id_pedido_proveedor = ANY(%s)
"""

_SELECT_INVENTARIO = """
SELECT p.id_producto,
       p.nombre,
       p.stock_actual AS stock,
       p.precio_compra AS costo_unitario
FROM producto p
WHERE p.id_empresa = %s
  AND p.estado = TRUE
  AND p.stock_actual > 0
ORDER BY p.nombre
"""

_SELECT_ULTIMA_VENTA = f"""
SELECT d.id_producto,
       MAX({_FECHA_VENTA}) AS ultima_venta
FROM detalle_pedido_cliente d
JOIN pedido_cliente pv ON pv.id_pedido_cliente = d.id_pedido_cliente
WHERE pv.id_empresa = %s
  AND pv.estado_envio <> 'cancelado'
GROUP BY d.id_producto
"""

_SELECT_PAGOS = """
SELECT pg.id_medio_pago,
       mp.medio_pago,
       pg.monto,
       pg.estado
FROM pago pg
JOIN medio_pago mp ON mp.id_medio_pago = pg.id_medio_pago
WHERE pg.id_empresa = %s
  AND pg.fecha_pago BETWEEN %s AND %s
"""

_SELECT_DEMANDA = f"""
SELECT d.id_producto,
       p.nombre,
       DATE_TRUNC('month', {_FECHA_VENTA})::date AS mes,
       SUM(d.cantidad) AS cantidad
FROM detalle_pedido_cliente d
JOIN pedido_cliente pv ON pv.id_pedido_cliente = d.id_pedido_cliente
JOIN producto p ON p.id_producto = d.id_producto
WHERE pv.id_empresa = %s
  AND pv.estado_envio <> 'cancelado'
  AND {_FECHA_VENTA} BETWEEN %s AND %s
GROUP BY d.id_producto, p.nombre, mes
"""

_SELECT_TOTALES_VENTAS = f"""
SELECT COALESCE(SUM(pv.total), 0) AS ventas
FROM pedido_cliente pv
WHERE pv.id_empresa = %s
  AND pv.estado_envio <> 'cancelado'
  AND {_FECHA_VENTA} BETWEEN %s AND %s
"""

_SELECT_TOTALES_GASTOS = """
SELECT COALESCE(SUM(pp.total), 0) AS gastos
FROM pedido_proveedor pp
WHERE pp.id_empresa = %s
  AND pp.estado = 'recibida'
  AND pp.fecha_recepcion BETWEEN %s AND %s
"""


class AnaliticaRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def _items_por_pedido(
        self, consulta: str, ids: list[str]
    ) -> dict[str, list[dict[str, Any]]]:
        if not ids:
            return {}
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(consulta, (ids,))
            filas = cur.fetchall()

        agrupados: dict[str, list[dict[str, Any]]] = {}
        for fila in filas:
            id_pedido = fila.pop("id_pedido_cliente", None) or fila.pop(
                "id_pedido_proveedor", None
            )
            agrupados.setdefault(id_pedido, []).append(fila)
        return agrupados

    def listar_ventas(
        self, desde: date, hasta: date
    ) -> list[dict[str, Any]]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT_VENTAS, (self._id_empresa, desde, hasta))
            pedidos = cur.fetchall()

        ids = [pedido["id_pedido_cliente"] for pedido in pedidos]
        items = self._items_por_pedido(_SELECT_ITEMS_VENTA, ids)

        return [
            {
                "id_pedido": pedido["id_pedido_cliente"],
                "fecha_hora": pedido["fecha_hora"],
                "id_cliente": pedido["id_cliente"],
                "cliente_nombre": pedido["cliente_nombre"],
                "total": pedido["total"],
                "estado": pedido["estado"],
                "items": items.get(pedido["id_pedido_cliente"], []),
            }
            for pedido in pedidos
        ]

    def listar_primeras_compras(self) -> dict[str, date]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT_PRIMERAS_COMPRAS, (self._id_empresa,))
            filas = cur.fetchall()
        return {
            fila["id_cliente"]: fila["primera_compra"] for fila in filas
        }

    def listar_compras(
        self, desde: date, hasta: date, *, por_recepcion: bool = False
    ) -> list[dict[str, Any]]:
        columna = "pp.fecha_recepcion" if por_recepcion else "pp.fecha_pedido"
        consulta = _SELECT_COMPRAS.format(
            filtro=f"{columna} BETWEEN %s AND %s"
        )
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(consulta, (desde, hasta, self._id_empresa))
            pedidos = cur.fetchall()

        ids = [pedido["id_pedido_proveedor"] for pedido in pedidos]
        items = self._items_por_pedido(_SELECT_ITEMS_COMPRA, ids)

        return [
            {
                "id_pedido": pedido["id_pedido_proveedor"],
                "fecha": pedido["fecha"],
                "fecha_recepcion": pedido["fecha_recepcion"],
                "id_proveedor": pedido["id_proveedor"],
                "proveedor_nombre": pedido["proveedor_nombre"],
                "total": pedido["total"],
                "estado": pedido["estado"],
                "items": items.get(pedido["id_pedido_proveedor"], []),
            }
            for pedido in pedidos
        ]

    def listar_inventario(self) -> list[dict[str, Any]]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT_INVENTARIO, (self._id_empresa,))
            return cur.fetchall()

    def listar_ultima_venta(self) -> dict[str, date]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT_ULTIMA_VENTA, (self._id_empresa,))
            filas = cur.fetchall()
        return {
            fila["id_producto"]: fila["ultima_venta"] for fila in filas
        }

    def listar_pagos(
        self, desde: date, hasta: date
    ) -> list[dict[str, Any]]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT_PAGOS, (self._id_empresa, desde, hasta))
            return cur.fetchall()

    def listar_historial_demanda(
        self, desde: date, hasta: date
    ) -> list[dict[str, Any]]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_SELECT_DEMANDA, (self._id_empresa, desde, hasta))
            return cur.fetchall()

    def totales(self, desde: date, hasta: date) -> dict[str, Decimal]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                _SELECT_TOTALES_VENTAS, (self._id_empresa, desde, hasta)
            )
            ventas = cur.fetchone()
            cur.execute(
                _SELECT_TOTALES_GASTOS, (self._id_empresa, desde, hasta)
            )
            gastos = cur.fetchone()
        return {
            "ventas": ventas["ventas"] if ventas else Decimal("0"),
            "gastos": gastos["gastos"] if gastos else Decimal("0"),
        }
