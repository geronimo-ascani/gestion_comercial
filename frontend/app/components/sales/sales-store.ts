import { useSyncExternalStore } from "react";

import type { Budget, SalesOrder } from "./sales-types";
import { formatDate } from "./sales-types";

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

export function updateBudget(number: string, patch: Partial<Budget>) {
  budgets = budgets.map((budget) =>
    budget.number === number ? { ...budget, ...patch } : budget
  );
  emit();
}

export function removeBudget(number: string) {
  budgets = budgets.filter((budget) => budget.number !== number);
  emit();
}

export function convertBudget(number: string): SalesOrder | null {
  const budget = budgets.find((item) => item.number === number);
  if (!budget) return null;

  const orderNumber = `PV-${String(orders.length + 1).padStart(3, "0")}`;
  const order: SalesOrder = {
    number: orderNumber,
    client: budget.client,
    clientId: budget.clientId,
    date: formatDate(new Date()),
    deliveryAddress: {
      province: "",
      locality: "",
      street: "",
      number: "",
      apartment: "",
    },
    items: budget.items.map((item) => ({ ...item })),
    total: budget.total,
    status: "pendiente",
    payment: "tarjeta",
    paymentStatus: "pendiente",
  };

  orders = [...orders, order];
  budgets = budgets.map((item) =>
    item.number === number ? { ...item, status: "convertido" } : item
  );
  emit();
  return order;
}