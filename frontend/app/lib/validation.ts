import type { Address } from "./address";

export function requireText(value: string, label: string): string | null {
  return value.trim() ? null : `${label} es obligatorio`;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? null
    : "Correo electrónico inválido";
}

export function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[+\d\s().-]+$/.test(trimmed)) {
    return "Solo se permiten números y símbolos de teléfono";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return "Teléfono inválido";
  }
  return null;
}

export function validateDocument(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[0-9.\-\s/]+$/.test(trimmed)) {
    return "Solo dígitos separados por puntos, guiones o barras";
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 11) {
    return "DNI/CUIT inválido (debe tener entre 6 y 11 dígitos)";
  }
  return null;
}

export function validateAddress(address: Address): string | null {
  const fields = [address.province, address.locality, address.street, address.number, address.apartment];
  const hasAny = fields.some((value) => value.trim());
  if (!hasAny) return null;
  const street = address.street.trim();
  if (!street) return "Ingrese la calle";
  if (street.length < 3) return "Dirección demasiado corta";
  if (!/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(street)) {
    return "Debe incluir el nombre de la calle";
  }
  const number = address.number.trim();
  if (number && !/^[0-9][0-9A-Za-z/-]*$/.test(number)) {
    return "Altura inválida";
  }
  return null;
}