from datetime import date
from decimal import Decimal
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

ComprobanteRow = dict[str, Any]
PedidoRow = dict[str, Any]

_SELECT_COMPROBANTE = """
SELECT cv.id_comprobante_venta,
       cv.numero_comprobante,
       cv.punto_venta,
       cv.tipo_comprobante,
       cv.estado_pago,
       cv.fecha_emision,
       cv.fecha_pago,
       cv.monto,
       cv.saldo_pendiente,
       cv.id_pedido_cliente,
       cv.id_empresa,
       cv.id_empleado,
       cv.observaciones,
       cv.cae,
       cv.cae_vence,
       cv.creado_en,
       cv.id_cliente,
       cv.cliente_nombre,
       cv.cliente_apellido,
       cv.cliente_dni_cuit,
       cv.cliente_email,
       cv.cliente_telefono,
       cv.cliente_condicion_codigo,
       cv.cliente_condicion_descripcion,
       cv.empresa_razon_social,
       cv.empresa_nombre_fantasia,
       cv.empresa_cuit,
       cv.empresa_condicion_iva,
       cv.empresa_domicilio,
       cv.empresa_punto_venta,
       cv.empresa_email,
       cv.empresa_telefono,
       cv.empresa_activa,
       cv.empresa_ingresos_brutos,
       cv.empresa_inicio_actividades,
       cv.empresa_codigo_postal,
       cv.empresa_localidad,
       cv.empresa_provincia,
       cv.estado_envio,
       cv.descuento_compra,
       cv.entrega_calle,
       cv.entrega_altura,
       cv.entrega_cp,
       cv.entrega_depto,
       cv.entrega_localidad,
       cv.entrega_provincia,
       EXISTS (
           SELECT 1 FROM comprobante_envio ce
           WHERE ce.id_comprobante_venta = cv.id_comprobante_venta
             AND ce.estado = 'enviado'
       ) AS enviado
FROM comprobante_venta cv
"""

_SELECT_PEDIDO = """
SELECT pv.id_pedido_cliente,
       pv.estado_envio,
       pv.total,
       pv.descuento_compra,
       pv.entrega_calle,
       pv.entrega_altura,
       pv.entrega_cp,
       pv.entrega_depto,
       pv.entrega_localidad,
       pv.entrega_provincia,
       pv.id_cliente,
       c.nombre AS cliente_nombre,
       c.apellido AS cliente_apellido,
       c.dni_cuit AS cliente_dni_cuit,
       c.email AS cliente_email,
       c.telefono AS cliente_telefono,
       ci.codigo_afip AS condicion_iva_codigo,
       ci.descripcion AS condicion_iva_descripcion
FROM pedido_cliente pv
JOIN cliente c ON c.id_cliente = pv.id_cliente
JOIN condicion_iva ci ON ci.id_condicion_iva = c.id_condicion_iva
"""

_SELECT_ITEMS_PEDIDO = """
SELECT d.id_producto,
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

_SELECT_ITEMS_COMPROBANTE = """
SELECT id_producto,
       producto_nombre,
       cantidad,
       descuento_producto,
       iva,
       neto,
       precio_unitario,
       subtotal,
       tipo_iva
