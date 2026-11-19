import { Badge } from "~/components/ui/badge";

import type {
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
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
    aprobada: { label: "Pago parcial", variant: "warning" },
    pagada: { label: "Pagada", variant: "success" },
    rechazada: { label: "Rechazada", variant: "destructive" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function InvoiceTypeBadge({ type }: { type: InvoiceType }) {
  const variant: BadgeVariant = type === "A" ? "info" : "secondary";
  return <Badge variant={variant}>Tipo {type}</Badge>;
}

export function MethodBadge({ label }: { label: string }) {
  return <Badge variant="secondary">{label}</Badge>;
}
