export type IvaCondition =
  | "gravado21"
  | "gravado10_5"
  | "exento"
  | "no_gravado";

export const ivaConditionLabels: Record<IvaCondition, string> = {
  gravado21: "Gravado IVA 21%",
  gravado10_5: "Gravado IVA 10.5%",
  exento: "Exento",
  no_gravado: "No gravado",
};

export const ivaRates: Record<IvaCondition, number> = {
  gravado21: 0.21,
  gravado10_5: 0.105,
  exento: 0,
  no_gravado: 0,
};

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  purchasePrice: number;
  margin: number;
  salePrice: number;
  stock: number;
  minStock: number;
  ivaCondition: IvaCondition;
}