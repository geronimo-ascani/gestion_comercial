import { getProductsSnapshot, adjustStock } from "../products/products-store";
import type { LineItem } from "./sales-types";

export function applyOrderStock(items: LineItem[]) {
  const products = getProductsSnapshot();
  for (const item of items) {
    const product = products.find((candidate) => candidate.code === item.sku);
    if (product) adjustStock(product.id, -item.qty);
  }
}

export function restoreOrderStock(items: LineItem[]) {
  const products = getProductsSnapshot();
  for (const item of items) {
    const product = products.find((candidate) => candidate.code === item.sku);
    if (product) adjustStock(product.id, item.qty);
  }
}

export function applyOrderStockDelta(
  previous: LineItem[] | undefined,
  next: LineItem[]
) {
  if (previous && previous.length > 0) restoreOrderStock(previous);
  if (next.length > 0) applyOrderStock(next);
}

export function stockValidationMessage(
  items: LineItem[],
  products: { id: string; code: string; name: string; stock: number }[]
): string | null {
  for (const item of items) {
    const product = products.find((candidate) => candidate.code === item.sku);
    if (product && item.qty > product.stock) {
      return `Stock insuficiente para "${item.product}": hay ${product.stock} y se requieren ${item.qty}.`;
    }
  }
  return null;
}