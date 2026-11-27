"""Worker persistente de la cola de correo, ejecutado fuera del event loop."""

import logging
import threading

from app.core.config import get_settings
from app.core.db import get_pool
from app.repositories.email_cola_repository import EmailColaRepository
from app.services.email_cola_service import EmailColaService

logger = logging.getLogger(__name__)

_stop = threading.Event()
_thread: threading.Thread | None = None


def _loop() -> None:
    settings = get_settings()
    while not _stop.is_set():
        try:
            with get_pool().connection() as conn:
                service = EmailColaService(EmailColaRepository(conn))
                service.procesar_lote()
        except Exception:  # noqa: BLE001 - el worker debe sobrevivir al error
            logger.exception("Falló un ciclo del worker de correo")
        _stop.wait(settings.email_worker_interval_seconds)


def iniciar_worker() -> None:
    global _thread
    if _thread is not None and _thread.is_alive():
        return
    _stop.clear()
    _thread = threading.Thread(
        target=_loop, name="email-worker", daemon=True
    )
    _thread.start()


def detener_worker() -> None:
    _stop.set()
    if _thread is not None:
        _thread.join(timeout=5)
