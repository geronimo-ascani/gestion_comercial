from datetime import date, datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_analitica_service
from app.api.v1.routers.analiticas import router
from app.api.v1.routers.auth import get_current_user
from app.services.analitica_calculos import AnaliticaDatosInvalidos


class FakeAnaliticaService:
    def __init__(self) -> None:
        self.roles: list[str] = []

    def obtener(self, periodo: str, rol: str):
        self.roles.append(rol)
        return {
            "periodo": periodo,
            "desde": date(2026, 10, 19),
            "hasta": date(2026, 11, 17),
            "generado_en": datetime(2026, 11, 17, tzinfo=timezone.utc),
            "kpis": {
                "ventas": "150.00",
                "compras": "40.00",
                "gastos": "55.00",
                "neto": "95.00",
                "margen_pct": "63.33",
                "costo_ventas": "40.00",
                "margen_bruto": "40.00",
                "margen_bruto_pct": "50.00",
            }
            if rol != "abastecimiento"
            else None,
        }


class ErrorAnaliticaService:
    def obtener(self, periodo: str, rol: str):
        raise AnaliticaDatosInvalidos("Período desconocido")


def _client(rol: str, service=None) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_analitica_service] = (
        lambda: service or FakeAnaliticaService()
    )
    return TestClient(app)


def test_admin_puede_obtener_analiticas() -> None:
    with _client("administrador") as client:
        response = client.get("/api/v1/analiticas?periodo=mes")

    assert response.status_code == 200
    body = response.json()
    assert body["periodo"] == "mes"
    assert body["kpis"]["ventas"] == "150.00"


def test_ventas_puede_obtener_analiticas() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/analiticas?periodo=7d")

    assert response.status_code == 200
    assert response.json()["periodo"] == "7d"


def test_abastecimiento_recibe_secciones_ocultas() -> None:
    with _client("abastecimiento") as client:
        response = client.get("/api/v1/analiticas")

    assert response.status_code == 200
    assert response.json()["kpis"] is None


def test_rol_no_permitido_devuelve_403() -> None:
    with _client("invitado") as client:
        response = client.get("/api/v1/analiticas")

    assert response.status_code == 403


def test_periodo_invalido_devuelve_422() -> None:
    with _client("administrador") as client:
        response = client.get("/api/v1/analiticas?periodo=semana")

    assert response.status_code == 422


def test_error_de_servicio_devuelve_422() -> None:
    with _client("administrador", ErrorAnaliticaService()) as client:
        response = client.get("/api/v1/analiticas")

    assert response.status_code == 422
    assert response.json()["detail"] == "Período desconocido"
