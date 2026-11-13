from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_pedido_venta_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.pedidos_venta import router


_PEDIDO = {
    "id_pedido_cliente": "PV-0001",
    "descuento_compra": Decimal("0"),
    "entrega_altura": "1234",
    "entrega_calle": "Av. Corrientes",
    "entrega_cp": "",
    "entrega_depto": "",
    "entrega_localidad": "CABA",
    "entrega_provincia": "Buenos Aires",
    "estado_envio": "pendiente",
    "fecha_emision": datetime(2026, 10, 4, tzinfo=timezone.utc),
    "fecha_muestra": date(2026, 10, 4),
    "saldo_pendiente": Decimal("12.50"),
    "total": Decimal("12.50"),
    "id_cliente": "CLI-0001",
    "cliente_nombre": "Cliente",
    "cliente_apellido": "Prueba",
    "cliente_email": "cliente@example.com",
    "cliente_telefono": "123456",
    "id_presupuesto_cliente": None,
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


class FakePedidoVentaService:
    def crear(self, _datos):
        return _PEDIDO

    def listar(self, _estado, _q, _limit, _offset):
        return [_PEDIDO]


def _client(rol: str) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_pedido_venta_service] = FakePedidoVentaService
    return TestClient(app)


def test_sales_role_can_create_sales_order() -> None:
    with _client("ventas") as client:
        response = client.post(
            "/api/v1/ventas/pedidos",
            json={
                "id_cliente": "CLI-0001",
                "entrega_provincia": "Buenos Aires",
                "entrega_localidad": "CABA",
                "entrega_calle": "Av. Corrientes",
                "entrega_altura": "1234",
                "items": [
                    {
                        "id_producto": "PRD-0001",
                        "cantidad": "1",
                        "descuento_producto": "0",
                    }
                ],
            },
        )

    assert response.status_code == 201
    assert response.json()["id_pedido_cliente"] == "PV-0001"
    assert response.json()["estado_envio"] == "pendiente"


def test_supply_role_cannot_create_sales_order() -> None:
    with _client("abastecimiento") as client:
        response = client.post(
            "/api/v1/ventas/pedidos",
            json={
                "id_cliente": "CLI-0001",
                "entrega_provincia": "Buenos Aires",
                "entrega_localidad": "CABA",
                "entrega_calle": "Av. Corrientes",
                "entrega_altura": "1234",
                "items": [
                    {
                        "id_producto": "PRD-0001",
                        "cantidad": "1",
                        "descuento_producto": "0",
                    }
                ],
            },
        )

    assert response.status_code == 403
