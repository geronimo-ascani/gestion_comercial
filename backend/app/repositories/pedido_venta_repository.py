from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

PedidoVentaRow = dict[str, Any]

_SELECT_PEDIDO = """
SELECT pv.id_pedido_cliente,
       pv.descuento_compra,
       pv.entrega_altura,
       pv.entrega_calle,
       pv.entrega_cp,
       pv.entrega_depto,
       pv.entrega_localidad,
       pv.entrega_provincia,
       pv.estado_envio,
       pv.fecha_emision,
       pv.fecha_muestra,
       pv.saldo_pendiente,
       pv.total,
       pv.id_cliente,
       c.nombre AS cliente_nombre,
       c.apellido AS cliente_apellido,
       c.email AS cliente_email,
       c.telefono AS cliente_telefono,
       pv.id_presupuesto_cliente
FROM pedido_cliente pv
JOIN cliente c ON c.id_cliente = pv.id_cliente
"""

_SELECT_ITEMS = """
SELECT d.id_pedido_cliente AS _pedido_ref,
       d.id_producto,
       p.nombre AS producto_nombre,
       d.cantidad,
       d.descuento_producto,
       d.iva,
       d.neto,
       d.precio_unitario,
       d.subtotal,
       d.tipo_iva
FROM detalle_pedido_cliente d
JOIN producto p ON p.id_producto = d.id_producto
"""


class PedidoVentaRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def cliente_existe(self, id_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = %s) AS existe",
                (id_cliente,),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def crear(self, datos: dict[str, Any]) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO pedido_cliente (
                    descuento_compra, entrega_altura, entrega_calle, entrega_cp,
                    entrega_depto, entrega_localidad, entrega_provincia,
                    estado_envio, saldo_pendiente, total, id_cliente
                )
                VALUES (
                    %(descuento_compra)s, %(entrega_altura)s, %(entrega_calle)s,
                    %(entrega_cp)s, %(entrega_depto)s, %(entrega_localidad)s,
                    %(entrega_provincia)s, 'pendiente', %(saldo_pendiente)s,
                    %(total)s, %(id_cliente)s
                )
                RETURNING id_pedido_cliente
                """,
                datos,
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_pedido_cliente"]

    def crear_items(
        self,
        id_pedido_cliente: str,
        items: list[dict[str, Any]],
    ) -> None:
        with self._conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO detalle_pedido_cliente (
                    id_pedido_cliente, id_producto, cantidad,
                    descuento_producto, iva, neto, precio_unitario,
                    subtotal, tipo_iva
                )
                VALUES (
                    %(id_pedido_cliente)s, %(id_producto)s, %(cantidad)s,
                    %(descuento_producto)s, %(iva)s, %(neto)s,
                    %(precio_unitario)s, %(subtotal)s, %(tipo_iva)s
                )
                """,
                [
                    {**item, "id_pedido_cliente": id_pedido_cliente}
                    for item in items
                ],
            )

    def reemplazar(
        self,
        id_pedido_cliente: str,
        datos: dict[str, Any],
        items: list[dict[str, Any]],
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pedido_cliente
                SET descuento_compra = %(descuento_compra)s,
                    entrega_altura = %(entrega_altura)s,
                    entrega_calle = %(entrega_calle)s,
                    entrega_cp = %(entrega_cp)s,
                    entrega_depto = %(entrega_depto)s,
                    entrega_localidad = %(entrega_localidad)s,
                    entrega_provincia = %(entrega_provincia)s,
                    saldo_pendiente = %(saldo_pendiente)s,
                    total = %(total)s,
                    id_cliente = %(id_cliente)s
                WHERE id_pedido_cliente = %(id_pedido_cliente)s
                """,
                {**datos, "id_pedido_cliente": id_pedido_cliente},
            )
            cur.execute(
                "DELETE FROM detalle_pedido_cliente WHERE id_pedido_cliente = %s",
                (id_pedido_cliente,),
            )
        self.crear_items(id_pedido_cliente, items)

    def obtener(
        self, id_pedido_cliente: str, bloquear: bool = False
    ) -> PedidoVentaRow | None:
        query = f"{_SELECT_PEDIDO} WHERE pv.id_pedido_cliente = %s"
        if bloquear:
            query += " FOR UPDATE OF pv"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_pedido_cliente,))
            pedido = cur.fetchone()
        if pedido is None:
            return None

        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_ITEMS} WHERE d.id_pedido_cliente = %s "
                "ORDER BY d.id_producto",
                (id_pedido_cliente,),
            )
            pedido["items"] = [
                {key: value for key, value in item.items() if key != "_pedido_ref"}
                for item in cur.fetchall()
            ]
        return pedido

    def listar(
        self,
        estado_envio: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[PedidoVentaRow]:
        pattern = f"%{q.strip()}%" if q and q.strip() else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PEDIDO}
                WHERE (%(estado)s::text IS NULL OR pv.estado_envio = %(estado)s)
                  AND (
                      %(q)s::text IS NULL
                      OR pv.id_pedido_cliente ILIKE %(q)s
                      OR c.nombre ILIKE %(q)s
                      OR c.apellido ILIKE %(q)s
                      OR c.dni_cuit ILIKE %(q)s
                  )
                ORDER BY pv.fecha_emision DESC, pv.id_pedido_cliente DESC
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "estado": estado_envio,
                    "q": pattern,
                    "limit": limit,
                    "offset": offset,
                },
            )
            pedidos = cur.fetchall()

        if not pedidos:
            return []
        ids = [pedido["id_pedido_cliente"] for pedido in pedidos]
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_ITEMS} WHERE d.id_pedido_cliente = ANY(%s) "
                "ORDER BY d.id_pedido_cliente, d.id_producto",
                (ids,),
            )
            items = cur.fetchall()
        items_por_pedido: dict[str, list[dict[str, Any]]] = {
            id_pedido: [] for id_pedido in ids
        }
        for item in items:
            id_pedido = item.pop("_pedido_ref")
            items_por_pedido[id_pedido].append(item)
        for pedido in pedidos:
            pedido["items"] = items_por_pedido[pedido["id_pedido_cliente"]]
        return pedidos

    def actualizar_estado(
        self,
        id_pedido_cliente: str,
        estado_actual: str,
        estado_nuevo: str,
    ) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pedido_cliente
                SET estado_envio = %s
                WHERE id_pedido_cliente = %s AND estado_envio = %s
                RETURNING id_pedido_cliente
                """,
                (estado_nuevo, id_pedido_cliente, estado_actual),
            )
            return cur.fetchone() is not None

    def marcar_cancelado(self, id_pedido_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pedido_cliente
                SET estado_envio = 'cancelado'
                WHERE id_pedido_cliente = %s
                  AND estado_envio IN ('pendiente', 'proceso', 'enviado')
                RETURNING id_pedido_cliente
                """,
                (id_pedido_cliente,),
            )
            return cur.fetchone() is not None
