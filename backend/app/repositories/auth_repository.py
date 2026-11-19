from datetime import date
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

UsuarioRow = dict[str, Any]

_SELECT_USUARIO = """
SELECT e.id_empleado, e.apellido, e.dni_cuil, e.email, e.fecha_alta,
       e.fecha_ingreso, e.fecha_modificacion, e.nombre, e.puesto, e.rol,
       e.telefono, e.id_empresa, emp.razon_social AS empresa_razon_social,
       e.contrasena_hash
FROM empleado e
JOIN empresa emp ON emp.id_empresa = e.id_empresa
"""


class AuthRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def bloquear_registro(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(734921, 1)")

    def contar(self) -> int:
        with self._conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total FROM empleado")
            row = cur.fetchone()
            assert row is not None
            return int(row["total"])

    def buscar_por_email(self, email: str) -> UsuarioRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                {_SELECT_USUARIO}
                WHERE LOWER(e.email) = LOWER(%s)
                """,
                (email,),
            )
            return cur.fetchone()

    def obtener(self, id_empleado: str) -> UsuarioRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_USUARIO} WHERE e.id_empleado = %s",
                (id_empleado,),
            )
            return cur.fetchone()

    def obtener_de_empresa(
        self, id_empleado: str, id_empresa: str
    ) -> UsuarioRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_USUARIO} WHERE e.id_empleado = %s AND e.id_empresa = %s",
                (id_empleado, id_empresa),
            )
            return cur.fetchone()

    def listar(self, id_empresa: str) -> list[UsuarioRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_USUARIO} WHERE e.id_empresa = %s "
                "ORDER BY e.apellido, e.nombre",
                (id_empresa,),
            )
            return cur.fetchall()

    def actualizar(
        self, id_empleado: str, datos: dict[str, Any], id_empresa: str
    ) -> UsuarioRow | None:
        campos_permitidos = {
            "apellido",
            "dni_cuil",
            "email",
            "fecha_ingreso",
            "nombre",
            "puesto",
            "rol",
            "telefono",
        }
        cambios = {
            campo: valor
            for campo, valor in datos.items()
            if campo in campos_permitidos
        }
        if not cambios:
            return self.obtener_de_empresa(id_empleado, id_empresa)

        with self._conn.transaction():
            with self._conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT email, dni_cuil
                    FROM empleado
                    WHERE id_empleado = %s AND id_empresa = %s
                    FOR UPDATE
                    """,
                    (id_empleado, id_empresa),
                )
                actual = cur.fetchone()
                if actual is None:
                    return None

                email = cambios.get("email", actual["email"])
                dni_cuil = cambios.get("dni_cuil", actual["dni_cuil"])
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM empleado
                        WHERE id_empleado <> %(id_empleado)s
                          AND (
                              LOWER(email) = LOWER(%(email)s)
                              OR (
                                  id_empresa = %(id_empresa)s
                                  AND regexp_replace(
                                      dni_cuil, '[^0-9]', '', 'g'
                                  ) = %(dni_cuil)s
                              )
                          )
                    ) AS duplicado
                    """,
                    {
                        "id_empleado": id_empleado,
                        "id_empresa": id_empresa,
                        "email": email,
                        "dni_cuil": dni_cuil,
                    },
                )
                if cur.fetchone()["duplicado"]:
                    raise RegistroDuplicado

                asignaciones = ", ".join(
                    f"{campo} = %({campo})s" for campo in cambios
                )
                cur.execute(
                    f"""
                    UPDATE empleado
                    SET {asignaciones}, fecha_modificacion = now()
                    WHERE id_empleado = %(id_empleado)s
                      AND id_empresa = %(id_empresa)s
                    """,
                    {
                        **cambios,
                        "id_empleado": id_empleado,
                        "id_empresa": id_empresa,
                    },
                )
        return self.obtener_de_empresa(id_empleado, id_empresa)

    def actualizar_contrasena(
        self, id_empleado: str, contrasena_hash: str, id_empresa: str
    ) -> bool:
        with self._conn.transaction():
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE recuperacion_contrasena
                    SET consumido_en = now()
                    WHERE id_empleado = %s AND consumido_en IS NULL
                    """,
                    (id_empleado,),
                )
                cur.execute(
                    """
                    UPDATE empleado
                    SET contrasena_hash = %s, fecha_modificacion = now()
                    WHERE id_empleado = %s AND id_empresa = %s
                    RETURNING id_empleado
                    """,
                    (contrasena_hash, id_empleado, id_empresa),
                )
                return cur.fetchone() is not None

    def eliminar(self, id_empleado: str, id_empresa: str) -> bool:
        with self._conn.transaction():
            with self._conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM empleado
                    WHERE id_empleado = %s AND id_empresa = %s
                    RETURNING id_empleado
                    """,
                    (id_empleado, id_empresa),
                )
                return cur.fetchone() is not None

    def registrar_intento(
        self, bucket: str, limite: int, ventana_segundos: int
    ) -> bool:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "DELETE FROM auth_rate_limit "
                "WHERE inicio_ventana < now() - INTERVAL '1 day'"
            )
            cur.execute(
                """
                INSERT INTO auth_rate_limit (bucket_hash, inicio_ventana, intentos)
                VALUES (%(bucket)s, now(), 1)
                ON CONFLICT (bucket_hash) DO UPDATE
                SET inicio_ventana = CASE
                        WHEN auth_rate_limit.inicio_ventana <=
                             now() - (%(ventana)s * INTERVAL '1 second')
                        THEN now() ELSE auth_rate_limit.inicio_ventana
                    END,
                    intentos = CASE
                        WHEN auth_rate_limit.inicio_ventana <=
                             now() - (%(ventana)s * INTERVAL '1 second')
                        THEN 1
                        ELSE LEAST(auth_rate_limit.intentos + 1, %(limite_mas_uno)s)
                    END
                RETURNING intentos
                """,
                {
                    "bucket": bucket,
                    "limite_mas_uno": limite + 1,
                    "ventana": ventana_segundos,
                },
            )
            intentos = cur.fetchone()["intentos"]
            return intentos <= limite

    def registrar(
        self,
        datos: dict[str, Any],
        contrasena_hash: str,
        id_empresa: str,
        rol: str,
    ) -> UsuarioRow:
        with self._conn.transaction():
            with self._conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM empleado
                        WHERE LOWER(email) = LOWER(%(email)s)
                           OR (
                               id_empresa = %(id_empresa)s
                               AND regexp_replace(
                                   dni_cuil, '[^0-9]', '', 'g'
                               ) = %(dni_cuil)s
                           )
                    ) AS duplicado
                    """,
                    {
                        "email": datos["email"],
                        "dni_cuil": datos["dni_cuil"],
                        "id_empresa": id_empresa,
                    },
                )
                if cur.fetchone()["duplicado"]:
                    raise RegistroDuplicado

                cur.execute(
                    """
                    INSERT INTO empleado (
                        apellido, contrasena_hash, dni_cuil, email, fecha_ingreso,
                        nombre, puesto, rol, telefono, id_empresa
                    )
                    VALUES (
                        %(apellido)s, %(contrasena_hash)s, %(dni_cuil)s,
                        %(email)s, %(fecha_ingreso)s, %(nombre)s, %(puesto)s,
                        %(rol)s, %(telefono)s, %(id_empresa)s
                    )
                    RETURNING id_empleado
                    """,
                    {
                        **datos,
                        "contrasena_hash": contrasena_hash,
                        "puesto": datos.get("puesto")
                        or rol.replace("_", " ").title(),
                        "rol": rol,
                        "id_empresa": id_empresa,
                    },
                )
                id_empleado = cur.fetchone()["id_empleado"]
        usuario = self.obtener(id_empleado)
        assert usuario is not None
        return usuario

    def guardar_token_recuperacion(
        self, id_empleado: str, token_hash: str, vence: Any
    ) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE recuperacion_contrasena
                SET consumido_en = now()
                WHERE id_empleado = %s AND consumido_en IS NULL
                """,
                (id_empleado,),
            )
            cur.execute(
                """
                INSERT INTO recuperacion_contrasena (
                    token_hash, id_empleado, vence_en
                )
                VALUES (%s, %s, %s)
                """,
                (token_hash, id_empleado, vence),
            )

    def invalidar_token_recuperacion(self, token_hash: str) -> None:
        with self._conn.cursor() as cur:
            cur.execute(
                """
                UPDATE recuperacion_contrasena
                SET consumido_en = now()
                WHERE token_hash = %s AND consumido_en IS NULL
                """,
                (token_hash,),
            )

    def restablecer_contrasena(
        self, token_hash: str, contrasena_hash: str
    ) -> bool:
        with self._conn.transaction():
            with self._conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    """
                    UPDATE recuperacion_contrasena
                    SET consumido_en = now()
                    WHERE token_hash = %s
                      AND consumido_en IS NULL
                      AND vence_en > now()
                    RETURNING id_empleado
                    """,
                    (token_hash,),
                )
                token = cur.fetchone()
                if token is None:
                    return False
                cur.execute(
                    """
                    UPDATE empleado
                    SET contrasena_hash = %s, fecha_modificacion = now()
                    WHERE id_empleado = %s
                    """,
                    (contrasena_hash, token["id_empleado"]),
                )
                return cur.rowcount == 1


class RegistroCerrado(Exception):
    pass


class RegistroNoAutorizado(Exception):
    pass


class RegistroDuplicado(Exception):
    pass
