import { useSyncExternalStore } from "react";

export interface PaymentMethodOption {
  id: string;
  label: string;
  /** Si es true, el cobro se procesa con la pasarela simulada. */
  gateway: boolean;
}

const defaultPaymentMethods: PaymentMethodOption[] = [
  { id: "efectivo", label: "Efectivo", gateway: false },
  { id: "tarjeta", label: "Tarjeta", gateway: true },
  { id: "mercadopago", label: "MercadoPago", gateway: true },
];

let methods: PaymentMethodOption[] = [...defaultPaymentMethods];

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): PaymentMethodOption[] {
  return methods;
}

export function usePaymentMethods(): PaymentMethodOption[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getPaymentMethodsSnapshot(): PaymentMethodOption[] {
  return methods;
}

export function getPaymentMethod(id: string): PaymentMethodOption | undefined {
  return methods.find((method) => method.id === id);
}

export function getPaymentMethodLabel(id: string): string {
  return getPaymentMethod(id)?.label ?? id;
}

export function isGatewayPaymentMethod(id: string): boolean {
  return getPaymentMethod(id)?.gateway ?? false;
}

export function isPaymentMethodLabelTaken(
  label: string,
  excludeId?: string
): boolean {
  const normalized = label.trim().toLowerCase();
  return methods.some(
    (method) =>
      method.id !== excludeId && method.label.trim().toLowerCase() === normalized
  );
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildUniqueId(base: string): string {
  const normalized = base || "medio";
  if (!methods.some((method) => method.id === normalized)) return normalized;
  let counter = 2;
  while (methods.some((method) => method.id === `${normalized}-${counter}`)) {
    counter += 1;
  }
  return `${normalized}-${counter}`;
}

export function addPaymentMethod(input: {
  label: string;
  gateway: boolean;
}): PaymentMethodOption {
  const method: PaymentMethodOption = {
    id: buildUniqueId(slugify(input.label)),
    label: input.label.trim(),
    gateway: input.gateway,
  };
  methods = [...methods, method];
  emit();
  return method;
}
