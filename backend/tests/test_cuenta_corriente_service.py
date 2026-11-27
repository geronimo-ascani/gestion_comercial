from datetime import date
from decimal import Decimal
from typing import Any

import pytest

from app.services.cliente_service import ClienteService
from app.services.cuenta_corriente_service import (
    CuentaCorrienteNoEncontrado,
    CuentaCorrienteService,
)
from app.services.proveedor_service import ProveedorService

_DESDE = date(2026, 11, 1)
_HASTA = date(2026, 11, 30)


def _movimiento(
    entidad: str,
    fecha: str,
    signo: int,
    monto: str,
    tipo: str,
    origen: str,
) -> dict[str, Any]:
    return {
        "id_movimiento": f"{tipo[:1]}-{origen}",
        "entidad_id": entidad,
        "tipo_movimiento": tipo,
        "id_origen": origen,
        "numero": "0001-00000001" if tipo == "comprobante" else None,
        "fecha": date.fromisoformat(fecha),
        "descripcion": "Movimiento de prueba",
        "monto": Decimal(monto),
        "signo": signo,
        "id_medio_pago": "MP-0001" if tipo == "pago" else None,
        "medio_pago": "Efectivo" if tipo == "pago" else None,
    }


class FakeCuentaRepo:
    def __init__(self) -> None:
        self.clientes = [
            {
                "id": "CLI-0001",
                "nombre": "Ana",
                "apellido": "Pérez",
                "documento": "30111111",
            }
        ]
        self.proveedores = [
            {
                "id": "PRV-0001",
                "nombre": "Proveedor SA",
                "apellido": "",
                "documento": "20111111111",
            }
        ]
        self.movimientos_clientes = [
            _movimiento(
                "CLI-0001", "2026-10-20", 1, "100.00", "comprobante", "CV-1"
            ),
            _movimiento("CLI-0001", "2026-10-25", -1, "40.00", "pago", "PG-1"),
            _movimiento(
                "CLI-0001", "2026-11-05", 1, "50.00", "comprobante", "CV-2"
            ),
            _movimiento("CLI-0001", "2026-11-10", -1, "20.00", "pago", "PG-2"),
        ]
        self.movimientos_proveedores = [
            _movimiento(
                "PRV-0001", "2026-11-03", 1, "121.50", "factura", "FP-1"
            ),
            _movimiento("PRV-0001", "2026-11-09", -1, "21.50", "pago", "PG-3"),
        ]
        self.llamadas: list[tuple] = []

    def listar_clientes(self, ids=None):
        self.llamadas.append(("clientes", ids))
        return [fila for fila in self.clientes if ids is None or fila["id"] in ids]

    def listar_proveedores(self, ids=None):
        self.llamadas.append(("proveedores", ids))
        return [fila for fila in self.proveedores if ids is None or fila["id"] in ids]

    def listar_movimientos_clientes(self, hasta=None, ids=None):
        self.llamadas.append(("movimientos_clientes", hasta, ids))
        return [
            fila
            for fila in self.movimientos_clientes
            if (hasta is None or fila["fecha"] <= hasta)
            and (ids is None or fila["entidad_id"] in ids)
        ]

    def listar_movimientos_proveedores(self, hasta=None, ids=None):
        self.llamadas.append(("movimientos_proveedores", hasta, ids))
        return [
            fila
            for fila in self.movimientos_proveedores
            if (hasta is None or fila["fecha"] <= hasta)
            and (ids is None or fila["entidad_id"] in ids)
        ]

    def cliente_existe(self, id_cliente: str) -> bool:
        return any(fila["id"] == id_cliente for fila in self.clientes)

    def proveedor_existe(self, id_proveedor: str) -> bool:
        return any(fila["id"] == id_proveedor for fila in self.proveedores)


def test_listado_clientes_calcula_saldo_final_y_eco_parametros() -> None:
    repo = FakeCuentaRepo()
    datos = CuentaCorrienteService(repo).listar_clientes(  # type: ignore[arg-type]
        _DESDE, _HASTA
    )

    assert datos["parametros"] == {
        "desde": _DESDE,
        "hasta": _HASTA,
        "id_cliente": None,
    }
    assert datos["clientes"][0]["saldo_inicial"] == Decimal("60.00")
    assert datos["clientes"][0]["saldo_final"] == Decimal("90.00")
    assert datos["totales"]["saldo_final"] == Decimal("90.00")
    assert ("movimientos_clientes", _HASTA, None) in repo.llamadas


