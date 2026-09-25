export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  purchasePrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
}