from datetime import datetime
from decimal import Decimal
from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_producto_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.productos import router
from app.services.producto_service import (
    ProductoDatosInvalidos,
    ProductoService,
)


class FakeProductoService:
    def __init__(self) -> None:
        self.listado: tuple[tuple, dict] | None = None
        self.movimientos: tuple | None = None

    def listar(self, *args, **kwargs):
        self.listado = (args, kwargs)
        return [], 0

    def listar_movimientos_globales(self, *args):
        self.movimientos = args
        return [
            {
                "id_movimiento": "MOV-0001",
                "cantidad": Decimal("2.000"),
                "fecha_movimiento": datetime(2026, 11, 1, 10, 0),
                "motivo": "compra",
                "tipo": "entrada",
                "id_pedido_cliente": None,
                "id_pedido_proveedor": "OC-0001",
                "id_producto": "PRD-0001",
                "producto_nombre": "Producto uno",
            }
        ]


def _client(rol: str, service: FakeProductoService) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_producto_service] = lambda: service
    return TestClient(app)


def test_listado_recibe_filtros_de_costo_stock_y_orden() -> None:
    service = FakeProductoService()
    with _client("administrador", service) as client:
        response = client.get(
            "/api/v1/productos"
            "?precio_compra_min=10&precio_compra_max=20"
            "&stock_min=2.5&stock_max=9.999&orden=stock_desc"
        )

    assert response.status_code == 200
    assert response.json()["total"] == 0
    assert service.listado is not None
    _, kwargs = service.listado
    assert kwargs["precio_compra_min"] == Decimal("10")
    assert kwargs["precio_compra_max"] == Decimal("20")
    assert kwargs["stock_min"] == Decimal("2.5")
    assert kwargs["stock_max"] == Decimal("9.999")
    assert kwargs["orden"] == "stock_desc"


def test_orden_desconocido_y_rangos_invalidos_se_rechazan() -> None:
    service = FakeProductoService()
    with _client("administrador", service) as client:
        response = client.get("/api/v1/productos?orden=drop+table")
        assert response.status_code == 422
        response = client.get("/api/v1/productos?stock_min=-1")
        assert response.status_code == 422

    producto_service = ProductoService(Mock(), Mock())
    for kwargs in (
        {"precio_compra_min": Decimal("20"), "precio_compra_max": Decimal("10")},
        {"stock_min": Decimal("5"), "stock_max": Decimal("2")},
    ):
        with pytest.raises(ProductoDatosInvalidos):
            producto_service.listar(
                None, None, None, None, None, None, "todos", True, 50, 0, **kwargs
            )


def test_movimientos_globales_no_cae_en_la_ruta_por_id() -> None:
    service = FakeProductoService()
    with _client("abastecimiento", service) as client:
        response = client.get(
            "/api/v1/productos/movimientos"
            "?desde=2026-11-01T00:00:00&tipo=entrada"
            "&motivo=compra&id_producto=PRD-0001"
        )

    assert response.status_code == 200
    assert response.json()[0]["id_movimiento"] == "MOV-0001"
    assert service.movimientos is not None
    desde, hasta, tipo, motivo, id_producto, limit, offset = service.movimientos
    assert desde == datetime(2026, 11, 1)
    assert hasta is None
    assert (tipo, motivo, id_producto) == (
        "entrada",
        "compra",
        "PRD-0001",
    )
    assert (limit, offset) == (50, 0)


def test_movimientos_globales_estan_restringidos_por_rol() -> None:
    service = FakeProductoService()
    with _client("ventas", service) as client:
        response = client.get("/api/v1/productos/movimientos")

    assert response.status_code == 403
    assert service.movimientos is None
