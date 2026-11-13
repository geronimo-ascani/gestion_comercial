from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

ClienteRow = dict[str, Any]

_SELECT = """
SELECT c.id_cliente, c.apellido, c.dni_cuit, c.email, c.nombre, c.saldo,
       c.telefono, c.id_condicion_iva,
       ci.descripcion AS condicion_iva_descripcion,
       d.altura AS direccion_altura, d.calle AS direccion_calle,
       d.cp AS direccion_cp, d.depto AS direccion_depto,
       d.localidad AS direccion_localidad, d.provincia AS direccion_provincia
FROM cliente c
JOIN condicion_iva ci ON ci.id_condicion_iva = c.id_condicion_iva
LEFT JOIN LATERAL (
    SELECT altura, calle, cp, depto, localidad, provincia
    FROM direccion
    WHERE id_cliente = c.id_cliente
    ORDER BY id_direccion
    LIMIT 1
) d ON TRUE
"""

_FIELDS = {
    "apellido",
    "dni_cuit",
    "email",
    "nombre",
    "telefono",
    "id_condicion_iva",
}


class ClienteRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def listar(self, q: str | None, limit: int, offset: int) -> list[ClienteRow]:
        pattern = f"%{q}%" if q else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT}
                WHERE (%(q)s::text IS NULL
                    OR c.nombre ILIKE %(q)s
                    OR c.apellido ILIKE %(q)s
                    OR c.dni_cuit ILIKE %(q)s
                    OR c.email ILIKE %(q)s
                    OR c.telefono ILIKE %(q)s)
                ORDER BY c.apellido, c.nombre
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {"q": pattern, "limit": limit, "offset": offset},
            )
            return cur.fetchall()

    def obtener(self, id_cliente: str) -> ClienteRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"{_SELECT} WHERE c.id_cliente = %s", (id_cliente,))
            return cur.fetchone()

    def condicion_iva_existe(self, id_condicion_iva: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM condicion_iva WHERE id_condicion_iva = %s
                ) AS existe
                """,
                (id_condicion_iva,),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def dni_cuit_existe(
        self, dni_cuit: str, excluir_id: str | None = None
    ) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM cliente
                    WHERE regexp_replace(dni_cuit, '[^0-9]', '', 'g') = %s
                      AND (%s::text IS NULL OR id_cliente <> %s)
                ) AS existe
                """,
                (dni_cuit, excluir_id, excluir_id),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])

    def crear(self, datos: dict[str, Any]) -> str:
        values = {key: datos[key] for key in _FIELDS}
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO cliente (
                    apellido, dni_cuit, email, nombre, telefono, id_condicion_iva
                )
                VALUES (
                    %(apellido)s, %(dni_cuit)s, %(email)s, %(nombre)s,
                    %(telefono)s, %(id_condicion_iva)s
                )
                RETURNING id_cliente
                """,
                values,
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_cliente"]

    def actualizar(
        self, id_cliente: str, campos: dict[str, Any]
    ) -> bool:
        unknown = set(campos) - _FIELDS
        if unknown:
            raise ValueError(f"Campos de cliente no actualizables: {sorted(unknown)}")
        if not campos:
            return self.obtener(id_cliente) is not None

        assignments = ", ".join(f"{field} = %({field})s" for field in campos)
        with self._conn.cursor() as cur:
            cur.execute(
                f"UPDATE cliente SET {assignments} WHERE id_cliente = %(id)s",
                {**campos, "id": id_cliente},
            )
            return cur.rowcount == 1

    def guardar_direccion(self, id_cliente: str, direccion: dict[str, str]) -> None:
        with self._conn.cursor() as cur:
            cur.execute("DELETE FROM direccion WHERE id_cliente = %s", (id_cliente,))
            cur.execute(
                """
                INSERT INTO direccion (
                    altura, calle, cp, depto, localidad, provincia, id_cliente
                )
                VALUES (
                    %(altura)s, %(calle)s, %(cp)s, %(depto)s,
                    %(localidad)s, %(provincia)s, %(id_cliente)s
                )
                """,
                {**direccion, "id_cliente": id_cliente},
            )

    def eliminar(self, id_cliente: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "DELETE FROM cliente WHERE id_cliente = %s RETURNING id_cliente",
                (id_cliente,),
            )
            return cur.fetchone() is not None
