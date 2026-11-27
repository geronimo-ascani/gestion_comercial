export type PaymentStatus = "aprobado" | "pendiente" | "rechazado";

export type InvoiceStatus = "emitida" | "aprobada" | "pagada" | "rechazada";

export type EmailEstado = "pendiente" | "enviado" | "fallido";

export type EmailOrigen = "automatico" | "manual";

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
  /** true cuando el último intento de envío del comprobante fue exitoso. */
  sent?: boolean;
  /** Estado del último correo, calculado por el backend. */
  emailStatus?: EmailEstado | null;
  emailOrigin?: EmailOrigen | null;
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
