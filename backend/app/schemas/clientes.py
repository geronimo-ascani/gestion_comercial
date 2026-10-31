from datetime import date, datetime
from decimal import Decimal

from .base import SchemaBase, UpdateSchema


class ClienteFields(SchemaBase):
    apellido: str
    dni_cuit: str
    email: str
    nombre: str
    saldo: float
    telefono: str
    id_condicion_iva: str


class ClienteCreate(ClienteFields):
    pass


class ClienteRead(ClienteFields):
    id_cliente: str


class ClienteUpdate(UpdateSchema):
    apellido: str | None = None
    dni_cuit: str | None = None
    email: str | None = None
    nombre: str | None = None
    saldo: float | None = None
    telefono: str | None = None
    id_condicion_iva: str | None = None


class DireccionFields(SchemaBase):
    altura: str
    calle: str
    cp: str
    depto: str
    localidad: str
    provincia: str
    id_cliente: str | None = None
    id_proveedor: str | None = None


class DireccionCreate(DireccionFields):
    pass


class DireccionRead(DireccionFields):
    id_direccion: str


class DireccionUpdate(UpdateSchema):
    altura: str | None = None
    calle: str | None = None
    cp: str | None = None
    depto: str | None = None
    localidad: str | None = None
    provincia: str | None = None
    id_cliente: str | None = None
    id_proveedor: str | None = None


class PresupuestoClienteFields(SchemaBase):
    descuento_compra: float
    estado: str
    fecha_creacion: datetime
    fecha_muestra: date
    fecha_vencimiento: date
    total: float
    id_cliente: str


class PresupuestoClienteCreate(PresupuestoClienteFields):
    pass


class PresupuestoClienteRead(PresupuestoClienteFields):
    id_presupuesto_cliente: str


class PresupuestoClienteUpdate(UpdateSchema):
    descuento_compra: float | None = None
    estado: str | None = None
    fecha_creacion: datetime | None = None
    fecha_muestra: date | None = None
    fecha_vencimiento: date | None = None
    total: float | None = None
    id_cliente: str | None = None


class DetallePresupuestoClienteFields(SchemaBase):
    cantidad: Decimal
    descuento_producto: float
    iva: float
    neto: float
    precio_unitario: float
    subtotal: float
    tipo_iva: str


class DetallePresupuestoClienteCreate(DetallePresupuestoClienteFields):
    id_presupuesto_cliente: str
    id_producto: str


class DetallePresupuestoClienteRead(DetallePresupuestoClienteCreate):
    pass


class DetallePresupuestoClienteUpdate(UpdateSchema):
    cantidad: Decimal | None = None
    descuento_producto: float | None = None
    iva: float | None = None
    neto: float | None = None
    precio_unitario: float | None = None
    subtotal: float | None = None
    tipo_iva: str | None = None


class PedidoClienteFields(SchemaBase):
    descuento_compra: float
    entrega_altura: str
    entrega_calle: str
    entrega_cp: str
    entrega_depto: str
    entrega_localidad: str
    estado_envio: str
    fecha_emision: datetime
    fecha_muestra: date
    saldo_pendiente: float
    total: float
    id_cliente: str
    id_presupuesto_cliente: str


class PedidoClienteCreate(PedidoClienteFields):
    pass


class PedidoClienteRead(PedidoClienteFields):
    id_pedido_cliente: str


class PedidoClienteUpdate(UpdateSchema):
    descuento_compra: float | None = None
    entrega_altura: str | None = None
    entrega_calle: str | None = None
    entrega_cp: str | None = None
    entrega_depto: str | None = None
    entrega_localidad: str | None = None
    estado_envio: str | None = None
    fecha_emision: datetime | None = None
    fecha_muestra: date | None = None
    saldo_pendiente: float | None = None
    total: float | None = None
    id_cliente: str | None = None
    id_presupuesto_cliente: str | None = None


class DetallePedidoClienteFields(SchemaBase):
    cantidad: Decimal
    descuento_producto: float
    iva: float
    neto: float
    precio_unitario: float
    subtotal: float
    tipo_iva: str


class DetallePedidoClienteCreate(DetallePedidoClienteFields):
    id_pedido_cliente: str
    id_producto: str


class DetallePedidoClienteRead(DetallePedidoClienteCreate):
    pass


class DetallePedidoClienteUpdate(UpdateSchema):
    cantidad: Decimal | None = None
    descuento_producto: float | None = None
    iva: float | None = None
    neto: float | None = None
    precio_unitario: float | None = None
    subtotal: float | None = None
    tipo_iva: str | None = None
