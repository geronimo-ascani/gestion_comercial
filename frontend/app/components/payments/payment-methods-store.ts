import { useSyncExternalStore } from "react";

import {
  crearMedioPago,
  listMediosPago,
  type MedioPagoApi,
} from "./payments-api";

export interface PaymentMethodOption {
  id: string;
  label: string;
  tipoCobro: string;
}

let methods: PaymentMethodOption[] = [];
let loading = false;
let loaded = false;
let loadPromise: Promise<void> | null = null;

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

function getLoadingSnapshot(): boolean {
  return loading;
}

function mapMedio(medio: MedioPagoApi): PaymentMethodOption {
  return {
    id: medio.id_medio_pago,
    label: medio.medio_pago,
    tipoCobro: medio.tipo_cobro,
  };
}

function sortMethods(items: PaymentMethodOption[]): PaymentMethodOption[] {
  return [...items].sort((a, b) => a.label.localeCompare(b.label, "es"));
}

export function usePaymentMethods(): PaymentMethodOption[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function usePaymentMethodsLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoadingSnapshot, () => false);
}

export async function loadPaymentMethods(force = false): Promise<void> {
  if (loaded && !force) return;
  if (loadPromise) {
    await loadPromise;
    if (!force) return;
  }

  loading = true;
  emit();

  loadPromise = (async () => {
    try {
      const medios = await listMediosPago();
      methods = sortMethods(medios.map(mapMedio));
      loaded = true;
    } finally {
      loading = false;
      loadPromise = null;
      emit();
    }
  })();

  return loadPromise;
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

export async function addPaymentMethod(input: {
  label: string;
  tipoCobro: string;
}): Promise<PaymentMethodOption> {
  const created = mapMedio(
    await crearMedioPago({
      medio_pago: input.label.trim(),
      tipo_cobro: input.tipoCobro,
    })
  );
  methods = sortMethods([
    ...methods.filter((method) => method.id !== created.id),
    created,
  ]);
  loaded = true;
  emit();
  return created;
}
