import { apiFetchBlob, apiRequest } from "~/lib/api";

export type Period = "hoy" | "7d" | "mes" | "trimestre" | "año";
export type Granularity = "diario" | "semanal" | "mensual" | "anual";

/** Filtros RF-29; el backend calcula todas las secciones con los mismos valores. */
export interface AnalyticsFilters {
  periodo: Period;
  desde?: string;
  hasta?: string;
  granularidad?: Granularity;
  limite?: number;
  dias_inmovilizado?: number;
  id_categoria?: string;
  id_cliente?: string;
  id_proveedor?: string;
  id_producto?: string;
  periodos_pronostico?: number;
}

export interface AnalyticsParametros {
  periodo: Period;
  desde: string;
  hasta: string;
  granularidad: Granularity;
  limite: number;
  dias_inmovilizado: number;
  id_categoria: string | null;
  id_cliente: string | null;
  id_proveedor: string | null;
  id_producto: string | null;
  periodos_pronostico: number;
}

export interface AnalyticsKpis {
  ventas: number | null;
  compras: number | null;
  gastos: number | null;
  neto: number | null;
  margenPct: number | null;
  costoVentas: number | null;
  margenBruto: number | null;
  margenBrutoPct: number | null;
}

export interface TrendPoint {
  label: string;
  ventas: number;
  gastos: number | null;
}

export interface AovUptPoint {
  label: string;
  aov: number;
  upt: number;
}

export interface AovUpt {
  aov: number;
  upt: number;
}

export interface NewRecurrentPoint {
  label: string;
  nuevos: number;
  recurrentes: number;
}

export interface ProductRanking {
  id: string;
  nombre: string;
  cantidad: number;
  ventaNeta: number;
  costo: number;
  margen: number;
  margenPct: number;
}

export interface CustomerRanking {
  id: string;
  nombre: string;
  pedidos: number;
  facturacion: number;
}

export interface ProviderRanking {
  id: string;
  nombre: string;
  pedidos: number;
  volumenCompra: number;
  unidades: number;
  precioPromedio: number;
  entregaPromedioDias: number | null;
}

export interface PriceProvider {
  id: string;
  proveedor: string;
  precioMinimo: number;
  precioPromedio: number;
  ultimaCompra: string;
}

export interface PriceComparison {
  id: string;
  nombre: string;
  proveedores: PriceProvider[];
}

export interface ImmobilizedItem {
  id: string;
  nombre: string;
  stock: number;
  costoUnitario: number;
  capital: number;
  diasSinVenta: number | null;
  sugerenciaLiquidar: boolean;
}

export interface ImmobilizedSummary {
  productos: number;
  capital: number;
}

export interface NewRecurrentSummary {
  total: number;
  nuevosPct: number;
  recurrentesPct: number;
}

export interface PaymentMethodSummary {
  totalCobrado: number;
}

export interface CategoryMargin {
  id: string;
  nombre: string;
  ventaNeta: number;
  costo: number;
  margen: number;
  margenPct: number;
}

export interface HeatmapData {
  days: number[];
  hours: number[];
  values: number[][];
}

export interface PaymentMethodTotal {
  id: string;
  medioPago: string;
  monto: number;
  participacionPct: number;
}

export interface DemandForecast {
  id: string;
  nombre: string;
  historial: number[];
  pronostico: number[];
}

export interface Variation {
  ventas: number | null;
  gastos: number | null;
  neto: number | null;
}

export interface AnalyticsData {
  periodo: Period;
  desde: string;
  hasta: string;
  generadoEn: string;
  parametros: AnalyticsParametros;
  kpis: AnalyticsKpis | null;
  tendencias: TrendPoint[];
  aovUpt: AovUptPoint[];
  aovUptActual: AovUpt | null;
  nuevosRecurrentes: NewRecurrentPoint[];
  resumenNuevosRecurrentes: NewRecurrentSummary | null;
  rankingProductos: ProductRanking[];
  productosMenosVendidos: ProductRanking[];
  productosMasRentables: ProductRanking[];
  rankingClientes: CustomerRanking[];
  rankingProveedores: ProviderRanking[];
  comparativaPrecios: PriceComparison[];
  margenCategorias: CategoryMargin[];
  inventarioInmovilizado: ImmobilizedItem[];
  resumenInventarioInmovilizado: ImmobilizedSummary | null;
  mapaCalor: HeatmapData | null;
  mediosPago: PaymentMethodTotal[];
  resumenMediosPago: PaymentMethodSummary | null;
  prediccionDemanda: DemandForecast[];
  variacion: Variation | null;
}

