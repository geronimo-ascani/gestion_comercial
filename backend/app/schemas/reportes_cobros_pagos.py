from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from .base import SchemaBase


EstadoPago = Literal["aprobado", "pendiente", "rechazado"]


class ReporteCobrosPagosParametrosRead(SchemaBase):
    desde: date
    hasta: date
    id_cliente: str | None = None
    id_proveedor: str | None = None


class ReporteConteoMontoRead(SchemaBase):
    monto: Decimal
    cantidad: int


class ReporteEstadoRead(SchemaBase):
    estado: EstadoPago
    cobros: ReporteConteoMontoRead
    pagos: ReporteConteoMontoRead


class ReporteMedioPagoRead(SchemaBase):
    id_medio_pago: str
    medio_pago: str
    cobros_aprobados: Decimal
    pagos_aprobados: Decimal
    total_aprobado: Decimal


class ReporteTotalesRead(SchemaBase):
    cobros_aprobados: Decimal
    pagos_aprobados: Decimal
    pagos_pendientes: Decimal
    pagos_rechazados: Decimal
    cobros_realizados: Decimal
    pagos_realizados: Decimal
    neto_realizado: Decimal


class ReporteCobrosPagosRead(SchemaBase):
    desde: date
    hasta: date
    generado_en: datetime
    parametros: ReporteCobrosPagosParametrosRead
    totales: ReporteTotalesRead
    por_estado: list[ReporteEstadoRead]
    por_medio_pago: list[ReporteMedioPagoRead]


class PagoProveedorListadoRead(SchemaBase):
    id_pago: str
    fecha_pago: date
    monto: Decimal
    estado: EstadoPago
    referencia: str
    id_medio_pago: str
    medio_pago: str
    id_factura_proveedor: str
    numero_factura: str
    id_proveedor: str
    proveedor_razon_social: str
    creado_en: datetime
