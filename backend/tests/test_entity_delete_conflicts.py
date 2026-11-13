from fastapi import FastAPI
from fastapi.testclient import TestClient
from psycopg import errors

from app.api.deps import get_cliente_service, get_proveedor_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.clientes import router as clientes_router
from app.api.v1.routers.proveedores import router as proveedores_router
from app.services.cliente_service import ClienteService
from app.services.proveedor_service import ProveedorService


class RestrictClienteRepository:
    def obtener(self, _id_cliente):
        return {
            "id_cliente": "CLI-0001",
            "apellido": "Prueba",
            "dni_cuit": "20123456789",
            "email": "cliente@example.invalid",
            "nombre": "Cliente",
            "saldo": 0,
            "telefono": "000",
            "id_condicion_iva": "IVA-0001",
            "condicion_iva_descripcion": "Consumidor final",
            "direccion_altura": "1",
            "direccion_calle": "Test",
            "direccion_cp": "1000",
            "direccion_depto": "",
            "direccion_localidad": "CABA",
            "direccion_provincia": "Buenos Aires",
        }

    def eliminar(self, _id_cliente):
        raise errors.RestrictViolation("cliente referenciado")


class RestrictProveedorRepository:
    def obtener(self, _id_proveedor):
        return {
            "id_proveedor": "PRV-0001",
            "banco": "",
            "cuenta": "",
            "cuit": "20123456789",
            "email": "proveedor@example.invalid",
            "razon_social": "Proveedor de prueba",
            "saldo": 0,
            "telefono": "000",
            "direccion_altura": "1",
            "direccion_calle": "Test",
            "direccion_cp": "1000",
            "direccion_depto": "",
            "direccion_localidad": "CABA",
            "direccion_provincia": "Buenos Aires",
        }

    def eliminar(self, _id_proveedor):
        raise errors.RestrictViolation("proveedor referenciado")


def _client() -> TestClient:
    app = FastAPI()
    app.include_router(clientes_router, prefix="/api/v1")
    app.include_router(proveedores_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": "administrador",
    }
    app.dependency_overrides[get_cliente_service] = lambda: ClienteService(
        RestrictClienteRepository()
    )
    app.dependency_overrides[get_proveedor_service] = lambda: ProveedorService(
        RestrictProveedorRepository()
    )
    return TestClient(app, raise_server_exceptions=False)


def test_delete_cliente_referenciado_responde_409() -> None:
    with _client() as client:
        response = client.delete("/api/v1/clientes/CLI-0001")

    assert response.status_code == 409
    assert "operaciones asociadas" in response.json()["detail"]


def test_delete_proveedor_referenciado_responde_409() -> None:
    with _client() as client:
        response = client.delete("/api/v1/proveedores/PRV-0001")

    assert response.status_code == 409
    assert "órdenes asociadas" in response.json()["detail"]
