from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

FacturaProveedorRow = dict[str, Any]

_SELECT_FACTURA = """
SELECT fp.id_factura_proveedor,
       fp.tipo_comprobante,
       fp.estado_pago,
       fp.fecha_emision,
       fp.fecha_vence,
       fp.total,
       fp.saldo_pendiente,
       fp.creado_en,
       fp.id_empresa,
       fp.id_proveedor,
       fp.proveedor_razon_social,
       fp.proveedor_cuit,
       fp.proveedor_domicilio,
       fp.proveedor_condicion_iva,
       fp.id_pedido_proveedor,
       fp.empresa_razon_social,
       fp.empresa_cuit,
       fp.empresa_domicilio,
       fp.empresa_condicion_iva,
       fpa.nombre_archivo AS archivo_nombre,
       fpa.mime_type AS archivo_mime_type,
       fpa.tamanio AS archivo_tamanio
FROM factura_proveedor fp
LEFT JOIN factura_proveedor_archivo fpa
       ON fpa.id_factura_proveedor = fp.id_factura_proveedor
"""

_COLUMNAS_FACTURA = (
    "id_factura_proveedor",
    "id_empresa",
    "id_proveedor",
    "id_pedido_proveedor",
    "id_empleado",
    "fecha_emision",
    "fecha_vence",
    "tipo_comprobante",
    "punto_venta",
    "numero_comprobante",
    "total",
    "saldo_pendiente",
    "estado_pago",
    "proveedor_razon_social",
    "proveedor_cuit",
    "proveedor_domicilio",
    "proveedor_condicion_iva",
    "empresa_razon_social",
    "empresa_cuit",
    "empresa_domicilio",
    "empresa_condicion_iva",
)


class FacturaProveedorRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def transaction(self) -> Any:
        return self._conn.transaction()

    def obtener_pedido(
        self, id_pedido_proveedor: str, bloquear: bool = False
    ) -> dict[str, Any] | None:
        query = """
        SELECT pp.id_pedido_proveedor,
               pp.id_proveedor,
               pp.estado,
               pp.total,
               pr.razon_social AS proveedor_razon_social,
               pr.cuit AS proveedor_cuit,
               ci.descripcion AS proveedor_condicion_iva_descripcion,
               ci.codigo_afip AS proveedor_condicion_iva_codigo,
               COALESCE(
                   NULLIF(
                       CONCAT_WS(
                           ' ', d.calle, d.altura, d.depto, d.cp,
                           d.localidad, d.provincia
                       ),
                       ''
                   ),
                   ''
               ) AS proveedor_domicilio
        FROM pedido_proveedor pp
        JOIN proveedor pr ON pr.id_proveedor = pp.id_proveedor
        JOIN condicion_iva ci ON ci.id_condicion_iva = pr.id_condicion_iva
        LEFT JOIN LATERAL (
            SELECT calle, altura, depto, cp, localidad, provincia
            FROM direccion
            WHERE id_proveedor = pr.id_proveedor
            ORDER BY id_direccion
            LIMIT 1
        ) d ON TRUE
        WHERE pp.id_pedido_proveedor = %s AND pp.id_empresa = %s
        """
        if bloquear:
            query += " FOR UPDATE OF pp"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_pedido_proveedor, self._id_empresa))
            return cur.fetchone()

    def crear(
        self,
        factura: dict[str, Any],
        archivo: dict[str, Any],
    ) -> str:
        """Genera el ID ``FP-####`` y lo usa como número mostrado.

        Las columnas ``punto_venta`` y ``numero_comprobante`` de la tabla son
        legacy: se completan con el ID generado solo para satisfacer el esquema
        histórico. El número real del proveedor permanece dentro del archivo.
        """
        columnas = ", ".join(_COLUMNAS_FACTURA)
        marcadores = ", ".join(f"%({campo})s" for campo in _COLUMNAS_FACTURA)
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT nextval('factura_proveedor_id_seq') AS correlativo")
            secuencia = cur.fetchone()
            assert secuencia is not None
            id_factura = f"FP-{int(secuencia['correlativo']):04d}"
            valores = {
                **factura,
                "id_factura_proveedor": id_factura,
                "punto_venta": "",
                "numero_comprobante": id_factura,
            }
            cur.execute(
                f"""
                INSERT INTO factura_proveedor ({columnas})
                VALUES ({marcadores})
                RETURNING id_factura_proveedor
                """,
                valores,
            )
            row = cur.fetchone()
            assert row is not None
            id_factura = row["id_factura_proveedor"]

        with self._conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO factura_proveedor_archivo (
                    id_factura_proveedor, nombre_archivo, mime_type,
                    tamanio, contenido
                )
                VALUES (
                    %(id_factura_proveedor)s, %(nombre_archivo)s,
                    %(mime_type)s, %(tamanio)s, %(contenido)s
                )
                """,
                {
                    "id_factura_proveedor": id_factura,
                    "nombre_archivo": archivo["nombre"],
                    "mime_type": archivo["mime_type"],
                    "tamanio": archivo["tamanio"],
                    "contenido": archivo["contenido"],
                },
            )
        return id_factura

    def _componer(self, factura: FacturaProveedorRow) -> FacturaProveedorRow:
        numero = factura["id_factura_proveedor"]
        factura["numero_comprobante"] = numero
        factura["numero_completo"] = numero
        # Legacy rows may store the retired "aprobada" value. The API only
        # exposes the two real states, derived from the remaining balance.
        saldo = factura.get("saldo_pendiente")
        factura["estado_pago"] = (
            "pagada" if saldo is not None and saldo == 0 else "emitida"
        )
        id_factura = numero
        factura["archivo_url"] = (
            f"/compras/facturas/{id_factura}/archivo"
        )
        factura["tiene_archivo"] = bool(factura.get("archivo_nombre"))
        return factura

    def obtener(
        self, id_factura_proveedor: str, bloquear: bool = False
    ) -> FacturaProveedorRow | None:
        query = (
            f"{_SELECT_FACTURA} "
            "WHERE fp.id_factura_proveedor = %s AND fp.id_empresa = %s"
        )
        if bloquear:
            query += " FOR UPDATE OF fp"
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(query, (id_factura_proveedor, self._id_empresa))
            factura = cur.fetchone()
        if factura is None:
            return None
        return self._componer(factura)

    def existe(self, id_factura_proveedor: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM factura_proveedor
                    WHERE id_factura_proveedor = %s AND id_empresa = %s
                ) AS existe
                """,
                (id_factura_proveedor, self._id_empresa),
            )
            row = cur.fetchone()
            assert row is not None
            return bool(row["existe"])

    def archivo(self, id_factura_proveedor: str) -> dict[str, Any] | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT fpa.nombre_archivo, fpa.mime_type, fpa.tamanio,
                       fpa.contenido
                FROM factura_proveedor_archivo fpa
                JOIN factura_proveedor fp
                  ON fp.id_factura_proveedor = fpa.id_factura_proveedor
                WHERE fpa.id_factura_proveedor = %s
                  AND fp.id_empresa = %s
                """,
                (id_factura_proveedor, self._id_empresa),
            )
            fila = cur.fetchone()
        if fila is None:
            return None
        fila["contenido"] = bytes(fila["contenido"])
        return fila

    def listar(
        self,
        estado_pago: str | None,
        id_pedido_proveedor: str | None,
        id_proveedor: str | None,
        q: str | None,
        limit: int,
        offset: int,
    ) -> list[FacturaProveedorRow]:
        pattern = f"%{q.strip()}%" if q and q.strip() else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_FACTURA}
                WHERE fp.id_empresa = %(id_empresa)s
                  AND (%(estado)s::text IS NULL OR fp.estado_pago = %(estado)s)
                  AND (%(pedido)s::text IS NULL
                       OR fp.id_pedido_proveedor = %(pedido)s)
                  AND (%(proveedor)s::text IS NULL
                       OR fp.id_proveedor = %(proveedor)s)
                  AND (
                      %(q)s::text IS NULL
                      OR fp.id_factura_proveedor ILIKE %(q)s
                      OR fp.numero_comprobante ILIKE %(q)s
                      OR fp.id_pedido_proveedor ILIKE %(q)s
                      OR fp.proveedor_razon_social ILIKE %(q)s
                      OR fp.proveedor_cuit ILIKE %(q)s
                  )
                ORDER BY fp.fecha_emision DESC, fp.id_factura_proveedor DESC
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "id_empresa": self._id_empresa,
                    "estado": estado_pago,
                    "pedido": id_pedido_proveedor,
                    "proveedor": id_proveedor,
                    "q": pattern,
                    "limit": limit,
                    "offset": offset,
                },
            )
            return [self._componer(row) for row in cur.fetchall()]

    def listar_por_pedido(
        self, id_pedido_proveedor: str
    ) -> list[FacturaProveedorRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_FACTURA} "
                "WHERE fp.id_pedido_proveedor = %s AND fp.id_empresa = %s "
                "ORDER BY fp.fecha_emision DESC, fp.id_factura_proveedor DESC",
                (id_pedido_proveedor, self._id_empresa),
            )
            return [self._componer(row) for row in cur.fetchall()]

    def actualizar_pago(
        self,
        id_factura_proveedor: str,
        estado_pago: str,
        saldo_pendiente: Any,
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE factura_proveedor
                SET estado_pago = %s, saldo_pendiente = %s
                WHERE id_factura_proveedor = %s AND id_empresa = %s
                """,
                (
                    estado_pago,
                    saldo_pendiente,
                    id_factura_proveedor,
                    self._id_empresa,
                ),
            )
