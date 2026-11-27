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
        self.parametros: dict = {}

    def obtener(self, periodo: str, rol: str, **kwargs):
        self.roles.append(rol)
        self.parametros = kwargs
        desde = kwargs.get("desde") or date(2026, 10, 19)
        hasta = kwargs.get("hasta") or date(2026, 11, 17)
        return {
            "periodo": periodo,
            "desde": desde,
            "hasta": hasta,
            "generado_en": datetime(2026, 11, 17, tzinfo=timezone.utc),
            "parametros": {
                "periodo": periodo,
                "desde": desde,
                "hasta": hasta,
                "granularidad": kwargs.get("granularidad") or "diario",
                "limite": kwargs.get("limite") or 10,
                "dias_inmovilizado": kwargs.get("dias_inmovilizado") or 0,
                "id_categoria": kwargs.get("id_categoria"),
                "id_cliente": kwargs.get("id_cliente"),
                "id_proveedor": kwargs.get("id_proveedor"),
                "id_producto": kwargs.get("id_producto"),
                "periodos_pronostico": kwargs.get("periodos_pronostico") or 1,
            },
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
    def obtener(self, periodo: str, rol: str, **kwargs):
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


def test_filtros_avanzados_llegan_al_servicio() -> None:
    service = FakeAnaliticaService()
    with _client("administrador", service) as client:
        response = client.get(
            "/api/v1/analiticas"
            "?periodo=trimestre"
            "&desde=2026-10-01&hasta=2026-11-17"
            "&granularidad=semanal&limite=4&dias_inmovilizado=20"
            "&id_categoria=CAT-0001&id_cliente=CLI-0001"
            "&id_proveedor=PRV-0001&id_producto=PRD-0001"
            "&periodos_pronostico=3"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["desde"] == "2026-10-01"
    assert body["hasta"] == "2026-11-17"
    assert body["parametros"]["granularidad"] == "semanal"
    assert body["parametros"]["dias_inmovilizado"] == 20
    assert body["parametros"]["id_cliente"] == "CLI-0001"
    assert service.parametros["periodos_pronostico"] == 3
    assert service.parametros["id_proveedor"] == "PRV-0001"


def test_parametros_invalidos_devuelven_422() -> None:
    with _client("administrador") as client:
        for query in (
            "granularidad=anual&limite=0",
            "dias_inmovilizado=-1",
            "periodos_pronostico=9",
            "id_cliente=" + "x" * 21,
        ):
            response = client.get(f"/api/v1/analiticas?{query}")
            assert response.status_code == 422


def test_reporte_pdf_usa_el_mismo_servicio_y_solo_pdf() -> None:
    service = FakeAnaliticaService()
    with _client("administrador", service) as client:
        response = client.get("/api/v1/analiticas/reporte.pdf?periodo=mes")

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert "reporte-analitico.pdf" in response.headers["content-disposition"]
    assert service.roles == ["administrador"]


def test_reporte_pdf_respeta_roles_y_parametros() -> None:
    service = FakeAnaliticaService()
    with _client("abastecimiento", service) as client:
        response = client.get(
            "/api/v1/analiticas/reporte.pdf?dias_inmovilizado=45"
        )

    assert response.status_code == 200
    assert service.parametros["dias_inmovilizado"] == 45

    with _client("invitado") as client:
        response = client.get("/api/v1/analiticas/reporte.pdf")

    assert response.status_code == 403
