from contextlib import nullcontext
from datetime import datetime, timezone
from typing import Any

import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.repositories.email_cola_repository import EmailColaRepository
from app.services.email_cola_service import EmailColaService
from app.services.email_service import (
    AdjuntoEmail,
    EmailNoConfigurado,
    ErrorEnvioEmail,
)


def _settings(**cambios: Any) -> Settings:
    valores: dict[str, Any] = {
        "database_url": "postgresql://localhost/test",
        "jwt_secret_key": SecretStr("t" * 64),
        "smtp_host": "smtp.example.com",
        "smtp_sender": "noreply@example.com",
        "email_worker_retry_minutes": 5,
        "email_worker_max_intentos": 3,
    }
    valores.update(cambios)
    return Settings(**valores)


class FakeEmail:
    def __init__(self, error: Exception | None = None) -> None:
        self.configurado = True
        self.error = error
        self.enviados: list[dict[str, Any]] = []

    def enviar(self, **kwargs: Any) -> None:
        if not self.configurado:
            raise EmailNoConfigurado("sin smtp")
        if self.error is not None:
            raise self.error
        self.enviados.append(kwargs)


class FakeColaRepository:
    """Doble del repositorio de outbox para probar el servicio sin PostgreSQL."""

    def __init__(self) -> None:
        self.jobs: list[dict[str, Any]] = []
        self.ultima_empresa: str | None = None

    def para_empresa(self, id_empresa: str) -> "FakeColaRepository":
        self.ultima_empresa = id_empresa
        return self

    def transaction(self):
        return nullcontext()

    def encolar(self, **datos: Any) -> int:
        id_cola = len(self.jobs) + 1
        self.jobs.append(
            {
                "id_cola_email": id_cola,
                "estado": "pendiente",
                "intentos": 0,
                "reclamado_en": None,
                **datos,
            }
        )
        return id_cola

    def vincular_envio(
        self, id_cola_email: int, id_envio: int
    ) -> None:
        for job in self.jobs:
            if job["id_cola_email"] == id_cola_email:
                job["id_envio"] = id_envio
                return

    def _buscar(self, id_cola_email: int) -> dict[str, Any] | None:
        return next(
            (
                job
                for job in self.jobs
                if job["id_cola_email"] == id_cola_email
            ),
            None,
        )

    def reclamar(self, id_cola_email: int) -> dict[str, Any] | None:
        job = self._buscar(id_cola_email)
        if job is None or job["estado"] != "pendiente":
            return None
        job["estado"] = "en_proceso"
        job["reclamado_en"] = datetime.now(timezone.utc)
        return dict(job)

    def reclamar_lote(self, limite: int) -> list[dict[str, Any]]:
        reclamados = []
        for job in self.jobs:
            if len(reclamados) >= limite:
                break
            if job["estado"] != "pendiente":
                continue
            job["estado"] = "en_proceso"
            reclamados.append(dict(job))
        return reclamados

    def reactivar_obsoletos(self, _minutos: float) -> int:
        return 0

    def marcar_enviado(self, id_cola_email: int) -> None:
        job = self._buscar(id_cola_email)
        if job is not None:
            job["estado"] = "enviado"
            job["reclamado_en"] = None

    def marcar_fallido(
        self,
        id_cola_email: int,
        error: str,
        *,
        retry_minutes: float,
        terminal: bool = False,
    ) -> str:
        job = self._buscar(id_cola_email)
        assert job is not None
        job["intentos"] += 1
        job["ultimo_error"] = error
        job["reclamado_en"] = None
        if terminal or job["intentos"] >= job["max_intentos"]:
            job["estado"] = "fallido"
        else:
            job["estado"] = "pendiente"
        return job["estado"]


