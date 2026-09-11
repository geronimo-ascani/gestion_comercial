import { useSyncExternalStore } from "react";

import type { Provider, PurchaseOrder } from "./purchases-types";

let providers: Provider[] = [];
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