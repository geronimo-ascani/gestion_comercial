from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

PedidoCompraRow = dict[str, Any]

_SELECT_PEDIDO = """
SELECT pp.id_pedido_proveedor,
       pp.estado,
       pp.fecha_pedido,
       pp.fecha_recepcion,
       pp.total,
       pp.id_empleado,
       pp.id_medio_pago,
       mp.medio_pago,
       pp.id_proveedor,
       pr.razon_social AS proveedor_nombre
FROM pedido_proveedor pp
JOIN medio_pago mp ON mp.id_medio_pago = pp.id_medio_pago
JOIN proveedor pr ON pr.id_proveedor = pp.id_proveedor
"""

_SELECT_ITEMS = """
SELECT d.id_pedido_proveedor,
       d.id_producto,
       p.nombre AS producto_nombre,
       d.cantidad,
       d.precio_unitario,
       d.subtotal
FROM detalle_pedido_proveedor d
JOIN producto p ON p.id_producto = d.id_producto
"""


class PedidoCompraRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def proveedor_existe(self, id_proveedor: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM proveedor WHERE id_proveedor = %s)",
                (id_proveedor,),
            )
            row = cur.fetchone()
            return bool(row and row["exists"])

    def medio_pago_existe(self, id_medio_pago: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM medio_pago WHERE id_medio_pago = %s)",
                (id_medio_pago,),
            )
            row = cur.fetchone()
            return bool(row and row["exists"])

    def crear(
        self,
        id_proveedor: str,
        id_medio_pago: str,
        id_empleado: str,
        total: Any,
    ) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO pedido_proveedor (
                    estado, fecha_pedido, total, id_empleado,
                    id_medio_pago, id_proveedor
                )
                VALUES ('pendiente', CURRENT_DATE, %s, %s, %s, %s)
                RETURNING id_pedido_proveedor
                """,
                (total, id_empleado, id_medio_pago, id_proveedor),
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_pedido_proveedor"]

    def crear_items(
        self,
        id_pedido_proveedor: str,
        items: list[dict[str, Any]],
    ) -> None:
        with self._conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO detalle_pedido_proveedor (
                    id_pedido_proveedor, id_producto, cantidad,
                    precio_unitario, subtotal
                )
                VALUES (
                    %(id_pedido_proveedor)s, %(id_producto)s, %(cantidad)s,
                    %(precio_unitario)s, %(subtotal)s
                )
                """,
                [
                    {**item, "id_pedido_proveedor": id_pedido_proveedor}
                    for item in items
                ],
            )

    def obtener(
        self, id_pedido_proveedor: str, bloquear: bool = False
    ) -> PedidoCompraRow | None:
        query = f"{_SELECT_PEDIDO} WHERE pp.id_pedido_proveedor = %s"
        if bloquear:
            query += " FOR UPDATE OF pp"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_pedido_proveedor,))
            pedido = cur.fetchone()
        if pedido is None:
            return None

        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_ITEMS} WHERE d.id_pedido_proveedor = %s "
                "ORDER BY d.id_producto",
                (id_pedido_proveedor,),
            )
            pedido["items"] = cur.fetchall()
        return pedido

    def listar(
        self,
        estado: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[PedidoCompraRow]:
        pattern = f"%{q.strip()}%" if q and q.strip() else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PEDIDO}
                WHERE (%(estado)s::text IS NULL OR pp.estado = %(estado)s)
                  AND (
                      %(q)s::text IS NULL
                      OR pp.id_pedido_proveedor ILIKE %(q)s
                      OR pr.razon_social ILIKE %(q)s
                      OR pr.cuit ILIKE %(q)s
                  )
                ORDER BY pp.fecha_pedido DESC, pp.id_pedido_proveedor DESC
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "estado": estado,
                    "q": pattern,
                    "limit": limit,
                    "offset": offset,
                },
            )
            pedidos = cur.fetchall()

        if not pedidos:
            return []
        ids = [pedido["id_pedido_proveedor"] for pedido in pedidos]
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_ITEMS} WHERE d.id_pedido_proveedor = ANY(%s) "
                "ORDER BY d.id_pedido_proveedor, d.id_producto",
                (ids,),
            )
            items = cur.fetchall()
        items_por_pedido: dict[str, list[dict[str, Any]]] = {
            id_pedido: [] for id_pedido in ids
        }
        for item in items:
            items_por_pedido[item["id_pedido_proveedor"]].append(item)
        for pedido in pedidos:
            pedido["items"] = items_por_pedido[pedido["id_pedido_proveedor"]]
        return pedidos

    def marcar_recibida(self, id_pedido_proveedor: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pedido_proveedor
                SET estado = 'recibida', fecha_recepcion = CURRENT_DATE
                WHERE id_pedido_proveedor = %s
                  AND estado IN ('pendiente', 'aprobada')
                RETURNING id_pedido_proveedor
                """,
                (id_pedido_proveedor,),
            )
            return cur.fetchone() is not None

    def marcar_cancelada(self, id_pedido_proveedor: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pedido_proveedor
                SET estado = 'cancelada'
                WHERE id_pedido_proveedor = %s
                  AND estado IN ('pendiente', 'aprobada')
                RETURNING id_pedido_proveedor
                """,
                (id_pedido_proveedor,),
            )
            return cur.fetchone() is not None
