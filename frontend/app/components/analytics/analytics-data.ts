export type Period = "hoy" | "7d" | "mes" | "trimestre" | "año";

export interface KpiSet {
  ventas: number;
  gastos: number;
  neto: number;
  margenPct: number;
  deltaVentas: string;
  deltaGastos: string;
  deltaNeto: string;
}

export interface PeriodConfig {
  label: string;
  factor: number;
  kpis: KpiSet;
}

export const periodOptions: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "mes", label: "Último mes" },
  { value: "trimestre", label: "Último trimestre" },
  { value: "año", label: "Este año" },
];

export const periodConfigs: Record<Period, PeriodConfig> = {
  hoy: {
    label: "Hoy",
    factor: 0.033,
    kpis: {
      ventas: 45_000,
      gastos: 30_500,
      neto: 14_500,
      margenPct: 32.2,
      deltaVentas: "+9%",
      deltaGastos: "-1%",
      deltaNeto: "+11%",
    },
  },
  "7d": {
    label: "Últimos 7 días",
    factor: 0.24,
    kpis: {
      ventas: 298_500,
      gastos: 198_000,
      neto: 100_500,
      margenPct: 33.7,
      deltaVentas: "+6%",
      deltaGastos: "+2%",
      deltaNeto: "+14%",
    },
  },
  mes: {
    label: "Último mes",
    factor: 1,
    kpis: {
      ventas: 1_230_500,
      gastos: 820_000,
      neto: 410_500,
      margenPct: 33.4,
      deltaVentas: "+12%",
      deltaGastos: "-3%",
      deltaNeto: "+25%",
    },
  },
  trimestre: {
    label: "Último trimestre",
    factor: 2.93,
    kpis: {
      ventas: 3_610_200,
      gastos: 2_410_800,
      neto: 1_199_400,
      margenPct: 33.2,
      deltaVentas: "+18%",
      deltaGastos: "+6%",
      deltaNeto: "+41%",
    },
  },
  año: {
    label: "Este año",
    factor: 11.8,
    kpis: {
      ventas: 14_520_000,
      gastos: 9_880_000,
      neto: 4_640_000,
      margenPct: 31.9,
      deltaVentas: "+22%",
      deltaGastos: "+9%",
      deltaNeto: "+48%",
    },
  },
};

const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const tendencies: { month: string; ventas: number; gastos: number }[] = [
  { month: months[0], ventas: 980000, gastos: 710000 },
  { month: months[1], ventas: 1050000, gastos: 760000 },
  { month: months[2], ventas: 1120000, gastos: 790000 },
  { month: months[3], ventas: 1080000, gastos: 820000 },
  { month: months[4], ventas: 1210000, gastos: 840000 },
  { month: months[5], ventas: 1180000, gastos: 810000 },
  { month: months[6], ventas: 1260000, gastos: 860000 },
  { month: months[7], ventas: 1320000, gastos: 880000 },
  { month: months[8], ventas: 1290000, gastos: 850000 },
  { month: months[9], ventas: 1370000, gastos: 900000 },
  { month: months[10], ventas: 1430000, gastos: 920000 },
  { month: months[11], ventas: 1510000, gastos: 980000 },
];

export const basePayments: { method: string; amount: number; color: string }[] = [
  { method: "Efectivo", amount: 480_000, color: "#3b82f6" },
  { method: "Tarjeta", amount: 540_500, color: "#f59e0b" },
  { method: "MercadoPago", amount: 210_000, color: "#10b981" },
];

export const aovSeries: { month: string; aov: number; upt: number }[] = [
  { month: months[0], aov: 18200, upt: 2.1 },
  { month: months[1], aov: 18450, upt: 2.2 },
  { month: months[2], aov: 18500, upt: 2.1 },
  { month: months[3], aov: 18300, upt: 2.3 },
  { month: months[4], aov: 18950, upt: 2.2 },
  { month: months[5], aov: 19200, upt: 2.4 },
  { month: months[6], aov: 19100, upt: 2.3 },
  { month: months[7], aov: 19450, upt: 2.4 },
  { month: months[8], aov: 19600, upt: 2.5 },
  { month: months[9], aov: 19800, upt: 2.4 },
  { month: months[10], aov: 20300, upt: 2.6 },
  { month: months[11], aov: 20800, upt: 2.7 },
];

