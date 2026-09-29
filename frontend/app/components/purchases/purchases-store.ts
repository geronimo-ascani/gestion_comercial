import { useSyncExternalStore } from "react";

import type { Provider, PurchaseOrder } from "./purchases-types";

let providers: Provider[] = [
  {
    id: "P-001",
    name: "Distribuidora San Juan",
    cuit: "30-00012345-1",
    phone: "+54 11 4342-1100",
    email: "ventas@distribuidorasanjuan.com.ar",
    balance: 85000,
    address: {
      province: "Buenos Aires",
      locality: "CABA",
      street: "Av. Paseo Colón",
      number: "2750",
      apartment: "",
    },
    bank: "Banco Nación",
    account: "20-00012345-1",
  },
  {
    id: "P-002",
    name: "Mayorista del Norte",
    cuit: "30-00034567-5",
    phone: "+54 381 452-8890",
    email: "contacto@mayoristanorte.com.ar",
    address: {
      province: "Tucumán",
      locality: "San Miguel de Tucumán",
      street: "Av. Mate de Luna",
      number: "3100",
      apartment: "PB",
    },
    bank: "Banco Macro",
    account: "30-00034567-5",
  },
  {
    id: "P-003",
    name: "Alimentos Cuyo S.A.",
    cuit: "30-00056789-9",
    phone: "+54 261 429-3322",
    email: "admin@alimentoscuyo.com.ar",
    balance: -32000,
    address: {
      province: "Mendoza",
      locality: "Mendoza",
      street: "Av. Godoy Cruz",
      number: "1150",
      apartment: "",
    },
    bank: "Banco Galicia",
    account: "30-00056789-9",
  },
  {
    id: "P-004",
    name: "LA Distribuciones",
    cuit: "23-00987654-5",
    phone: "+54 351 468-7744",
    email: "ventas@ladistribuciones.com.ar",
    address: {
      province: "Córdoba",
      locality: "Córdoba",
      street: "Bv. San Juan",
      number: "940",
      apartment: "1º A",
    },
    bank: "Banco de Córdoba",
    account: "23-00987654-5",
  },
  {
    id: "P-005",
    name: "Tecno Import SRL",
    cuit: "20-11222334-8",
    phone: "+54 11 4795-6611",
    email: "info@tecnoimport.com.ar",
    address: {
      province: "Buenos Aires",
      locality: "San Isidro",
      street: "Av. del Libertador",
      number: "16200",
      apartment: "",
    },
    bank: "Banco Santander",
    account: "20-11222334-8",
  },
];
let orders: PurchaseOrder[] = [];

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

function getProviders() {
  return providers;
}

function getOrders() {
  return orders;
}

export function useProviders(): Provider[] {
  return useSyncExternalStore(subscribe, getProviders, getProviders);
}

export function usePurchaseOrders(): PurchaseOrder[] {
  return useSyncExternalStore(subscribe, getOrders, getOrders);
}

export function addProvider(provider: Provider) {
  providers = [...providers, provider];
  emit();
}

export function updateProvider(id: string, patch: Partial<Provider>) {
  providers = providers.map((provider) =>
    provider.id === id ? { ...provider, ...patch } : provider
  );
  emit();
}

export function removeProvider(id: string) {
  providers = providers.filter((provider) => provider.id !== id);
  emit();
}

export function addPurchaseOrder(order: PurchaseOrder) {
  orders = [...orders, order];
  emit();
}

export function removePurchaseOrder(number: string) {
  orders = orders.filter((order) => order.number !== number);
  emit();
}