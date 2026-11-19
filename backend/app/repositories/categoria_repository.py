from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

CategoriaRow = dict[str, Any]


class CategoriaRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def listar(self, q: str | None, limit: int, offset: int) -> list[CategoriaRow]:
        patron = f"%{q}%" if q else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_categoria, nombre
                FROM categoria
                WHERE id_empresa = %(id_empresa)s
                  AND (%(q)s::text IS NULL OR nombre ILIKE %(q)s::text)
                ORDER BY nombre
                LIMIT %(limit)s OFFSET %(offset)s
                """,
                {
                    "id_empresa": self._id_empresa,
                    "q": patron,
                    "limit": limit,
                    "offset": offset,
                },
            )
            return cur.fetchall()

    def obtener(self, id_categoria: str) -> CategoriaRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_categoria, nombre
                FROM categoria
                WHERE id_categoria = %s AND id_empresa = %s
                """,
                (id_categoria, self._id_empresa),
            )
            return cur.fetchone()

    def crear(self, nombre: str) -> CategoriaRow:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO categoria (id_empresa, nombre)
                VALUES (%s, %s)
                RETURNING id_categoria, nombre
                """,
                (self._id_empresa, nombre),
            )
            fila = cur.fetchone()
            assert fila is not None
            return fila

    def actualizar(self, id_categoria: str, nombre: str) -> CategoriaRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                UPDATE categoria
                SET nombre = %s
                WHERE id_categoria = %s AND id_empresa = %s
                RETURNING id_categoria, nombre
                """,
                (nombre, id_categoria, self._id_empresa),
            )
            return cur.fetchone()

    def eliminar(self, id_categoria: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM categoria
                WHERE id_categoria = %s AND id_empresa = %s
                RETURNING id_categoria
                """,
                (id_categoria, self._id_empresa),
            )
            return cur.fetchone() is not None

    def existe_nombre(self, nombre: str, excluir_id: str | None = None) -> bool:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM categoria
                    WHERE id_empresa = %s
                      AND LOWER(nombre) = LOWER(%s)
                      AND (%s::text IS NULL OR id_categoria <> %s)
                ) AS existe
                """,
                (self._id_empresa, nombre, excluir_id, excluir_id),
            )
            fila = cur.fetchone()
            return bool(fila and fila["existe"])

    def esta_en_uso(self, id_categoria: str) -> bool:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM producto
                    WHERE id_categoria = %s AND id_empresa = %s
                ) AS en_uso
                """,
                (id_categoria, self._id_empresa),
            )
            fila = cur.fetchone()
            return bool(fila and fila["en_uso"])
