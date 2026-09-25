import { useSyncExternalStore } from "react";

import type { Employee } from "./employees-types";

const demoEmployees: Employee[] = [
  {
    id: "EMP-001",
    firstName: "María",
    lastName: "González",
    cuil: "20-30223344-5",
    phone: "+54 11 5555-0101",
    email: "maria@empresa.com",
    hireDate: "01/03/2023",
    role: "administrador",
    password: "123456",
  },
  {
    id: "EMP-002",
    firstName: "Juan",
    lastName: "Pérez",
    cuil: "20-25123456-7",
    phone: "+54 11 5555-0202",
    email: "juan@empresa.com",
    hireDate: "15/06/2024",
    role: "ventas",
    password: "123456",
  },
];

let employees: Employee[] = [...demoEmployees];

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