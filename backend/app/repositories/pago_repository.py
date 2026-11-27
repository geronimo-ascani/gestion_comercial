from decimal import Decimal
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

PagoRow = dict[str, Any]

_SELECT_PAGO = """
SELECT p.id_pago,
       p.estado,
       p.fecha_pago,
       p.monto,
       p.referencia,
       p.id_medio_pago,
       mp.medio_pago,
       p.creado_en,
       p.id_comprobante_venta,
       p.id_factura_proveedor,
       CASE WHEN p.id_factura_proveedor IS NOT NULL THEN 'pago' ELSE 'cobro' END
           AS tipo_pago
FROM pago p
JOIN medio_pago mp ON mp.id_medio_pago = p.id_medio_pago
"""


class PagoRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def crear(self, datos: dict[str, Any]) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO pago (
                    id_empresa, estado, fecha_pago, monto, referencia,
                    id_comprobante_venta, id_factura_proveedor, id_medio_pago
                )
                VALUES (
                    %(id_empresa)s, %(estado)s, %(fecha_pago)s, %(monto)s,
                    %(referencia)s, %(id_comprobante_venta)s,
                    %(id_factura_proveedor)s, %(id_medio_pago)s
                )
                RETURNING id_pago
                """,
                {
                    **datos,
                    "id_empresa": self._id_empresa,
                    "id_comprobante_venta": datos.get("id_comprobante_venta"),
                    "id_factura_proveedor": datos.get("id_factura_proveedor"),
                },
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_pago"]

    def obtener(self, id_pago: str) -> PagoRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_PAGO} WHERE p.id_pago = %s AND p.id_empresa = %s",
                (id_pago, self._id_empresa),
            )
            return cur.fetchone()

    def actualizar_estado(
        self, id_pago: str, estado: str, id_factura_proveedor: str
    ) -> bool:
        """Cambia el estado de un pago pendiente de una factura propia."""
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pago
                SET estado = %s
                WHERE id_pago = %s
                  AND id_factura_proveedor = %s
                  AND id_empresa = %s
                  AND estado = 'pendiente'
                """,
                (estado, id_pago, id_factura_proveedor, self._id_empresa),
            )
            return cur.rowcount == 1

    def listar_por_comprobante(
        self, id_comprobante_venta: str
    ) -> list[PagoRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PAGO}
                WHERE p.id_comprobante_venta = %s AND p.id_empresa = %s
                ORDER BY p.creado_en, p.id_pago
                """,
                (id_comprobante_venta, self._id_empresa),
            )
            return cur.fetchall()

    def listar_por_factura(
        self, id_factura_proveedor: str
    ) -> list[PagoRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PAGO}
                WHERE p.id_factura_proveedor = %s AND p.id_empresa = %s
                ORDER BY p.creado_en, p.id_pago
                """,
                (id_factura_proveedor, self._id_empresa),
            )
            return cur.fetchall()

    def listar_todos(self, limit: int, offset: int) -> list[PagoRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT p.id_pago,
                       p.estado,
                       p.fecha_pago,
                       p.monto,
                       p.referencia,
                       p.id_medio_pago,
                       mp.medio_pago,
                       p.creado_en,
                       cv.id_comprobante_venta,
                       cv.numero_comprobante,
                       cv.punto_venta,
                       cv.id_pedido_cliente,
                       pv.id_cliente,
                       c.nombre AS cliente_nombre,
                       c.apellido AS cliente_apellido
                FROM pago p
                JOIN medio_pago mp ON mp.id_medio_pago = p.id_medio_pago
                JOIN comprobante_venta cv
                  ON cv.id_comprobante_venta = p.id_comprobante_venta
                JOIN pedido_cliente pv
                  ON pv.id_pedido_cliente = cv.id_pedido_cliente
                JOIN cliente c ON c.id_cliente = pv.id_cliente
                WHERE p.id_empresa = %s
                ORDER BY p.creado_en DESC, p.id_pago DESC
                LIMIT %s OFFSET %s
                """,
                (self._id_empresa, limit, offset),
            )
            return cur.fetchall()

    def sumar(
        self, id_comprobante_venta: str, estados: tuple[str, ...]
    ) -> Decimal:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(monto), 0) AS total
                FROM pago
                WHERE id_comprobante_venta = %s
                  AND id_empresa = %s
                  AND estado = ANY(%s)
                """,
                (id_comprobante_venta, self._id_empresa, list(estados)),
            )
            row = cur.fetchone()
            assert row is not None
            return Decimal(row["total"])

    def sumar_factura(
        self, id_factura_proveedor: str, estados: tuple[str, ...]
    ) -> Decimal:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT COALESCE(SUM(monto), 0) AS total
                FROM pago
                WHERE id_factura_proveedor = %s
                  AND id_empresa = %s
                  AND estado = ANY(%s)
                """,
                (id_factura_proveedor, self._id_empresa, list(estados)),
            )
            row = cur.fetchone()
            assert row is not None
            return Decimal(row["total"])

    def medio_pago_existe(self, id_medio_pago: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM medio_pago
                    WHERE id_medio_pago = %s AND id_empresa = %s
                ) AS existe
                """,
                (id_medio_pago, self._id_empresa),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])
