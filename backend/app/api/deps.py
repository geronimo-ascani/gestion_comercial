from typing import Annotated, Any

from fastapi import Depends
from psycopg import Connection

from app.core.db import get_db
from app.repositories.auth_repository import AuthRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.catalogo_repository import CatalogoRepository
from app.repositories.categoria_repository import CategoriaRepository
from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
)
from app.repositories.pedido_compra_repository import PedidoCompraRepository
from app.repositories.producto_repository import ProductoRepository
from app.repositories.proveedor_repository import ProveedorRepository
from app.services.cliente_service import ClienteService
from app.services.catalogo_service import CatalogoService
from app.services.categoria_service import CategoriaService
from app.services.auth_service import AuthService
from app.services.producto_service import ProductoService
from app.services.proveedor_service import ProveedorService
from app.services.pedido_compra_service import PedidoCompraService


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


def get_cliente_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> ClienteService:
    return ClienteService(ClienteRepository(db))


def get_proveedor_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> ProveedorService:
    return ProveedorService(ProveedorRepository(db))


def get_pedido_compra_service(
    db: Annotated[Connection[dict[str, Any]], Depends(get_db)],
) -> PedidoCompraService:
    return PedidoCompraService(
        PedidoCompraRepository(db),
        ProductoRepository(db),
        MovimientoInventarioRepository(db),
    )
