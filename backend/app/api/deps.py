from typing import Annotated, Any

from fastapi import Depends
from psycopg import Connection

from app.api.security import CurrentUser, get_auth_service
from app.core.db import get_db
from app.repositories.analitica_repository import AnaliticaRepository
from app.repositories.cliente_repository import ClienteRepository
from app.repositories.catalogo_repository import CatalogoRepository
from app.repositories.categoria_repository import CategoriaRepository
from app.repositories.comprobante_repository import ComprobanteRepository
from app.repositories.empresa_repository import EmpresaRepository
from app.repositories.factura_proveedor_repository import (
    FacturaProveedorRepository,
)
from app.repositories.pago_repository import PagoRepository
from app.repositories.movimiento_inventario_repository import (
    MovimientoInventarioRepository,
)
from app.repositories.pedido_compra_repository import PedidoCompraRepository
from app.repositories.pedido_venta_repository import PedidoVentaRepository
from app.repositories.producto_repository import ProductoRepository
from app.repositories.proveedor_repository import ProveedorRepository
from app.repositories.presupuesto_repository import PresupuestoRepository
from app.services.analitica_service import AnaliticaService
from app.services.cliente_service import ClienteService
from app.services.catalogo_service import CatalogoService
from app.services.categoria_service import CategoriaService
from app.services.comprobante_service import ComprobanteService
from app.services.empresa_service import EmpresaService
from app.services.factura_proveedor_service import FacturaProveedorService
from app.services.pago_service import PagoService
from app.services.reporte_cobros_pagos_service import (
    ReporteCobrosPagosService,
)
from app.services.auth_service import AuthService
from app.services.producto_service import ProductoService
from app.services.proveedor_service import ProveedorService
from app.services.presupuesto_service import PresupuestoService
from app.services.pedido_compra_service import PedidoCompraService
from app.services.pedido_venta_service import PedidoVentaService

__all__ = [
    "get_auth_service",
    "get_analitica_service",
    "get_categoria_service",
    "get_producto_service",
    "get_catalogo_service",
    "get_cliente_service",
    "get_proveedor_service",
    "get_pedido_compra_service",
    "get_pedido_venta_service",
    "get_presupuesto_service",
    "get_empresa_service",
    "get_comprobante_service",
    "get_pago_service",
    "get_reporte_cobros_pagos_service",
    "get_factura_proveedor_service",
]

DbDep = Annotated[Connection[dict[str, Any]], Depends(get_db)]


def get_analitica_service(
    db: DbDep,
    usuario: CurrentUser,
) -> AnaliticaService:
    return AnaliticaService(
        AnaliticaRepository(db, usuario["id_empresa"])
    )


def get_categoria_service(
    db: DbDep,
    usuario: CurrentUser,
) -> CategoriaService:
    return CategoriaService(
        CategoriaRepository(db, usuario["id_empresa"])
    )


def get_producto_service(
    db: DbDep,
    usuario: CurrentUser,
) -> ProductoService:
    return ProductoService(
        ProductoRepository(db, usuario["id_empresa"]),
        MovimientoInventarioRepository(db, usuario["id_empresa"]),
    )


def get_catalogo_service(
    db: DbDep,
    usuario: CurrentUser,
) -> CatalogoService:
    return CatalogoService(
        CatalogoRepository(db, usuario["id_empresa"])
    )


def get_cliente_service(
    db: DbDep,
    usuario: CurrentUser,
) -> ClienteService:
    return ClienteService(ClienteRepository(db, usuario["id_empresa"]))


def get_proveedor_service(
    db: DbDep,
    usuario: CurrentUser,
) -> ProveedorService:
    return ProveedorService(ProveedorRepository(db, usuario["id_empresa"]))


def get_pedido_compra_service(
    db: DbDep,
    usuario: CurrentUser,
) -> PedidoCompraService:
    return PedidoCompraService(
        PedidoCompraRepository(db, usuario["id_empresa"]),
        ProductoRepository(db, usuario["id_empresa"]),
        MovimientoInventarioRepository(db, usuario["id_empresa"]),
    )


def get_pedido_venta_service(
    db: DbDep,
    usuario: CurrentUser,
) -> PedidoVentaService:
    return PedidoVentaService(
        PedidoVentaRepository(db, usuario["id_empresa"]),
        ProductoRepository(db, usuario["id_empresa"]),
        MovimientoInventarioRepository(db, usuario["id_empresa"]),
    )


def get_presupuesto_service(
    db: DbDep,
    usuario: CurrentUser,
) -> PresupuestoService:
    return PresupuestoService(
        PresupuestoRepository(db, usuario["id_empresa"]),
        PedidoVentaRepository(db, usuario["id_empresa"]),
        ProductoRepository(db, usuario["id_empresa"]),
        MovimientoInventarioRepository(db, usuario["id_empresa"]),
    )


def get_empresa_service(
    db: DbDep,
) -> EmpresaService:
    return EmpresaService(EmpresaRepository(db))


def get_comprobante_service(
    db: DbDep,
    usuario: CurrentUser,
) -> ComprobanteService:
    return ComprobanteService(
        ComprobanteRepository(db, usuario["id_empresa"]),
        PagoRepository(db, usuario["id_empresa"]),
        EmpresaService(EmpresaRepository(db)),
        id_empresa=usuario["id_empresa"],
    )


def get_pago_service(
    db: DbDep,
    usuario: CurrentUser,
) -> PagoService:
    return PagoService(
        ComprobanteRepository(db, usuario["id_empresa"]),
        PagoRepository(db, usuario["id_empresa"]),
    )


def get_reporte_cobros_pagos_service(
    db: DbDep,
    usuario: CurrentUser,
) -> ReporteCobrosPagosService:
    return ReporteCobrosPagosService(
        PagoRepository(db, usuario["id_empresa"])
    )


def get_factura_proveedor_service(
    db: DbDep,
    usuario: CurrentUser,
) -> FacturaProveedorService:
    return FacturaProveedorService(
        FacturaProveedorRepository(db, usuario["id_empresa"]),
        PagoRepository(db, usuario["id_empresa"]),
        EmpresaService(EmpresaRepository(db)),
        id_empresa=usuario["id_empresa"],
    )
