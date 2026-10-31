from datetime import date
from decimal import Decimal

from .base import SchemaBase, UpdateSchema


class ProveedorFields(SchemaBase):
    banco: str
    cuenta: str
    cuit: str
    email: str
    razon_social: str
    saldo: float
    telefono: str


class ProveedorCreate(ProveedorFields):
    pass


class ProveedorRead(ProveedorFields):
    id_proveedor: str


class ProveedorUpdate(UpdateSchema):
    banco: str | None = None
    cuenta: str | None = None
    cuit: str | None = None
    email: str | None = None
    razon_social: str | None = None
    saldo: float | None = None
    telefono: str | None = None


class PedidoProveedorFields(SchemaBase):
    estado: str
    fecha_pedido: date
    fecha_recepcion: date
    total: float
    id_empleado: str
    id_medio_pago: str
    id_proveedor: str


class PedidoProveedorCreate(PedidoProveedorFields):
    pass


class PedidoProveedorRead(PedidoProveedorFields):
    id_pedido_proveedor: str


class PedidoProveedorUpdate(UpdateSchema):
    estado: str | None = None
    fecha_pedido: date | None = None
    fecha_recepcion: date | None = None
    total: float | None = None
    id_empleado: str | None = None
    id_medio_pago: str | None = None
    id_proveedor: str | None = None


class DetallePedidoProveedorFields(SchemaBase):
    cantidad: Decimal
    precio_unitario: float
    subtotal: float


class DetallePedidoProveedorCreate(DetallePedidoProveedorFields):
    id_pedido_proveedor: str
    id_producto: str


class DetallePedidoProveedorRead(DetallePedidoProveedorCreate):
    pass


class DetallePedidoProveedorUpdate(UpdateSchema):
    cantidad: Decimal | None = None
    precio_unitario: float | None = None
    subtotal: float | None = None
