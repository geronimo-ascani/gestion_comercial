from dataclasses import dataclass
from email.message import EmailMessage
from smtplib import SMTP, SMTPException, SMTP_SSL

from app.core.config import Settings, get_settings


class EmailError(Exception):
    pass


class EmailNoConfigurado(EmailError):
    pass


class ErrorEnvioEmail(EmailError):
    pass


@dataclass(frozen=True)
class AdjuntoEmail:
    nombre: str
    contenido: bytes
    tipo_mime: str = "application/pdf"


class EmailService:
    """Envío de correo reutilizable para recuperación y comprobantes."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    @property
    def configurado(self) -> bool:
        return bool(self._settings.smtp_host and self._settings.smtp_sender)

    def enviar(
        self,
        destinatario: str,
        asunto: str,
        cuerpo: str,
        cuerpo_html: str | None = None,
        adjuntos: list[AdjuntoEmail] | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
    ) -> None:
        if not self.configurado:
            raise EmailNoConfigurado(
                "El envío de correo no está configurado en el servidor"
            )

        mensaje = EmailMessage()
        mensaje["Subject"] = asunto
        mensaje["From"] = self._settings.smtp_sender
        mensaje["To"] = destinatario
        if cc:
            mensaje["Cc"] = ", ".join(cc)
        if bcc:
            mensaje["Bcc"] = ", ".join(bcc)
        mensaje.set_content(cuerpo)
        if cuerpo_html:
            mensaje.add_alternative(cuerpo_html, subtype="html")
        for adjunto in adjuntos or []:
            maintype, _, subtype = adjunto.tipo_mime.partition("/")
            mensaje.add_attachment(
                adjunto.contenido,
                maintype=maintype or "application",
                subtype=subtype or "octet-stream",
                filename=adjunto.nombre,
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
            raise ErrorEnvioEmail(str(exc)) from exc