export const recurrentSeries: {
  month: string;
  recurrentes: number;
  nuevos: number;
}[] = [
  { month: months[0], recurrentes: 620000, nuevos: 360000 },
  { month: months[1], recurrentes: 650000, nuevos: 400000 },
  { month: months[2], recurrentes: 700000, nuevos: 420000 },
  { month: months[3], recurrentes: 720000, nuevos: 360000 },
  { month: months[4], recurrentes: 780000, nuevos: 430000 },
  { month: months[5], recurrentes: 800000, nuevos: 380000 },
  { month: months[6], recurrentes: 850000, nuevos: 410000 },
  { month: months[7], recurrentes: 890000, nuevos: 430000 },
  { month: months[8], recurrentes: 920000, nuevos: 370000 },
  { month: months[9], recurrentes: 980000, nuevos: 450000 },
  { month: months[10], recurrentes: 1050000, nuevos: 380000 },
  { month: months[11], recurrentes: 1120000, nuevos: 390000 },
];

export const topProducts: {
  rank: number;
  product: string;
  qty: number;
  unitSale: number;
  unitCost: number;
}[] = [
  { rank: 1, product: "Gaseosa 1,5L (promo)", qty: 320, unitSale: 980, unitCost: 720 },
  { rank: 2, product: "Aceite 900ml", qty: 170, unitSale: 1710, unitCost: 1280 },
  { rank: 3, product: "Harina 0000 1kg", qty: 300, unitSale: 780, unitCost: 610 },
  { rank: 4, product: "Arroz 1kg", qty: 200, unitSale: 940, unitCost: 810 },
  { rank: 5, product: "Leche entera 1L", qty: 430, unitSale: 410, unitCost: 372 },
];

export const topCustomers: { rank: number; client: string; orders: number; amount: number }[] = [
  { rank: 1, client: "Mini Market El Sol", orders: 42, amount: 486_000 },
  { rank: 2, client: "Almacén Los Amigos", orders: 35, amount: 398_500 },
  { rank: 3, client: "Despensa Doña Rosa", orders: 28, amount: 312_900 },
  { rank: 4, client: "Super 24hs", orders: 24, amount: 276_300 },
  { rank: 5, client: "Kiosco El Turco", orders: 19, amount: 142_800 },
];

export interface OldStockItem {
  product: string;
  daysSinceSale: number;
  stock: number;
  cost: number;
}

export const oldStock: OldStockItem[] = [
  { product: "Yerba premium 1kg", daysSinceSale: 95, stock: 48, cost: 2450 },
  { product: "Cerveza importada 473ml", daysSinceSale: 72, stock: 60, cost: 1850 },
  { product: "Aderezos gourmet (display)", daysSinceSale: 41, stock: 24, cost: 3200 },
  { product: "Galletas sin TACC 300g", daysSinceSale: 33, stock: 36, cost: 980 },
  { product: "Detergente 3L", daysSinceSale: 22, stock: 15, cost: 5200 },
];

const heatDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const heatHours: number[] = [];
for (let h = 8; h <= 21; h += 1) heatHours.push(h);

const baseHeatValues = [
  [1, 2, 3, 4, 6, 5, 3, 3, 4, 5, 6, 7, 6, 4],
  [1, 2, 3, 4, 6, 5, 3, 3, 4, 5, 6, 7, 6, 4],
  [2, 2, 4, 5, 7, 5, 4, 3, 5, 6, 7, 8, 7, 5],
  [2, 3, 4, 5, 8, 6, 4, 4, 5, 6, 8, 8, 8, 5],
  [2, 3, 5, 6, 9, 7, 5, 4, 6, 7, 9, 10, 9, 7],
  [3, 4, 6, 8, 11, 9, 6, 5, 7, 9, 12, 12, 11, 8],
  [1, 1, 2, 2, 3, 2, 2, 2, 2, 3, 4, 4, 3, 2],
];

export function buildHeatmap(factor: number) {
  return {
    days: heatDayLabels,
    hours: heatHours,
    values: baseHeatValues.map((row) => row.map((value) => Math.max(1, Math.round(value * factor)))),
  };
}

export function formatAR(value: number): string {
  return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

export function formatPercent(value: number): string {
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}