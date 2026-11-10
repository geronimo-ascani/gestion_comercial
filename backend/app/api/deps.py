from typing import Annotated, Any

from fastapi import Depends
from psycopg import Connection

from app.core.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.repositories.catalogo_repository import CatalogoRepository
from app.repositories.categoria_repository import CategoriaRepository
from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
)
from app.repositories.producto_repository import ProductoRepository
from app.services.catalogo_service import CatalogoService
from app.services.categoria_service import CategoriaService
from app.services.auth_service import AuthService
from app.services.producto_service import ProductoService


def get_auth_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> AuthService:
    return AuthService(AuthRepository(db))


def get_categoria_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> CategoriaService:
    return CategoriaService(CategoriaRepository(db))


def get_producto_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> ProductoService:
    return ProductoService(
        ProductoRepository(db),
        MovimientoInventarioRepository(db),
    )


def get_catalogo_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> CatalogoService:
    return CatalogoService(CatalogoRepository(db))
