import { Badge } from "~/components/ui/badge";

import {
  paymentMethodLabels,
  type ConciliationStatus,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "./payments-types";

type BadgeVariant =
  | "success"
  | "warning"
  | "info"
  | "secondary"
  | "destructive"
  | "outline";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
    aprobado: { label: "Aprobado", variant: "success" },
    pendiente: { label: "Pendiente", variant: "warning" },
    rechazado: { label: "Rechazado", variant: "destructive" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const config: Record<InvoiceStatus, { label: string; variant: BadgeVariant }> = {
    emitida: { label: "Emitida", variant: "info" },
    aprobada: { label: "Aprobada", variant: "success" },
    pagada: { label: "Pagada", variant: "success" },
    rechazada: { label: "Rechazada", variant: "destructive" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function InvoiceSendBadge({ sendCount }: { sendCount?: number }) {
  return (sendCount ?? 0) > 0 ? (
    <Badge variant="success">Enviado</Badge>
  ) : (
    <Badge variant="warning">Pendiente</Badge>
  );
}

export function ConciliationBadge({ status }: { status: ConciliationStatus }) {
  return status === "conciliado" ? (
    <Badge variant="success">Conciliado</Badge>
  ) : (
    <Badge variant="warning">Pendiente</Badge>
  );
}

export function MethodBadge({ method }: { method: PaymentMethod }) {
  const variant: BadgeVariant = method === "mercadopago" ? "info" : "secondary";
  return <Badge variant={variant}>{paymentMethodLabels[method]}</Badge>;
}