interface KpisApi {
  ventas: string | null;
  compras: string | null;
  gastos: string | null;
  neto: string | null;
  margen_pct: string | null;
  costo_ventas: string | null;
  margen_bruto: string | null;
  margen_bruto_pct: string | null;
}

interface TrendApi {
  inicio: string;
  fin: string;
  ventas: string;
  gastos: string | null;
}

interface AovUptApi {
  inicio: string;
  fin: string;
  aov: string;
  upt: string;
}

interface NewRecurrentApi {
  inicio: string;
  fin: string;
  nuevos: string;
  recurrentes: string;
}

interface ProductRankingApi {
  id_producto: string;
  nombre: string;
  cantidad: string;
  venta_neta: string;
  costo: string;
  margen: string;
  margen_pct: string;
}

interface CustomerRankingApi {
  id_cliente: string;
  nombre: string;
  pedidos: number;
  facturacion: string;
}

interface ProviderRankingApi {
  id_proveedor: string;
  nombre: string;
  pedidos: number;
  volumen_compra: string;
  unidades: string;
  precio_promedio: string;
  entrega_promedio_dias: string | null;
}

interface PriceProviderApi {
  id_proveedor: string;
  proveedor: string;
  precio_minimo: string;
  precio_promedio: string;
  ultima_compra: string;
}

interface PriceComparisonApi {
  id_producto: string;
  nombre: string;
  proveedores: PriceProviderApi[];
}

interface ImmobilizedApi {
  id_producto: string;
  nombre: string;
  stock: string;
  costo_unitario: string;
  capital: string;
  dias_sin_venta: number | null;
  sugerencia_liquidar: boolean;
}

interface ImmobilizedSummaryApi {
  productos: number;
  capital: string;
}

interface NewRecurrentSummaryApi {
  total: string;
  nuevos_pct: string;
  recurrentes_pct: string;
}

interface PaymentSummaryApi {
  total_cobrado: string;
}

interface CategoryMarginApi {
  id_categoria: string;
  nombre: string;
  venta_neta: string;
  costo: string;
  margen: string;
  margen_pct: string;
}

interface HeatmapApi {
  dias: number[];
  horas: number[];
  valores: string[][];
}

interface PaymentApi {
  id_medio_pago: string;
  medio_pago: string;
  monto: string;
  participacion_pct: string;
}

interface DemandApi {
  id_producto: string;
  nombre: string;
  historial: string[];
  pronostico: string[];
}

interface VariationApi {
  ventas: string | null;
  gastos: string | null;
  neto: string | null;
}

interface ParametrosApi {
  periodo: Period;
  desde: string;
  hasta: string;
  granularidad: Granularity;
  limite: number;
  dias_inmovilizado: number;
  id_categoria: string | null;
  id_cliente: string | null;
  id_proveedor: string | null;
  id_producto: string | null;
  periodos_pronostico: number;
}

interface AnalyticsApi {
  periodo: Period;
  desde: string;
  hasta: string;
  generado_en: string;
  parametros: ParametrosApi;
  kpis: KpisApi | null;
  tendencias: TrendApi[] | null;
  aov_upt: AovUptApi[] | null;
  aov_upt_actual: AovUptApi | null;
  nuevos_recurrentes: NewRecurrentApi[] | null;
  resumen_nuevos_recurrentes: NewRecurrentSummaryApi | null;
  ranking_productos: ProductRankingApi[] | null;
  productos_menos_vendidos: ProductRankingApi[] | null;
  productos_mas_rentables: ProductRankingApi[] | null;
  ranking_clientes: CustomerRankingApi[] | null;
  ranking_proveedores: ProviderRankingApi[] | null;
  comparativa_precios: PriceComparisonApi[] | null;
  margen_categorias: CategoryMarginApi[] | null;
  inventario_inmovilizado: ImmobilizedApi[] | null;
  resumen_inventario_inmovilizado: ImmobilizedSummaryApi | null;
  mapa_calor: HeatmapApi | null;
  medios_pago: PaymentApi[] | null;
  resumen_medios_pago: PaymentSummaryApi | null;
  prediccion_demanda: DemandApi[] | null;
  variacion: VariationApi | null;
}

