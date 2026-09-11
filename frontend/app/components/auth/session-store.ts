import { useSyncExternalStore } from "react";

import type { Employee } from "../employees/employees-types";
import {
  getEmployeesSnapshot,
  updateEmployee,
} from "../employees/employees-store";

let currentUserId: string | null = null;

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

function getCurrentUser(): Employee | null {
  if (!currentUserId) return null;
  return (
    getEmployeesSnapshot().find((employee) => employee.id === currentUserId) ??
    null
  );
}

export function useCurrentUser(): Employee | null {
  return useSyncExternalStore(subscribe, getCurrentUser, getCurrentUser);
}

export function loginUser(email: string, password: string): string | null {
  const employee = getEmployeesSnapshot().find(
    (item) => item.email.toLowerCase() === email.trim().toLowerCase()
  );
  if (!employee) return "No existe un usuario con ese correo.";
  if (!employee.password) return "El usuario no tiene contraseña configurada.";
  if (employee.password !== password) return "La contraseña es incorrecta.";
  currentUserId = employee.id;
  emit();
  return null;
}

export function logoutUser() {
  currentUserId = null;
  emit();
}

export function changePassword(
  currentPassword: string,
  newPassword: string
): string | null {
  const employee = getCurrentUser();
  if (!employee) return "No hay un usuario en sesión.";
  if (!employee.password) return "El usuario no tiene contraseña configurada.";
  if (employee.password !== currentPassword)
    return "La contraseña actual es incorrecta.";
  if (newPassword.length < 6)
    return "La nueva contraseña debe tener al menos 6 caracteres.";
  updateEmployee(employee.id, { password: newPassword });
  emit();
  return null;
}