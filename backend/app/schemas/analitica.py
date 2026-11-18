from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from app.schemas.base import SchemaBase

PeriodoAnalitica = Literal["hoy", "7d", "mes", "trimestre", "año"]


class KpisAnaliticaRead(SchemaBase):
    ventas: Decimal | None = None
    compras: Decimal | None = None
    gastos: Decimal | None = None
    neto: Decimal | None = None
    margen_pct: Decimal | None = None
    costo_ventas: Decimal | None = None
    margen_bruto: Decimal | None = None
    margen_bruto_pct: Decimal | None = None


class PuntoTendenciaRead(SchemaBase):
    inicio: date
    fin: date
    ventas: Decimal
    gastos: Decimal | None = None


class AovUptRead(SchemaBase):
    aov: Decimal
    upt: Decimal


class PuntoAovUptRead(SchemaBase):
    inicio: date
    fin: date
    aov: Decimal
    upt: Decimal


class PuntoNuevosRecurrentesRead(SchemaBase):
    inicio: date
    fin: date
    nuevos: Decimal
    recurrentes: Decimal


class RankingProductoRead(SchemaBase):
    id_producto: str
    nombre: str
    cantidad: Decimal
    venta_neta: Decimal
    costo: Decimal
    margen: Decimal
    margen_pct: Decimal


class RankingClienteRead(SchemaBase):
    id_cliente: str
    nombre: str
    pedidos: int
    facturacion: Decimal


class RankingProveedorRead(SchemaBase):
    id_proveedor: str
    nombre: str
    pedidos: int
    volumen_compra: Decimal
    unidades: Decimal
    precio_promedio: Decimal
    entrega_promedio_dias: Decimal | None = None


class PrecioProveedorRead(SchemaBase):
    id_proveedor: str
    proveedor: str
    precio_minimo: Decimal
    precio_promedio: Decimal
    ultima_compra: date


class ComparativaPrecioRead(SchemaBase):
    id_producto: str
    nombre: str
    proveedores: list[PrecioProveedorRead]


class InventarioInmovilizadoRead(SchemaBase):
    id_producto: str
    nombre: str
    stock: Decimal
    costo_unitario: Decimal
    capital: Decimal
    dias_sin_venta: int | None = None


class MargenCategoriaRead(SchemaBase):
    id_categoria: str
    nombre: str
    venta_neta: Decimal
    costo: Decimal
    margen: Decimal
    margen_pct: Decimal


class MapaCalorRead(SchemaBase):
    dias: list[int]
    horas: list[int]
    valores: list[list[Decimal]]


class VentaMetodoPagoRead(SchemaBase):
    id_medio_pago: str
    medio_pago: str
    monto: Decimal


class PrediccionDemandaRead(SchemaBase):
    id_producto: str
    nombre: str
    historial: list[Decimal]
    pronostico: list[Decimal]


class VariacionRead(SchemaBase):
    ventas: Decimal | None = None
    gastos: Decimal | None = None
    neto: Decimal | None = None


class AnaliticaRead(SchemaBase):
    periodo: PeriodoAnalitica
    desde: date
    hasta: date
    generado_en: datetime
    kpis: KpisAnaliticaRead | None = None
    tendencias: list[PuntoTendenciaRead] | None = None
    aov_upt: list[PuntoAovUptRead] | None = None
    aov_upt_actual: AovUptRead | None = None
    nuevos_recurrentes: list[PuntoNuevosRecurrentesRead] | None = None
    ranking_productos: list[RankingProductoRead] | None = None
    ranking_clientes: list[RankingClienteRead] | None = None
    ranking_proveedores: list[RankingProveedorRead] | None = None
    comparativa_precios: list[ComparativaPrecioRead] | None = None
    margen_categorias: list[MargenCategoriaRead] | None = None
    inventario_inmovilizado: list[InventarioInmovilizadoRead] | None = None
    mapa_calor: MapaCalorRead | None = None
    medios_pago: list[VentaMetodoPagoRead] | None = None
    prediccion_demanda: list[PrediccionDemandaRead] | None = None
    variacion: VariacionRead | None = None
