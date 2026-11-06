from collections.abc import Iterator
from typing import Any

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import get_settings

_pool: ConnectionPool | None = None


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


def get_db() -> Iterator[Connection[dict[str, Any]]]:
    with get_pool().connection() as conn:
        yield conn
