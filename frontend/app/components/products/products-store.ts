import { useEffect, useSyncExternalStore } from "react";

import { listarProductos } from "./products-api";
import type { Product } from "./products-types";

const EMPTY_PRODUCTS: Product[] = [];

let products: Product[] = EMPTY_PRODUCTS;
let loaded = false;
let loadPromise: Promise<void> | null = null;

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

function getProducts() {
  return products;
}

function getServerProducts() {
  return EMPTY_PRODUCTS;
}

async function fetchProducts(): Promise<void> {
  const data = await listarProductos({ estado: true, limit: 200 });
  products = data.items;
  loaded = true;
  emit();
}

export function loadProducts(force = false): Promise<void> {
  if (loaded && !force) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = fetchProducts().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
}

export async function refreshProducts(): Promise<void> {
  if (loadPromise) {
    try {
      await loadPromise;
    } catch {
      // Si la carga anterior falló, se reintenta con la consulta forzada.
    }
  }
  loaded = false;
  return loadProducts(true);
}

export function invalidateProducts(): void {
  loaded = false;
}

export function useProducts(): Product[] {
  useEffect(() => {
    void loadProducts();
  }, []);

  return useSyncExternalStore(subscribe, getProducts, getServerProducts);
}
