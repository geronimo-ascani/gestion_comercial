from collections.abc import Iterator
from ipaddress import ip_address
from typing import Any

from fastapi import Request
from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

_pool: ConnectionPool | None = None

_CONTEXTOS = ("id_empleado", "id_correlacion", "ip_cliente", "user_agent")


def open_pool() -> None:
    global _pool
    if _pool is not None:
        return

    settings = get_settings()
    _pool = ConnectionPool(
        conninfo=settings.database_url,
        min_size=0,
        max_size=10,
        kwargs={"row_factory": dict_row},
        open=False,
    )
    _pool.open()


def close_pool() -> None:
    global _pool
    if _pool is None:
        return
    _pool.close()
    _pool = None


def get_pool() -> ConnectionPool:
    if _pool is None:
        raise RuntimeError("El pool de conexiones no está inicializado")
    return _pool


def _ip_valida(valor: str) -> str:
    try:
        ip_address(valor)
    except ValueError:
        return ""
    return valor


def get_db(request: Request) -> Iterator[Connection[dict[str, Any]]]:
    with get_pool().connection() as conn:
        contexto = {
            "id_empleado": "",
            "id_correlacion": getattr(request.state, "id_correlacion", ""),
            "ip_cliente": _ip_valida(
                request.client.host if request.client else ""
            ),
            "user_agent": request.headers.get("user-agent", "")[:500],
        }
        with conn.cursor() as cur:
            for clave, valor in contexto.items():
                cur.execute(
                    "SELECT set_config(%s, %s, false)",
                    (f"app.{clave}", valor),
                )
        conn.commit()
        try:
            yield conn
        finally:
            with conn.cursor() as cur:
                for clave in _CONTEXTOS:
                    cur.execute(
                        "SELECT set_config(%s, NULL, false)", (f"app.{clave}",)
                    )
            conn.rollback()
