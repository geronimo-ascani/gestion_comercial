import { useSyncExternalStore } from "react";

import type { Budget, SalesOrder } from "./sales-types";

let orders: SalesOrder[] = [];
let budgets: Budget[] = [];

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

function getOrders() {
  return orders;
}

function getBudgets() {
  return budgets;
}

export function useOrders(): SalesOrder[] {
  return useSyncExternalStore(subscribe, getOrders, getOrders);
}

export function useBudgets(): Budget[] {
  return useSyncExternalStore(subscribe, getBudgets, getBudgets);
}

export function addOrder(order: SalesOrder) {
  orders = [...orders, order];
  emit();
}

export function removeOrder(number: string) {
  orders = orders.filter((order) => order.number !== number);
  emit();
}

export function updateOrder(number: string, patch: Partial<SalesOrder>) {
  orders = orders.map((order) =>
    order.number === number ? { ...order, ...patch } : order
  );
  emit();
}

export function addBudget(budget: Budget) {
  budgets = [...budgets, budget];
  emit();
}