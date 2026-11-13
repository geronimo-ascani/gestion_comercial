import { useSyncExternalStore } from "react";

import {
  customerPayload,
  createCustomer,
  deleteCustomerApi,
  listCustomers,
  updateCustomerApi,
} from "./customers-api";
import type { Customer } from "./customers-types";

let customers: Customer[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCustomers() {
  return customers;
}

export function useCustomers(): Customer[] {
  return useSyncExternalStore(subscribe, getCustomers, getCustomers);
}

export async function refreshCustomers(): Promise<Customer[]> {
  customers = await listCustomers();
  emit();
  return customers;
}

export async function addCustomer(customer: Customer): Promise<Customer> {
  const saved = await createCustomer(customerPayload(customer));
  customers = [...customers.filter((item) => item.id !== saved.id), saved];
  emit();
  return saved;
}

export async function updateCustomer(
  id: string,
  customer: Customer
): Promise<Customer> {
  const saved = await updateCustomerApi(id, customerPayload(customer));
  customers = customers.map((item) => (item.id === id ? saved : item));
  emit();
  return saved;
}

export async function removeCustomer(id: string): Promise<void> {
  await deleteCustomerApi(id);
  customers = customers.filter((customer) => customer.id !== id);
  emit();
}
