from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_cuenta_corriente_service
from app.api.v1.routers.auth import get_current_user
from app.api.v1.routers.cuentas_corrientes import router
from app.services.cuenta_corriente_service import (
    CuentaCorrienteNoEncontrado,
)

_DESDE = date(2026, 11, 1)
_HASTA = date(2026, 11, 30)
_GENERADO = datetime(2026, 11, 30, tzinfo=timezone.utc)


def _resumen(tipo: str) -> dict[str, Any]:
    comun = {
        "saldo_inicial": Decimal("60.00"),
        "total_cargo": Decimal("50.00"),
        "total_abono": Decimal("20.00"),
        "saldo_final": Decimal("90.00"),
        "cantidad_pagos": 1,
        "ultima_actividad": date(2026, 11, 10),
    }
    if tipo == "cliente":
        return {
            "id_cliente": "CLI-0001",
            "nombre": "Ana",
            "apellido": "Pérez",
            "dni_cuit": "30111111",
            "cantidad_comprobantes": 1,
            **comun,
        }
    return {
        "id_proveedor": "PRV-0001",
        "razon_social": "Proveedor SA",
        "cuit": "20111111111",
        "cantidad_facturas": 1,
        **comun,
    }


def _movimiento() -> dict[str, Any]:
    return {
        "id_movimiento": "C-CV-0001",
        "tipo_movimiento": "comprobante",
        "id_origen": "CV-0001",
        "numero": "0001-00000001",
        "fecha": date(2026, 11, 5),
        "descripcion": "Emisión de comprobante",
        "monto": Decimal("50.00"),
        "signo": 1,
        "saldo_resultante": Decimal("110.00"),
        "id_medio_pago": None,
        "medio_pago": None,
    }


def _totales() -> dict[str, Any]:
    return {
        "saldo_inicial": Decimal("60.00"),
        "total_cargo": Decimal("50.00"),
        "total_abono": Decimal("20.00"),
        "saldo_final": Decimal("90.00"),
        "cantidad_operaciones": 2,
        "cantidad_entidades": 1,
    }


class FakeCuentasService:
    def __init__(self) -> None:
        self.parametros: dict[str, Any] = {}

    def _listado(self, tipo: str, **kwargs) -> dict[str, Any]:
        self.parametros = kwargs
        clave = "clientes" if tipo == "cliente" else "proveedores"
        return {
            "desde": kwargs["desde"],
            "hasta": kwargs["hasta"],
            "generado_en": _GENERADO,
            "parametros": {
                "desde": kwargs["desde"],
                "hasta": kwargs["hasta"],
                ("id_cliente" if tipo == "cliente" else "id_proveedor"): kwargs.get(
                    "id_cliente" if tipo == "cliente" else "id_proveedor"
                ),
            },
            "totales": _totales(),
            clave: [_resumen(tipo)],
        }

    def _detalle(self, tipo: str, id_entidad: str, desde, hasta) -> dict[str, Any]:
        if id_entidad.endswith("9999"):
            raise CuentaCorrienteNoEncontrado(id_entidad)
        clave = "cliente" if tipo == "cliente" else "proveedor"
        return {
            "desde": desde,
            "hasta": hasta,
            "generado_en": _GENERADO,
            "parametros": {
                "desde": desde,
                "hasta": hasta,
                ("id_cliente" if tipo == "cliente" else "id_proveedor"): id_entidad,
            },
            clave: {**_resumen(tipo), "movimientos": [_movimiento()]},
        }

    def listar_clientes(self, **kwargs) -> dict[str, Any]:
        return self._listado("cliente", **kwargs)

    def listar_proveedores(self, **kwargs) -> dict[str, Any]:
        return self._listado("proveedor", **kwargs)

    def obtener_cliente(self, id_cliente, desde, hasta) -> dict[str, Any]:
        return self._detalle("cliente", id_cliente, desde, hasta)

    def obtener_proveedor(self, id_proveedor, desde, hasta) -> dict[str, Any]:
        return self._detalle("proveedor", id_proveedor, desde, hasta)


def _client(rol: str, service: FakeCuentasService | None = None) -> TestClient:
    app = FastAPI()
    app.include_router(router, prefix="/api/v1")
    app.dependency_overrides[get_current_user] = lambda: {
        "id_empleado": "EMP-0001",
        "id_empresa": "EMP-0001",
        "rol": rol,
    }
    app.dependency_overrides[get_cuenta_corriente_service] = (
        lambda: service or FakeCuentasService()
    )
    return TestClient(app)


def test_clientes_visible_para_administrador_y_ventas() -> None:
    for rol in ("administrador", "ventas"):
        service = FakeCuentasService()
        with _client(rol, service) as client:
            response = client.get(
                "/api/v1/cuentas-corrientes/clientes"
                "?desde=2026-11-01&hasta=2026-11-30&id_cliente=CLI-0001"
            )
        assert response.status_code == 200
        body = response.json()
        assert body["parametros"]["id_cliente"] == "CLI-0001"
        assert body["clientes"][0]["saldo_final"] == "90.00"
        assert body["totales"]["cantidad_operaciones"] == 2
        assert service.parametros["id_cliente"] == "CLI-0001"


def test_proveedores_visible_para_administrador_y_abastecimiento() -> None:
    for rol in ("administrador", "abastecimiento"):
        with _client(rol) as client:
            response = client.get(
                "/api/v1/cuentas-corrientes/proveedores"
                "?desde=2026-11-01&hasta=2026-11-30"
            )
        assert response.status_code == 200
        assert response.json()["proveedores"][0]["razon_social"] == "Proveedor SA"


def test_permisos_separados_por_tipo_de_cuenta() -> None:
    with _client("abastecimiento") as client:
        response = client.get("/api/v1/cuentas-corrientes/clientes")
    assert response.status_code == 403

    with _client("ventas") as client:
        response = client.get("/api/v1/cuentas-corrientes/proveedores")
    assert response.status_code == 403


def test_detalle_devuelve_movimientos_y_respeta_tenant_por_id() -> None:
    with _client("ventas") as client:
        response = client.get(
            "/api/v1/cuentas-corrientes/clientes/CLI-0001"
            "?desde=2026-11-01&hasta=2026-11-30"
        )
        missing = client.get(
            "/api/v1/cuentas-corrientes/clientes/CLI-9999"
            "?desde=2026-11-01&hasta=2026-11-30"
        )

    assert response.status_code == 200
    assert response.json()["cliente"]["movimientos"][0]["saldo_resultante"] == "110.00"
    assert missing.status_code == 404


def test_rango_invertido_devuelve_422_y_fechas_son_opcionales() -> None:
    with _client("administrador") as client:
        invertido = client.get(
            "/api/v1/cuentas-corrientes/clientes"
            "?desde=2026-11-30&hasta=2026-11-01"
        )
        sin_fechas = client.get("/api/v1/cuentas-corrientes/proveedores")

    assert invertido.status_code == 422
    assert sin_fechas.status_code == 200


def test_no_existen_endpoints_de_pdf() -> None:
    with _client("administrador") as client:
        esquema = client.get("/openapi.json").json()

    rutas_pdf = [
        ruta
        for ruta in esquema["paths"]
        if "cuentas-corrientes" in ruta and "reporte.pdf" in ruta
    ]
    assert rutas_pdf == []
