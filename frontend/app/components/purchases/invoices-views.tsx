import { Badge } from "~/components/ui/badge";

import type { InvoiceEstadoPago } from "./invoices-types";

const ESTADO_CONFIG: Record<
  InvoiceEstadoPago,
  { label: string; variant: "warning" | "success" }
> = {
  emitida: { label: "Emitida", variant: "warning" },
  pagada: { label: "Pagada", variant: "success" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceEstadoPago }) {
  const { label, variant } = ESTADO_CONFIG[status];
  return <Badge variant={variant}>{label}</Badge>;
}