def test_detalle_cliente_incluye_movimientos_y_saldos_corrientes() -> None:
    datos = CuentaCorrienteService(FakeCuentaRepo()).obtener_cliente(  # type: ignore[arg-type]
        "CLI-0001", _DESDE, _HASTA
    )

    assert datos["parametros"]["id_cliente"] == "CLI-0001"
    cliente = datos["cliente"]
    assert cliente["id_cliente"] == "CLI-0001"
    assert cliente["cantidad_comprobantes"] == 1
    assert cliente["cantidad_pagos"] == 1
    assert [
        item["saldo_resultante"] for item in cliente["movimientos"]
    ] == [Decimal("110.00"), Decimal("90.00")]


def test_entidad_ajena_devuelve_error_de_servicio() -> None:
    service = CuentaCorrienteService(FakeCuentaRepo())  # type: ignore[arg-type]
    with pytest.raises(CuentaCorrienteNoEncontrado):
        service.obtener_cliente("CLI-9999", _DESDE, _HASTA)
    with pytest.raises(CuentaCorrienteNoEncontrado):
        service.obtener_proveedor("PRV-9999", _DESDE, _HASTA)


def test_detalle_proveedor_deriva_de_facturas_y_pagos_aprobados() -> None:
    datos = CuentaCorrienteService(FakeCuentaRepo()).obtener_proveedor(  # type: ignore[arg-type]
        "PRV-0001", _DESDE, _HASTA
    )

    proveedor = datos["proveedor"]
    assert proveedor["cantidad_facturas"] == 1
    assert proveedor["saldo_inicial"] == Decimal("0.00")
    assert proveedor["saldo_final"] == Decimal("100.00")
    assert proveedor["movimientos"][0]["tipo_movimiento"] == "factura"


class FakeCuentasSaldos:
    def saldos_clientes(self, ids):
        return {"CLI-0001": Decimal("123.45")}

    def saldos_proveedores(self, ids):
        return {"PRV-0001": Decimal("67.89")}


class FakeClienteRepo:
    def _fila(self) -> dict[str, Any]:
        return {
            "id_cliente": "CLI-0001",
            "apellido": "Pérez",
            "dni_cuit": "30111111",
            "email": "ana@example.com",
            "nombre": "Ana",
            "saldo": Decimal("999.99"),
            "telefono": "123",
            "id_condicion_iva": "CI-0001",
            "condicion_iva_descripcion": "Responsable inscripto",
            "direccion_altura": "1",
            "direccion_calle": "Calle",
            "direccion_cp": "1000",
            "direccion_depto": "",
            "direccion_localidad": "Córdoba",
            "direccion_provincia": "Córdoba",
        }

    def listar(self, q, limit, offset):
        return [self._fila()]

    def obtener(self, id_cliente):
        return self._fila()


class FakeProveedorRepo:
    def _fila(self) -> dict[str, Any]:
        return {
            "id_proveedor": "PRV-0001",
            "id_condicion_iva": "CI-0001",
            "banco": "Banco",
            "cuenta": "Cuenta",
            "cuit": "20111111111",
            "email": "proveedor@example.com",
            "razon_social": "Proveedor SA",
            "saldo": Decimal("999.99"),
            "telefono": "123",
            "direccion_altura": "1",
            "direccion_calle": "Calle",
            "direccion_cp": "1000",
            "direccion_depto": "",
            "direccion_localidad": "Córdoba",
            "direccion_provincia": "Córdoba",
        }

    def listar(self, q, limit, offset):
        return [self._fila()]

    def obtener(self, id_proveedor):
        return self._fila()


def test_listados_de_clientes_y_proveedores_usan_saldo_derivado() -> None:
    clientes = ClienteService(  # type: ignore[arg-type]
        FakeClienteRepo(), FakeCuentasSaldos()  # type: ignore[arg-type]
    )
    proveedores = ProveedorService(  # type: ignore[arg-type]
        FakeProveedorRepo(), FakeCuentasSaldos()  # type: ignore[arg-type]
    )

    assert clientes.listar(None, 50, 0)[0]["saldo"] == Decimal("123.45")
    assert clientes.obtener("CLI-0001")["saldo"] == Decimal("123.45")
    assert proveedores.listar(None, 50, 0)[0]["saldo"] == Decimal("67.89")
    assert proveedores.obtener("PRV-0001")["saldo"] == Decimal("67.89")
