export type IvaCondition =
  | "gravado27"
  | "gravado21"
  | "gravado10_5"
  | "gravado5"
  | "gravado2_5"
  | "exento"
  | "no_gravado";

export const ivaConditionLabels: Record<IvaCondition, string> = {
  gravado27: "IVA 27,00 %",
  gravado21: "IVA 21,00 %",
  gravado10_5: "IVA 10,50 %",
  gravado5: "IVA 5,00 %",
  gravado2_5: "IVA 2,50 %",
  exento: "Exento (0,00 %)",
  no_gravado: "No gravado (0,00 %)",
};

export const ivaRates: Record<IvaCondition, number> = {
  gravado27: 0.27,
  gravado21: 0.21,
  gravado10_5: 0.105,
  gravado5: 0.05,
  gravado2_5: 0.025,
  exento: 0,
  no_gravado: 0,
};

export function ivaRateLabel(condition: IvaCondition): string {
  const percent = ivaRates[condition] * 100;
  return `${percent.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;
}

export const ivaArcaCodes: Record<IvaCondition, string> = {
  gravado27: "0006",
  gravado21: "0005",
  gravado10_5: "0004",
  gravado5: "0008",
  gravado2_5: "0009",
  exento: "0003",
  no_gravado: "0003",
};

export type IvaOperationCode = "E" | "N" | "X" | "Z" | "C";

export const ivaOperationCodeLabels: Record<IvaOperationCode, string> = {
  E: "Operaciones exentas",
  N: "No gravado",
  X: "Import./Export. del exterior",
  Z: "Importaciones de zona franca",
  C: "Operación de canje",
};

export const defaultIvaOperationCode: Partial<
  Record<IvaCondition, IvaOperationCode>
> = {
  exento: "E",
  no_gravado: "N",
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
  ivaOperationCode?: IvaOperationCode;
}