class FakeCursor:
    def __init__(self, fila: dict[str, Any] | None) -> None:
        self.fila = fila
        self.consultas: list[tuple[str, Any]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def execute(self, consulta: str, parametros: Any = None) -> None:
        self.consultas.append((consulta, parametros))

    def fetchone(self) -> dict[str, Any] | None:
        return self.fila


class FakeConnection:
    def __init__(self, fila: dict[str, Any] | None) -> None:
        self.cursor_fake = FakeCursor(fila)

    def cursor(self, **_kwargs: Any) -> FakeCursor:
        return self.cursor_fake


def test_encolar_usa_la_empresa_y_guarda_el_adjunto() -> None:
    repo = FakeColaRepository()
    servicio = EmailColaService(repo, FakeEmail(), _settings())
    adjunto = AdjuntoEmail("comprobante.pdf", b"%PDF-1.4")

    id_cola = servicio.encolar(
        id_empresa="EMP-0002",
        tipo="comprobante",
        destinatario="cliente@example.com",
        asunto="Comprobante 0001-00000001",
        cuerpo="Cuerpo",
        adjunto_nombre=adjunto.nombre,
        adjunto_contenido=adjunto.contenido,
        reply_to="empresa@example.com",
    )

    assert repo.ultima_empresa == "EMP-0002"
    job = repo.jobs[0]
    assert job["id_cola_email"] == id_cola
    assert job["adjunto_contenido"] == b"%PDF-1.4"
    assert job["reply_to"] == "empresa@example.com"


def test_encolar_sin_smtp_falla() -> None:
    email = FakeEmail()
    email.configurado = False
    servicio = EmailColaService(FakeColaRepository(), email, _settings())

    with pytest.raises(EmailNoConfigurado):
        servicio.encolar(
            id_empresa="EMP-0001",
            tipo="recuperacion",
            destinatario=" usuario@example.com ",
            asunto="Restablecer contraseña",
            cuerpo="Enlace",
        )


def test_procesar_job_envia_y_marca_como_enviado() -> None:
    email = FakeEmail()
    repo = FakeColaRepository()
    servicio = EmailColaService(repo, email, _settings())
    id_cola = servicio.encolar(
        id_empresa="EMP-0001",
        tipo="comprobante",
        destinatario="cliente@example.com",
        asunto="Comprobante",
        cuerpo="Cuerpo",
        cuerpo_html="<p>Cuerpo</p>",
        cc=["cc@example.com"],
        bcc=["bcc@example.com"],
        reply_to="empresa@example.com",
        adjunto_nombre="comprobante.pdf",
        adjunto_contenido=b"%PDF-1.4",
    )

    assert servicio.procesar_job(id_cola) is True

    mensaje = email.enviados[0]
    assert mensaje["destinatario"] == "cliente@example.com"
    assert mensaje["cc"] == ["cc@example.com"]
    assert mensaje["bcc"] == ["bcc@example.com"]
    assert mensaje["reply_to"] == "empresa@example.com"
    assert mensaje["adjuntos"][0].contenido == b"%PDF-1.4"
    assert repo.jobs[0]["estado"] == "enviado"


def test_procesar_job_reintenta_hasta_el_limite() -> None:
    email = FakeEmail(error=ErrorEnvioEmail("timeout"))
    repo = FakeColaRepository()
    servicio = EmailColaService(repo, email, _settings())
    id_cola = servicio.encolar(
        id_empresa="EMP-0001",
        tipo="comprobante",
        destinatario="cliente@example.com",
        asunto="Comprobante",
        cuerpo="Cuerpo",
    )

    assert servicio.procesar_job(id_cola) is False
    assert repo.jobs[0]["estado"] == "pendiente"
    assert repo.jobs[0]["intentos"] == 1

    assert servicio.procesar_job(id_cola) is False
    assert repo.jobs[0]["estado"] == "pendiente"

    assert servicio.procesar_job(id_cola) is False
    assert repo.jobs[0]["estado"] == "fallido"
    assert repo.jobs[0]["intentos"] == 3
    assert len(email.enviados) == 0


def test_sin_smtp_al_procesar_es_fallo_terminal() -> None:
    email = FakeEmail()
    repo = FakeColaRepository()
    servicio = EmailColaService(repo, email, _settings())
    id_cola = servicio.encolar(
        id_empresa="EMP-0001",
        tipo="recuperacion",
        destinatario="usuario@example.com",
        asunto="Restablecer contraseña",
        cuerpo="Enlace",
    )
    email.configurado = False

    assert servicio.procesar_job(id_cola) is False
    assert repo.jobs[0]["estado"] == "fallido"
    assert repo.jobs[0]["intentos"] == 1


def test_fallo_terminal_de_recuperacion_invalida_el_token() -> None:
    fila = {
        "estado": "fallido",
        "tipo": "recuperacion",
        "id_referencia": "hash-del-token",
    }
    repositorio = EmailColaRepository(FakeConnection(fila))

    estado = repositorio.marcar_fallido(
        7, "smtp caído", retry_minutes=5, terminal=True
    )

    assert estado == "fallido"
    consultas = repositorio._conn.cursor_fake.consultas
    assert any("recuperacion_contrasena" in sql for sql, _ in consultas)
    assert any(params == ("hash-del-token",) for _, params in consultas if params)
