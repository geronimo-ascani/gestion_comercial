from datetime import date

from .base import SchemaBase, UpdateSchema


class MedioPagoFields(SchemaBase):
    medio_pago: str
    tipo_cobro: str


class MedioPagoCreate(MedioPagoFields):
    pass


class MedioPagoRead(MedioPagoFields):
    id_medio_pago: str


class MedioPagoUpdate(UpdateSchema):
    medio_pago: str | None = None
    tipo_cobro: str | None = None


class ComprobanteVentaFields(SchemaBase):
    estado_pago: str
    fecha_emision: date
    fecha_pago: date | None = None
    monto: float
    tipo_comprobante: str
    id_pedido_cliente: str


class ComprobanteVentaCreate(ComprobanteVentaFields):
    pass


class ComprobanteVentaRead(ComprobanteVentaFields):
    id_comprobante_venta: str


class ComprobanteVentaUpdate(UpdateSchema):
    estado_pago: str | None = None
    fecha_emision: date | None = None
    fecha_pago: date | None = None
    monto: float | None = None
    tipo_comprobante: str | None = None
    id_pedido_cliente: str | None = None


class PagoFields(SchemaBase):
    estado: str
    fecha_pago: date
    monto: float
    referencia: str
    id_comprobante_venta: str
    id_medio_pago: str


class PagoCreate(PagoFields):
    pass


class PagoRead(PagoFields):
    id_pago: str


class PagoUpdate(UpdateSchema):
    estado: str | None = None
    fecha_pago: date | None = None
    monto: float | None = None
    referencia: str | None = None
    id_comprobante_venta: str | None = None
    id_medio_pago: str | None = None
