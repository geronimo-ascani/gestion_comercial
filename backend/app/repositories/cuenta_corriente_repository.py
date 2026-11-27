"""Datos de cuentas corrientes, siempre limitados a la empresa autenticada."""

from datetime import date
from typing import Any, Sequence

from psycopg import Connection
from psycopg.rows import dict_row

CuentaRow = dict[str, Any]

ZONA_HORARIA = "America/Argentina/Buenos_Aires"

# Una factura registrada con fecha futura se reconoce el día en que se registró,
# para que el saldo de la cuenta coincida con el saldo pendiente listado.
_FECHA_FACTURA = f"""
LEAST(
  (fp.fecha_emision AT TIME ZONE '{ZONA_HORARIA}')::date,
  (fp.creado_en AT TIME ZONE '{ZONA_HORARIA}')::date
)
"""
_FECHA_PAGO = (
    f"COALESCE(p.fecha_pago, "
    f"(p.creado_en AT TIME ZONE '{ZONA_HORARIA}')::date)"
)


_CLIENTES = """
SELECT c.id_cliente AS id,
       c.nombre,
       c.apellido,
       c.dni_cuit AS documento
FROM cliente c
WHERE c.id_empresa = %(id_empresa)s
  AND (%(ids)s::text[] IS NULL OR c.id_cliente = ANY(%(ids)s::text[]))
ORDER BY c.apellido, c.nombre, c.id_cliente
"""

_PROVEEDORES = """
SELECT p.id_proveedor AS id,
       p.razon_social AS nombre,
       '' AS apellido,
       p.cuit AS documento
FROM proveedor p
WHERE p.id_empresa = %(id_empresa)s
  AND (%(ids)s::text[] IS NULL OR p.id_proveedor = ANY(%(ids)s::text[]))
ORDER BY p.razon_social, p.id_proveedor
"""

_MOVIMIENTOS_CLIENTES = f"""
WITH movimientos AS (
    SELECT CONCAT('C-', cv.id_comprobante_venta) AS id_movimiento,
           cv.id_cliente AS entidad_id,
           'comprobante' AS tipo_movimiento,
           cv.id_comprobante_venta AS id_origen,
           CONCAT_WS('-', cv.punto_venta, cv.numero_comprobante::text) AS numero,
           cv.fecha_emision AS fecha,
           'Emisión de comprobante' AS descripcion,
           cv.monto,
           1 AS signo,
           NULL::text AS id_medio_pago,
           NULL::text AS medio_pago
    FROM comprobante_venta cv
    JOIN cliente c
      ON c.id_cliente = cv.id_cliente
     AND c.id_empresa = cv.id_empresa
    JOIN pedido_cliente pv
      ON pv.id_pedido_cliente = cv.id_pedido_cliente
     AND pv.id_empresa = cv.id_empresa
    WHERE cv.id_empresa = %(id_empresa)s
      AND pv.estado_envio <> 'cancelado'

    UNION ALL

    SELECT CONCAT('P-', p.id_pago) AS id_movimiento,
           cv.id_cliente AS entidad_id,
           'pago' AS tipo_movimiento,
           p.id_pago AS id_origen,
           NULL::text AS numero,
           {_FECHA_PAGO} AS fecha,
           'Cobro aprobado' AS descripcion,
           p.monto,
           -1 AS signo,
           p.id_medio_pago,
           mp.medio_pago
    FROM pago p
    JOIN comprobante_venta cv
      ON cv.id_comprobante_venta = p.id_comprobante_venta
     AND cv.id_empresa = p.id_empresa
    JOIN cliente c
      ON c.id_cliente = cv.id_cliente
     AND c.id_empresa = cv.id_empresa
    JOIN pedido_cliente pv
      ON pv.id_pedido_cliente = cv.id_pedido_cliente
     AND pv.id_empresa = cv.id_empresa
    LEFT JOIN medio_pago mp
      ON mp.id_medio_pago = p.id_medio_pago
     AND mp.id_empresa = p.id_empresa
    WHERE p.id_empresa = %(id_empresa)s
      AND p.estado = 'aprobado'
      AND p.id_comprobante_venta IS NOT NULL
      AND pv.estado_envio <> 'cancelado'
)
SELECT * FROM movimientos
WHERE (%(hasta)s::date IS NULL OR fecha <= %(hasta)s::date)
  AND (%(ids)s::text[] IS NULL OR entidad_id = ANY(%(ids)s::text[]))
ORDER BY fecha, id_origen, id_movimiento
"""

