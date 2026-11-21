from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import Field, model_validator

from .base import SchemaBase
from .pagos import PagoCreate, PagoRead

TipoComprobanteCompra = Literal["A", "B", "C", "E"]
EstadoPagoFactura = Literal["emitida", "pagada"]


class FacturaProveedorCreate(SchemaBase):
    """Metadatos visibles en el listado, transcritos del PDF/JPG recibido.

    El número de comprobante del proveedor permanece dentro del archivo. El
    identificador ``FP-####`` y el número mostrado se generan en el servidor.
    """

    id_pedido_proveedor: str = Field(min_length=1, max_length=20)
    fecha_emision: datetime
    fecha_vence: datetime
    total: Decimal = Field(ge=0, max_digits=14, decimal_places=2)

    @model_validator(mode="after")
    def validar_fechas(self) -> "FacturaProveedorCreate":
        if self.fecha_vence < self.fecha_emision:
            raise ValueError("La fecha de vencimiento no puede ser anterior a la emisión")
        return self


class FacturaProveedorResumen(SchemaBase):
    """Datos del listado. ``numero_*`` es el ID generado ``FP-####``."""

    id_factura_proveedor: str
    numero_comprobante: str
    numero_completo: str
    tipo_comprobante: TipoComprobanteCompra
    estado_pago: EstadoPagoFactura
    fecha_emision: datetime
    fecha_vence: datetime
    total: Decimal
    saldo_pendiente: Decimal
    id_empresa: str
    id_proveedor: str
    proveedor_razon_social: str
    id_pedido_proveedor: str
    archivo_nombre: str | None
    archivo_mime_type: str | None
    archivo_tamanio: int | None
    archivo_url: str
    tiene_archivo: bool


class FacturaProveedorRead(FacturaProveedorResumen):
    creado_en: datetime
    proveedor_cuit: str
    proveedor_domicilio: str
    proveedor_condicion_iva: str
    empresa_razon_social: str
    empresa_cuit: str
    empresa_domicilio: str
    empresa_condicion_iva: str
    pagos: list[PagoRead]


class PagoProveedorCreate(PagoCreate):
    pass


class PagoProveedorRead(PagoRead):
    pass
