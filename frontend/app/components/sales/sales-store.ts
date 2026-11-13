import { useSyncExternalStore } from "react";

import type { Budget, SalesOrder } from "./sales-types";
import {
  approveBudget as approveBudgetApi,
  advanceSalesOrder as advanceSalesOrderApi,
  cancelSalesOrder as cancelSalesOrderApi,
  convertBudget as convertBudgetApi,
  createBudget as createBudgetApi,
  createSalesOrder as createSalesOrderApi,
  deleteBudget as deleteBudgetApi,
  getBudget as getBudgetApi,
  getSalesOrder as getSalesOrderApi,
  listBudgets,
  listSalesOrders,
  updateBudget as updateBudgetApi,
  updateSalesOrder as updateSalesOrderApi,
  type PresupuestoConversionPayload,
  type PresupuestoPayload,
  type SalesOrderPayload,
} from "./sales-api";

let orders: SalesOrder[] = [];
let budgets: Budget[] = [];
let ordersLoaded = false;
let ordersLoadPromise: Promise<void> | null = null;
let budgetsLoaded = false;
let budgetsLoadPromise: Promise<void> | null = null;

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

export function loadBudgets(force = false): Promise<void> {
  if (budgetsLoaded && !force) return Promise.resolve();
  if (budgetsLoadPromise) return budgetsLoadPromise;

  budgetsLoadPromise = listBudgets()
    .then((loadedBudgets) => {
      budgets = loadedBudgets;
      budgetsLoaded = true;
      emit();
    })
    .finally(() => {
      budgetsLoadPromise = null;
    });
  return budgetsLoadPromise;
}

function saveSalesOrder(order: SalesOrder): SalesOrder {
  orders = [order, ...orders.filter((item) => item.number !== order.number)];
  ordersLoaded = true;
  emit();
  return order;
}

function saveBudget(budget: Budget): Budget {
  budgets = [budget, ...budgets.filter((item) => item.number !== budget.number)];
  budgetsLoaded = true;
  emit();
  return budget;
}

export async function getSalesOrder(id: string): Promise<SalesOrder> {
  const cached = orders.find((order) => order.number === id);
  if (cached) return cached;
  return saveSalesOrder(await getSalesOrderApi(id));
}

export async function getBudget(id: string): Promise<Budget> {
  const cached = budgets.find((budget) => budget.number === id);
  if (cached) return cached;
  return saveBudget(await getBudgetApi(id));
}

export async function createSalesOrder(
  payload: SalesOrderPayload
): Promise<SalesOrder> {
  return saveSalesOrder(await createSalesOrderApi(payload));
}

export async function createBudget(
  payload: PresupuestoPayload,
): Promise<Budget> {
  return saveBudget(await createBudgetApi(payload));
}

export async function updateBudget(
  id: string,
  payload: PresupuestoPayload,
): Promise<Budget> {
  return saveBudget(await updateBudgetApi(id, payload));
}

export async function approveBudget(id: string): Promise<Budget> {
  return saveBudget(await approveBudgetApi(id));
}

export async function removeBudget(id: string): Promise<void> {
  await deleteBudgetApi(id);
  budgets = budgets.filter((budget) => budget.number !== id);
  emit();
}

export async function convertBudget(
  id: string,
  payload: PresupuestoConversionPayload,
): Promise<SalesOrder> {
  const order = await convertBudgetApi(id, payload);
  budgets = budgets.map((budget) =>
    budget.number === id ? { ...budget, status: "convertido" } : budget,
  );
  emit();
  return saveSalesOrder(order);
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
