from datetime import datetime
from decimal import Decimal
from typing import Literal

from .base import SchemaBase


class MovimientoInventarioFields(SchemaBase):
    cantidad: Decimal
    fecha_movimiento: datetime
    motivo: Literal["compra", "venta", "devolucion", "ajuste"]
    tipo: Literal["entrada", "salida"]
    id_pedido_cliente: str | None = None
    id_pedido_proveedor: str | None = None
    id_producto: str


class MovimientoInventarioCreate(MovimientoInventarioFields):
    pass


class MovimientoInventarioRead(MovimientoInventarioFields):
    id_movimiento: str
    producto_nombre: str
