"""Identificador de correlación compartido por logs y respuestas."""

from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class CorrelationIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self._app = app

    async def __call__(
        self, scope: Scope, receive: Receive, send: Send
    ) -> None:
        if scope["type"] != "http":
            await self._app(scope, receive, send)
            return

        headers = dict(scope.get("headers", ()))
        valor = headers.get(b"x-request-id", b"").decode("latin-1").strip()
        id_correlacion = valor[:64] or uuid4().hex
        scope.setdefault("state", {})["id_correlacion"] = id_correlacion

        async def enviar(mensaje: Message) -> None:
            if mensaje["type"] == "http.response.start":
                respuesta = MutableHeaders(scope=mensaje)
                respuesta["X-Request-ID"] = id_correlacion
            await send(mensaje)

        await self._app(scope, receive, enviar)
