from datetime import date, datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_auth_service
from app.api.v1.routers.auth import get_current_user, router as auth_router
from app.services.auth_service import (
    AuthDatosDuplicados,
    EmpleadoEnUso,
)


_EMPLEADO = {
    "id_empleado": "EMP-0001",
    "apellido": "Pérez",
    "dni_cuil": "20123456789",
    "email": "ana@example.com",
    "fecha_alta": datetime(2026, 1, 1, tzinfo=timezone.utc),
    "fecha_ingreso": date(2026, 1, 1),
    "fecha_modificacion": None,
    "nombre": "Ana",
    "puesto": "Vendedora",
    "rol": "ventas",
    "telefono": "11111111",
}


class FakeAuthService:
    def registrar(self, _datos, _administrador_id):
        return None, dict(_EMPLEADO)

    def listar_usuarios(self):
        return [dict(_EMPLEADO)]

    def obtener_usuario(self, id_empleado):
        return dict(_EMPLEADO) if id_empleado == "EMP-0001" else None

    def actualizar_usuario(self, _id_empleado, _datos):
        raise AuthDatosDuplicados

    def eliminar_usuario(self, _id_empleado):
        raise EmpleadoEnUso


class SuccessfulDeleteAuthService(FakeAuthService):
    def eliminar_usuario(self, _id_empleado):
        return None


def _client(
    role: str = "administrador",
    service_factory=FakeAuthService,
) -> TestClient:
    app = FastAPI()
    app.include_router(auth_router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-ADMIN",
        "rol": role,
    }
    app.dependency_overrides[get_auth_service] = service_factory
    return TestClient(app, raise_server_exceptions=False)


def test_admin_puede_crear_listar_y_consultar_empleados() -> None:
    with _client() as client:
        creado = client.post(
            "/api/v1/auth/employees",
            json={
                "apellido": "Pérez",
                "dni_cuil": "20123456789",
                "email": "ANA@example.com",
                "fecha_ingreso": "2026-01-01",
                "nombre": "Ana",
                "password": "password-segura",
                "puesto": "Vendedora",
                "rol": "ventas",
                "telefono": "11111111",
            },
        )
        listado = client.get("/api/v1/auth/employees")
        detalle = client.get("/api/v1/auth/employees/EMP-0001")

    assert creado.status_code == 201
    assert creado.json()["email"] == "ana@example.com"
    assert "password" not in creado.json()
    assert listado.status_code == 200
    assert detalle.status_code == 200


def test_empleado_no_administrador_no_puede_gestionar_empleados() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/auth/employees")

    assert response.status_code == 403


def test_actualizacion_duplicada_y_baja_referenciada_responden_conflicto() -> None:
    with _client() as client:
        actualizado = client.patch(
            "/api/v1/auth/employees/EMP-0001",
            json={"email": "duplicado@example.com"},
        )
        eliminado = client.delete("/api/v1/auth/employees/EMP-0001")

    assert actualizado.status_code == 409
    assert eliminado.status_code == 409
    assert "no se puede eliminar" in eliminado.json()["detail"]


def test_admin_puede_eliminar_fisicamente_empleado_sin_referencias() -> None:
    with _client(service_factory=SuccessfulDeleteAuthService) as client:
        response = client.delete("/api/v1/auth/employees/EMP-0001")

    assert response.status_code == 204
    assert response.content == b""