_MOVIMIENTOS_PROVEEDORES = f"""
WITH movimientos AS (
    SELECT CONCAT('F-', fp.id_factura_proveedor) AS id_movimiento,
           fp.id_proveedor AS entidad_id,
           'factura' AS tipo_movimiento,
           fp.id_factura_proveedor AS id_origen,
           fp.id_factura_proveedor::text AS numero,
           {_FECHA_FACTURA} AS fecha,
           'Registro de factura' AS descripcion,
           fp.total AS monto,
           1 AS signo,
           NULL::text AS id_medio_pago,
           NULL::text AS medio_pago
    FROM factura_proveedor fp
    JOIN proveedor pr
      ON pr.id_proveedor = fp.id_proveedor
     AND pr.id_empresa = fp.id_empresa
    WHERE fp.id_empresa = %(id_empresa)s

    UNION ALL

    SELECT CONCAT('P-', p.id_pago) AS id_movimiento,
           fp.id_proveedor AS entidad_id,
           'pago' AS tipo_movimiento,
           p.id_pago AS id_origen,
           NULL::text AS numero,
           {_FECHA_PAGO} AS fecha,
           'Pago aprobado' AS descripcion,
           p.monto,
           -1 AS signo,
           p.id_medio_pago,
           mp.medio_pago
    FROM pago p
    JOIN factura_proveedor fp
      ON fp.id_factura_proveedor = p.id_factura_proveedor
     AND fp.id_empresa = p.id_empresa
    JOIN proveedor pr
      ON pr.id_proveedor = fp.id_proveedor
     AND pr.id_empresa = fp.id_empresa
    LEFT JOIN medio_pago mp
      ON mp.id_medio_pago = p.id_medio_pago
     AND mp.id_empresa = p.id_empresa
    WHERE p.id_empresa = %(id_empresa)s
      AND p.estado = 'aprobado'
      AND p.id_factura_proveedor IS NOT NULL
)
SELECT * FROM movimientos
WHERE (%(hasta)s::date IS NULL OR fecha <= %(hasta)s::date)
  AND (%(ids)s::text[] IS NULL OR entidad_id = ANY(%(ids)s::text[]))
ORDER BY fecha, id_origen, id_movimiento
"""


class CuentaCorrienteRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def _parametros(
        self, ids: Sequence[str] | None, hasta: date | None
    ) -> dict[str, Any]:
        return {
            "id_empresa": self._id_empresa,
            "ids": list(ids) if ids is not None else None,
            "hasta": hasta,
        }

    def listar_clientes(self, ids: Sequence[str] | None = None) -> list[CuentaRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_CLIENTES, self._parametros(ids, None))
            return cur.fetchall()

    def listar_proveedores(
        self, ids: Sequence[str] | None = None
    ) -> list[CuentaRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_PROVEEDORES, self._parametros(ids, None))
            return cur.fetchall()

    def listar_movimientos_clientes(
        self,
        hasta: date | None = None,
        ids: Sequence[str] | None = None,
    ) -> list[CuentaRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_MOVIMIENTOS_CLIENTES, self._parametros(ids, hasta))
            return cur.fetchall()

    def listar_movimientos_proveedores(
        self,
        hasta: date | None = None,
        ids: Sequence[str] | None = None,
    ) -> list[CuentaRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(_MOVIMIENTOS_PROVEEDORES, self._parametros(ids, hasta))
            return cur.fetchall()

    def cliente_existe(self, id_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM cliente
                    WHERE id_cliente = %s AND id_empresa = %s
                ) AS existe
                """,
                (id_cliente, self._id_empresa),
            )
            fila = cur.fetchone()
            return bool(fila and fila["existe"])

    def proveedor_existe(self, id_proveedor: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM proveedor
                    WHERE id_proveedor = %s AND id_empresa = %s
                ) AS existe
                """,
                (id_proveedor, self._id_empresa),
            )
            fila = cur.fetchone()
            return bool(fila and fila["existe"])
