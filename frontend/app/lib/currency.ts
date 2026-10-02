export function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

export function parseNumberInput(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned
    .replace(/[^0-9.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePercentInput(value: string): number {
  const cleaned = value.trim().replace(/\s/g, "").replace(/[^0-9.,-]/g, "");
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSep = lastComma > lastDot ? "," : ".";
  const thousandsSep = decimalSep === "," ? "." : ",";
  const normalized = cleaned.split(thousandsSep).join("").split(decimalSep).join(".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}