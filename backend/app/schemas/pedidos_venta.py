from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.base import SchemaBase


class PedidoVentaLineaInput(SchemaBase):
    id_producto: str = Field(min_length=1, max_length=20)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    descuento_producto: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )


class PedidoVentaInput(SchemaBase):
    id_cliente: str = Field(min_length=1, max_length=20)
    entrega_provincia: str = Field(min_length=1, max_length=120)
    entrega_localidad: str = Field(min_length=1, max_length=120)
    entrega_calle: str = Field(min_length=1, max_length=160)
    entrega_altura: str = Field(min_length=1, max_length=10, pattern=r"^\d+$")
    entrega_cp: str = Field(default="", max_length=10)
    entrega_depto: str = Field(default="", max_length=20)
    descuento_compra: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )
    items: list[PedidoVentaLineaInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validar_productos_unicos(self) -> "PedidoVentaInput":
        ids = [item.id_producto for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un producto en el pedido")
        return self


class PedidoVentaEstadoInput(SchemaBase):
    estado_envio: Literal["proceso", "enviado", "entregado"]


class PedidoVentaLineaRead(SchemaBase):
    id_producto: str
    producto_nombre: str
    cantidad: Decimal
    descuento_producto: Decimal
    iva: Decimal
    neto: Decimal
    precio_unitario: Decimal
    subtotal: Decimal
    tipo_iva: str


class PedidoVentaRead(SchemaBase):
    id_pedido_cliente: str
    descuento_compra: Decimal
    entrega_altura: str
    entrega_calle: str
    entrega_cp: str
    entrega_depto: str
    entrega_localidad: str
    entrega_provincia: str
    estado_envio: Literal["pendiente", "proceso", "enviado", "entregado", "cancelado"]
    fecha_emision: datetime
    fecha_muestra: date
    saldo_pendiente: Decimal
    total: Decimal
    id_cliente: str
    cliente_nombre: str
    cliente_apellido: str
    cliente_email: str
    cliente_telefono: str
    id_presupuesto_cliente: str | None
    items: list[PedidoVentaLineaRead]
