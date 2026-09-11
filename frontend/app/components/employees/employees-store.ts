import { useSyncExternalStore } from "react";

import type { Employee } from "./employees-types";

let employees: Employee[] = [];

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

function getEmployees() {
  return employees;
}

export function getEmployeesSnapshot(): Employee[] {
  return employees;
}

export function useEmployees(): Employee[] {
  return useSyncExternalStore(subscribe, getEmployees, getEmployees);
}

export function addEmployee(employee: Employee) {
  employees = [...employees, employee];
  emit();
}

export function updateEmployee(id: string, patch: Partial<Employee>) {
  employees = employees.map((employee) =>
    employee.id === id ? { ...employee, ...patch } : employee
  );
  emit();
}

export function removeEmployee(id: string) {
  employees = employees.filter((employee) => employee.id !== id);
  emit();
}