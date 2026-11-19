from types import SimpleNamespace

from app.services import email_service as modulo_email
from app.services.email_service import AdjuntoEmail, EmailService


class FakeSMTP:
    instancias: list["FakeSMTP"] = []

    def __init__(self, host: str, port: int, timeout: float | None = None) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.mensaje = None
        self.starttls_llamadas = 0
        self.credenciales: tuple[str, str] | None = None
        FakeSMTP.instancias.append(self)

    def __enter__(self) -> "FakeSMTP":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def starttls(self) -> None:
        self.starttls_llamadas += 1

    def login(self, usuario: str, contrasena: str) -> None:
        self.credenciales = (usuario, contrasena)

    def send_message(self, mensaje: object) -> None:
        self.mensaje = mensaje


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        smtp_host="smtp.example.com",
        smtp_port=587,
        smtp_username=None,
        smtp_password=None,
        smtp_sender="noreply@example.com",
        smtp_starttls=True,
        smtp_use_ssl=False,
    )


def test_enviar_incluye_cc_bcc_y_adjunto(monkeypatch) -> None:
    FakeSMTP.instancias.clear()
    monkeypatch.setattr(modulo_email, "SMTP", FakeSMTP)
    servicio = EmailService(settings=_settings())

    servicio.enviar(
        destinatario="destinatario@example.com",
        asunto="Comprobante 0001-00000001",
        cuerpo="Cuerpo en texto",
        cuerpo_html="<p>Cuerpo HTML</p>",
        adjuntos=[AdjuntoEmail(nombre="comprobante.pdf", contenido=b"%PDF-1.4")],
        cc=["cc1@example.com", "cc2@example.com"],
        bcc=["bcc@example.com"],
    )

    smtp = FakeSMTP.instancias[-1]
    assert smtp.host == "smtp.example.com"
    assert smtp.starttls_llamadas == 1
    assert smtp.mensaje["Subject"] == "Comprobante 0001-00000001"
    assert smtp.mensaje["From"] == "noreply@example.com"
    assert smtp.mensaje["To"] == "destinatario@example.com"
    assert smtp.mensaje["Cc"] == "cc1@example.com, cc2@example.com"
    assert smtp.mensaje["Bcc"] == "bcc@example.com"
    adjunto = smtp.mensaje.get_payload()[1]
    assert adjunto.get_filename() == "comprobante.pdf"


def test_enviar_sin_copias_no_agrega_headers(monkeypatch) -> None:
    FakeSMTP.instancias.clear()
    monkeypatch.setattr(modulo_email, "SMTP", FakeSMTP)
    servicio = EmailService(settings=_settings())

    servicio.enviar(
        destinatario="destinatario@example.com",
        asunto="Comprobante",
        cuerpo="Cuerpo",
    )

    smtp = FakeSMTP.instancias[-1]
    assert smtp.mensaje["Cc"] is None
    assert smtp.mensaje["Bcc"] is None
