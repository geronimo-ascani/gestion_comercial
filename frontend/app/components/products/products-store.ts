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

export function getProductsSnapshot(): Product[] {
  return products;
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

export function useProducts(): Product[] {
  useEffect(() => {
    void loadProducts();
  }, []);

  return useSyncExternalStore(subscribe, getProducts, getServerProducts);
}

/**
 * Ajuste local del stock para los borradores de ventas/compras.
 * La persistencia real se hace contra la API cuando se confirme la operación.
 */
export function adjustStock(id: string, delta: number): number {
  const product = products.find((item) => item.id === id);
  if (!product) return 0;
  const stock = Math.max(0, product.stock + delta);
  products = products.map((item) => (item.id === id ? { ...item, stock } : item));
  emit();
  return stock;
}
