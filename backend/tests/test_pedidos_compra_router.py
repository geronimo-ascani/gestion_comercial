from datetime import date
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_pedido_compra_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.pedidos_compra import router


_PEDIDO = {
    "id_pedido_proveedor": "OC-0001",
    "estado": "pendiente",
    "fecha_pedido": date(2026, 10, 4),
    "fecha_recepcion": None,
    "total": Decimal("12.50"),
    "id_empleado": "EMP-0001",
    "id_medio_pago": "MPG-0001",
    "medio_pago": "Transferencia",
    "id_proveedor": "PRV-0001",
    "proveedor_nombre": "Proveedor de prueba",
    "items": [
        {
            "id_producto": "PRD-0001",
            "producto_nombre": "Producto de prueba",
            "cantidad": Decimal("1.250"),
            "precio_unitario": Decimal("10.00"),
            "subtotal": Decimal("12.50"),
        }
    ],
}


class FakePedidoCompraService:
    def crear(self, _datos, id_empleado):
        return {**_PEDIDO, "id_empleado": id_empleado}


def _client(rol: str) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_pedido_compra_service] = (
        FakePedidoCompraService
    )
    return TestClient(app)


def test_supply_role_can_create_purchase_order() -> None:
    with _client("abastecimiento") as client:
        response = client.post(
            "/api/v1/compras/pedidos",
            json={
                "id_proveedor": "PRV-0001",
                "id_medio_pago": "MPG-0001",
                "items": [
                    {
                        "id_producto": "PRD-0001",
                        "cantidad": "1.250",
                        "precio_unitario": "10.00",
                    }
                ],
            },
        )

    assert response.status_code == 201
    assert response.json()["id_empleado"] == "EMP-0001"
    assert response.json()["estado"] == "pendiente"


def test_sales_role_cannot_create_purchase_order() -> None:
    with _client("ventas") as client:
        response = client.post(
            "/api/v1/compras/pedidos",
            json={
                "id_proveedor": "PRV-0001",
                "id_medio_pago": "MPG-0001",
                "items": [
                    {
                        "id_producto": "PRD-0001",
                        "cantidad": "1",
                        "precio_unitario": "10",
                    }
                ],
            },
        )

    assert response.status_code == 403
