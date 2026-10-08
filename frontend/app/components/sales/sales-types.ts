import type { Address } from "~/lib/address";

export type OrderStatus = "pendiente" | "proceso" | "enviado" | "entregado" | "cancelado";

export type PaymentMethod = "efectivo" | "tarjeta" | "mercadopago";

export type PaymentStatus = "pendiente" | "pagado" | "rechazado";

export type BudgetStatus = "pendiente" | "aprobado" | "vencido" | "convertido";

export interface LineItem {
  sku?: string;
  product: string;
  qty: number;
  unitPrice: string;
  subtotal: string;
}

export interface SalesOrder {
  number: string;
  client: string;
  clientId?: string;
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  date: string;
  deliveryAddress: Address;
  items: LineItem[];
  subtotal?: string;
  shipping?: string;
  tax?: string;
  discount?: string;
  total: string;
  status: OrderStatus;
  payment: PaymentMethod;
  paymentStatus: PaymentStatus;
  invoiceNumber?: string;
}

export interface Budget {
  number: string;
  client: string;
  clientId?: string;
  date: string;
  expires: string;
  items: LineItem[];
  total: string;
  status: BudgetStatus;
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatInputDate(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function formatDateForInput(value: string): string {
  if (!value) return "";
  const [day, month, year] = value.split("/");
  return `${year}-${month}-${day}`;
}

export const paymentLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  mercadopago: "MercadoPago",
};