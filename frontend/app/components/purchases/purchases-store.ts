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
let orders: PurchaseOrder[] = [
  {
    number: "OC-001",
    providerId: "P-001",
    provider: "Distribuidora San Juan",
    date: "02/10/2026",
    receivedDate: "04/10/2026",
    items: [
      { product: "Auriculares Bluetooth", qty: 12, unitPrice: "$ 28.000", subtotal: "$ 336.000" },
      { product: "Mouse ergonómico", qty: 20, unitPrice: "$ 18.000", subtotal: "$ 360.000" },
    ],
    total: "$ 696.000",
    status: "recibida",
  },
  {
    number: "OC-002",
    providerId: "P-002",
    provider: "Mayorista del Norte",
    date: "03/10/2026",
    receivedDate: "09/10/2026",
    items: [
      { product: "Harina 0000 1kg", qty: 80, unitPrice: "$ 610", subtotal: "$ 48.800" },
      { product: "Aceite 900ml", qty: 48, unitPrice: "$ 1.280", subtotal: "$ 61.440" },
    ],
    total: "$ 110.240",
    status: "recibida",
  },
  {
    number: "OC-003",
    providerId: "P-003",
    provider: "Alimentos Cuyo S.A.",
    date: "06/10/2026",
    receivedDate: "08/10/2026",
    items: [
      { product: "Leche entera 1L", qty: 120, unitPrice: "$ 372", subtotal: "$ 44.640" },
    ],
    total: "$ 44.640",
    status: "recibida",
  },
  {
    number: "OC-004",
    providerId: "P-001",
    provider: "Distribuidora San Juan",
    date: "12/10/2026",
    receivedDate: "15/10/2026",
    items: [
      { product: "Monitor 24\" Full HD", qty: 8, unitPrice: "$ 72.000", subtotal: "$ 576.000" },
    ],
    total: "$ 576.000",
    status: "recibida",
  },
  {
    number: "OC-005",
    providerId: "P-002",
    provider: "Mayorista del Norte",
    date: "14/10/2026",
    receivedDate: "18/10/2026",
    items: [
      { product: "Arroz 1kg", qty: 60, unitPrice: "$ 810", subtotal: "$ 48.600" },
    ],
    total: "$ 48.600",
    status: "recibida",
  },
  {
    number: "OC-006",
    providerId: "P-004",
    provider: "LA Distribuciones",
    date: "15/10/2026",
    receivedDate: "20/10/2026",
    items: [
      { product: "Gaseosa 1,5L (promo)", qty: 72, unitPrice: "$ 720", subtotal: "$ 51.840" },
    ],
    total: "$ 51.840",
    status: "recibida",
  },
  {
    number: "OC-007",
    providerId: "P-005",
    provider: "Tecno Import SRL",
    date: "21/10/2026",
    items: [
      { product: "Auriculares Bluetooth", qty: 10, unitPrice: "$ 28.000", subtotal: "$ 280.000" },
    ],
    total: "$ 280.000",
    status: "pendiente",
  },
];

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