import { useSyncExternalStore } from "react";

import { getAccessToken, setAccessToken } from "~/lib/auth-token";
import { ApiError } from "~/lib/api";
import type { Employee } from "../employees/employees-types";
import { iniciarSesion, obtenerUsuarioActual } from "./auth-api";

let currentUser: Employee | null = null;
let initialized = false;
let initialization: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getCurrentUser() {
  return currentUser;
}

function getInitialized() {
  return initialized;
}

export function useCurrentUser(): Employee | null {
  return useSyncExternalStore(subscribe, getCurrentUser, () => null);
}

export function useSessionInitialized(): boolean {
  return useSyncExternalStore(subscribe, getInitialized, () => false);
}

export async function initializeSession(): Promise<void> {
  if (initialized) return;
  if (initialization) return initialization;

  initialization = (async () => {
    const token = getAccessToken();
    if (!token) {
      currentUser = null;
      initialized = true;
      emit();
      return;
    }

    try {
      currentUser = await obtenerUsuarioActual();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setAccessToken(null);
        currentUser = null;
      } else {
        throw error;
      }
    } finally {
      initialized = true;
      initialization = null;
      emit();
    }
  })();

  return initialization;
}

export async function loginUser(
  email: string,
  password: string
): Promise<void> {
  const data = await iniciarSesion(email, password);
  setAccessToken(data.access_token);
  try {
    currentUser = await obtenerUsuarioActual();
  } catch (error) {
    setAccessToken(null);
    throw error;
  }
  initialized = true;
  emit();
}

export function acceptRegisteredSession(
  token: string,
  user: Employee
): void {
  setAccessToken(token);
  currentUser = user;
  initialized = true;
  emit();
}

export function logoutUser(): void {
  setAccessToken(null);
  currentUser = null;
  initialized = true;
  emit();
}
