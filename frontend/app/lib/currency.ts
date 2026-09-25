export function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

export function parseNumberInput(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "");
  if (!cleaned) return 0;
  const parsed = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}