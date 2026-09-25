import { useSyncExternalStore } from "react";

import type { Product } from "./products-types";

const demoProducts: Product[] = [
  {
    id: "prod-1",
    code: "PRD-001",
    name: 'Notebook Gamer 15"',
    description: "16 GB RAM · 512 GB SSD · RTX 4060",
    purchasePrice: 850000,
    salePrice: 1099999,
    stock: 8,
    minStock: 3,
  },
  {
    id: "prod-2",
    code: "PRD-002",
    name: 'Monitor 24" Full HD',
    description: "Panel IPS · 75 Hz",
    purchasePrice: 180000,
    salePrice: 249999,
    stock: 0,
    minStock: 5,
  },
  {
    id: "prod-3",
    code: "PRD-003",
    name: "Teclado mecánico TKL",
    description: "Switches red · retroiluminado",
    purchasePrice: 45000,
    salePrice: 79999,
    stock: 25,
    minStock: 5,
  },
  {
    id: "prod-4",
    code: "PRD-004",
    name: "Mouse ergonómico",
    description: "Inalámbrico · 1600 DPI",
    purchasePrice: 18000,
    salePrice: 32999,
    stock: 40,
    minStock: 10,
  },
  {
    id: "prod-5",
    code: "PRD-005",
    name: "Auriculares Bluetooth",
    description: "Cancelación de ruido",
    purchasePrice: 52000,
    salePrice: 89999,
    stock: 4,
    minStock: 6,
  },
  {
    id: "prod-6",
    code: "PRD-006",
    name: "Disco SSD 1TB NVMe",
    description: "Lectura 3500 MB/s",
    purchasePrice: 96000,
    salePrice: 139999,
    stock: 12,
    minStock: 4,
  },
];

let products: Product[] = [...demoProducts];

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

export function getProductsSnapshot(): Product[] {
  return products;
}

export function useProducts(): Product[] {
  return useSyncExternalStore(subscribe, getProducts, getProducts);
}

export function getNextProductCode(): string {
  const max = products.reduce((highest, product) => {
    const match = /(\d+)$/.exec(product.code);
    const sequence = match ? Number(match[1]) : 0;
    return sequence > highest ? sequence : highest;
  }, 0);
  return `PRD-${String(max + 1).padStart(3, "0")}`;
}

export function addProduct(product: Product) {
  products = [...products, product];
  emit();
}

export function updateProduct(id: string, patch: Partial<Product>) {
  products = products.map((product) =>
    product.id === id ? { ...product, ...patch } : product
  );
  emit();
}

export function removeProduct(id: string) {
  products = products.filter((product) => product.id !== id);
  emit();
}