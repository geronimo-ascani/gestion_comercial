from fastapi import APIRouter

from app.api.v1.routers import (
    auth,
    catalogo,
    categorias,
    clientes,
    pedidos_compra,
    pedidos_venta,
    productos,
    proveedores,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(categorias.router)
api_router.include_router(productos.router)
api_router.include_router(catalogo.router)
api_router.include_router(clientes.router)
api_router.include_router(proveedores.router)
api_router.include_router(pedidos_compra.router)
api_router.include_router(pedidos_venta.router)
