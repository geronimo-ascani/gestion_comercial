"""Errores 500: causa exacta en el log, mensaje genérico al cliente."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("gestion_comercial")


def instalar_manejador_errores(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def error_inesperado(
        request: Request, exc: Exception
    ) -> JSONResponse:
        id_correlacion = getattr(request.state, "id_correlacion", "-")
        logger.exception(
            "Error inesperado id_correlacion=%s metodo=%s ruta=%s",
            id_correlacion,
            request.method,
            request.url.path,
        )
        contenido: dict[str, Any] = {
            "detail": "Ocurrió un error inesperado. Intente nuevamente.",
            "id_correlacion": id_correlacion,
        }
        return JSONResponse(
            status_code=500,
            content=contenido,
            headers={"X-Request-ID": id_correlacion},
        )
