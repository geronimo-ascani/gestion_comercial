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
  if (digits.length === 11) {
    const prefix = Number(digits.slice(0, 2));
    if (![20, 23, 24, 27, 30, 33, 34, 35, 36].includes(prefix)) {
      return "Prefijo de CUIT/CUIL inválido";
    }
    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const sum = digits
      .slice(0, 10)
      .split("")
      .reduce(
        (acc, digit, index) => acc + Number(digit) * weights[index],
        0
      );
    const remainder = sum % 11;
    const verifier = remainder === 0 ? 0 : 11 - remainder;
    if (verifier === 10 || verifier !== Number(digits[10])) {
      return "CUIT/CUIL inválido (dígito verificador incorrecto)";
    }
    return null;
  }
  if (digits.length < 7 || digits.length > 8) {
    return "DNI inválido (debe tener entre 7 y 8 dígitos)";
  }
  return null;
}

export function validateAddress(
  address: Address,
  options: { required?: boolean } = {}
): Record<"province" | "locality" | "street" | "number", string | null> {
  const empty = { province: null, locality: null, street: null, number: null };
  const fields = [
    address.province,
    address.locality,
    address.street,
    address.number,
  ];
  const hasAny = fields.some((value) => value.trim());
  if (!hasAny && !options.required) return empty;
  const street = address.street.trim();
  const number = address.number.trim();
  return {
    province: !address.province.trim() ? "La provincia es obligatoria" : null,
    locality: !address.locality.trim() ? "La localidad es obligatoria" : null,
    street: !street
      ? "La calle es obligatoria"
      : street.length < 3
        ? "Dirección demasiado corta"
        : !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(street)
          ? "Debe incluir el nombre de la calle"
          : null,
    number: !number
      ? "La altura es obligatoria"
      : !/^[0-9][0-9A-Za-z/-]*$/.test(number)
        ? "Altura inválida"
        : null,
  };
}