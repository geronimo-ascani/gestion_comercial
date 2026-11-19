from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_empresa_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.empresas import router
from app.services.empresa_service import EmpresaNoEncontrada

_EMPRESA = {
    "id_empresa": "EMP-0001",
    "razon_social": "Empresa de prueba",
    "nombre_fantasia": "",
    "cuit": "20111111112",
    "condicion_iva": "responsable_inscripto",
    "domicilio": "Av. Siempre Viva 123",
    "punto_venta": "0001",
    "email": "empresa@example.com",
    "telefono": "123456",
    "activa": True,
    "ingresos_brutos": "",
    "inicio_actividades": None,
    "codigo_postal": "",
    "localidad": "",
    "provincia": "",
}


class FakeEmpresaService:
    def obtener_actual(self, _id_empresa):
        return _EMPRESA

    def actualizar(self, _id_empresa, datos):
        return {**_EMPRESA, **datos.model_dump(exclude_unset=True)}


class EmpresaInexistenteService(FakeEmpresaService):
    def obtener_actual(self, id_empresa):
        raise EmpresaNoEncontrada(id_empresa)


def _client(rol: str, service_factory=FakeEmpresaService) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
        "id_empresa": "EMP-0001",
    }
    app.dependency_overrides[get_empresa_service] = service_factory
    return TestClient(app)


def test_admin_can_read_own_empresa() -> None:
    with _client("administrador") as client:
        response = client.get("/api/v1/empresas")

    assert response.status_code == 200
    assert response.json()[0]["id_empresa"] == "EMP-0001"


def test_sales_cannot_list_empresas() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/empresas")

    assert response.status_code == 403


def test_any_role_can_read_current_empresa() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/empresas/actual")

    assert response.status_code == 200
    assert response.json()["id_empresa"] == "EMP-0001"


def test_admin_can_update_own_empresa() -> None:
    with _client("administrador") as client:
        response = client.put(
            "/api/v1/empresas/EMP-0001",
            json={
                "razon_social": "Nueva empresa",
                "cuit": "20-11111111-2",
                "condicion_iva": "monotributista",
                "punto_venta": "7",
            },
        )

    assert response.status_code == 200
    assert response.json()["cuit"] == "20111111112"
    assert response.json()["punto_venta"] == "00007"


def test_admin_cannot_update_other_empresa() -> None:
    with _client("administrador") as client:
        response = client.put(
            "/api/v1/empresas/EMP-9999",
            json={"razon_social": "Otra empresa"},
        )

    assert response.status_code == 404


def test_sales_cannot_update_empresa() -> None:
    with _client("ventas") as client:
        response = client.put(
            "/api/v1/empresas/EMP-0001",
            json={"razon_social": "Nueva empresa"},
        )

    assert response.status_code == 403


def test_missing_empresa_is_not_found() -> None:
    with _client("ventas", EmpresaInexistenteService) as client:
        response = client.get("/api/v1/empresas/actual")

    assert response.status_code == 404
