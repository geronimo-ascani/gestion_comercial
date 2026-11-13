from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

AlicuotaRow = dict[str, Any]
UnidadRow = dict[str, Any]
CondicionIVARow = dict[str, Any]


class CatalogoRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def listar_alicuotas(self) -> list[AlicuotaRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_alicuota_iva, descripcion, porcentaje, codigo_afip, tipo_iva
                FROM alicuota_iva
                ORDER BY porcentaje, descripcion
                """
            )
            return cur.fetchall()

    def listar_unidades(self) -> list[UnidadRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_unidad, descripcion, unidad_venta
                FROM unidad
                ORDER BY descripcion
                """
            )
            return cur.fetchall()

    def listar_condiciones_iva(self) -> list[CondicionIVARow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_condicion_iva, codigo_afip, descripcion
                FROM condicion_iva
                ORDER BY descripcion
                """
            )
            return cur.fetchall()