function toNumber(value: string | null | undefined): number | null {
  return value == null ? null : Number(value);
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function bucketLabel(inicio: string, fin: string): string {
  const start = parseDate(inicio);
  const end = parseDate(fin);
  const sameMonth =
    start.getMonth() === end.getMonth() &&
    start.getFullYear() === end.getFullYear();
  const span = Math.round(
    (end.getTime() - start.getTime()) / 86_400_000
  );

  if (sameMonth && span >= 20) {
    return capitalize(
      start
        .toLocaleDateString("es-AR", { month: "short" })
        .replace(".", "")
    );
  }

  return start.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function mapProductRanking(filas: ProductRankingApi[] | null): ProductRanking[] {
  return (filas ?? []).map((fila) => ({
    id: fila.id_producto,
    nombre: fila.nombre,
    cantidad: Number(fila.cantidad),
    ventaNeta: Number(fila.venta_neta),
    costo: Number(fila.costo),
    margen: Number(fila.margen),
    margenPct: Number(fila.margen_pct),
  }));
}

function mapAnalytics(raw: AnalyticsApi): AnalyticsData {
  return {
    periodo: raw.periodo,
    desde: raw.desde,
    hasta: raw.hasta,
    generadoEn: raw.generado_en,
    parametros: {
      periodo: raw.parametros.periodo,
      desde: raw.parametros.desde,
      hasta: raw.parametros.hasta,
      granularidad: raw.parametros.granularidad,
      limite: raw.parametros.limite,
      dias_inmovilizado: raw.parametros.dias_inmovilizado,
      id_categoria: raw.parametros.id_categoria,
      id_cliente: raw.parametros.id_cliente,
      id_proveedor: raw.parametros.id_proveedor,
      id_producto: raw.parametros.id_producto,
      periodos_pronostico: raw.parametros.periodos_pronostico,
    },
    kpis: raw.kpis
      ? {
          ventas: toNumber(raw.kpis.ventas),
          compras: toNumber(raw.kpis.compras),
          gastos: toNumber(raw.kpis.gastos),
          neto: toNumber(raw.kpis.neto),
          margenPct: toNumber(raw.kpis.margen_pct),
          costoVentas: toNumber(raw.kpis.costo_ventas),
          margenBruto: toNumber(raw.kpis.margen_bruto),
          margenBrutoPct: toNumber(raw.kpis.margen_bruto_pct),
        }
      : null,
    tendencias: (raw.tendencias ?? []).map((punto) => ({
      label: bucketLabel(punto.inicio, punto.fin),
      ventas: Number(punto.ventas),
      gastos: toNumber(punto.gastos),
    })),
    aovUpt: (raw.aov_upt ?? []).map((punto) => ({
      label: bucketLabel(punto.inicio, punto.fin),
      aov: Number(punto.aov),
      upt: Number(punto.upt),
    })),
    aovUptActual: raw.aov_upt_actual
      ? {
          aov: Number(raw.aov_upt_actual.aov),
          upt: Number(raw.aov_upt_actual.upt),
        }
      : null,
    nuevosRecurrentes: (raw.nuevos_recurrentes ?? []).map((punto) => ({
      label: bucketLabel(punto.inicio, punto.fin),
      nuevos: Number(punto.nuevos),
      recurrentes: Number(punto.recurrentes),
    })),
    resumenNuevosRecurrentes: raw.resumen_nuevos_recurrentes
      ? {
          total: Number(raw.resumen_nuevos_recurrentes.total),
          nuevosPct: Number(raw.resumen_nuevos_recurrentes.nuevos_pct),
          recurrentesPct: Number(
            raw.resumen_nuevos_recurrentes.recurrentes_pct
          ),
        }
      : null,
    rankingProductos: mapProductRanking(raw.ranking_productos),
    productosMenosVendidos: mapProductRanking(raw.productos_menos_vendidos),
    productosMasRentables: mapProductRanking(raw.productos_mas_rentables),
    rankingClientes: (raw.ranking_clientes ?? []).map((fila) => ({
      id: fila.id_cliente,
      nombre: fila.nombre,
      pedidos: fila.pedidos,
      facturacion: Number(fila.facturacion),
    })),
    rankingProveedores: (raw.ranking_proveedores ?? []).map((fila) => ({
      id: fila.id_proveedor,
      nombre: fila.nombre,
      pedidos: fila.pedidos,
      volumenCompra: Number(fila.volumen_compra),
      unidades: Number(fila.unidades),
      precioPromedio: Number(fila.precio_promedio),
      entregaPromedioDias: toNumber(fila.entrega_promedio_dias),
    })),
    comparativaPrecios: (raw.comparativa_precios ?? []).map((fila) => ({
      id: fila.id_producto,
      nombre: fila.nombre,
      proveedores: fila.proveedores.map((proveedor) => ({
        id: proveedor.id_proveedor,
        proveedor: proveedor.proveedor,
        precioMinimo: Number(proveedor.precio_minimo),
        precioPromedio: Number(proveedor.precio_promedio),
        ultimaCompra: proveedor.ultima_compra,
      })),
    })),
    margenCategorias: (raw.margen_categorias ?? []).map((fila) => ({
      id: fila.id_categoria,
      nombre: fila.nombre,
      ventaNeta: Number(fila.venta_neta),
      costo: Number(fila.costo),
      margen: Number(fila.margen),
      margenPct: Number(fila.margen_pct),
    })),
    inventarioInmovilizado: (raw.inventario_inmovilizado ?? []).map(
      (fila) => ({
        id: fila.id_producto,
        nombre: fila.nombre,
        stock: Number(fila.stock),
        costoUnitario: Number(fila.costo_unitario),
        capital: Number(fila.capital),
        diasSinVenta: fila.dias_sin_venta,
        sugerenciaLiquidar: fila.sugerencia_liquidar,
      })
    ),
    resumenInventarioInmovilizado: raw.resumen_inventario_inmovilizado
      ? {
          productos: raw.resumen_inventario_inmovilizado.productos,
          capital: Number(raw.resumen_inventario_inmovilizado.capital),
        }
      : null,
    mapaCalor: raw.mapa_calor
      ? {
          days: raw.mapa_calor.dias,
          hours: raw.mapa_calor.horas,
          values: raw.mapa_calor.valores.map((fila) =>
            fila.map((valor) => Number(valor))
          ),
        }
      : null,
    mediosPago: (raw.medios_pago ?? []).map((fila) => ({
      id: fila.id_medio_pago,
      medioPago: fila.medio_pago,
      monto: Number(fila.monto),
      participacionPct: Number(fila.participacion_pct),
    })),
    resumenMediosPago: raw.resumen_medios_pago
      ? { totalCobrado: Number(raw.resumen_medios_pago.total_cobrado) }
      : null,
    prediccionDemanda: (raw.prediccion_demanda ?? []).map((fila) => ({
      id: fila.id_producto,
      nombre: fila.nombre,
      historial: fila.historial.map(Number),
      pronostico: fila.pronostico.map(Number),
    })),
    variacion: raw.variacion
      ? {
          ventas: toNumber(raw.variacion.ventas),
          gastos: toNumber(raw.variacion.gastos),
          neto: toNumber(raw.variacion.neto),
        }
      : null,
  };
}

function analyticsQuery(filters: AnalyticsFilters | Period): string {
  const values: AnalyticsFilters =
    typeof filters === "string" ? { periodo: filters } : filters;
  const params = new URLSearchParams({ periodo: values.periodo });
  const optional: Array<[string, string | number | undefined]> = [
    ["desde", values.desde],
    ["hasta", values.hasta],
    ["granularidad", values.granularidad],
    ["limite", values.limite],
    ["dias_inmovilizado", values.dias_inmovilizado],
    ["id_categoria", values.id_categoria],
    ["id_cliente", values.id_cliente],
    ["id_proveedor", values.id_proveedor],
    ["id_producto", values.id_producto],
    ["periodos_pronostico", values.periodos_pronostico],
  ];
  for (const [key, value] of optional) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchAnalytics(
  filters: AnalyticsFilters | Period
): Promise<AnalyticsData> {
  const raw = await apiRequest<AnalyticsApi>(
    `/analiticas?${analyticsQuery(filters)}`
  );
  return mapAnalytics(raw);
}

/** RF-28: la única exportación es el PDF generado por el backend. */
export async function downloadAnalyticsReport(
  filters: AnalyticsFilters | Period
): Promise<void> {
  const { blob, filename } = await apiFetchBlob(
    `/analiticas/reporte.pdf?${analyticsQuery(filters)}`
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "reporte-analitico.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
