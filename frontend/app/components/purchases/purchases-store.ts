import { useSyncExternalStore } from "react";

import type { Provider, PurchaseOrder } from "./purchases-types";
import {
  createProvider,
  deleteProviderApi,
  listProviders,
  providerPayload,
  updateProviderApi,
} from "./providers-api";

let providers: Provider[] = [];
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

export async function refreshProviders(): Promise<Provider[]> {
  providers = await listProviders();
  emit();
  return providers;
}

export function usePurchaseOrders(): PurchaseOrder[] {
  return useSyncExternalStore(subscribe, getOrders, getOrders);
}

export async function addProvider(provider: Provider): Promise<Provider> {
  const saved = await createProvider(providerPayload(provider));
  providers = [...providers.filter((item) => item.id !== saved.id), saved];
  emit();
  return saved;
}

export async function updateProvider(
  id: string,
  provider: Provider
): Promise<Provider> {
  const saved = await updateProviderApi(id, providerPayload(provider));
  providers = providers.map((item) => (item.id === id ? saved : item));
  emit();
  return saved;
}

export async function removeProvider(id: string): Promise<void> {
  await deleteProviderApi(id);
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