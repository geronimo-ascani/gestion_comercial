from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

ProveedorRow = dict[str, Any]

_SELECT = """
SELECT p.id_proveedor, p.id_condicion_iva, p.banco, p.cuenta, p.cuit, p.email,
       p.razon_social, p.saldo, p.telefono,
       d.altura AS direccion_altura, d.calle AS direccion_calle,
       d.cp AS direccion_cp, d.depto AS direccion_depto,
       d.localidad AS direccion_localidad, d.provincia AS direccion_provincia
FROM proveedor p
LEFT JOIN LATERAL (
    SELECT altura, calle, cp, depto, localidad, provincia
    FROM direccion
    WHERE id_proveedor = p.id_proveedor
    ORDER BY id_direccion
    LIMIT 1
) d ON TRUE
"""

_FIELDS = (
    "id_condicion_iva",
    "banco",
    "cuenta",
    "cuit",
    "email",
    "razon_social",
    "telefono",
)


class ProveedorRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def transaction(self) -> Any:
        return self._conn.transaction()

    def listar(
        self, q: str | None, limit: int, offset: int
    ) -> list[ProveedorRow]:
        pattern = f"%{q}%" if q else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT}
                WHERE p.id_empresa = %(id_empresa)s
                  AND (%(q)s::text IS NULL
                    OR p.razon_social ILIKE %(q)s
                    OR p.cuit ILIKE %(q)s
                    OR p.email ILIKE %(q)s
                    OR p.telefono ILIKE %(q)s
                    OR p.banco ILIKE %(q)s)
                ORDER BY p.razon_social
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "id_empresa": self._id_empresa,
                    "q": pattern,
                    "limit": limit,
                    "offset": offset,
                },
            )
            return cur.fetchall()

    def obtener(self, id_proveedor: str) -> ProveedorRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT} WHERE p.id_proveedor = %s AND p.id_empresa = %s",
                (id_proveedor, self._id_empresa),
            )
            return cur.fetchone()

    def cuit_existe(self, cuit: str, excluir_id: str | None = None) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM proveedor
                    WHERE id_empresa = %s
                      AND regexp_replace(cuit, '[^0-9]', '', 'g') = %s
                      AND (%s::text IS NULL OR id_proveedor <> %s)
                ) AS existe
                """,
                (self._id_empresa, cuit, excluir_id, excluir_id),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def condicion_iva_existe(self, id_condicion_iva: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM condicion_iva
                    WHERE id_condicion_iva = %s
                ) AS existe
                """,
                (id_condicion_iva,),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def condicion_iva_codigo(self, id_condicion_iva: str) -> str | None:
        """Código AFIP de la condición; ``None`` si el ID no existe."""
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT codigo_afip FROM condicion_iva
                WHERE id_condicion_iva = %s
                """,
                (id_condicion_iva,),
            )
            row = cur.fetchone()
            return str(row["codigo_afip"]) if row else None

    def crear(self, datos: dict[str, Any]) -> str:
        # La condición IVA siempre viene explícita del servicio validado.
        values = {
            key: datos[key]
            for key in _FIELDS
            if datos.get(key) is not None
        }
        columnas = ", ".join(("id_empresa", *values))
        marcadores = ", ".join(
            f"%({campo})s" for campo in ("id_empresa", *values)
        )
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                INSERT INTO proveedor ({columnas})
                VALUES ({marcadores})
                RETURNING id_proveedor
                """,
                {**values, "id_empresa": self._id_empresa},
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_proveedor"]

    def actualizar(
        self, id_proveedor: str, campos: dict[str, Any]
    ) -> bool:
        unknown = set(campos) - set(_FIELDS)
        if unknown:
            raise ValueError(f"Campos de proveedor no actualizables: {sorted(unknown)}")
        if not campos:
            return self.obtener(id_proveedor) is not None

        assignments = ", ".join(f"{field} = %({field})s" for field in campos)
        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE proveedor
                SET {assignments}
                WHERE id_proveedor = %(id)s AND id_empresa = %(id_empresa)s
                """,
                {
                    **campos,
                    "id": id_proveedor,
                    "id_empresa": self._id_empresa,
                },
            )
            return cur.rowcount == 1

    def guardar_direccion(
        self, id_proveedor: str, direccion: dict[str, str]
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM direccion
                WHERE id_proveedor = %s
                  AND EXISTS (
                      SELECT 1 FROM proveedor
                      WHERE id_proveedor = %s AND id_empresa = %s
                  )
                """,
                (id_proveedor, id_proveedor, self._id_empresa),
            )
            cur.execute(
                """
                INSERT INTO direccion (
                    altura, calle, cp, depto, localidad, provincia, id_proveedor
                )
                VALUES (
                    %(altura)s, %(calle)s, %(cp)s, %(depto)s,
                    %(localidad)s, %(provincia)s, %(id_proveedor)s
                )
                """,
                {**direccion, "id_proveedor": id_proveedor},
            )

    def eliminar(self, id_proveedor: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM proveedor
                WHERE id_proveedor = %s AND id_empresa = %s
                RETURNING id_proveedor
                """,
                (id_proveedor, self._id_empresa),
            )
            return cur.fetchone() is not None
