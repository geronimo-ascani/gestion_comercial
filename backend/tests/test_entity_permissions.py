from contextlib import nullcontext

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_cliente_service, get_proveedor_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.clientes import router as clientes_router
from app.api.v1.routers.proveedores import router as proveedores_router
from app.services.cliente_service import ClienteService
from app.services.proveedor_service import ProveedorService

_CLIENTE = {
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

_PROVEEDOR = {
    "id_proveedor": "PRV-0001",
    "banco": "Banco Test",
    "cuenta": "000123",
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


class FakeClienteRepository:
    def transaction(self):
        return nullcontext()

    def obtener(self, _id_cliente):
        return dict(_CLIENTE)

    def actualizar(self, _id_cliente, _cambios):
        return True

    def guardar_direccion(self, _id_cliente, _direccion):
        return None

    def dni_cuit_existe(self, _dni_cuit, excluir_id=None):
        return False

    def condicion_iva_existe(self, _id_condicion_iva):
        return True

    def eliminar(self, _id_cliente):
        return True


class FakeProveedorRepository:
    def transaction(self):
        return nullcontext()

    def obtener(self, _id_proveedor):
        return dict(_PROVEEDOR)

    def actualizar(self, _id_proveedor, _cambios):
        return True

    def guardar_direccion(self, _id_proveedor, _direccion):
        return None

    def cuit_existe(self, _cuit, excluir_id=None):
        return False

    def eliminar(self, _id_proveedor):
        return True


def _client(role: str) -> TestClient:
    app = FastAPI()
    app.include_router(clientes_router, prefix="/api/v1")
    app.include_router(proveedores_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": role,
    }
    app.dependency_overrides[get_cliente_service] = lambda: ClienteService(
        FakeClienteRepository()
    )
    app.dependency_overrides[get_proveedor_service] = lambda: ProveedorService(
        FakeProveedorRepository()
    )
    return TestClient(app, raise_server_exceptions=False)


def test_ventas_puede_editar_y_eliminar_clientes() -> None:
    with _client("ventas") as client:
        actualizado = client.patch(
            "/api/v1/clientes/CLI-0001", json={"telefono": "123"}
        )
        eliminado = client.delete("/api/v1/clientes/CLI-0001")

    assert actualizado.status_code == 200
    assert eliminado.status_code == 204


def test_abastecimiento_no_puede_gestionar_clientes() -> None:
    with _client("abastecimiento") as client:
        actualizado = client.patch(
            "/api/v1/clientes/CLI-0001", json={"telefono": "123"}
        )
        eliminado = client.delete("/api/v1/clientes/CLI-0001")

    assert actualizado.status_code == 403
    assert eliminado.status_code == 403


def test_abastecimiento_puede_editar_y_eliminar_proveedores() -> None:
    with _client("abastecimiento") as client:
        actualizado = client.patch(
            "/api/v1/proveedores/PRV-0001", json={"telefono": "123"}
        )
        eliminado = client.delete("/api/v1/proveedores/PRV-0001")

    assert actualizado.status_code == 200
    assert eliminado.status_code == 204


def test_ventas_no_puede_gestionar_proveedores() -> None:
    with _client("ventas") as client:
        actualizado = client.patch(
            "/api/v1/proveedores/PRV-0001", json={"telefono": "123"}
        )
        eliminado = client.delete("/api/v1/proveedores/PRV-0001")

    assert actualizado.status_code == 403
    assert eliminado.status_code == 403
