from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_comprobante_service, get_pago_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.comprobantes import router
from app.services.comprobante_service import (
    ComprobanteEnvioFallido,
    ComprobanteEnvioNoConfigurado,
    ComprobanteEstadoInvalido,
    ComprobanteNoEncontrado,
)
from app.services.pago_service import PagoDatosInvalidos

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

_CLIENTE = {
    "id_cliente": "CLI-0001",
    "nombre": "Cliente",
    "apellido": "Prueba",
    "dni_cuit": "20111111112",
    "email": "cliente@example.com",
    "telefono": "123456",
    "condicion_iva_codigo": "5",
    "condicion_iva_descripcion": "Consumidor Final",
}

_ITEM = {
    "id_producto": "PRD-0001",
    "producto_nombre": "Producto",
    "cantidad": Decimal("1.000"),
    "descuento_producto": Decimal("0"),
    "iva": Decimal("17.36"),
    "neto": Decimal("82.64"),
    "precio_unitario": Decimal("100.00"),
    "subtotal": Decimal("100.00"),
    "tipo_iva": "gravado",
}

_PAGO = {
    "id_pago": "PAG-0001",
    "estado": "aprobado",
    "fecha_pago": date(2026, 11, 18),
    "monto": Decimal("100.00"),
    "referencia": "",
    "id_medio_pago": "MPG-0001",
    "medio_pago": "Efectivo",
    "creado_en": datetime(2026, 11, 18, tzinfo=timezone.utc),
}

_COMPROBANTE = {
    "id_comprobante_venta": "FV-0001",
    "numero_comprobante": "00000001",
    "numero_completo": "0001-00000001",
    "punto_venta": "0001",
    "tipo_comprobante": "B",
    "estado_pago": "emitida",
    "fecha_emision": date(2026, 11, 18),
    "fecha_pago": None,
    "monto": Decimal("100.00"),
    "saldo_pendiente": Decimal("100.00"),
    "total_pagado": Decimal("0"),
    "id_pedido_cliente": "PV-0001",
    "estado_envio": "enviado",
    "descuento_compra": Decimal("0"),
    "entrega_calle": "Test",
    "entrega_altura": "1",
    "entrega_cp": "",
    "entrega_depto": "",
    "entrega_localidad": "CABA",
    "entrega_provincia": "Buenos Aires",
    "observaciones": "",
    "cae": None,
    "cae_vence": None,
    "creado_en": datetime(2026, 11, 18, tzinfo=timezone.utc),
    "id_empresa": "EMP-0001",
    "empresa_razon_social": "Empresa de prueba",
    "cliente_nombre": "Cliente",
    "cliente_apellido": "Prueba",
    "empresa": _EMPRESA,
    "cliente": _CLIENTE,
    "items": [_ITEM],
    "pagos": [],
}

_RESUMEN = {
    key: _COMPROBANTE[key]
    for key in (
        "id_comprobante_venta",
        "numero_comprobante",
        "numero_completo",
        "punto_venta",
        "tipo_comprobante",
        "estado_pago",
        "fecha_emision",
        "monto",
        "saldo_pendiente",
        "id_pedido_cliente",
        "cliente_nombre",
        "cliente_apellido",
        "id_empresa",
        "empresa_razon_social",
    )
}


class FakeComprobanteService:
    def emitir(self, _id_pedido, _datos, _id_empleado):
        return _COMPROBANTE

    def obtener_por_pedido(self, _id_pedido):
        return _COMPROBANTE

    def obtener(self, _id_comprobante):
        return _COMPROBANTE

    def listar(self, _estado, _q, _limit, _offset):
        return [_RESUMEN]

    def enviar(self, _id_comprobante, destinatario=None):
        return {
            "id_envio": 1,
            "destinatario": destinatario or "cliente@example.com",
            "estado": "enviado",
            "error": None,
            "enviado_en": datetime(2026, 11, 18, tzinfo=timezone.utc),
        }

    def listar_envios(self, _id_comprobante):
        return [self.enviar(_id_comprobante)]


class PedidoInexistenteService(FakeComprobanteService):
    def obtener(self, id_comprobante):
        raise ComprobanteNoEncontrado(id_comprobante)


class PedidoNoEmitibleService(FakeComprobanteService):
    def emitir(self, _id_pedido, _datos, _id_empleado):
        raise ComprobanteEstadoInvalido(
            "No se puede emitir el comprobante de un pedido cancelado"
        )


class FakePagoService:
    def listar(self, _id_comprobante):
        return [_PAGO]

    def listar_todos(self, _limit, _offset):
        return [
            {
                **_PAGO,
                "id_comprobante_venta": "FV-0001",
                "numero_comprobante": "00000001",
                "punto_venta": "0001",
                "id_pedido_cliente": "PV-0001",
                "id_cliente": "CLI-0001",
                "cliente_nombre": "Cliente",
                "cliente_apellido": "Prueba",
            }
        ]

    def registrar(self, _id_comprobante, datos):
        return {**_PAGO, "monto": datos.monto}


