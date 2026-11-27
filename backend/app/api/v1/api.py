from fastapi import APIRouter

from app.api.v1.routers import (
    analiticas,
    auth,
    catalogo,
    categorias,
    clientes,
    comprobantes,
    empresas,
    facturas_proveedor,
    pedidos_compra,
    pedidos_venta,
    presupuestos,
    productos,
    proveedores,
    reportes_cobros_pagos,
)

api_router = APIRouter()
api_router.include_router(analiticas.router)
api_router.include_router(auth.router)
api_router.include_router(categorias.router)
api_router.include_router(productos.router)
api_router.include_router(catalogo.router)
api_router.include_router(clientes.router)
api_router.include_router(proveedores.router)
api_router.include_router(pedidos_compra.router)
api_router.include_router(pedidos_venta.router)
api_router.include_router(presupuestos.router)
api_router.include_router(empresas.router)
api_router.include_router(comprobantes.router)
api_router.include_router(facturas_proveedor.router)
api_router.include_router(reportes_cobros_pagos.router)
