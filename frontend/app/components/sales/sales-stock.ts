import type { LineItem } from "./sales-types";

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