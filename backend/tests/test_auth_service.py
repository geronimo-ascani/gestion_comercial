from contextlib import nullcontext
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


class FakeEmpresaRepository:
    def __init__(self, primera: dict | None = None) -> None:
        self.primera = primera
        self.creadas: list[str] = []

    def obtener_primera(self) -> dict | None:
        return self.primera

    def crear_placeholder(self, razon_social: str) -> str:
        self.creadas.append(razon_social)
        return "EMP-0002"


class FakeAuthRepository:
    def __init__(self, usuario: dict | None = None) -> None:
        self.usuario = usuario
        self.usuarios: list[dict] = [usuario] if usuario else []
        self.registro: tuple[dict, str, str, str] | None = None
        self.allow_attempt = True

    def transaction(self):
        return nullcontext()

    def bloquear_registro(self) -> None:
        return None

    def contar(self) -> int:
        return len(self.usuarios)

    def buscar_por_email(self, _email: str) -> dict | None:
        return self.usuario

    def registrar(
        self,
        datos: dict,
        contrasena_hash: str,
        id_empresa: str,
        rol: str,
    ) -> dict:
        self.registro = (datos, contrasena_hash, id_empresa, rol)
        usuario = {
            "id_empleado": "EMP-0001",
            "nombre": datos["nombre"],
            "apellido": datos["apellido"],
            "email": datos["email"],
            "rol": rol,
            "id_empresa": id_empresa,
            "empresa_razon_social": "Empresa de prueba",
            "fecha_modificacion": None,
        }
        self.usuario = usuario
        self.usuarios.append(usuario)
        return usuario

    def obtener(self, id_empleado: str) -> dict | None:
        if self.usuario and self.usuario["id_empleado"] == id_empleado:
            return self.usuario
        return None

    def obtener_de_empresa(
        self, id_empleado: str, id_empresa: str
    ) -> dict | None:
        usuario = self.obtener(id_empleado)
        if usuario is None or usuario.get("id_empresa") != id_empresa:
            return None
        return usuario

    def listar(self, id_empresa: str) -> list[dict]:
        return [
            usuario
            for usuario in self.usuarios
            if usuario.get("id_empresa") == id_empresa
        ]

    def actualizar(
        self, id_empleado: str, datos: dict, id_empresa: str
    ) -> dict | None:
        usuario = self.obtener_de_empresa(id_empleado, id_empresa)
        if usuario is None:
            return None
        usuario.update(datos)
        usuario["fecha_modificacion"] = datetime.now(UTC) + timedelta(seconds=1)
        return usuario

    def actualizar_contrasena(
        self, id_empleado: str, contrasena_hash: str, id_empresa: str
    ) -> bool:
        usuario = self.obtener_de_empresa(id_empleado, id_empresa)
        if usuario is None:
            return False
        usuario["contrasena_hash"] = contrasena_hash
        usuario["fecha_modificacion"] = datetime.now(UTC) + timedelta(seconds=1)
        return True

    def eliminar(self, id_empleado: str, id_empresa: str) -> bool:
        if self.obtener_de_empresa(id_empleado, id_empresa) is None:
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
        "id_empresa": "EMP-0001",
        "empresa_razon_social": "Empresa de prueba",
    }


def test_login_emite_jwt_para_credenciales_validas() -> None:
    repo = FakeAuthRepository(create_usuario("correct-password"))
    service = AuthService(repo, create_settings())

    token, usuario = service.autenticar(
        "admin@example.com", SecretStr("correct-password")
    )

    assert service.decodificar_token(token) == "EMP-0001"
    assert usuario["email"] == "admin@example.com"
    assert usuario["id_empresa"] == "EMP-0001"
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
        "EMP-0001", {"nombre": "Ana María"}, "EMP-0001"
    )

    assert actualizado["nombre"] == "Ana María"
    assert "contrasena_hash" not in actualizado
    assert not service.token_vigente(token, actualizado)


def test_admin_password_update_hashes_password_and_invalidates_sessions() -> None:
    usuario = create_usuario("old-password")
    repo = FakeAuthRepository(usuario)
    service = AuthService(repo, create_settings())
    token, _ = service.autenticar(
        "admin@example.com", SecretStr("old-password")
    )

    service.actualizar_contrasena_empleado(
        "EMP-0001", SecretStr("new-password"), "EMP-0001"
    )

    assert usuario["contrasena_hash"] != "new-password"
    assert PasswordHash.recommended().verify(
        "new-password", usuario["contrasena_hash"]
    )
    assert not service.token_vigente(token, usuario)
    with pytest.raises(CredencialesInvalidas):
        service.autenticar("admin@example.com", SecretStr("old-password"))


