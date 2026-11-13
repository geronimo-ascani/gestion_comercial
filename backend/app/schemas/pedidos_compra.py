from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.base import SchemaBase


class PedidoCompraLineaCreate(SchemaBase):
    id_producto: str = Field(min_length=1, max_length=20)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    precio_unitario: Decimal = Field(gt=0, max_digits=14, decimal_places=2)


class PedidoCompraCreate(SchemaBase):
    id_proveedor: str = Field(min_length=1, max_length=20)
    id_medio_pago: str = Field(min_length=1, max_length=20)
    items: list[PedidoCompraLineaCreate] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validar_productos_unicos(self) -> "PedidoCompraCreate":
        ids = [item.id_producto for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un producto en la orden")
        return self


class PedidoCompraLineaRead(SchemaBase):
    id_producto: str
    producto_nombre: str
    cantidad: Decimal
    precio_unitario: Decimal
    subtotal: Decimal


class PedidoCompraRead(SchemaBase):
    id_pedido_proveedor: str
    estado: Literal["pendiente", "aprobada", "recibida", "cancelada"]
    fecha_pedido: date
    fecha_recepcion: date | None
    total: Decimal
    id_empleado: str
    id_medio_pago: str
    medio_pago: str
    id_proveedor: str
    proveedor_nombre: str
    items: list[PedidoCompraLineaRead]
