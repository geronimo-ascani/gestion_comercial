from datetime import date
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row

UsuarioRow = dict[str, Any]

_SELECT_USUARIO = """
SELECT id_empleado, apellido, dni_cuil, email, fecha_alta, fecha_ingreso,
       fecha_modificacion, nombre, puesto, rol, telefono
"""


class AuthRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def transaction(self) -> Any:
        return self._conn.transaction()

    def buscar_por_email(self, email: str) -> UsuarioRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""
                SELECT id_empleado, apellido, dni_cuil, email, fecha_alta,
                       fecha_ingreso, fecha_modificacion, nombre, puesto, rol,
                       telefono, contrasena_hash
                FROM empleado
                WHERE LOWER(email) = LOWER(%s)
                """,
                (email,),
            )
            return cur.fetchone()

    def obtener(self, id_empleado: str) -> UsuarioRow | None:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"{_SELECT_USUARIO} FROM empleado WHERE id_empleado = %s",
                (id_empleado,),
            )
            return cur.fetchone()

    def listar(self) -> list[UsuarioRow]:
        with self._conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"{_SELECT_USUARIO} FROM empleado ORDER BY apellido, nombre")
            return cur.fetchall()

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
        administrador_id: str | None,
    ) -> tuple[UsuarioRow, bool]:
        with self._conn.transaction():
            with self._conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT pg_advisory_xact_lock(734921, 1)")
                cur.execute("SELECT COUNT(*) AS total FROM empleado")
                hay_usuarios = cur.fetchone()["total"] > 0
                if hay_usuarios and administrador_id is None:
                    raise RegistroCerrado
                if hay_usuarios and administrador_id is not None:
                    cur.execute(
                        "SELECT rol FROM empleado WHERE id_empleado = %s",
                        (administrador_id,),
                    )
                    actor = cur.fetchone()
                    if actor is None or actor["rol"] != "administrador":
                        raise RegistroNoAutorizado
                cur.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM empleado
                        WHERE LOWER(email) = LOWER(%(email)s)
                           OR dni_cuil = %(dni_cuil)s
                    ) AS duplicado
                    """,
                    {"email": datos["email"], "dni_cuil": datos["dni_cuil"]},
                )
                if cur.fetchone()["duplicado"]:
                    raise RegistroDuplicado

                rol = datos["rol"] if hay_usuarios else "administrador"
                cur.execute(
                    """
                    INSERT INTO empleado (
                        apellido, contrasena_hash, dni_cuil, email, fecha_ingreso,
                        nombre, puesto, rol, telefono
                    )
                    VALUES (
                        %(apellido)s, %(contrasena_hash)s, %(dni_cuil)s, %(email)s,
                        %(fecha_ingreso)s, %(nombre)s, %(puesto)s, %(rol)s, %(telefono)s
                    )
                    RETURNING id_empleado
                    """,
                    {
                        **datos,
                        "contrasena_hash": contrasena_hash,
                        "puesto": rol.replace("_", " ").title(),
                        "rol": rol,
                    },
                )
                id_empleado = cur.fetchone()["id_empleado"]
            usuario = self.obtener(id_empleado)
            assert usuario is not None
            return usuario, not hay_usuarios

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
