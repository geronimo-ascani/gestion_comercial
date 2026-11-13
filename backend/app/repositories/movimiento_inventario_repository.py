from datetime import datetime
from decimal import Decimal
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

MovimientoRow = dict[str, Any]


class MovimientoInventarioRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def crear_ajuste(
        self, id_producto: str, tipo: str, cantidad: Decimal
    ) -> MovimientoRow:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH movimiento AS (
                    INSERT INTO movimiento_inventario (
                        cantidad, fecha_movimiento, motivo, tipo,
                        id_pedido_cliente, id_pedido_proveedor, id_producto
                    )
                    VALUES (
                        %(cantidad)s, now(), 'ajuste', %(tipo)s::tipo_movimiento,
                        NULL, NULL, %(id_producto)s
                    )
                    RETURNING id_movimiento, cantidad, fecha_movimiento, motivo, tipo,
                              id_pedido_cliente, id_pedido_proveedor, id_producto
                )
                SELECT
                    m.id_movimiento,
                    m.cantidad,
                    m.fecha_movimiento,
                    m.motivo,
                    m.tipo,
                    m.id_pedido_cliente,
                    m.id_pedido_proveedor,
                    m.id_producto,
                    p.nombre AS producto_nombre
                FROM movimiento m
                JOIN producto p ON p.id_producto = m.id_producto
                """,
                {
                    "cantidad": cantidad,
                    "tipo": tipo,
                    "id_producto": id_producto,
                },
            )
            fila = cur.fetchone()
            assert fila is not None
            return fila

    def crear_compra(
        self,
        id_pedido_proveedor: str,
        id_producto: str,
        cantidad: Decimal,
    ) -> MovimientoRow:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH movimiento AS (
                    INSERT INTO movimiento_inventario (
                        cantidad, fecha_movimiento, motivo, tipo,
                        id_pedido_cliente, id_pedido_proveedor, id_producto
                    )
                    VALUES (
                        %(cantidad)s, now(), 'compra', 'entrada',
                        NULL, %(id_pedido_proveedor)s, %(id_producto)s
                    )
                    RETURNING id_movimiento, cantidad, fecha_movimiento, motivo, tipo,
                              id_pedido_cliente, id_pedido_proveedor, id_producto
                )
                SELECT m.id_movimiento, m.cantidad, m.fecha_movimiento, m.motivo,
                       m.tipo, m.id_pedido_cliente, m.id_pedido_proveedor,
                       m.id_producto, p.nombre AS producto_nombre
                FROM movimiento m
                JOIN producto p ON p.id_producto = m.id_producto
                """,
                {
                    "cantidad": cantidad,
                    "id_pedido_proveedor": id_pedido_proveedor,
                    "id_producto": id_producto,
                },
            )
            movimiento = cur.fetchone()
            assert movimiento is not None
            return movimiento

    def crear_venta(
        self,
        id_pedido_cliente: str,
        id_producto: str,
        cantidad: Decimal,
    ) -> MovimientoRow:
        return self._crear_movimiento_pedido_venta(
            id_pedido_cliente, id_producto, cantidad, "salida", "venta"
        )

    def crear_devolucion(
        self,
        id_pedido_cliente: str,
        id_producto: str,
        cantidad: Decimal,
    ) -> MovimientoRow:
        return self._crear_movimiento_pedido_venta(
            id_pedido_cliente, id_producto, cantidad, "entrada", "devolucion"
        )

    def _crear_movimiento_pedido_venta(
        self,
        id_pedido_cliente: str,
        id_producto: str,
        cantidad: Decimal,
        tipo: str,
        motivo: str,
    ) -> MovimientoRow:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                WITH movimiento AS (
                    INSERT INTO movimiento_inventario (
                        cantidad, fecha_movimiento, motivo, tipo,
                        id_pedido_cliente, id_pedido_proveedor, id_producto
                    )
                    VALUES (
                        %(cantidad)s, now(), %(motivo)s::motivo_movimiento,
                        %(tipo)s::tipo_movimiento, %(id_pedido_cliente)s,
                        NULL, %(id_producto)s
                    )
                    RETURNING id_movimiento, cantidad, fecha_movimiento, motivo, tipo,
                              id_pedido_cliente, id_pedido_proveedor, id_producto
                )
                SELECT m.id_movimiento, m.cantidad, m.fecha_movimiento, m.motivo,
                       m.tipo, m.id_pedido_cliente, m.id_pedido_proveedor,
                       m.id_producto, p.nombre AS producto_nombre
                FROM movimiento m
                JOIN producto p ON p.id_producto = m.id_producto
                """,
                {
                    "cantidad": cantidad,
                    "motivo": motivo,
                    "tipo": tipo,
                    "id_pedido_cliente": id_pedido_cliente,
                    "id_producto": id_producto,
                },
            )
            movimiento = cur.fetchone()
            assert movimiento is not None
            return movimiento

    def listar_por_producto(
        self,
        id_producto: str,
        desde: datetime | None,
        hasta: datetime | None,
        tipo: str | None,
        motivo: str | None,
        limit: int,
        offset: int,
    ) -> list[MovimientoRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                    m.id_movimiento,
                    m.cantidad,
                    m.fecha_movimiento,
                    m.motivo,
                    m.tipo,
                    m.id_pedido_cliente,
                    m.id_pedido_proveedor,
                    m.id_producto,
                    p.nombre AS producto_nombre
                FROM movimiento_inventario m
                JOIN producto p ON p.id_producto = m.id_producto
                WHERE m.id_producto = %(id_producto)s
                  AND (%(desde)s::timestamptz IS NULL OR m.fecha_movimiento >= %(desde)s)
                  AND (%(hasta)s::timestamptz IS NULL OR m.fecha_movimiento <= %(hasta)s)
                  AND (%(tipo)s::text IS NULL OR m.tipo = %(tipo)s::tipo_movimiento)
                  AND (%(motivo)s::text IS NULL OR m.motivo = %(motivo)s::motivo_movimiento)
                ORDER BY m.fecha_movimiento DESC
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "id_producto": id_producto,
                    "desde": desde,
                    "hasta": hasta,
                    "tipo": tipo,
                    "motivo": motivo,
                    "limit": limit,
                    "offset": offset,
                },
            )
            return cur.fetchall()
