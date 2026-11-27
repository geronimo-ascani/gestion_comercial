from datetime import date
from typing import Any

from app.repositories.cuenta_corriente_repository import (
    CuentaCorrienteRepository,
)


class FakeCursor:
    def __init__(self) -> None:
        self.sql = ""
        self.params: Any = None
        self.filas: list[dict[str, Any]] = []
        self.llamadas: list[tuple[str, Any]] = []

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_args) -> None:
        return None

    def execute(self, sql: str, params: Any) -> None:
        self.sql = sql
        self.params = params
        self.llamadas.append((sql, params))

    def fetchall(self) -> list[dict[str, Any]]:
        return self.filas

    def fetchone(self) -> dict[str, Any] | None:
        return {"existe": True}


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_usado = FakeCursor()

    def cursor(self, **_kwargs) -> FakeCursor:
        return self.cursor_usado


def _repo() -> tuple[CuentaCorrienteRepository, FakeCursor]:
    conn = FakeConnection()
    return CuentaCorrienteRepository(conn, "EMP-0002"), conn.cursor_usado


def test_movimientos_clientes_son_tenant_y_solo_pagos_aprobados() -> None:
    repo, cur = _repo()

    repo.listar_movimientos_clientes(
        date(2026, 11, 30), ids=["CLI-0001"]
    )

    assert "cv.id_empresa = %(id_empresa)s" in cur.sql
    assert "p.estado = 'aprobado'" in cur.sql
    assert "entidad_id = ANY(%(ids)s::text[])" in cur.sql
    assert cur.params == {
        "id_empresa": "EMP-0002",
        "ids": ["CLI-0001"],
        "hasta": date(2026, 11, 30),
    }


def test_movimientos_proveedores_usan_total_como_monto() -> None:
    repo, cur = _repo()

    repo.listar_movimientos_proveedores(hasta=date(2026, 11, 30))

    assert "fp.total AS monto" in cur.sql
    assert "p.estado = 'aprobado'" in cur.sql
    assert "fp.id_empresa = %(id_empresa)s" in cur.sql
    assert cur.params["id_empresa"] == "EMP-0002"
    assert cur.params["ids"] is None


def test_entidades_filtran_por_empresa() -> None:
    repo, cur = _repo()

    repo.listar_clientes(ids=["CLI-0001"])
    repo.listar_proveedores()

    sql_clientes, params_clientes = cur.llamadas[0]
    sql_proveedores, params_proveedores = cur.llamadas[1]
    assert "c.id_empresa = %(id_empresa)s" in sql_clientes
    assert "p.id_empresa = %(id_empresa)s" in sql_proveedores
    assert params_clientes["ids"] == ["CLI-0001"]
    assert params_proveedores["ids"] is None


def test_existencia_de_entidades_usa_fila_diccionario_y_empresa() -> None:
    repo, cur = _repo()

    assert repo.cliente_existe("CLI-0001") is True
    assert repo.proveedor_existe("PRV-0001") is True

    sql_cliente, params_cliente = cur.llamadas[0]
    sql_proveedor, params_proveedor = cur.llamadas[1]
    assert "id_empresa = %s" in sql_cliente
    assert "id_empresa = %s" in sql_proveedor
    assert params_cliente == ("CLI-0001", "EMP-0002")
    assert params_proveedor == ("PRV-0001", "EMP-0002")
