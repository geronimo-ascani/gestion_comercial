import { useSyncExternalStore } from "react";

import { calculateSalePrice } from "./products-calc";
import {
  ivaRates,
  type IvaCondition,
  type IvaOperationCode,
  type Product,
} from "./products-types";

function seed(
  id: string,
  code: string,
  name: string,
  description: string,
  purchasePrice: number,
  margin: number,
  stock: number,
  minStock: number,
  ivaCondition: IvaCondition,
  ivaOperationCode?: IvaOperationCode
): Product {
  const salePrice = calculateSalePrice(purchasePrice, margin, ivaRates[ivaCondition]);
  return {
    id,
    code,
    name,
    description,
    purchasePrice,
    margin,
    salePrice,
    stock,
    minStock,
    ivaCondition,
    ivaOperationCode,
  };
}

const demoProducts: Product[] = [
  seed("prod-1", "PRD-001", 'Notebook Gamer 15"', "16 GB RAM · 512 GB SSD · RTX 4060", 850000, 30, 8, 3, "gravado21"),
  seed("prod-2", "PRD-002", 'Monitor 24" Full HD', "Panel IPS · 75 Hz", 180000, 40, 0, 5, "gravado27"),
  seed("prod-3", "PRD-003", "Teclado mecánico TKL", "Switches red · retroiluminado", 45000, 70, 25, 5, "gravado5"),
  seed("prod-4", "PRD-004", "Mouse ergonómico", "Inalámbrico · 1600 DPI", 18000, 80, 40, 10, "gravado10_5"),
  seed("prod-5", "PRD-005", "Auriculares Bluetooth", "Cancelación de ruido", 52000, 60, 4, 6, "exento", "E"),
  seed("prod-6", "PRD-006", "Disco SSD 1TB NVMe", "Lectura 3500 MB/s", 96000, 45, 12, 4, "gravado21"),
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

export function adjustStock(id: string, delta: number): number {
  const product = products.find((item) => item.id === id);
  if (!product) return 0;
  const stock = Math.max(0, product.stock + delta);
  products = products.map((item) => (item.id === id ? { ...item, stock } : item));
  emit();
  return stock;
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