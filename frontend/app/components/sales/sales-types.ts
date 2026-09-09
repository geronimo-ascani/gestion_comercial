export type OrderStatus = "pendiente" | "proceso" | "enviado" | "entregado" | "cancelado";

export type PaymentMethod = "efectivo" | "tarjeta" | "mercadopago";

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
  company?: string;
  contact?: string;
  email?: string;
  phone?: string;
  date: string;
  deliveryAddress: string;
  items: LineItem[];
  subtotal?: string;
  shipping?: string;
  tax?: string;
  discount?: string;
  total: string;
  status: OrderStatus;
  payment: PaymentMethod;
}

export interface Budget {
  number: string;
  client: string;
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

export const paymentLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  mercadopago: "MercadoPago",
};