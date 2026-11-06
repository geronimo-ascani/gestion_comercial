export interface Product {
  /** `id_producto`; también se usa como código visible. */
  id: string;
  code: string;
  name: string;
  category: string;
  categoryId: string;
  description: string;
  purchasePrice: number;
  margin: number;
  salePrice: number;
  stock: number;
  minStock: number;
  alicuotaId: string;
  alicuotaDescripcion: string;
  alicuotaPorcentaje: number;
  stockBajo: boolean;
}
