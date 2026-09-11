import type { LineItem } from "../sales/sales-types";
import type { Address } from "~/lib/address";

export type PurchaseOrderStatus =
  | "pendiente"
  | "aprobada"
  | "recibida"
  | "cancelada";

export interface Provider {
  id: string;
  name: string;
  cuit: string;
  phone: string;
  email: string;
  address: Address;
  bank: string;
  account: string;
}

export interface PurchaseOrder {
  number: string;
  provider: string;
  date: string;
  items: LineItem[];
  total: string;
  status: PurchaseOrderStatus;
}