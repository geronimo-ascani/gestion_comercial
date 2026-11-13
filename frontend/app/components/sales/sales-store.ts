import { useSyncExternalStore } from "react";

import type { Budget, SalesOrder } from "./sales-types";
import {
  advanceSalesOrder as advanceSalesOrderApi,
  cancelSalesOrder as cancelSalesOrderApi,
  createSalesOrder as createSalesOrderApi,
  getSalesOrder as getSalesOrderApi,
  listSalesOrders,
  updateSalesOrder as updateSalesOrderApi,
  type SalesOrderPayload,
} from "./sales-api";

let orders: SalesOrder[] = [];
let budgets: Budget[] = [];
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

export function loadSalesOrders(force = false): Promise<void> {
  if (ordersLoaded && !force) return Promise.resolve();
  if (ordersLoadPromise) return ordersLoadPromise;

  ordersLoadPromise = listSalesOrders()
    .then((loadedOrders) => {
      orders = loadedOrders;
      ordersLoaded = true;
      emit();
    })
    .finally(() => {
      ordersLoadPromise = null;
    });
  return ordersLoadPromise;
}

function saveSalesOrder(order: SalesOrder): SalesOrder {
  orders = [order, ...orders.filter((item) => item.number !== order.number)];
  ordersLoaded = true;
  emit();
  return order;
}

export async function getSalesOrder(id: string): Promise<SalesOrder> {
  const cached = orders.find((order) => order.number === id);
  if (cached) return cached;
  return saveSalesOrder(await getSalesOrderApi(id));
}

export async function createSalesOrder(
  payload: SalesOrderPayload
): Promise<SalesOrder> {
  return saveSalesOrder(await createSalesOrderApi(payload));
}

export async function updateSalesOrder(
  id: string,
  payload: SalesOrderPayload
): Promise<SalesOrder> {
  return saveSalesOrder(await updateSalesOrderApi(id, payload));
}

export async function advanceSalesOrder(
  id: string,
  estado: "proceso" | "enviado" | "entregado"
): Promise<SalesOrder> {
  return saveSalesOrder(await advanceSalesOrderApi(id, estado));
}

export async function cancelSalesOrder(id: string): Promise<SalesOrder> {
  return saveSalesOrder(await cancelSalesOrderApi(id));
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
