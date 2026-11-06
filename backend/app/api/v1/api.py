from fastapi import APIRouter

from app.api.v1.routers import catalogo, categorias, productos

api_router = APIRouter()
api_router.include_router(categorias.router)
api_router.include_router(productos.router)
api_router.include_router(catalogo.router)
