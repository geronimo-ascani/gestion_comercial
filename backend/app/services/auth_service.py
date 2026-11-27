from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from typing import Any

import jwt
from pwdlib import PasswordHash
from pydantic import SecretStr
from psycopg import errors

from app.core.config import Settings, get_settings
from app.repositories.auth_repository import (
    AuthRepository,
    RegistroDuplicado,
)
from app.repositories.empresa_repository import EmpresaRepository
from app.services.email_cola_service import EmailColaService
from app.services.email_service import (
    EmailNoConfigurado as EmailNoConfiguradoBase,
    EmailService,
    ErrorEnvioEmail as ErrorEnvioEmailBase,
)

_password_hash = PasswordHash.recommended()
_dummy_password_hash = _password_hash.hash("invalid-login-timing-placeholder")


class AuthError(Exception):
    pass


class CredencialesInvalidas(AuthError):
    pass


class RegistroBloqueado(AuthError):
    pass


class AuthDatosDuplicados(AuthError):
    pass


class EmpleadoNoEncontrado(AuthError):
    pass


class EmpleadoEnUso(AuthError):
    pass


class EmpleadoSinCambios(AuthError):
    pass


class LimiteIntentosExcedido(AuthError):
    pass


class TokenRecuperacionInvalido(AuthError):
    pass


class EmailNoConfigurado(AuthError):
    pass


class ErrorEnvioEmail(AuthError):
    pass


def _razon_social_inicial(nombre: str, apellido: str) -> str:
    return f"Empresa de {nombre} {apellido}".strip()[:160]


