from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field

from .base import SchemaBase


class MedioPagoFields(SchemaBase):
    medio_pago: str = Field(min_length=1, max_length=80)
    tipo_cobro: str = Field(min_length=1, max_length=20)


class MedioPagoCreate(MedioPagoFields):
    pass


class MedioPagoRead(MedioPagoFields):
    id_medio_pago: str


class MedioPagoUpdate(SchemaBase):
    medio_pago: str | None = None
    tipo_cobro: str | None = None


class PagoCreate(SchemaBase):
    id_medio_pago: str = Field(min_length=1, max_length=20)
    monto: Decimal = Field(gt=0, max_digits=14, decimal_places=2)
    referencia: str = Field(default="", max_length=80)
    estado: Literal["aprobado", "pendiente", "rechazado"] = "aprobado"
    fecha_pago: date | None = None


class PagoEstadoUpdate(SchemaBase):
    estado: Literal["aprobado", "rechazado"]


class PagoRead(SchemaBase):
    id_pago: str
    estado: Literal["aprobado", "pendiente", "rechazado"]
    fecha_pago: date
    monto: Decimal
    referencia: str
    id_medio_pago: str
    medio_pago: str
    creado_en: datetime
    id_comprobante_venta: str | None = None
    id_factura_proveedor: str | None = None
    tipo_pago: Literal["cobro", "pago"] | None = None


class PagoListadoRead(PagoRead):
    id_comprobante_venta: str
    numero_comprobante: str | None
    punto_venta: str
    id_pedido_cliente: str
    id_cliente: str
    cliente_nombre: str
    cliente_apellido: str



class ComprobanteEnvioRead(SchemaBase):
    id_envio: int
    destinatario: str
    cc: list[str] = Field(default_factory=list)
    bcc: list[str] = Field(default_factory=list)
    estado: Literal["enviado", "fallido"]
    error: str | None
    enviado_en: datetime
