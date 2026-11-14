import { useSyncExternalStore } from "react";

import {
  actualizarEmpleado as actualizarEmpleadoApi,
  crearEmpleado as crearEmpleadoApi,
  eliminarEmpleado as eliminarEmpleadoApi,
  listarEmpleados,
  obtenerEmpleado as obtenerEmpleadoApi,
  type EmployeeCreatePayload,
  type EmployeeUpdatePayload,
} from "../auth/auth-api";
import type { Employee } from "./employees-types";

let employees: Employee[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getEmployees() {
  return employees;
}

export function useEmployees(): Employee[] {
  return useSyncExternalStore(subscribe, getEmployees, () => []);
}

export function loadEmployees(force = false): Promise<void> {
  if (loaded && !force) return Promise.resolve();
  if (loading) return loading;
  loading = listarEmpleados()
    .then((data) => {
      employees = data;
      loaded = true;
      emit();
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

export async function refreshEmployees(): Promise<void> {
  if (loading) await loading;
  loaded = false;
  return loadEmployees();
}

function saveEmployee(employee: Employee): Employee {
  employees = [
    employee,
    ...employees.filter((item) => item.id !== employee.id),
  ];
  loaded = true;
  emit();
  return employee;
}

export async function getEmployee(id: string): Promise<Employee> {
  const cached = employees.find((employee) => employee.id === id);
  if (cached) return cached;
  return saveEmployee(await obtenerEmpleadoApi(id));
}

export async function createEmployee(
  payload: EmployeeCreatePayload
): Promise<Employee> {
  return saveEmployee(await crearEmpleadoApi(payload));
}

export async function updateEmployee(
  id: string,
  payload: EmployeeUpdatePayload
): Promise<Employee> {
  return saveEmployee(await actualizarEmpleadoApi(id, payload));
}

export async function removeEmployee(id: string): Promise<void> {
  await eliminarEmpleadoApi(id);
  employees = employees.filter((employee) => employee.id !== id);
  emit();
}
