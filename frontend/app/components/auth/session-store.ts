import { useSyncExternalStore } from "react";

import type { Employee } from "../employees/employees-types";
import {
  getEmployeesSnapshot,
  updateEmployee,
} from "../employees/employees-store";

const SESSION_KEY = "gc-current-user-id";

function readStoredUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function persistUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (userId) window.localStorage.setItem(SESSION_KEY, userId);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignorar errores de almacenamiento (modo privado, cuota, etc.)
  }
}

let currentUserId: string | null = readStoredUserId();

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
  persistUserId(currentUserId);
  emit();
  return null;
}

export function logoutUser() {
  currentUserId = null;
  persistUserId(null);
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