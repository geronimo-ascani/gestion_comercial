from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

AlicuotaRow = dict[str, Any]
UnidadRow = dict[str, Any]
CondicionIVARow = dict[str, Any]
MedioPagoRow = dict[str, Any]


class CatalogoRepository:
    def __init__(self, conn: Connection, id_empresa: str) -> None:
        self._conn = conn
        self._id_empresa = id_empresa

    def transaction(self) -> Any:
        return self._conn.transaction()

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

    def listar_medios_pago(self) -> list[MedioPagoRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT id_medio_pago, medio_pago, tipo_cobro
                FROM medio_pago
                WHERE id_empresa = %s
                ORDER BY medio_pago
                """,
                (self._id_empresa,),
            )
            return cur.fetchall()

    def crear_medio_pago(
        self, medio_pago: str, tipo_cobro: str
    ) -> MedioPagoRow:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO medio_pago (id_empresa, medio_pago, tipo_cobro)
                VALUES (%s, %s, %s)
                RETURNING id_medio_pago, medio_pago, tipo_cobro
                """,
                (self._id_empresa, medio_pago, tipo_cobro),
            )
            row = cur.fetchone()
            assert row is not None
            return row
