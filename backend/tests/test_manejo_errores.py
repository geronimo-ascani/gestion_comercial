import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errores import instalar_manejador_errores
from app.core.middleware import CorrelationIdMiddleware


def _app_con_error() -> FastAPI:
    app = FastAPI()
    app.add_middleware(CorrelationIdMiddleware)
    instalar_manejador_errores(app)

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secreto-interno-no-exponer")

    return app


def test_error_500_oculta_causa_y_devuelve_correlacion(
    caplog: logging.LogRecord,
) -> None:
    with caplog.at_level(logging.ERROR, logger="gestion_comercial"):
        with TestClient(
            _app_con_error(), raise_server_exceptions=False
        ) as client:
            respuesta = client.get(
                "/boom", headers={"X-Request-ID": "corr-123"}
            )

    assert respuesta.status_code == 500
    cuerpo = respuesta.json()
    assert "secreto-interno-no-exponer" not in respuesta.text
    assert cuerpo["detail"] == (
        "Ocurrió un error inesperado. Intente nuevamente."
    )
    assert cuerpo["id_correlacion"] == "corr-123"
    assert respuesta.headers["X-Request-ID"] == "corr-123"
    assert "secreto-interno-no-exponer" in caplog.text
    assert "id_correlacion=corr-123" in caplog.text


def test_correlacion_se_genera_cuando_no_viene_en_la_peticion() -> None:
    with TestClient(
        _app_con_error(), raise_server_exceptions=False
    ) as client:
        respuesta = client.get("/boom")

    valor = respuesta.headers["X-Request-ID"]
    assert valor
    assert len(valor) == 32
    assert respuesta.json()["id_correlacion"] == valor
