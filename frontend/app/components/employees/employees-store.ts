import { useSyncExternalStore } from "react";

import { listarEmpleados } from "../auth/auth-api";
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

export function loadEmployees(): Promise<void> {
  if (loaded) return Promise.resolve();
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
