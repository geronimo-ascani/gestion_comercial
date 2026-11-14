from datetime import UTC, datetime, timedelta
import jwt
import pytest
from fastapi import HTTPException
from pydantic import SecretStr
from pwdlib import PasswordHash
from psycopg import errors

from app.core.config import Settings
from app.api.v1.routers.auth import require_roles
from app.repositories.auth_repository import RegistroDuplicado
from app.services.auth_service import (
    AuthService,
    AuthDatosDuplicados,
    CredencialesInvalidas,
    EmpleadoEnUso,
    EmpleadoNoEncontrado,
    LimiteIntentosExcedido,
)


class FakeAuthRepository:
    def __init__(self, usuario: dict | None = None) -> None:
        self.usuario = usuario
        self.registro: tuple[dict, str, str | None] | None = None
        self.allow_attempt = True

    def buscar_por_email(self, _email: str) -> dict | None:
        return self.usuario

    def registrar(
        self, datos: dict, contrasena_hash: str, administrador_id: str | None
    ) -> tuple[dict, bool]:
        self.registro = (datos, contrasena_hash, administrador_id)
        usuario = {
            "id_empleado": "EMP-0001",
            "nombre": datos["nombre"],
            "apellido": datos["apellido"],
            "email": datos["email"],
            "rol": "administrador",
        }
        return usuario, True

    def obtener(self, id_empleado: str) -> dict | None:
        if self.usuario and self.usuario["id_empleado"] == id_empleado:
            return self.usuario
        return None

    def actualizar(self, id_empleado: str, datos: dict) -> dict | None:
        usuario = self.obtener(id_empleado)
        if usuario is None:
            return None
        usuario.update(datos)
        usuario["fecha_modificacion"] = datetime.now(UTC) + timedelta(seconds=1)
        return usuario

    def eliminar(self, id_empleado: str) -> bool:
        if self.obtener(id_empleado) is None:
            return False
        self.usuario = None
        return True

    def registrar_intento(
        self, _bucket: str, _limite: int, _ventana: int
    ) -> bool:
        return self.allow_attempt


def create_settings() -> Settings:
    return Settings(
        database_url="postgresql://localhost/test",
        jwt_secret_key=SecretStr("t" * 64),
    )


def create_usuario(password: str) -> dict:
    return {
        "id_empleado": "EMP-0001",
        "email": "admin@example.com",
        "contrasena_hash": PasswordHash.recommended().hash(password),
        "rol": "administrador",
    }


def test_login_emite_jwt_para_credenciales_validas() -> None:
    repo = FakeAuthRepository(create_usuario("correct-password"))
    service = AuthService(repo, create_settings())

    token, usuario = service.autenticar(
        "admin@example.com", SecretStr("correct-password")
    )

    assert service.decodificar_token(token) == "EMP-0001"
    assert usuario["email"] == "admin@example.com"
    assert "contrasena_hash" not in usuario


def test_login_usa_error_generico_para_usuario_inexistente_y_password_incorrecta() -> None:
    service = AuthService(FakeAuthRepository(), create_settings())
    with pytest.raises(CredencialesInvalidas):
        service.autenticar("missing@example.com", SecretStr("wrong-password"))

    repo = FakeAuthRepository(create_usuario("correct-password"))
    service = AuthService(repo, create_settings())
    with pytest.raises(CredencialesInvalidas):
        service.autenticar("admin@example.com", SecretStr("wrong-password"))


def test_jwt_expirado_se_rechaza() -> None:
    settings = create_settings()
    service = AuthService(FakeAuthRepository(), settings)
    token = jwt.encode(
        {
            "sub": "EMP-0001",
            "iat": datetime.now(UTC) - timedelta(hours=2),
            "exp": datetime.now(UTC) - timedelta(hours=1),
        },
        settings.jwt_secret_key.get_secret_value(),
        algorithm="HS256",
    )

    with pytest.raises(jwt.ExpiredSignatureError):
        service.decodificar_token(token)


def test_token_queda_invalidado_al_cambiar_la_contrasena() -> None:
    usuario = create_usuario("correct-password")
    repo = FakeAuthRepository(usuario)
    service = AuthService(repo, create_settings())
    token, _ = service.autenticar(
        "admin@example.com", SecretStr("correct-password")
    )
    usuario["fecha_modificacion"] = datetime.now(UTC) + timedelta(seconds=1)

    assert not service.token_vigente(token, usuario)


def test_actualizar_empleado_cambia_fecha_de_modificacion_y_devuelve_datos_publicos() -> None:
    usuario = create_usuario("correct-password")
    repo = FakeAuthRepository(usuario)
    service = AuthService(repo, create_settings())
    token, _ = service.autenticar(
        "admin@example.com", SecretStr("correct-password")
    )

    actualizado = service.actualizar_usuario(
        "EMP-0001", {"nombre": "Ana María"}
    )

    assert actualizado["nombre"] == "Ana María"
    assert "contrasena_hash" not in actualizado
    assert not service.token_vigente(token, actualizado)


def test_actualizar_empleado_traduce_duplicados_y_eliminar_detecta_referencias() -> None:
    class DuplicateRepository(FakeAuthRepository):
        def actualizar(self, _id_empleado: str, _datos: dict) -> dict | None:
            raise RegistroDuplicado

    with pytest.raises(AuthDatosDuplicados):
        AuthService(DuplicateRepository(create_usuario("password")), create_settings()).actualizar_usuario(
            "EMP-0001", {"email": "used@example.com"}
        )

    class RestrictedRepository(FakeAuthRepository):
        def eliminar(self, _id_empleado: str) -> bool:
            raise errors.RestrictViolation("employee referenced")

    with pytest.raises(EmpleadoEnUso):
        AuthService(RestrictedRepository(create_usuario("password")), create_settings()).eliminar_usuario(
            "EMP-0001"
        )


def test_actualizar_o_eliminar_empleado_inexistente_responde_no_encontrado() -> None:
    service = AuthService(FakeAuthRepository(), create_settings())

    with pytest.raises(EmpleadoNoEncontrado):
        service.actualizar_usuario("EMP-404", {"nombre": "Ana"})
    with pytest.raises(EmpleadoNoEncontrado):
        service.eliminar_usuario("EMP-404")


def test_eliminar_empleado_sin_referencias_lo_borra() -> None:
    repo = FakeAuthRepository(create_usuario("password"))
    service = AuthService(repo, create_settings())

    service.eliminar_usuario("EMP-0001")

    assert repo.usuario is None


def test_registrar_hashea_password_y_solo_emite_token_al_primer_usuario() -> None:
    repo = FakeAuthRepository()
    service = AuthService(repo, create_settings())
    datos = {
        "nombre": "Ana",
        "apellido": "Pérez",
        "email": "ana@example.com",
        "password": SecretStr("password-segura"),
    }

    token, _ = service.registrar(datos, None)

    assert token is not None
    assert repo.registro is not None
    assert repo.registro[1] != "password-segura"
    assert PasswordHash.recommended().verify(
        "password-segura", repo.registro[1]
    )
    assert repo.registro[2] is None


def test_rate_limit_rechaza_exceso_de_intentos() -> None:
    repo = FakeAuthRepository()
    repo.allow_attempt = False
    service = AuthService(repo, create_settings())

    with pytest.raises(LimiteIntentosExcedido):
        service.verificar_limite_intentos("login:127.0.0.1", 5, 60)


def test_roles_restringen_operaciones_de_administracion() -> None:
    require_roles("administrador")({"rol": "administrador"})

    with pytest.raises(HTTPException) as error:
        require_roles("administrador")({"rol": "ventas"})

    assert error.value.status_code == 403
