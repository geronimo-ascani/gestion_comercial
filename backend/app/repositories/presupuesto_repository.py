from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

PresupuestoRow = dict[str, Any]

_ESTADO_EFECTIVO = """
CASE
    WHEN pc.estado IN ('pendiente', 'aprobado')
         AND pc.fecha_vencimiento < CURRENT_DATE
    THEN 'vencido'
    ELSE pc.estado
END
"""

_SELECT_PRESUPUESTO = f"""
SELECT pc.id_presupuesto_cliente,
       {_ESTADO_EFECTIVO} AS estado,
       pc.fecha_creacion,
       pc.fecha_muestra,
       pc.fecha_vencimiento,
       pc.descuento_compra,
       pc.total,
       pc.id_cliente,
       c.nombre AS cliente_nombre,
       c.apellido AS cliente_apellido
FROM presupuesto_cliente pc
JOIN cliente c ON c.id_cliente = pc.id_cliente
"""

_SELECT_ITEMS = """
SELECT dp.id_presupuesto_cliente AS _presupuesto_ref,
       dp.id_producto,
       p.nombre AS producto_nombre,
       dp.cantidad,
       dp.descuento_producto,
       dp.iva,
       dp.neto,
       dp.precio_unitario,
       dp.subtotal,
       dp.tipo_iva
FROM detalle_presupuesto_cliente dp
JOIN producto p ON p.id_producto = dp.id_producto
"""


class PresupuestoRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def cliente_existe(self, id_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM cliente WHERE id_cliente = %s)",
                (id_cliente,),
            )
            row = cur.fetchone()
            return bool(row and row["exists"])

    def crear(self, datos: dict[str, Any], total: Any) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO presupuesto_cliente (
                    estado, fecha_muestra, fecha_vencimiento,
                    descuento_compra, total, id_cliente
                )
                VALUES (
                    'pendiente', %(fecha_muestra)s, %(fecha_vencimiento)s,
                    %(descuento_compra)s, %(total)s, %(id_cliente)s
                )
                RETURNING id_presupuesto_cliente
                """,
                {**datos, "total": total},
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_presupuesto_cliente"]

    def crear_items(
        self, id_presupuesto_cliente: str, items: list[dict[str, Any]]
    ) -> None:
        with self._conn.cursor() as cur:
            cur.executemany(
                """
                INSERT INTO detalle_presupuesto_cliente (
                    id_presupuesto_cliente, id_producto, cantidad,
                    descuento_producto, iva, neto, precio_unitario,
                    subtotal, tipo_iva
                )
                VALUES (
                    %(id_presupuesto_cliente)s, %(id_producto)s, %(cantidad)s,
                    %(descuento_producto)s, %(iva)s, %(neto)s,
                    %(precio_unitario)s, %(subtotal)s, %(tipo_iva)s
                )
                """,
                [
                    {**item, "id_presupuesto_cliente": id_presupuesto_cliente}
                    for item in items
                ],
            )

    def obtener(
        self, id_presupuesto_cliente: str, bloquear: bool = False
    ) -> PresupuestoRow | None:
        query = (
            f"{_SELECT_PRESUPUESTO} "
            "WHERE pc.id_presupuesto_cliente = %s"
        )
        if bloquear:
            query += " FOR UPDATE OF pc"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_presupuesto_cliente,))
            presupuesto = cur.fetchone()
        if presupuesto is None:
            return None

        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_ITEMS} WHERE dp.id_presupuesto_cliente = %s "
                "ORDER BY dp.id_producto",
                (id_presupuesto_cliente,),
            )
            presupuesto["items"] = [
                {key: value for key, value in item.items() if key != "_presupuesto_ref"}
                for item in cur.fetchall()
            ]
        return presupuesto

    def listar(
        self,
        estado: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[PresupuestoRow]:
        pattern = f"%{q.strip()}%" if q and q.strip() else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PRESUPUESTO}
                WHERE (%(estado)s::text IS NULL OR ({_ESTADO_EFECTIVO}) = %(estado)s)
                  AND (
                      %(q)s::text IS NULL
                      OR pc.id_presupuesto_cliente ILIKE %(q)s
                      OR c.nombre ILIKE %(q)s
                      OR c.apellido ILIKE %(q)s
                      OR c.dni_cuit ILIKE %(q)s
                  )
                ORDER BY pc.fecha_muestra DESC, pc.id_presupuesto_cliente DESC
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "estado": estado,
                    "q": pattern,
                    "limit": limit,
                    "offset": offset,
                },
            )
            presupuestos = cur.fetchall()

        if not presupuestos:
            return []
        ids = [item["id_presupuesto_cliente"] for item in presupuestos]
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_ITEMS} WHERE dp.id_presupuesto_cliente = ANY(%s) "
                "ORDER BY dp.id_presupuesto_cliente, dp.id_producto",
                (ids,),
            )
            lineas = cur.fetchall()
        items_por_presupuesto: dict[str, list[dict[str, Any]]] = {
            id_presupuesto: [] for id_presupuesto in ids
        }
        for item in lineas:
            id_presupuesto = item.pop("_presupuesto_ref")
            items_por_presupuesto[id_presupuesto].append(item)
        for presupuesto in presupuestos:
            presupuesto["items"] = items_por_presupuesto[
                presupuesto["id_presupuesto_cliente"]
            ]
        return presupuestos

    def reemplazar(
        self,
        id_presupuesto_cliente: str,
        datos: dict[str, Any],
        total: Any,
        items: list[dict[str, Any]],
    ) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE presupuesto_cliente
                SET fecha_muestra = %(fecha_muestra)s,
                    fecha_vencimiento = %(fecha_vencimiento)s,
                    descuento_compra = %(descuento_compra)s,
                    total = %(total)s,
                    id_cliente = %(id_cliente)s
                WHERE id_presupuesto_cliente = %(id_presupuesto_cliente)s
                  AND estado = 'pendiente'
                RETURNING id_presupuesto_cliente
                """,
                {
                    **datos,
                    "total": total,
                    "id_presupuesto_cliente": id_presupuesto_cliente,
                },
            )
            if cur.fetchone() is None:
                return False
            cur.execute(
                "DELETE FROM detalle_presupuesto_cliente "
                "WHERE id_presupuesto_cliente = %s",
                (id_presupuesto_cliente,),
            )
        self.crear_items(id_presupuesto_cliente, items)
        return True

    def marcar_aprobado(self, id_presupuesto_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE presupuesto_cliente
                SET estado = 'aprobado'
                WHERE id_presupuesto_cliente = %s
                  AND estado = 'pendiente'
                  AND fecha_vencimiento >= CURRENT_DATE
                RETURNING id_presupuesto_cliente
                """,
                (id_presupuesto_cliente,),
            )
            return cur.fetchone() is not None

    def marcar_vencido(self, id_presupuesto_cliente: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE presupuesto_cliente
                SET estado = 'vencido'
                WHERE id_presupuesto_cliente = %s
                  AND estado IN ('pendiente', 'aprobado')
                  AND fecha_vencimiento < CURRENT_DATE
                """,
                (id_presupuesto_cliente,),
            )

    def eliminar(self, id_presupuesto_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM presupuesto_cliente
                WHERE id_presupuesto_cliente = %s AND estado = 'pendiente'
                RETURNING id_presupuesto_cliente
                """,
                (id_presupuesto_cliente,),
            )
            return cur.fetchone() is not None

    def marcar_convertido(self, id_presupuesto_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE presupuesto_cliente
                SET estado = 'convertido'
                WHERE id_presupuesto_cliente = %s
                  AND estado = 'aprobado'
                  AND fecha_vencimiento >= CURRENT_DATE
                RETURNING id_presupuesto_cliente
                """,
                (id_presupuesto_cliente,),
            )
            return cur.fetchone() is not None
