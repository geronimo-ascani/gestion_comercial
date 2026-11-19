const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export function esEmailValido(valor: string): boolean {
  return PATRON_EMAIL.test(normalizarEmail(valor));
}

export function parsearListaEmails(valor: string): string[] {
  const direcciones = valor
    .split(/[,;]+/)
    .map(normalizarEmail)
    .filter(Boolean);
  return [...new Set(direcciones)];
}
