import type { Period } from "./analytics-api";

export type { Period };

export const periodOptions: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "mes", label: "Último mes" },
  { value: "trimestre", label: "Último trimestre" },
  { value: "año", label: "Este año" },
];

export function periodLabel(period: Period): string {
  return (
    periodOptions.find((option) => option.value === period)?.label ?? "Período"
  );
}

export const paymentPalette = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
];

export function paymentColor(index: number): string {
  return paymentPalette[index % paymentPalette.length];
}

export const heatDayLabels = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function heatDayLabel(index: number): string {
  return heatDayLabels[index] ?? `Día ${index + 1}`;
}

export function formatAR(value: number): string {
  return `$${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString("es-AR", { maximumFractionDigits: digits });
}

export function formatCompact(value: number): string {
  if (value === 0) return "$0";
  return `$${new Intl.NumberFormat("es-AR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "s/d";
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}
