from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from smtplib import SMTP, SMTPException, SMTP_SSL
from email.message import EmailMessage
from typing import Any

import jwt
from pwdlib import PasswordHash
from pydantic import SecretStr
from psycopg import errors

from app.core.config import Settings, get_settings
from app.repositories.auth_repository import (
    AuthRepository,
    RegistroCerrado,
    RegistroDuplicado,
    RegistroNoAutorizado,
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


class LimiteIntentosExcedido(AuthError):
    pass


class TokenRecuperacionInvalido(AuthError):
    pass


class EmailNoConfigurado(AuthError):
    pass


class ErrorEnvioEmail(AuthError):
    pass


class AuthService:
    def __init__(self, repo: AuthRepository, settings: Settings | None = None) -> None:
        self._repo = repo
        self._settings = settings or get_settings()

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

    def registrar(
        self,
        datos: dict[str, Any],
        administrador_id: str | None,
    ) -> tuple[str | None, dict[str, Any]]:
        try:
            usuario, primer_usuario = self._repo.registrar(
                datos,
                _password_hash.hash(datos["password"].get_secret_value()),
                administrador_id,
            )
        except RegistroCerrado as exc:
            raise RegistroBloqueado from exc
        except RegistroNoAutorizado as exc:
            raise RegistroBloqueado from exc
        except (RegistroDuplicado, errors.UniqueViolation) as exc:
            raise AuthDatosDuplicados from exc
        token = self._crear_token(usuario["id_empleado"]) if primer_usuario else None
        return token, usuario

    def obtener_usuario(self, id_empleado: str) -> dict[str, Any] | None:
        usuario = self._repo.obtener(id_empleado)
        return self._usuario_publico(usuario) if usuario else None

    def listar_usuarios(self) -> list[dict[str, Any]]:
        return [self._usuario_publico(row) for row in self._repo.listar()]

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
        if not self._settings.smtp_host or not self._settings.smtp_sender:
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
        mensaje = EmailMessage()
        mensaje["Subject"] = "Restablecer contraseña"
        mensaje["From"] = self._settings.smtp_sender
        mensaje["To"] = usuario["email"]
        mensaje.set_content(
            "Recibimos una solicitud para restablecer tu contraseña.\n\n"
            f"Usá este enlace dentro de "
            f"{self._settings.password_reset_token_minutes} minutos:\n{url}\n\n"
            "Si no solicitaste el cambio, ignorá este correo."
        )

        try:
            smtp_class = SMTP_SSL if self._settings.smtp_use_ssl else SMTP
            with smtp_class(
                self._settings.smtp_host,
                self._settings.smtp_port,
                timeout=10,
            ) as smtp:
                if (
                    not self._settings.smtp_use_ssl
                    and self._settings.smtp_starttls
                ):
                    smtp.starttls()
                username = self._settings.smtp_username
                password = self._settings.smtp_password
                if username and password:
                    smtp.login(username, password.get_secret_value())
                smtp.send_message(mensaje)
        except (OSError, SMTPException) as exc:
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