FROM comprobante_item
"""

_COLUMNAS_SNAPSHOT = (
    "estado_pago",
    "fecha_emision",
    "fecha_pago",
    "monto",
    "tipo_comprobante",
    "id_pedido_cliente",
    "numero_comprobante",
    "punto_venta",
    "id_empresa",
    "id_empleado",
    "observaciones",
    "saldo_pendiente",
    "id_cliente",
    "cliente_nombre",
    "cliente_apellido",
    "cliente_dni_cuit",
    "cliente_email",
    "cliente_telefono",
    "cliente_condicion_codigo",
    "cliente_condicion_descripcion",
    "empresa_razon_social",
    "empresa_nombre_fantasia",
    "empresa_cuit",
    "empresa_condicion_iva",
    "empresa_domicilio",
    "empresa_punto_venta",
    "empresa_email",
    "empresa_telefono",
    "empresa_activa",
    "empresa_ingresos_brutos",
    "empresa_inicio_actividades",
    "empresa_codigo_postal",
    "empresa_localidad",
    "empresa_provincia",
    "estado_envio",
    "descuento_compra",
    "entrega_calle",
    "entrega_altura",
    "entrega_cp",
    "entrega_depto",
    "entrega_localidad",
    "entrega_provincia",
)

_COLUMNAS_ITEM = (
    "id_producto",
    "producto_nombre",
    "cantidad",
    "descuento_producto",
    "iva",
    "neto",
    "precio_unitario",
    "subtotal",
    "tipo_iva",
)


class ComprobanteRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def transaction(self) -> Any:
        return self._conn.transaction()

    def existe(self, id_comprobante_venta: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM comprobante_venta
                    WHERE id_comprobante_venta = %s AND id_empresa = %s
                ) AS existe
                """,
                (id_comprobante_venta, self._id_empresa),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def obtener_pedido(
        self, id_pedido_cliente: str, bloquear: bool = False
    ) -> PedidoRow | None:
        query = (
            f"{_SELECT_PEDIDO} "
            "WHERE pv.id_pedido_cliente = %s AND pv.id_empresa = %s"
        )
        if bloquear:
            query += " FOR UPDATE OF pv"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_pedido_cliente, self._id_empresa))
            return cur.fetchone()

    def obtener(
        self, id_comprobante_venta: str, bloquear: bool = False
    ) -> ComprobanteRow | None:
        query = (
            f"{_SELECT_COMPROBANTE} "
            "WHERE cv.id_comprobante_venta = %s AND cv.id_empresa = %s"
        )
        if bloquear:
            query += " FOR UPDATE OF cv"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_comprobante_venta, self._id_empresa))
            comprobante = cur.fetchone()
        if comprobante is not None:
            comprobante["items"] = self._items_comprobante(
                comprobante["id_comprobante_venta"]
            )
        return comprobante

    def buscar_por_pedido(
        self, id_pedido_cliente: str, bloquear: bool = False
    ) -> ComprobanteRow | None:
        query = (
            f"{_SELECT_COMPROBANTE} "
            "WHERE cv.id_pedido_cliente = %s AND cv.id_empresa = %s"
        )
        if bloquear:
            query += " FOR UPDATE OF cv"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_pedido_cliente, self._id_empresa))
            comprobante = cur.fetchone()
        if comprobante is not None:
            comprobante["items"] = self._items_comprobante(
                comprobante["id_comprobante_venta"]
            )
        return comprobante

    def listar(
        self,
        estado_pago: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[ComprobanteRow]:
        pattern = f"%{q.strip()}%" if q and q.strip() else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_COMPROBANTE}
                WHERE cv.id_empresa = %(id_empresa)s
                  AND (%(estado)s::text IS NULL OR cv.estado_pago = %(estado)s)
                  AND (
                      %(q)s::text IS NULL
                      OR cv.id_comprobante_venta ILIKE %(q)s
                      OR cv.numero_comprobante ILIKE %(q)s
                      OR cv.id_pedido_cliente ILIKE %(q)s
                      OR cv.cliente_nombre ILIKE %(q)s
                      OR cv.cliente_apellido ILIKE %(q)s
                      OR cv.empresa_razon_social ILIKE %(q)s
                  )
                ORDER BY cv.fecha_emision DESC, cv.id_comprobante_venta DESC
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "id_empresa": self._id_empresa,
                    "estado": estado_pago,
                    "q": pattern,
                    "limit": limit,
                    "offset": offset,
                },
            )
            return cur.fetchall()

    def siguiente_numero(
        self,
        id_empresa: str,
        punto_venta: str,
        tipo_comprobante: str,
    ) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO comprobante_secuencia (
                    id_empresa, punto_venta, tipo_comprobante, ultimo
                )
                VALUES (%s, %s, %s, 1)
                ON CONFLICT (id_empresa, punto_venta, tipo_comprobante)
                DO UPDATE SET ultimo = comprobante_secuencia.ultimo + 1
                RETURNING ultimo
                """,
                (id_empresa, punto_venta, tipo_comprobante),
            )
            row = cur.fetchone()
            assert row is not None
            return str(row["ultimo"]).zfill(8)

    def crear(self, datos: dict[str, Any]) -> str:
        columnas = ", ".join(_COLUMNAS_SNAPSHOT)
        valores = ", ".join(f"%({columna})s" for columna in _COLUMNAS_SNAPSHOT)
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                INSERT INTO comprobante_venta ({columnas})
                VALUES ({valores})
                RETURNING id_comprobante_venta
                """,
                {**datos, "id_empresa": self._id_empresa},
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_comprobante_venta"]

    def crear_items(
        self, id_comprobante_venta: str, items: list[dict[str, Any]]
    ) -> None:
        if not items:
            return
        columnas = ", ".join(("id_comprobante_venta", "orden", *_COLUMNAS_ITEM))
        marcadores = ", ".join(["%s"] * (len(_COLUMNAS_ITEM) + 2))
        filas = [
            (
                id_comprobante_venta,
                orden,
                *(item[columna] for columna in _COLUMNAS_ITEM),
            )
            for orden, item in enumerate(items, start=1)
        ]
        with self._conn.cursor() as cur:
            cur.executemany(
                f"""
                INSERT INTO comprobante_item ({columnas})
                VALUES ({marcadores})
                """,
                filas,
            )

    def obtener_items_pedido(
        self, id_pedido_cliente: str
    ) -> list[dict[str, Any]]:
        query = (
            f"{_SELECT_ITEMS_PEDIDO} "
            "WHERE d.id_pedido_cliente = %s "
            "AND EXISTS ("
            "SELECT 1 FROM pedido_cliente pv "
            "WHERE pv.id_pedido_cliente = d.id_pedido_cliente "
            "AND pv.id_empresa = %s) "
            "ORDER BY d.id_producto"
        )
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_pedido_cliente, self._id_empresa))
            return cur.fetchall()

    def actualizar_pago(
        self,
        id_comprobante_venta: str,
        estado_pago: str,
        saldo_pendiente: Decimal,
        fecha_pago: date | None,
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE comprobante_venta
                SET estado_pago = %s,
                    saldo_pendiente = %s,
                    fecha_pago = %s
                WHERE id_comprobante_venta = %s AND id_empresa = %s
                """,
                (
                    estado_pago,
                    saldo_pendiente,
                    fecha_pago,
                    id_comprobante_venta,
                    self._id_empresa,
                ),
            )

    def actualizar_saldo_pedido(
        self, id_pedido_cliente: str, saldo_pendiente: Decimal
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE pedido_cliente
                SET saldo_pendiente = %s
                WHERE id_pedido_cliente = %s AND id_empresa = %s
                """,
                (saldo_pendiente, id_pedido_cliente, self._id_empresa),
            )

    def registrar_envio(
        self,
        id_comprobante_venta: str,
        destinatario: str,
        estado: str,
        error: str | None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
    ) -> int:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO comprobante_envio (
                    id_comprobante_venta, destinatario, estado, error, cc, bcc
                )
                VALUES (%s, %s, %s, %s, %s::text[], %s::text[])
                RETURNING id_envio
                """,
                (
                    id_comprobante_venta,
                    destinatario,
                    estado,
                    error,
                    list(cc or []),
                    list(bcc or []),
                ),
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_envio"]

    def obtener_envio(self, id_envio: int) -> dict[str, Any] | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT ce.id_envio, ce.destinatario, ce.cc, ce.bcc,
                       ce.estado, ce.error, ce.enviado_en
                FROM comprobante_envio ce
                JOIN comprobante_venta cv
                  ON cv.id_comprobante_venta = ce.id_comprobante_venta
                WHERE ce.id_envio = %s AND cv.id_empresa = %s
                """,
                (id_envio, self._id_empresa),
            )
            return cur.fetchone()

    def listar_envios(self, id_comprobante_venta: str) -> list[dict[str, Any]]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT ce.id_envio, ce.destinatario, ce.cc, ce.bcc,
                       ce.estado, ce.error, ce.enviado_en
                FROM comprobante_envio ce
                JOIN comprobante_venta cv
                  ON cv.id_comprobante_venta = ce.id_comprobante_venta
                WHERE ce.id_comprobante_venta = %s
                  AND cv.id_empresa = %s
                ORDER BY ce.enviado_en DESC, ce.id_envio DESC
                """,
                (id_comprobante_venta, self._id_empresa),
            )
            return cur.fetchall()

    def _items_comprobante(
        self, id_comprobante_venta: str
    ) -> list[dict[str, Any]]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_ITEMS_COMPROBANTE}
                WHERE id_comprobante_venta = %s
                ORDER BY orden, id_producto
                """,
                (id_comprobante_venta,),
            )
            return cur.fetchall()
