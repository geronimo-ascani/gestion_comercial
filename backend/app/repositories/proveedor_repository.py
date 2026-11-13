from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

ProveedorRow = dict[str, Any]

_SELECT = """
SELECT p.id_proveedor, p.banco, p.cuenta, p.cuit, p.email,
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

_FIELDS = {
    "banco",
    "cuenta",
    "cuit",
    "email",
    "razon_social",
    "telefono",
}


class ProveedorRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

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
                WHERE (%(q)s::text IS NULL
                    OR p.razon_social ILIKE %(q)s
                    OR p.cuit ILIKE %(q)s
                    OR p.email ILIKE %(q)s
                    OR p.telefono ILIKE %(q)s
                    OR p.banco ILIKE %(q)s)
                ORDER BY p.razon_social
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {"q": pattern, "limit": limit, "offset": offset},
            )
            return cur.fetchall()

    def obtener(self, id_proveedor: str) -> ProveedorRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"{_SELECT} WHERE p.id_proveedor = %s", (id_proveedor,))
            return cur.fetchone()

    def cuit_existe(self, cuit: str, excluir_id: str | None = None) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM proveedor
                    WHERE regexp_replace(cuit, '[^0-9]', '', 'g') = %s
                      AND (%s::text IS NULL OR id_proveedor <> %s)
                ) AS existe
                """,
                (cuit, excluir_id, excluir_id),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def crear(self, datos: dict[str, Any]) -> str:
        values = {key: datos[key] for key in _FIELDS}
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO proveedor (
                    banco, cuenta, cuit, email, razon_social, telefono
                )
                VALUES (
                    %(banco)s, %(cuenta)s, %(cuit)s, %(email)s,
                    %(razon_social)s, %(telefono)s
                )
                RETURNING id_proveedor
                """,
                values,
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_proveedor"]

    def actualizar(
        self, id_proveedor: str, campos: dict[str, Any]
    ) -> bool:
        unknown = set(campos) - _FIELDS
        if unknown:
            raise ValueError(f"Campos de proveedor no actualizables: {sorted(unknown)}")
        if not campos:
            return self.obtener(id_proveedor) is not None

        assignments = ", ".join(f"{field} = %({field})s" for field in campos)
        with self._conn.cursor() as cur:
            cur.execute(
                f"UPDATE proveedor SET {assignments} WHERE id_proveedor = %(id)s",
                {**campos, "id": id_proveedor},
            )
            return cur.rowcount == 1

    def guardar_direccion(
        self, id_proveedor: str, direccion: dict[str, str]
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM direccion WHERE id_proveedor = %s", (id_proveedor,))
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
                "DELETE FROM proveedor WHERE id_proveedor = %s RETURNING id_proveedor",
                (id_proveedor,),
            )
            return cur.fetchone() is not None
