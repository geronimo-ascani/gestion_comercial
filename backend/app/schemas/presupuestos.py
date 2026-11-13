from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator

from app.schemas.base import SchemaBase


class PresupuestoLineaInput(SchemaBase):
    id_producto: str = Field(min_length=1, max_length=20)
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    descuento_producto: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )


class PresupuestoInput(SchemaBase):
    id_cliente: str = Field(min_length=1, max_length=20)
    fecha_muestra: date = Field(default_factory=date.today)
    fecha_vencimiento: date
    descuento_compra: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )
    items: list[PresupuestoLineaInput] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def validar_datos(self) -> "PresupuestoInput":
        if self.fecha_vencimiento < self.fecha_muestra:
            raise ValueError(
                "La fecha de vencimiento no puede ser anterior a la fecha del presupuesto"
            )
        ids = [item.id_producto for item in self.items]
        if len(ids) != len(set(ids)):
            raise ValueError("No se puede repetir un producto en el presupuesto")
        return self


class PresupuestoLineaRead(SchemaBase):
    id_producto: str
    producto_nombre: str
    cantidad: Decimal
    descuento_producto: Decimal
    iva: Decimal
    neto: Decimal
    precio_unitario: Decimal
    subtotal: Decimal
    tipo_iva: str


class PresupuestoRead(SchemaBase):
    id_presupuesto_cliente: str
    estado: Literal["pendiente", "aprobado", "vencido", "convertido"]
    fecha_creacion: datetime
    fecha_muestra: date
    fecha_vencimiento: date
    descuento_compra: Decimal
    total: Decimal
    id_cliente: str
    cliente_nombre: str
    cliente_apellido: str
    items: list[PresupuestoLineaRead]


class PresupuestoConversionInput(SchemaBase):
    entrega_provincia: str = Field(min_length=1, max_length=120)
    entrega_localidad: str = Field(min_length=1, max_length=120)
    entrega_calle: str = Field(min_length=1, max_length=160)
    entrega_altura: str = Field(min_length=1, max_length=10, pattern=r"^\d+$")
    entrega_cp: str = Field(default="", max_length=10)
    entrega_depto: str = Field(default="", max_length=20)
