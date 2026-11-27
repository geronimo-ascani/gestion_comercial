from datetime import date
from decimal import Decimal
from typing import Any

from app.repositories.pago_repository import PagoRepository


class FakeCursor:
    def __init__(self) -> None:
        self.sql = ""
        self.params: Any = None
        self.filas: list[dict[str, Any]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args) -> None:
        return None

    def execute(self, sql: str, params: Any) -> None:
        self.sql = sql
        self.params = params

    def fetchall(self) -> list[dict[str, Any]]:
        return self.filas


class FakeConnection:
    def __init__(self, filas: list[dict[str, Any]] | None = None) -> None:
        self.cursor_usado = FakeCursor()
        self.cursor_usado.filas = filas or []

    def cursor(self, **_kwargs) -> FakeCursor:
        return self.cursor_usado


def _repo(filas: list[dict[str, Any]] | None = None):
    conn = FakeConnection(filas)
    return PagoRepository(conn, "EMP-0002"), conn.cursor_usado


def test_reporte_filtra_por_empresa_y_rango() -> None:
    filas = [
        {
            "id_pago": "PAG-0001",
            "estado": "aprobado",
            "monto": Decimal("100.00"),
            "tipo_pago": "cobro",
            "id_medio_pago": "MP-0001",
            "medio_pago": "Efectivo",
        }
    ]
    repo, cur = _repo(filas)

    resultado = repo.listar_para_reporte(
        date(2026, 11, 1),
        date(2026, 11, 30),
        id_cliente="CLI-0001",
    )

    assert resultado == filas
    assert "p.id_empresa = %(id_empresa)s" in cur.sql
    assert "LEFT JOIN comprobante_venta" in cur.sql
    assert "LEFT JOIN factura_proveedor" in cur.sql
    assert cur.params == {
        "id_empresa": "EMP-0002",
        "desde": date(2026, 11, 1),
        "hasta": date(2026, 11, 30),
        "id_cliente": "CLI-0001",
        "id_proveedor": None,
    }


def test_reporte_separa_cobro_de_pago_por_factura() -> None:
    repo, cur = _repo()

    repo.listar_para_reporte(
        date(2026, 11, 1), date(2026, 11, 30), id_proveedor="PRV-0001"
    )

    assert (
        "CASE WHEN p.id_factura_proveedor IS NULL THEN 'cobro' ELSE 'pago' END"
        in cur.sql
    )
    assert "pv.id_cliente = %(id_cliente)s" in cur.sql
    assert "fp.id_proveedor = %(id_proveedor)s" in cur.sql
    assert cur.params["id_cliente"] is None
    assert cur.params["id_proveedor"] == "PRV-0001"


def test_listado_global_pagos_proveedor() -> None:
    filas = [
        {
            "id_pago": "PAG-0002",
            "id_factura_proveedor": "FP-0001",
            "id_proveedor": "PRV-0001",
            "proveedor_razon_social": "Proveedor SA",
        }
    ]
    repo, cur = _repo(filas)

    resultado = repo.listar_pagos_proveedor(
        id_proveedor="PRV-0001",
        estado="aprobado",
        limit=25,
        offset=5,
    )

    assert resultado == filas
    assert "JOIN factura_proveedor" in cur.sql
    assert "JOIN proveedor" in cur.sql
    assert "p.id_empresa = %(id_empresa)s" in cur.sql
    assert cur.params == {
        "id_empresa": "EMP-0002",
        "desde": None,
        "hasta": None,
        "id_proveedor": "PRV-0001",
        "estado": "aprobado",
        "id_medio_pago": None,
        "limit": 25,
        "offset": 5,
    }
