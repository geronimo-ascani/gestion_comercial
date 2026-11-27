"""Servicio de la cola de correo: encola y despacha mensajes durablemente."""

import logging

from app.core.config import Settings, get_settings
from app.repositories.email_cola_repository import EmailColaRepository, EmailJob
from app.services.email_service import (
    AdjuntoEmail,
    EmailError,
    EmailNoConfigurado,
    EmailService,
)

logger = logging.getLogger(__name__)


class EmailColaService:
    def __init__(
        self,
        repo: EmailColaRepository,
        email: EmailService | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._repo = repo
        self._email = email or EmailService()
        self._settings = settings or get_settings()

    def encolar(
        self,
        *,
        id_empresa: str,
        tipo: str,
        destinatario: str,
        asunto: str,
        cuerpo: str,
        cuerpo_html: str | None = None,
        cc: list[str] | None = None,
        bcc: list[str] | None = None,
        adjunto_nombre: str | None = None,
        adjunto_contenido: bytes | None = None,
        adjunto_tipo_mime: str = "application/pdf",
        reply_to: str | None = None,
        id_referencia: str | None = None,
        origen: str = "manual",
    ) -> int | None:
        if not self._email.configurado:
            raise EmailNoConfigurado(
                "El envío de correo no está configurado en el servidor"
            )
        repo = self._repo.para_empresa(id_empresa)
        with repo.transaction():
            return repo.encolar(
                tipo=tipo,
                destinatario=destinatario,
                asunto=asunto,
                cuerpo=cuerpo,
                cuerpo_html=cuerpo_html,
                cc=cc,
                bcc=bcc,
                adjunto_nombre=adjunto_nombre,
                adjunto_contenido=adjunto_contenido,
                adjunto_tipo_mime=adjunto_tipo_mime,
                reply_to=reply_to,
                id_referencia=id_referencia,
                origen=origen,
                max_intentos=self._settings.email_worker_max_intentos,
            )

    def vincular_envio(
        self, id_empresa: str, id_cola_email: int | None, id_envio: int
    ) -> None:
        if id_cola_email is None:
            return
        self._repo.para_empresa(id_empresa).vincular_envio(
            id_cola_email, id_envio
        )

    def procesar_job(self, id_cola_email: int) -> bool:
        """Reclama y procesa un job puntual. La usa el `BackgroundTask`."""
        with self._repo.transaction():
            job = self._repo.reclamar(id_cola_email)
        if job is None:
            return False
        return self._procesar_reclamado(job)

    def procesar_lote(self, limite: int = 20) -> int:
        """Reclama y procesa un lote. La usa el worker persistente."""
        with self._repo.transaction():
            self._repo.reactivar_obsoletos(
                self._settings.email_worker_stale_minutes
            )
            trabajos = self._repo.reclamar_lote(limite)
        procesados = 0
        for job in trabajos:
            if self._procesar_reclamado(job):
                procesados += 1
        return procesados

    def _procesar_reclamado(self, job: EmailJob) -> bool:
        id_cola_email = job["id_cola_email"]
        adjuntos: list[AdjuntoEmail] = []
        if job.get("adjunto_contenido"):
            adjuntos.append(
                AdjuntoEmail(
                    nombre=job["adjunto_nombre"] or "adjunto.pdf",
                    contenido=bytes(job["adjunto_contenido"]),
                    tipo_mime=job["adjunto_tipo_mime"],
                )
            )
        try:
            self._email.enviar(
                destinatario=job["destinatario"],
                asunto=job["asunto"],
                cuerpo=job["cuerpo"],
                cuerpo_html=job.get("cuerpo_html"),
                adjuntos=adjuntos,
                cc=list(job.get("cc") or []),
                bcc=list(job.get("bcc") or []),
                reply_to=job.get("reply_to"),
            )
        except EmailNoConfigurado as exc:
            with self._repo.transaction():
                self._repo.marcar_fallido(
                    id_cola_email, str(exc), retry_minutes=0, terminal=True
                )
            return False
        except EmailError as exc:
            with self._repo.transaction():
                self._repo.marcar_fallido(
                    id_cola_email,
                    str(exc),
                    retry_minutes=self._settings.email_worker_retry_minutes,
                )
            return False
        except Exception as exc:  # noqa: BLE001 - el worker no debe morir
            logger.exception("Error inesperado al procesar email_cola %s", id_cola_email)
            with self._repo.transaction():
                self._repo.marcar_fallido(
                    id_cola_email,
                    str(exc),
                    retry_minutes=self._settings.email_worker_retry_minutes,
                )
            return False

        with self._repo.transaction():
            self._repo.marcar_enviado(id_cola_email)
        return True

    def procesar_job_si_existe(self, id_cola_email: int | None) -> bool:
        if id_cola_email is None:
            return False
        return self.procesar_job(id_cola_email)
