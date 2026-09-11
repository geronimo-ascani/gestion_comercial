import { useSyncExternalStore } from "react";

import type { Customer } from "./customers-types";

let customers: Customer[] = [];

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

function getCustomers() {
  return customers;
}

export function useCustomers(): Customer[] {
  return useSyncExternalStore(subscribe, getCustomers, getCustomers);
}

export function addCustomer(customer: Customer) {
  customers = [...customers, customer];
  emit();
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  customers = customers.map((customer) =>
    customer.id === id ? { ...customer, ...patch } : customer
  );
  emit();
}

export function removeCustomer(id: string) {
  customers = customers.filter((customer) => customer.id !== id);
  emit();
}