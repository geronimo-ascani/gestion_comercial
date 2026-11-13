import { useSyncExternalStore } from "react";

import type { Provider, PurchaseOrder } from "./purchases-types";
import {
  createProvider,
  deleteProviderApi,
  listProviders,
  providerPayload,
  updateProviderApi,
} from "./providers-api";
import { listPurchaseOrders } from "./purchases-api";

let providers: Provider[] = [];
let orders: PurchaseOrder[] = [];
let ordersLoaded = false;
let ordersLoadPromise: Promise<void> | null = null;

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

async function fetchPurchaseOrders(): Promise<void> {
  orders = await listPurchaseOrders();
  ordersLoaded = true;
  emit();
}

export function loadPurchaseOrders(): Promise<void> {
  if (ordersLoaded) return Promise.resolve();
  if (ordersLoadPromise) return ordersLoadPromise;

  ordersLoadPromise = fetchPurchaseOrders().finally(() => {
    ordersLoadPromise = null;
  });
  return ordersLoadPromise;
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

export function savePurchaseOrder(order: PurchaseOrder) {
  orders = [...orders.filter((item) => item.number !== order.number), order];
  emit();
}