def test_actualizar_empleado_traduce_duplicados_y_eliminar_detecta_referencias() -> None:
    class DuplicateRepository(FakeAuthRepository):
        def actualizar(
            self, _id_empleado: str, _datos: dict, _id_empresa: str
        ) -> dict | None:
            raise RegistroDuplicado

    with pytest.raises(AuthDatosDuplicados):
        AuthService(
            DuplicateRepository(create_usuario("password")), create_settings()
        ).actualizar_usuario(
            "EMP-0001", {"email": "used@example.com"}, "EMP-0001"
        )

    class RestrictedRepository(FakeAuthRepository):
        def eliminar(self, _id_empleado: str, _id_empresa: str) -> bool:
            raise errors.RestrictViolation("employee referenced")

    with pytest.raises(EmpleadoEnUso):
        AuthService(
            RestrictedRepository(create_usuario("password")), create_settings()
        ).eliminar_usuario("EMP-0001", "EMP-0001")


def test_actualizar_o_eliminar_empleado_inexistente_responde_no_encontrado() -> None:
    service = AuthService(FakeAuthRepository(), create_settings())

    with pytest.raises(EmpleadoNoEncontrado):
        service.actualizar_usuario("EMP-404", {"nombre": "Ana"}, "EMP-0001")
    with pytest.raises(EmpleadoNoEncontrado):
        service.eliminar_usuario("EMP-404", "EMP-0001")
    with pytest.raises(EmpleadoNoEncontrado):
        service.actualizar_contrasena_empleado(
            "EMP-404", SecretStr("new-password"), "EMP-0001"
        )


def test_eliminar_empleado_sin_referencias_lo_borra() -> None:
    repo = FakeAuthRepository(create_usuario("password"))
    service = AuthService(repo, create_settings())

    service.eliminar_usuario("EMP-0001", "EMP-0001")

    assert repo.usuario is None


def test_registro_publico_del_primer_usuario_usa_la_empresa_inicial() -> None:
    repo = FakeAuthRepository()
    empresas = FakeEmpresaRepository({"id_empresa": "EMP-0001"})
    service = AuthService(repo, create_settings(), empresas)
    datos = {
        "nombre": "Ana",
        "apellido": "Pérez",
        "email": "ana@example.com",
        "password": SecretStr("password-segura"),
    }

    token, usuario = service.registrar_publico(datos)

    assert token is not None
    assert usuario["id_empresa"] == "EMP-0001"
    assert repo.registro is not None
    assert repo.registro[1] != "password-segura"
    assert PasswordHash.recommended().verify(
        "password-segura", repo.registro[1]
    )
    assert repo.registro[2] == "EMP-0001"
    assert repo.registro[3] == "administrador"
    assert empresas.creadas == []


def test_registro_publico_posterior_crea_una_empresa_aislada() -> None:
    repo = FakeAuthRepository(create_usuario("password"))
    empresas = FakeEmpresaRepository({"id_empresa": "EMP-0001"})
    service = AuthService(repo, create_settings(), empresas)
    datos = {
        "nombre": "Ana",
        "apellido": "Pérez",
        "email": "ana@example.com",
        "password": SecretStr("password-segura"),
    }

    token, usuario = service.registrar_publico(datos)

    assert token is not None
    assert usuario["id_empresa"] == "EMP-0002"
    assert repo.registro is not None
    assert repo.registro[2] == "EMP-0002"
    assert empresas.creadas == ["Empresa de Ana Pérez"]


def test_registrar_empleado_queda_en_la_empresa_indicada() -> None:
    repo = FakeAuthRepository()
    service = AuthService(repo, create_settings(), FakeEmpresaRepository())
    datos = {
        "nombre": "Beto",
        "apellido": "Gómez",
        "email": "beto@example.com",
        "password": SecretStr("password-segura"),
        "rol": "ventas",
    }

    empleado = service.registrar_empleado(datos, "EMP-0007")

    assert empleado["id_empresa"] == "EMP-0007"
    assert repo.registro is not None
    assert repo.registro[2] == "EMP-0007"
    assert repo.registro[3] == "ventas"


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
