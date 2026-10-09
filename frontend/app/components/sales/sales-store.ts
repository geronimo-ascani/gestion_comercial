import { useSyncExternalStore } from "react";

import type { Budget, SalesOrder } from "./sales-types";

const demoOrders: SalesOrder[] = [
  {
    number: "PV-DEMO-01",
    client: "María González",
    clientId: "C-001",
    email: "maria.gonzalez@gmail.com",
    phone: "+54 11 5458-1024",
    date: "04/10/2026",
    deliveryAddress: {
      province: "Buenos Aires",
      locality: "CABA",
      street: "Av. Corrientes",
      number: "1234",
      apartment: "3°B",
    },
    items: [
      {
        sku: "PRD-005",
        product: "Auriculares Bluetooth",
        qty: 2,
        unitPrice: "$ 45.000",
        subtotal: "$ 90.000",
      },
      {
        sku: "PRD-004",
        product: "Mouse ergonómico",
        qty: 1,
        unitPrice: "$ 35.000",
        subtotal: "$ 35.000",
      },
    ],
    total: "$ 125.000",
    status: "entregado",
    payment: "mercadopago",
    paymentStatus: "pagado",
    invoiceNumber: "F-001",
  },
  {
    number: "PV-DEMO-02",
    client: "Juan Pérez",
    clientId: "C-002",
    email: "juan.perez@hotmail.com",
    phone: "+54 11 4756-8830",
    date: "06/10/2026",
    deliveryAddress: {
      province: "Buenos Aires",
      locality: "La Plata",
      street: "Calle 12",
      number: "456",
      apartment: "",
    },
    items: [
      {
        sku: "PRD-003",
        product: "Teclado mecánico TKL",
        qty: 1,
        unitPrice: "$ 45.000",
        subtotal: "$ 45.000",
      },
    ],
    total: "$ 45.000",
    status: "proceso",
    payment: "tarjeta",
    paymentStatus: "pendiente",
    invoiceNumber: "F-002",
  },
  {
    number: "PV-DEMO-03",
    client: "Laura Fernández",
    clientId: "C-003",
    email: "laura.fernandez@gmail.com",
    phone: "+54 341 422-9102",
    date: "01/10/2026",
    deliveryAddress: {
      province: "Santa Fe",
      locality: "Rosario",
      street: "Bv. Oroño",
      number: "2890",
      apartment: "PB",
    },
    items: [
      {
        sku: "PRD-002",
        product: 'Monitor 24" Full HD',
        qty: 1,
        unitPrice: "$ 90.000",
        subtotal: "$ 90.000",
      },
    ],
    total: "$ 90.000",
    status: "pendiente",
    payment: "mercadopago",
    paymentStatus: "pendiente",
    invoiceNumber: "F-003",
  },
  {
    number: "PV-DEMO-04",
    client: "Carlos Rodríguez",
    clientId: "C-004",
    email: "carlos.rodriguez@outlook.com",
    phone: "+54 261 429-7731",
    date: "08/10/2026",
    deliveryAddress: {
      province: "Mendoza",
      locality: "Mendoza",
      street: "Av. San Martín",
      number: "891",
      apartment: "5°C",
    },
    items: [
      {
        sku: "PRD-005",
        product: "Auriculares Bluetooth",
        qty: 1,
        unitPrice: "$ 60.000",
        subtotal: "$ 60.000",
      },
    ],
    total: "$ 60.000",
    status: "entregado",
    payment: "efectivo",
    paymentStatus: "pagado",
    invoiceNumber: "F-004",
  },
  {
    number: "PV-DEMO-05",
    client: "Ana Martínez",
    clientId: "C-005",
    email: "ana.martinez@gmail.com",
    phone: "+54 351 458-2210",
    date: "07/10/2026",
    deliveryAddress: {
      province: "Córdoba",
      locality: "Córdoba",
      street: "Av. Colón",
      number: "540",
      apartment: "",
    },
    items: [
      {
        sku: "PRD-006",
        product: "Disco SSD 1TB NVMe",
        qty: 1,
        unitPrice: "$ 32.000",
        subtotal: "$ 32.000",
      },
    ],
    total: "$ 32.000",
    status: "entregado",
    payment: "mercadopago",
    paymentStatus: "pagado",
    invoiceNumber: "F-005",
  },
];

let orders: SalesOrder[] = [...demoOrders];
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