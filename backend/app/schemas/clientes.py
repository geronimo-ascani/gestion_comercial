import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import Field, field_validator

from .base import SchemaBase, UpdateSchema


class DireccionEntidad(SchemaBase):
    altura: str = Field(min_length=1, max_length=10)
    calle: str = Field(min_length=1, max_length=160)
    cp: str = Field(min_length=1, max_length=10)
    depto: str = Field(default="", max_length=20)
    localidad: str = Field(min_length=1, max_length=120)
    provincia: str = Field(min_length=1, max_length=120)


class DireccionEntidadRead(SchemaBase):
    altura: str
    calle: str
    cp: str
    depto: str
    localidad: str
    provincia: str


class CondicionIVARead(SchemaBase):
    id_condicion_iva: str
    codigo_afip: str
    descripcion: str


class ClienteFields(SchemaBase):
    apellido: str = Field(min_length=1, max_length=120)
    dni_cuit: str = Field(min_length=7, max_length=20)
    email: str = Field(max_length=160)
    nombre: str = Field(min_length=1, max_length=120)
    telefono: str = Field(min_length=1, max_length=40)
    id_condicion_iva: str = Field(min_length=1, max_length=20)
    direccion: DireccionEntidad

    @field_validator("dni_cuit")
    @classmethod
    def validar_dni_cuit(cls, valor: str) -> str:
        digitos = re.sub(r"[^0-9]", "", valor)
        if not 7 <= len(digitos) <= 11:
            raise ValueError("DNI/CUIT debe contener entre 7 y 11 dígitos")
        return digitos

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str) -> str:
        email = valor.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Debe ingresar un correo electrónico válido")
        return email


class ClienteCreate(ClienteFields):
    pass


class ClienteRead(ClienteFields):
    direccion: DireccionEntidadRead
    id_cliente: str
    saldo: Decimal
    condicion_iva_descripcion: str


class ClienteUpdate(UpdateSchema):
    apellido: str | None = Field(default=None, min_length=1, max_length=120)
    dni_cuit: str | None = Field(default=None, min_length=7, max_length=20)
    email: str | None = Field(default=None, max_length=160)
    nombre: str | None = Field(default=None, min_length=1, max_length=120)
    telefono: str | None = Field(default=None, min_length=1, max_length=40)
    id_condicion_iva: str | None = Field(default=None, min_length=1, max_length=20)
    direccion: DireccionEntidad | None = None

    @field_validator("dni_cuit")
    @classmethod
    def validar_dni_cuit(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        digitos = re.sub(r"[^0-9]", "", valor)
        if not 7 <= len(digitos) <= 11:
            raise ValueError("DNI/CUIT debe contener entre 7 y 11 dígitos")
        return digitos

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        email = valor.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
            raise ValueError("Debe ingresar un correo electrónico válido")
        return email


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
