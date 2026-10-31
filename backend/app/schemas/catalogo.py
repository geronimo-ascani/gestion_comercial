from decimal import Decimal

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
    nombre: str


class CategoriaCreate(CategoriaFields):
    pass


class CategoriaRead(CategoriaFields):
    id_categoria: str


class CategoriaUpdate(UpdateSchema):
    nombre: str | None = None


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
    porcentaje: float
    tipo_iva: str


class AlicuotaIVACreate(AlicuotaIVAFields):
    pass


class AlicuotaIVARead(AlicuotaIVAFields):
    id_alicuota_iva: str


class AlicuotaIVAUpdate(UpdateSchema):
    codigo_afip: str | None = None
    descripcion: str | None = None
    porcentaje: float | None = None
    tipo_iva: str | None = None


class ProductoFields(SchemaBase):
    descripcion: str
    estado: bool
    imagen: bool
    margen: float
    nombre: str
    precio_compra: float
    precio_venta: float
    stock_actual: Decimal
    stock_minimo: Decimal
    id_alicuota_iva: str
    id_categoria: str
    id_unidad: str


class ProductoCreate(ProductoFields):
    pass


class ProductoRead(ProductoFields):
    id_producto: str


class ProductoUpdate(UpdateSchema):
    descripcion: str | None = None
    estado: bool | None = None
    imagen: bool | None = None
    margen: float | None = None
    nombre: str | None = None
    precio_compra: float | None = None
    precio_venta: float | None = None
    stock_actual: Decimal | None = None
    stock_minimo: Decimal | None = None
    id_alicuota_iva: str | None = None
    id_categoria: str | None = None
    id_unidad: str | None = None
