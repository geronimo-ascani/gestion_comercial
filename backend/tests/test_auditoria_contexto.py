from pathlib import Path
from types import SimpleNamespace
from typing import Any

from app.api.security import get_current_user
from app.core.db import _ip_valida


class _Cursor:
    def __init__(self, registros: list[tuple[str, tuple[Any, ...]]]) -> None:
        self._registros = registros

    def __enter__(self) -> "_Cursor":
        return self

    def __exit__(self, *_args: object) -> bool:
        return False

    def execute(self, sql: str, params: tuple[Any, ...] | None = None) -> None:
        self._registros.append((sql, params or ()))


class _Conexion:
    def __init__(self) -> None:
        self.registros: list[tuple[str, tuple[Any, ...]]] = []
        self.confirmaciones = 0

    def cursor(self) -> _Cursor:
        return _Cursor(self.registros)

    def commit(self) -> None:
        self.confirmaciones += 1


def test_get_current_user_deja_id_empleado_en_la_conexion() -> None:
    db = _Conexion()
    servicio = SimpleNamespace(
        decodificar_token=lambda _token: "EMP-0007",
        obtener_usuario=lambda _id: {
            "id_empleado": "EMP-0007",
            "rol": "administrador",
            "id_empresa": "EMPRESA-1",
            "fecha_modificacion": None,
        },
        token_vigente=lambda _token, _usuario: True,
    )
    credenciales = SimpleNamespace(credentials="token")

    usuario = get_current_user(
        credentials=credenciales,  # type: ignore[arg-type]
        service=servicio,  # type: ignore[arg-type]
        db=db,  # type: ignore[arg-type]
    )

    assert usuario["id_empleado"] == "EMP-0007"
    assert db.confirmaciones == 1
    assert any(
        "app.id_empleado" in sql and params == ("EMP-0007",)
        for sql, params in db.registros
    )


def test_ip_invalida_no_se_propaga_al_trigger() -> None:
    assert _ip_valida("testclient") == ""
    assert _ip_valida("127.0.0.1") == "127.0.0.1"


def test_migracion_auditoria_cuenta_con_masking_e_inmutabilidad() -> None:
    ruta = (
        Path(__file__).resolve().parents[1]
        / "sql"
        / "014_auditoria_multiempresa.sql"
    )
    contenido = ruta.read_text(encoding="utf-8")

    assert "ALTER TABLE log_auditoria" in contenido
    assert "id_empresa VARCHAR(20)" in contenido
    assert "- 'contrasena_hash'" in contenido
    assert "trg_auditoria_inmutable" in contenido
    for tabla in (
        "producto",
        "pedido_cliente",
        "pedido_proveedor",
        "comprobante_venta",
        "factura_proveedor",
    ):
        assert f"'{tabla}'" in contenido