class AuthService:
    def __init__(
        self,
        repo: AuthRepository,
        settings: Settings | None = None,
        empresa_repo: EmpresaRepository | None = None,
        email_queue: EmailColaService | None = None,
    ) -> None:
        self._repo = repo
        self._settings = settings or get_settings()
        self._email = EmailService(self._settings)
        self._empresas = empresa_repo
        self._correo = email_queue

    def autenticar(self, email: str, password: SecretStr) -> tuple[str, dict[str, Any]]:
        usuario = self._repo.buscar_por_email(email)
        password_hash = (
            usuario["contrasena_hash"] if usuario else _dummy_password_hash
        )
        password_correcta = _password_hash.verify(
            password.get_secret_value(), password_hash
        )
        if usuario is None or not password_correcta:
            raise CredencialesInvalidas
        return self._crear_token(usuario["id_empleado"]), self._usuario_publico(usuario)

    def registrar_publico(
        self, datos: dict[str, Any]
    ) -> tuple[str, dict[str, Any]]:
        """Registra un administrador y su empresa.

        El primer usuario del sistema se asigna a la empresa inicial existente;
        los siguientes obtienen una empresa nueva y aislada.
        """
        if self._empresas is None:
            raise RegistroBloqueado("No se puede crear la empresa")
        try:
            with self._repo.transaction():
                self._repo.bloquear_registro()
                hay_usuarios = self._repo.contar() > 0
                if hay_usuarios:
                    id_empresa = self._empresas.crear_placeholder(
                        _razon_social_inicial(
                            datos["nombre"], datos["apellido"]
                        )
                    )
                else:
                    primera = self._empresas.obtener_primera()
                    id_empresa = (
                        primera["id_empresa"]
                        if primera is not None
                        else self._empresas.crear_placeholder(
                            _razon_social_inicial(
                                datos["nombre"], datos["apellido"]
                            )
                        )
                    )
                usuario = self._repo.registrar(
                    datos,
                    _password_hash.hash(
                        datos["password"].get_secret_value()
                    ),
                    id_empresa,
                    "administrador",
                )
        except (RegistroDuplicado, errors.UniqueViolation) as exc:
            raise AuthDatosDuplicados from exc
        return self._crear_token(usuario["id_empleado"]), self._usuario_publico(
            usuario
        )

    def registrar_empleado(
        self, datos: dict[str, Any], id_empresa: str
    ) -> dict[str, Any]:
        try:
            usuario = self._repo.registrar(
                datos,
                _password_hash.hash(datos["password"].get_secret_value()),
                id_empresa,
                datos["rol"],
            )
        except (RegistroDuplicado, errors.UniqueViolation) as exc:
            raise AuthDatosDuplicados from exc
        return self._usuario_publico(usuario)

    def obtener_usuario(self, id_empleado: str) -> dict[str, Any] | None:
        usuario = self._repo.obtener(id_empleado)
        return self._usuario_publico(usuario) if usuario else None

    def obtener_empleado(
        self, id_empleado: str, id_empresa: str
    ) -> dict[str, Any] | None:
        usuario = self._repo.obtener_de_empresa(id_empleado, id_empresa)
        return self._usuario_publico(usuario) if usuario else None

    def listar_usuarios(self, id_empresa: str) -> list[dict[str, Any]]:
        return [
            self._usuario_publico(row)
            for row in self._repo.listar(id_empresa)
        ]

    def actualizar_usuario(
        self, id_empleado: str, datos: dict[str, Any], id_empresa: str
    ) -> dict[str, Any]:
        cambios = {
            campo: valor
            for campo, valor in datos.items()
            if valor is not None
        }
        if not cambios:
            raise EmpleadoSinCambios
        try:
            empleado = self._repo.actualizar(id_empleado, cambios, id_empresa)
        except (RegistroDuplicado, errors.UniqueViolation) as exc:
            raise AuthDatosDuplicados from exc
        if empleado is None:
            raise EmpleadoNoEncontrado(id_empleado)
        return self._usuario_publico(empleado)

    def actualizar_contrasena_empleado(
        self, id_empleado: str, password: SecretStr, id_empresa: str
    ) -> None:
        actualizado = self._repo.actualizar_contrasena(
            id_empleado,
            _password_hash.hash(password.get_secret_value()),
            id_empresa,
        )
        if not actualizado:
            raise EmpleadoNoEncontrado(id_empleado)

    def eliminar_usuario(self, id_empleado: str, id_empresa: str) -> None:
        try:
            eliminado = self._repo.eliminar(id_empleado, id_empresa)
        except (errors.ForeignKeyViolation, errors.RestrictViolation) as exc:
            raise EmpleadoEnUso(id_empleado) from exc
        if not eliminado:
            raise EmpleadoNoEncontrado(id_empleado)

    def verificar_limite_intentos(
        self, identificador: str, limite: int, ventana_segundos: int
    ) -> None:
        bucket = self._hash_token(identificador)
        if not self._repo.registrar_intento(bucket, limite, ventana_segundos):
            raise LimiteIntentosExcedido

    def decodificar_token(self, token: str) -> str:
        payload = self._decodificar_claims(token)
        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject:
            raise jwt.InvalidTokenError("El token no contiene un usuario válido")
        return subject

    def token_vigente(
        self, token: str, usuario: dict[str, Any]
    ) -> bool:
        payload = self._decodificar_claims(token)
        fecha_modificacion = usuario.get("fecha_modificacion")
        if fecha_modificacion is None:
            return True
        if fecha_modificacion.tzinfo is None:
            fecha_modificacion = fecha_modificacion.replace(tzinfo=UTC)
        emitido = datetime.fromtimestamp(payload["iat"], UTC)
        return fecha_modificacion <= emitido

    def _decodificar_claims(self, token: str) -> dict[str, Any]:
        return jwt.decode(
            token,
            self._settings.jwt_secret_key.get_secret_value(),
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub"]},
        )

    def solicitar_recuperacion(self, email: str) -> None:
        if not self._email.configurado:
            raise EmailNoConfigurado

        usuario = self._repo.buscar_por_email(email)
        if usuario is None:
            return

        token = token_urlsafe(48)
        token_hash = self._hash_token(token)
        vence = datetime.now(UTC) + timedelta(
            minutes=self._settings.password_reset_token_minutes
        )
        self._repo.guardar_token_recuperacion(
            usuario["id_empleado"], token_hash, vence
        )
        url = (
            f"{self._settings.frontend_base_url.rstrip('/')}"
            f"/reset-password?token={token}"
        )

        cuerpo = (
            "Recibimos una solicitud para restablecer tu contraseña.\n\n"
            f"Usá este enlace dentro de "
            f"{self._settings.password_reset_token_minutes} minutos:"
            f"\n{url}\n\n"
            "Si no solicitaste el cambio, ignorá este correo."
        )
        try:
            if self._correo is None:
                raise EmailNoConfiguradoBase(
                    "El envío asíncrono de correo no está configurado"
                )
            self._correo.encolar(
                id_empresa=usuario["id_empresa"],
                tipo="recuperacion",
                id_referencia=token_hash,
                destinatario=usuario["email"],
                asunto="Restablecer contraseña",
                cuerpo=cuerpo,
                origen="automatico",
            )
        except EmailNoConfiguradoBase as exc:
            self._repo.invalidar_token_recuperacion(token_hash)
            raise EmailNoConfigurado from exc
        except ErrorEnvioEmailBase as exc:
            self._repo.invalidar_token_recuperacion(token_hash)
            raise ErrorEnvioEmail from exc

    def restablecer_contrasena(self, token: str, password: SecretStr) -> None:
        actualizado = self._repo.restablecer_contrasena(
            self._hash_token(token),
            _password_hash.hash(password.get_secret_value()),
        )
        if not actualizado:
            raise TokenRecuperacionInvalido

    def _crear_token(self, id_empleado: str) -> str:
        ahora = datetime.now(UTC)
        vence = ahora + timedelta(minutes=self._settings.jwt_access_token_minutes)
        return jwt.encode(
            {"sub": id_empleado, "iat": ahora, "exp": vence},
            self._settings.jwt_secret_key.get_secret_value(),
            algorithm="HS256",
        )

    @staticmethod
    def _hash_token(token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

    @staticmethod
    def _usuario_publico(usuario: dict[str, Any]) -> dict[str, Any]:
        return {key: value for key, value in usuario.items() if key != "contrasena_hash"}
