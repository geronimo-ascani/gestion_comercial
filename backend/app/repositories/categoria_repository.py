from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

CategoriaRow = dict[str, Any]


class CategoriaRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def listar(self, q: str | None, limit: int, offset: int) -> list[CategoriaRow]:
        patron = f"%{q}%" if q else None
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_categoria, nombre
                FROM categoria
                WHERE (%s::text IS NULL OR nombre ILIKE %s::text)
                ORDER BY nombre
                LIMIT %s OFFSET %s
                """,
                (patron, patron, limit, offset),
            )
            return cur.fetchall()

    def obtener(self, id_categoria: str) -> CategoriaRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_categoria, nombre
                FROM categoria
                WHERE id_categoria = %s
                """,
                (id_categoria,),
            )
            return cur.fetchone()

    def crear(self, nombre: str) -> CategoriaRow:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO categoria (id_categoria, nombre)
                VALUES (
                    'CAT-' || LPAD(nextval('categoria_id_seq')::text, 4, '0'),
                    %s
                )
                RETURNING id_categoria, nombre
                """,
                (nombre,),
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
                WHERE id_categoria = %s
                RETURNING id_categoria, nombre
                """,
                (nombre, id_categoria),
            )
            return cur.fetchone()

    def eliminar(self, id_categoria: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                "DELETE FROM categoria WHERE id_categoria = %s RETURNING id_categoria",
                (id_categoria,),
            )
            return cur.fetchone() is not None

    def existe_nombre(self, nombre: str, excluir_id: str | None = None) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM categoria
                    WHERE LOWER(nombre) = LOWER(%s)
                      AND (%s::text IS NULL OR id_categoria <> %s)
                )
                """,
                (nombre, excluir_id, excluir_id),
            )
            fila = cur.fetchone()
            return bool(fila and fila[0])

    def esta_en_uso(self, id_categoria: str) -> bool:
        with self._conn.cursor() as cur:
            cur.execute("SELECT to_regclass('producto')")
            fila = cur.fetchone()
            if fila is None or fila[0] is None:
                return False

            cur.execute(
                "SELECT EXISTS (SELECT 1 FROM producto WHERE id_categoria = %s)",
                (id_categoria,),
            )
            fila = cur.fetchone()
            return bool(fila and fila[0])
