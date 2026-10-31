from datetime import date
from decimal import Decimal

from .base import SchemaBase


class MovimientoInventarioFields(SchemaBase):
    cantidad: Decimal
    fecha_movimiento: date
    motivo: str
    tipo: str
    id_pedido_cliente: str | None = None
    id_pedido_proveedor: str | None = None
    id_producto: str


class MovimientoInventarioCreate(MovimientoInventarioFields):
    pass


class MovimientoInventarioRead(MovimientoInventarioFields):
    id_movimiento: str
