from decimal import Decimal
from typing import Any

from psycopg import Connection, sql
from psycopg.rows import dict_row

ProductoRow = dict[str, Any]
AlicuotaRow = dict[str, Any]

_FROM_PRODUCTO = """
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
JOIN alicuota_iva a ON a.id_alicuota_iva = p.id_alicuota_iva
JOIN unidad u ON u.id_unidad = p.id_unidad
"""

_SELECT_PRODUCTO = f"""
SELECT
    p.id_producto,
    p.nombre,
    p.descripcion,
    p.estado,
    p.imagen,
    p.margen,
    p.precio_compra,
    p.precio_venta,
    p.stock_actual,
    p.stock_minimo,
    p.id_alicuota_iva,
    p.id_categoria,
    p.id_unidad,
    c.nombre AS categoria_nombre,
    a.descripcion AS alicuota_descripcion,
    a.porcentaje AS alicuota_porcentaje,
    a.codigo_afip AS alicuota_codigo_afip,
    a.tipo_iva AS alicuota_tipo_iva,
    u.descripcion AS unidad_descripcion,
    u.unidad_venta,
    (p.stock_actual <= p.stock_minimo) AS stock_bajo
{_FROM_PRODUCTO}
"""

_WHERE_PRODUCTO = """
WHERE (%(q)s::text IS NULL OR p.id_producto ILIKE %(q)s OR p.nombre ILIKE %(q)s
       OR p.descripcion ILIKE %(q)s OR c.nombre ILIKE %(q)s)
  AND (%(id_categoria)s::text IS NULL OR p.id_categoria = %(id_categoria)s)
  AND (%(id_alicuota_iva)s::text IS NULL OR p.id_alicuota_iva = %(id_alicuota_iva)s)
  AND (%(id_unidad)s::text IS NULL OR p.id_unidad = %(id_unidad)s)
  AND (%(precio_min)s::numeric IS NULL OR p.precio_venta >= %(precio_min)s)
  AND (%(precio_max)s::numeric IS NULL OR p.precio_venta <= %(precio_max)s)
  AND (%(estado)s::boolean IS NULL OR p.estado = %(estado)s)
  AND (
      %(stock_estado)s::text IS NULL
      OR (%(stock_estado)s = 'en_stock' AND p.stock_actual > p.stock_minimo)
      OR (%(stock_estado)s = 'critico' AND p.stock_actual > 0 AND p.stock_actual <= p.stock_minimo)
      OR (%(stock_estado)s = 'sin_stock' AND p.stock_actual = 0)
      OR (%(stock_estado)s = 'alerta' AND p.stock_actual <= p.stock_minimo)
  )
"""

_COLUMNAS_ACTUALIZABLES = {
    "nombre",
    "descripcion",
    "estado",
    "imagen",
    "margen",
    "precio_compra",
    "precio_venta",
    "stock_actual",
    "stock_minimo",
    "id_alicuota_iva",
    "id_categoria",
    "id_unidad",
}


class ProductoRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def listar(
        self, filtros: dict[str, Any], limit: int, offset: int
    ) -> list[ProductoRow]:
        parametros = {**filtros, "limit": limit, "offset": offset}
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_PRODUCTO} {_WHERE_PRODUCTO} "
                "ORDER BY p.nombre LIMIT %(limit)s OFFSET %(offset)s",
                parametros,
            )
            return cur.fetchall()

    def contar(self, filtros: dict[str, Any]) -> int:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"SELECT COUNT(*) AS total {_FROM_PRODUCTO} {_WHERE_PRODUCTO}",
                filtros,
            )
            fila = cur.fetchone()
            return int(fila["total"]) if fila is not None else 0

    def obtener(
        self, id_producto: str, incluir_dados_de_baja: bool = False
    ) -> ProductoRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PRODUCTO}
                WHERE p.id_producto = %s
                  AND (%s OR p.estado = TRUE)
                """,
                (id_producto, incluir_dados_de_baja),
            )
            return cur.fetchone()

    def obtener_activo_para_pedido(self, id_producto: str) -> ProductoRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PRODUCTO}
                WHERE p.id_producto = %s AND p.estado = TRUE
                FOR SHARE OF p
                """,
                (id_producto,),
            )
            return cur.fetchone()

    def bloquear_para_pedido_venta(
        self, id_producto: str, incluir_dados_de_baja: bool = False
    ) -> ProductoRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_PRODUCTO}
                WHERE p.id_producto = %s
                  AND (%s OR p.estado = TRUE)
                FOR UPDATE OF p
                """,
                (id_producto, incluir_dados_de_baja),
            )
            return cur.fetchone()

    def crear(self, datos: dict[str, Any], precio_venta: Decimal) -> ProductoRow:
        parametros = {**datos, "precio_venta": precio_venta}
        with self._conn.cursor(row_factory=dict_row) as cur:
            if datos.get("id_producto") is None:
                cur.execute(
                    """
                    INSERT INTO producto (
                        nombre, descripcion, estado, imagen, margen,
                        precio_compra, precio_venta, stock_actual, stock_minimo,
                        id_alicuota_iva, id_categoria, id_unidad
                    )
                    VALUES (
                        %(nombre)s, %(descripcion)s, %(estado)s, %(imagen)s, %(margen)s,
                        %(precio_compra)s, %(precio_venta)s, %(stock_actual)s, %(stock_minimo)s,
                        %(id_alicuota_iva)s, %(id_categoria)s, %(id_unidad)s
                    )
                    RETURNING id_producto
                    """,
                    parametros,
                )
            else:
                cur.execute(
                    """
                    INSERT INTO producto (
                        id_producto, nombre, descripcion, estado, imagen, margen,
                        precio_compra, precio_venta, stock_actual, stock_minimo,
                        id_alicuota_iva, id_categoria, id_unidad
                    )
                    VALUES (
                        %(id_producto)s, %(nombre)s, %(descripcion)s, %(estado)s,
                        %(imagen)s, %(margen)s, %(precio_compra)s, %(precio_venta)s,
                        %(stock_actual)s, %(stock_minimo)s, %(id_alicuota_iva)s,
                        %(id_categoria)s, %(id_unidad)s
                    )
                    RETURNING id_producto
                    """,
                    parametros,
                )
            fila = cur.fetchone()
            assert fila is not None
            id_producto = fila["id_producto"]

        producto = self.obtener(id_producto)
        assert producto is not None
        return producto

    def reservar_codigo(self) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT 'PRD-' || LPAD(nextval('producto_id_seq')::text, 4, '0')
                    AS id_producto
                """
            )
            fila = cur.fetchone()
            assert fila is not None
            id_producto = str(fila["id_producto"])
            cur.execute(
                """
                INSERT INTO reserva_codigo_producto (id_producto, estado)
                VALUES (%s, 'reservado')
                """,
                (id_producto,),
            )
            return id_producto

    def anular_codigo_reservado(self, id_producto: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE reserva_codigo_producto
                SET estado = 'anulado', fecha_actualizacion = now()
                WHERE id_producto = %s AND estado = 'reservado'
                  AND NOT EXISTS (
                      SELECT 1 FROM producto WHERE producto.id_producto = %s
                  )
                RETURNING id_producto
                """,
                (id_producto, id_producto),
            )
            return cur.fetchone() is not None

    def consumir_codigo_reservado(self, id_producto: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE reserva_codigo_producto
                SET estado = 'usado', fecha_actualizacion = now()
                WHERE id_producto = %s AND estado = 'reservado'
                RETURNING id_producto
                """,
                (id_producto,),
            )
            return cur.fetchone() is not None

    def estado_codigo_reservado(self, id_producto: str) -> str | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT estado
                FROM reserva_codigo_producto
                WHERE id_producto = %s
                """,
                (id_producto,),
            )
            row = cur.fetchone()
            return row["estado"] if row is not None else None

    def actualizar(
        self, id_producto: str, campos: dict[str, Any]
    ) -> ProductoRow | None:
        if not campos:
            return self.obtener(id_producto)

        desconocidas = set(campos) - _COLUMNAS_ACTUALIZABLES
        if desconocidas:
            raise ValueError(f"Columnas no actualizables: {sorted(desconocidas)}")

        asignaciones = [
            sql.SQL("{} = {}").format(sql.Identifier(columna), sql.Placeholder(columna))
            for columna in campos
        ]
        consulta = sql.SQL(
            "UPDATE producto SET {} WHERE id_producto = {} RETURNING id_producto"
        ).format(
            sql.SQL(", ").join(asignaciones),
            sql.Placeholder("id_producto"),
        )

        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(consulta, {**campos, "id_producto": id_producto})
            fila = cur.fetchone()

        if fila is None:
            return None
        return self.obtener(id_producto, incluir_dados_de_baja=True)

    def aplicar_delta_stock(
        self, id_producto: str, delta: Decimal
    ) -> ProductoRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                UPDATE producto
                SET stock_actual = stock_actual + %(delta)s
                WHERE id_producto = %(id_producto)s
                  AND estado = TRUE
                  AND stock_actual + %(delta)s >= 0
                RETURNING id_producto
                """,
                {"id_producto": id_producto, "delta": delta},
            )
            fila = cur.fetchone()
        if fila is None:
            return None
        return self.obtener(id_producto)

    def aplicar_delta_stock_sistema(
        self, id_producto: str, delta: Decimal
    ) -> ProductoRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE producto
                SET stock_actual = stock_actual + %(delta)s
                WHERE id_producto = %(id_producto)s
                  AND stock_actual + %(delta)s >= 0
                RETURNING id_producto
                """,
                {"id_producto": id_producto, "delta": delta},
            )
            row = cur.fetchone()
        if row is None:
            return None
        return self.obtener(id_producto, incluir_dados_de_baja=True)

    def eliminar(self, id_producto: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "DELETE FROM producto WHERE id_producto = %s RETURNING id_producto",
                (id_producto,),
            )
            return cur.fetchone() is not None

    def esta_en_uso(self, id_producto: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT (
                    EXISTS (SELECT 1 FROM detalle_presupuesto_cliente WHERE id_producto = %s)
                    OR EXISTS (SELECT 1 FROM detalle_pedido_cliente WHERE id_producto = %s)
                    OR EXISTS (SELECT 1 FROM detalle_pedido_proveedor WHERE id_producto = %s)
                    OR EXISTS (SELECT 1 FROM movimiento_inventario WHERE id_producto = %s)
                ) AS en_uso
                """,
                (id_producto, id_producto, id_producto, id_producto),
            )
            fila = cur.fetchone()
            return bool(fila and fila["en_uso"])

    def obtener_alicuota(self, id_alicuota_iva: str) -> AlicuotaRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_alicuota_iva, porcentaje
                FROM alicuota_iva
                WHERE id_alicuota_iva = %s
                """,
                (id_alicuota_iva,),
            )
            return cur.fetchone()

    def obtener_unidad_por_codigo(self, codigo: str) -> str | None:
        with self._conn.cursor() as cur:
            cur.execute(
                "SELECT id_unidad FROM unidad WHERE unidad_venta = %s",
                (codigo,),
            )
            fila = cur.fetchone()
            return fila["id_unidad"] if fila is not None else None

    def existe_categoria(self, id_categoria: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM categoria WHERE id_categoria = %s
                ) AS existe
                """,
                (id_categoria,),
            )
            fila = cur.fetchone()
            return bool(fila and fila["existe"])

    def existe_unidad(self, id_unidad: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM unidad WHERE id_unidad = %s
                ) AS existe
                """,
                (id_unidad,),
            )
            fila = cur.fetchone()
            return bool(fila and fila["existe"])
