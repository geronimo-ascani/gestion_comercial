import { useSyncExternalStore } from "react";

import type { Customer } from "./customers-types";

let customers: Customer[] = [
  {
    id: "C-001",
    firstName: "María",
    lastName: "González",
    document: "27.123.456",
    phone: "+54 11 5458-1024",
    email: "maria.gonzalez@gmail.com",
    address: {
      province: "Buenos Aires",
      locality: "CABA",
      street: "Av. Corrientes",
      number: "1234",
      apartment: "3°B",
    },
  },
  {
    id: "C-002",
    firstName: "Juan",
    lastName: "Pérez",
    document: "30.654.789",
    phone: "+54 11 4756-8830",
    email: "juan.perez@hotmail.com",
    address: {
      province: "Buenos Aires",
      locality: "La Plata",
      street: "Calle 12",
      number: "456",
      apartment: "",
    },
  },
  {
    id: "C-003",
    firstName: "Laura",
    lastName: "Fernández",
    document: "23.987.321",
    phone: "+54 341 422-9102",
    email: "laura.fernandez@gmail.com",
    address: {
      province: "Santa Fe",
      locality: "Rosario",
      street: "Bv. Oroño",
      number: "2890",
      apartment: "PB",
    },
  },
  {
    id: "C-004",
    firstName: "Carlos",
    lastName: "Rodríguez",
    document: "30.321.654",
    phone: "+54 261 429-7731",
    email: "carlos.rodriguez@outlook.com",
    address: {
      province: "Mendoza",
      locality: "Mendoza",
      street: "Av. San Martín",
      number: "891",
      apartment: "5°C",
    },
  },
  {
    id: "C-005",
    firstName: "Ana",
    lastName: "Martínez",
    document: "27.456.987",
    phone: "+54 351 458-2210",
    email: "ana.martinez@gmail.com",
    address: {
      province: "Córdoba",
      locality: "Córdoba",
      street: "Av. Colón",
      number: "540",
      apartment: "",
    },
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