export type PaymentStatus = "aprobado" | "pendiente" | "rechazado";

export type InvoiceStatus = "emitida" | "aprobada" | "pagada" | "rechazada";

export type InvoiceType = "A" | "B" | "C" | "E";

export interface Invoice {
  id: string;
  number: string;
  type: InvoiceType;
  orderNumber: string;
  clientId: string;
  client: string;
  /** Email del cliente, usado como destinatario por defecto del envío. */
  clientEmail: string;
  date: string;
  amount: number;
  paidAmount: number;
  balance: number;
  /** Último medio de pago aprobado, si existe. */
  method: string;
  status: InvoiceStatus;
}

export interface PaymentTransaction {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  orderNumber: string;
  clientId: string;
  client: string;
  method: string;
  methodLabel: string;
  amount: number;
  date: string;
  status: PaymentStatus;
  reference?: string;
}
