from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_presupuesto_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.presupuestos import router

_PRESUPUESTO = {
    "id_presupuesto_cliente": "PRE-0001",
    "estado": "pendiente",
    "fecha_creacion": datetime(2026, 11, 13, tzinfo=timezone.utc),
    "fecha_muestra": date(2026, 11, 13),
    "fecha_vencimiento": date(2026, 11, 20),
    "descuento_compra": Decimal("0"),
    "total": Decimal("12.50"),
    "id_cliente": "CLI-0001",
    "cliente_nombre": "Ana",
    "cliente_apellido": "Prueba",
    "items": [
        {
            "id_producto": "PRD-0001",
            "producto_nombre": "Producto",
            "cantidad": Decimal("1.000"),
            "descuento_producto": Decimal("0"),
            "iva": Decimal("2.17"),
            "neto": Decimal("10.33"),
            "precio_unitario": Decimal("12.50"),
            "subtotal": Decimal("12.50"),
            "tipo_iva": "gravado",
        }
    ],
}


class FakePresupuestoService:
    def listar(self, _estado, _q, _limit, _offset):
        return [_PRESUPUESTO]

    def crear(self, _datos):
        return _PRESUPUESTO


def _client(rol: str) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_presupuesto_service] = FakePresupuestoService
    return TestClient(app)


def test_sales_role_can_list_and_create_budgets() -> None:
    with _client("ventas") as client:
        listed = client.get("/api/v1/ventas/presupuestos")
        created = client.post(
            "/api/v1/ventas/presupuestos",
            json={
                "id_cliente": "CLI-0001",
                "fecha_muestra": "2026-11-13",
                "fecha_vencimiento": "2026-11-20",
                "items": [
                    {
                        "id_producto": "PRD-0001",
                        "cantidad": "1.000",
                    }
                ],
            },
        )

    assert listed.status_code == 200
    assert listed.json()[0]["id_presupuesto_cliente"] == "PRE-0001"
    assert created.status_code == 201
    assert created.json()["estado"] == "pendiente"


def test_supply_role_cannot_create_budgets() -> None:
    with _client("abastecimiento") as client:
        response = client.post(
            "/api/v1/ventas/presupuestos",
            json={
                "id_cliente": "CLI-0001",
                "fecha_vencimiento": "2026-11-20",
                "items": [
                    {
                        "id_producto": "PRD-0001",
                        "cantidad": "1",
                    }
                ],
            },
        )

    assert response.status_code == 403
