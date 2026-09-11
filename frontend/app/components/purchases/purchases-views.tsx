import { Badge } from "~/components/ui/badge";

import type { PurchaseOrderStatus } from "./purchases-types";

export function PurchaseOrderStatusBadge({
  status,
}: {
  status: PurchaseOrderStatus;
}) {
  const config: Record<
    PurchaseOrderStatus,
    { label: string; variant: "success" | "warning" | "info" | "destructive" }
  > = {
    pendiente: { label: "Pendiente", variant: "warning" },
    aprobada: { label: "Aprobada", variant: "success" },
    recibida: { label: "Recibida", variant: "info" },
    cancelada: { label: "Cancelada", variant: "destructive" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}