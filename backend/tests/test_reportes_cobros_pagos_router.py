from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_reporte_cobros_pagos_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.reportes_cobros_pagos import router
from app.services.reporte_cobros_pagos_calculos import (
    ReporteCobrosPagosDatosInvalidos,
)

_DESDE = date(2026, 11, 1)
_HASTA = date(2026, 11, 30)


def _datos() -> dict:
    return {
        "desde": _DESDE,
        "hasta": _HASTA,
        "generado_en": datetime(2026, 11, 30, tzinfo=timezone.utc),
        "parametros": {
            "desde": _DESDE,
            "hasta": _HASTA,
            "id_cliente": None,
            "id_proveedor": None,
        },
        "totales": {
            "cobros_aprobados": Decimal("100.00"),
            "cobros_pendientes": Decimal("20.00"),
            "cobros_rechazados": Decimal("0.00"),
            "pagos_aprobados": Decimal("40.00"),
            "pagos_pendientes": Decimal("0.00"),
            "pagos_rechazados": Decimal("0.00"),
            "cobros_realizados": Decimal("100.00"),
            "pagos_realizados": Decimal("40.00"),
            "neto_realizado": Decimal("60.00"),
        },
        "por_estado": [
            {
                "estado": "aprobado",
                "cobros": {"monto": Decimal("100.00"), "cantidad": 1},
                "pagos": {"monto": Decimal("40.00"), "cantidad": 1},
            },
            {
                "estado": "pendiente",
                "cobros": {"monto": Decimal("20.00"), "cantidad": 1},
                "pagos": {"monto": Decimal("0.00"), "cantidad": 0},
            },
            {
                "estado": "rechazado",
                "cobros": {"monto": Decimal("0.00"), "cantidad": 0},
                "pagos": {"monto": Decimal("0.00"), "cantidad": 0},
            },
        ],
        "por_medio_pago": [
            {
                "id_medio_pago": "MP-0001",
                "medio_pago": "Efectivo",
                "cobros_aprobados": Decimal("100.00"),
                "pagos_aprobados": Decimal("0.00"),
                "total_aprobado": Decimal("100.00"),
            }
        ],
    }


class FakeReporteService:
    def __init__(self, error: Exception | None = None) -> None:
        self.error = error
        self.parametros: dict = {}

    def obtener(self, **kwargs) -> dict:
        self.parametros = kwargs
        if self.error:
            raise self.error
        datos = _datos()
        datos["parametros"] = {
            "desde": kwargs["desde"],
            "hasta": kwargs["hasta"],
            "id_cliente": kwargs.get("id_cliente"),
            "id_proveedor": kwargs.get("id_proveedor"),
        }
        return datos


def _client(rol: str, service=None) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "id_empresa": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_reporte_cobros_pagos_service] = (
        lambda: service or FakeReporteService()
    )
    return TestClient(app)


def test_administrador_puede_obtener_reporte() -> None:
    service = FakeReporteService()
    with _client("administrador", service) as client:
        response = client.get(
            "/api/v1/reportes/cobros-pagos"
            "?desde=2026-11-01&hasta=2026-11-30"
            "&id_cliente=CLI-0001&id_proveedor=PRV-0001"
        )

    assert response.status_code == 200
    body = response.json()
    assert body["parametros"]["desde"] == "2026-11-01"
    assert body["parametros"]["id_cliente"] == "CLI-0001"
    assert body["totales"]["neto_realizado"] == "60.00"
    assert body["por_estado"][0]["cobros"]["cantidad"] == 1
    assert body["por_medio_pago"][0]["medio_pago"] == "Efectivo"
    assert service.parametros == {
        "desde": _DESDE,
        "hasta": _HASTA,
        "id_cliente": "CLI-0001",
        "id_proveedor": "PRV-0001",
    }


def test_reporte_es_admin_only() -> None:
    for rol in ("ventas", "abastecimiento", "invitado"):
        with _client(rol) as client:
            response = client.get(
                "/api/v1/reportes/cobros-pagos"
                "?desde=2026-11-01&hasta=2026-11-30"
            )
        assert response.status_code == 403


def test_rango_invertido_devuelve_422() -> None:
    with _client("administrador") as client:
        response = client.get(
            "/api/v1/reportes/cobros-pagos"
            "?desde=2026-11-30&hasta=2026-11-01"
        )
    assert response.status_code == 422


def test_error_de_rango_del_servicio_devuelve_422() -> None:
    service = FakeReporteService(
        ReporteCobrosPagosDatosInvalidos("Rango inválido")
    )
    with _client("administrador", service) as client:
        response = client.get(
            "/api/v1/reportes/cobros-pagos"
            "?desde=2026-11-01&hasta=2026-11-30"
        )
    assert response.status_code == 422
    assert response.json()["detail"] == "Rango inválido"


def test_faltan_fechas_devuelve_422() -> None:
    with _client("administrador") as client:
        response = client.get("/api/v1/reportes/cobros-pagos?desde=2026-11-01")
    assert response.status_code == 422


def test_pdf_usa_los_mismos_datos_y_solo_pdf() -> None:
    service = FakeReporteService()
    with _client("administrador", service) as client:
        response = client.get(
            "/api/v1/reportes/cobros-pagos/reporte.pdf"
            "?desde=2026-11-01&hasta=2026-11-30&id_cliente=CLI-0001"
        )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.content.startswith(b"%PDF")
    assert "reporte-cobros-pagos.pdf" in response.headers["content-disposition"]
    assert service.parametros["id_cliente"] == "CLI-0001"


def test_pdf_respeta_roles() -> None:
    with _client("ventas") as client:
        response = client.get(
            "/api/v1/reportes/cobros-pagos/reporte.pdf"
            "?desde=2026-11-01&hasta=2026-11-30"
        )
    assert response.status_code == 403
