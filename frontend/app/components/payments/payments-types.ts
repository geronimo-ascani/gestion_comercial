export type PaymentMethod = "efectivo" | "tarjeta" | "mercadopago";

export type PaymentStatus = "aprobado" | "pendiente" | "rechazado";

export type InvoiceStatus = "emitida" | "aprobada" | "pagada" | "rechazada";

export type ConciliationStatus = "conciliado" | "pendiente";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  mercadopago: "MercadoPago",
};

export interface Invoice {
  number: string;
  orderNumber: string;
  clientId: string;
  client: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  status: InvoiceStatus;
  paidAt?: string;
  sentAt?: string;
  lastSentAt?: string;
  sendCount?: number;
}

export interface PaymentTransaction {
  id: string;
  invoiceNumber: string;
  orderNumber: string;
  clientId: string;
  client: string;
  method: PaymentMethod;
  amount: number;
  date: string;
  status: PaymentStatus;
  gatewayReference?: string;
  conciliationStatus: ConciliationStatus;
}

export interface GatewaySimulationResult {
  status: PaymentStatus;
  reference: string;
}