class PagoInvalidoService(FakePagoService):
    def registrar(self, _id_comprobante, _datos):
        raise PagoDatosInvalidos("El pago excede el saldo pendiente")


class EnvioNoConfiguradoService(FakeComprobanteService):
    def enviar(self, _id_comprobante, destinatario=None):
        raise ComprobanteEnvioNoConfigurado("sin smtp")


class EnvioFallidoService(FakeComprobanteService):
    def enviar(self, _id_comprobante, destinatario=None):
        raise ComprobanteEnvioFallido("timeout")


def _client(
    rol: str,
    comprobante_factory=FakeComprobanteService,
    pago_factory=FakePagoService,
) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_comprobante_service] = comprobante_factory
    app.dependency_overrides[get_pago_service] = pago_factory
    return TestClient(app)


def test_sales_role_can_emit_comprobante() -> None:
    with _client("ventas") as client:
        response = client.post(
            "/api/v1/ventas/pedidos/PV-0001/comprobante", json={}
        )

    assert response.status_code == 200
    assert response.json()["numero_completo"] == "0001-00000001"
    assert response.json()["tipo_comprobante"] == "B"


def test_supply_role_cannot_emit_comprobante() -> None:
    with _client("abastecimiento") as client:
        response = client.post(
            "/api/v1/ventas/pedidos/PV-0001/comprobante", json={}
        )

    assert response.status_code == 403


def test_emission_from_invalid_state_is_conflict() -> None:
    with _client("ventas", PedidoNoEmitibleService) as client:
        response = client.post(
            "/api/v1/ventas/pedidos/PV-0001/comprobante", json={}
        )

    assert response.status_code == 409


def test_missing_comprobante_is_not_found() -> None:
    with _client("ventas", PedidoInexistenteService) as client:
        response = client.get("/api/v1/ventas/comprobantes/FV-9999")

    assert response.status_code == 404


def test_list_and_detail_return_backend_values() -> None:
    with _client("administrador") as client:
        listed = client.get("/api/v1/ventas/comprobantes")
        detail = client.get("/api/v1/ventas/comprobantes/FV-0001")

    assert listed.status_code == 200
    assert listed.json()[0]["estado_pago"] == "emitida"
    assert detail.status_code == 200
    assert detail.json()["empresa"]["razon_social"] == "Empresa de prueba"


def test_register_partial_payment_returns_created() -> None:
    with _client("ventas") as client:
        response = client.post(
            "/api/v1/ventas/comprobantes/FV-0001/pagos",
            json={
                "id_medio_pago": "MPG-0001",
                "monto": "40.00",
            },
        )

    assert response.status_code == 201
    assert response.json()["monto"] == "40.00"


def test_payment_over_balance_is_conflict() -> None:
    with _client("ventas", pago_factory=PagoInvalidoService) as client:
        response = client.post(
            "/api/v1/ventas/comprobantes/FV-0001/pagos",
            json={
                "id_medio_pago": "MPG-0001",
                "monto": "150.00",
            },
        )

    assert response.status_code == 409


def test_send_comprobante_returns_envio() -> None:
    with _client("ventas") as client:
        response = client.post(
            "/api/v1/ventas/comprobantes/FV-0001/envio",
            json={"destinatario": "otro@example.com"},
        )

    assert response.status_code == 200
    assert response.json()["estado"] == "enviado"
    assert response.json()["destinatario"] == "otro@example.com"


def test_send_without_smtp_is_conflict() -> None:
    with _client("ventas", EnvioNoConfiguradoService) as client:
        response = client.post("/api/v1/ventas/comprobantes/FV-0001/envio")

    assert response.status_code == 409


def test_send_failure_is_bad_gateway() -> None:
    with _client("ventas", EnvioFallidoService) as client:
        response = client.post("/api/v1/ventas/comprobantes/FV-0001/envio")

    assert response.status_code == 502


def test_supply_role_cannot_send_comprobante() -> None:
    with _client("abastecimiento") as client:
        response = client.post("/api/v1/ventas/comprobantes/FV-0001/envio")

    assert response.status_code == 403


def test_list_envios_returns_history() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/ventas/comprobantes/FV-0001/envios")

    assert response.status_code == 200
    assert response.json()[0]["estado"] == "enviado"


def test_list_all_payments_includes_comprobante_data() -> None:
    with _client("ventas") as client:
        response = client.get("/api/v1/ventas/pagos")

    assert response.status_code == 200
    assert response.json()[0]["id_comprobante_venta"] == "FV-0001"
    assert response.json()[0]["cliente_nombre"] == "Cliente"
