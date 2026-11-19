from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

EmpresaRow = dict[str, Any]

_SELECT = """
SELECT id_empresa, razon_social, nombre_fantasia, cuit, condicion_iva,
       domicilio, punto_venta, email, telefono, activa,
       ingresos_brutos, inicio_actividades, codigo_postal, localidad,
       provincia
FROM empresa
"""

_CAMPOS_ACTUALIZABLES = {
    "razon_social",
    "nombre_fantasia",
    "cuit",
    "condicion_iva",
    "domicilio",
    "punto_venta",
    "email",
    "telefono",
    "activa",
    "ingresos_brutos",
    "inicio_actividades",
    "codigo_postal",
    "localidad",
    "provincia",
}


class EmpresaRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def obtener(self, id_empresa: str) -> EmpresaRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"{_SELECT} WHERE id_empresa = %s", (id_empresa,))
            return cur.fetchone()

    def obtener_primera(self) -> EmpresaRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"{_SELECT} ORDER BY id_empresa LIMIT 1")
            return cur.fetchone()

    def crear(self, datos: dict[str, Any]) -> str:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                INSERT INTO empresa (
                    razon_social, nombre_fantasia, cuit, condicion_iva,
                    domicilio, punto_venta, email, telefono, activa,
                    ingresos_brutos, inicio_actividades, codigo_postal,
                    localidad, provincia
                )
                VALUES (
                    %(razon_social)s, %(nombre_fantasia)s, %(cuit)s,
                    %(condicion_iva)s, %(domicilio)s, %(punto_venta)s,
                    %(email)s, %(telefono)s, %(activa)s,
                    %(ingresos_brutos)s, %(inicio_actividades)s,
                    %(codigo_postal)s, %(localidad)s, %(provincia)s
                )
                RETURNING id_empresa
                """,
                datos,
            )
            row = cur.fetchone()
            assert row is not None
            return row["id_empresa"]

    def crear_placeholder(self, razon_social: str) -> str:
        return self.crear(
            {
                "razon_social": razon_social,
                "nombre_fantasia": "",
                "cuit": "",
                "condicion_iva": "responsable_inscripto",
                "domicilio": "",
                "punto_venta": "0001",
                "email": "",
                "telefono": "",
                "activa": True,
                "ingresos_brutos": "",
                "inicio_actividades": None,
                "codigo_postal": "",
                "localidad": "",
                "provincia": "",
            }
        )

    def actualizar(self, id_empresa: str, datos: dict[str, Any]) -> bool:
        campos = {k: v for k, v in datos.items() if k in _CAMPOS_ACTUALIZABLES}
        if not campos:
            return self.obtener(id_empresa) is not None
        asignaciones = ", ".join(f"{campo} = %({campo})s" for campo in campos)
        with self._conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE empresa
                SET {asignaciones}
                WHERE id_empresa = %(id_empresa)s
                RETURNING id_empresa
                """,
                {**campos, "id_empresa": id_empresa},
            )
            return cur.fetchone() is not None

    def cuit_existe(self, cuit: str, excluir_id: str | None = None) -> bool:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM empresa
                    WHERE cuit = %s
                      AND (%s::text IS NULL OR id_empresa <> %s)
                ) AS existe
                """,
                (cuit, excluir_id, excluir_id),
            )
            row = cur.fetchone()
            return bool(row and row["existe"])
