from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_catalogo_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.catalogo import router
from app.services.catalogo_service import MedioPagoDuplicado

_MEDIOS = [
    {
        "id_medio_pago": "MPG-0001",
        "medio_pago": "Efectivo",
        "tipo_cobro": "contado",
    },
    {
        "id_medio_pago": "MPG-0002",
        "medio_pago": "Transferencia",
        "tipo_cobro": "transferencia",
    },
]


class FakeCatalogoService:
    def listar_medios_pago(self):
        return _MEDIOS

    def crear_medio_pago(self, datos):
        return {
            "id_medio_pago": "MPG-0003",
            "medio_pago": datos.medio_pago,
            "tipo_cobro": datos.tipo_cobro,
        }


class MedioPagoDuplicadoService(FakeCatalogoService):
    def crear_medio_pago(self, _datos):
        raise MedioPagoDuplicado(
            "Ya existe un medio de pago con ese nombre"
        )


def _client(rol: str, service_factory=FakeCatalogoService) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_catalogo_service] = service_factory
    return TestClient(app)


def test_sales_role_can_list_medios_pago() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/medios-pago")

    assert response.status_code == 200
    assert response.json()[0]["medio_pago"] == "Efectivo"


def test_sales_role_cannot_create_medio_pago() -> None:
    with _client("ventas") as client:
        response = client.post(
            "/api/v1/medios-pago",
            json={"medio_pago": "Cripto", "tipo_cobro": "billetera"},
        )

    assert response.status_code == 403


def test_admin_can_create_medio_pago() -> None:
    with _client("administrador") as client:
        response = client.post(
            "/api/v1/medios-pago",
            json={"medio_pago": "Cripto", "tipo_cobro": "billetera"},
        )

    assert response.status_code == 201
    assert response.json()["medio_pago"] == "Cripto"
    assert response.json()["tipo_cobro"] == "billetera"


def test_duplicate_medio_pago_is_conflict() -> None:
    with _client(
        "administrador", MedioPagoDuplicadoService
    ) as client:
        response = client.post(
            "/api/v1/medios-pago",
            json={"medio_pago": "Efectivo", "tipo_cobro": "contado"},
        )

    assert response.status_code == 409
