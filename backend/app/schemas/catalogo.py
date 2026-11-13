from decimal import Decimal
from typing import Literal

from pydantic import Field

from .base import SchemaBase, UpdateSchema


class CondicionIVAFields(SchemaBase):
    codigo_afip: str
    descripcion: str


class CondicionIVACreate(CondicionIVAFields):
    pass


class CondicionIVARead(CondicionIVAFields):
    id_condicion_iva: str


class CondicionIVAUpdate(UpdateSchema):
    codigo_afip: str | None = None
    descripcion: str | None = None


class CategoriaFields(SchemaBase):
    nombre: str = Field(min_length=1, max_length=120)


class CategoriaCreate(CategoriaFields):
    pass


class CategoriaRead(CategoriaFields):
    id_categoria: str


class CategoriaUpdate(UpdateSchema):
    nombre: str | None = Field(default=None, min_length=1, max_length=120)


class UnidadFields(SchemaBase):
    descripcion: str
    unidad_venta: str


class UnidadCreate(UnidadFields):
    pass


class UnidadRead(UnidadFields):
    id_unidad: str


class UnidadUpdate(UpdateSchema):
    descripcion: str | None = None
    unidad_venta: str | None = None


class AlicuotaIVAFields(SchemaBase):
    codigo_afip: str
    descripcion: str
    porcentaje: Decimal = Field(
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )
    tipo_iva: str


class AlicuotaIVACreate(AlicuotaIVAFields):
    pass


class AlicuotaIVARead(AlicuotaIVAFields):
    id_alicuota_iva: str


class AlicuotaIVAUpdate(UpdateSchema):
    codigo_afip: str | None = None
    descripcion: str | None = None
    porcentaje: Decimal | None = Field(
        default=None,
        ge=0,
        le=100,
        max_digits=5,
        decimal_places=2,
    )
    tipo_iva: str | None = None


class ProductoFields(SchemaBase):
    nombre: str = Field(min_length=1, max_length=160)
    descripcion: str = Field(default="", max_length=255)
    estado: bool = True
    imagen: bool = False
    margen: Decimal = Field(ge=0, max_digits=7, decimal_places=2)
    precio_compra: Decimal = Field(
        gt=0,
        max_digits=14,
        decimal_places=2,
    )
    stock_actual: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        max_digits=14,
        decimal_places=3,
    )
    stock_minimo: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        max_digits=14,
        decimal_places=3,
    )
    id_alicuota_iva: str = Field(min_length=1, max_length=20)
    id_categoria: str = Field(min_length=1, max_length=20)


class ProductoCreate(ProductoFields):
    id_producto: str | None = Field(
        default=None,
        min_length=8,
        max_length=20,
        pattern=r"^PRD-\d{4,}$",
    )
    id_unidad: str | None = Field(default=None, min_length=1, max_length=20)


class ProductoCodigoRead(SchemaBase):
    id_producto: str


class ProductoRead(SchemaBase):
    id_producto: str
    nombre: str
    descripcion: str
    estado: bool
    imagen: bool
    margen: Decimal
    precio_compra: Decimal
    precio_venta: Decimal
    stock_actual: Decimal
    stock_minimo: Decimal
    id_alicuota_iva: str
    id_categoria: str
    id_unidad: str
    categoria_nombre: str
    alicuota_descripcion: str
    alicuota_porcentaje: Decimal
    alicuota_codigo_afip: str
    alicuota_tipo_iva: str
    unidad_descripcion: str
    unidad_venta: str
    stock_bajo: bool


class ProductoUpdate(UpdateSchema):
    nombre: str | None = Field(default=None, min_length=1, max_length=160)
    descripcion: str | None = Field(default=None, max_length=255)
    estado: bool | None = None
    imagen: bool | None = None
    margen: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=7,
        decimal_places=2,
    )
    precio_compra: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=14,
        decimal_places=2,
    )
    stock_minimo: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=14,
        decimal_places=3,
    )
    id_alicuota_iva: str | None = Field(default=None, min_length=1, max_length=20)
    id_categoria: str | None = Field(default=None, min_length=1, max_length=20)
    id_unidad: str | None = Field(default=None, min_length=1, max_length=20)


class ProductoAjusteStock(SchemaBase):
    tipo: Literal["entrada", "salida"]
    cantidad: Decimal = Field(gt=0, max_digits=14, decimal_places=3)


class ProductoListResponse(SchemaBase):
    items: list[ProductoRead]
    total: int
    limit: int
    offset: int
