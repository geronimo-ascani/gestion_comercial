import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { formatMoney } from "~/lib/currency";
import type { PaymentTransaction } from "./payments-types";
import { paymentMethodLabels } from "./payments-types";
import { reconcilePayment, useInvoices } from "./payments-store";
import { InvoiceStatusBadge } from "./payments-views";

interface ReconcilePaymentDialogProps {
  payment: PaymentTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReconcilePaymentDialog({
  payment,
  open,
  onOpenChange,
}: ReconcilePaymentDialogProps) {
  const invoices = useInvoices();
  const [error, setError] = useState<string | null>(null);

  const invoice = payment
    ? invoices.find((item) => item.orderNumber === payment.orderNumber)
    : undefined;
  const canReconcile =
    !!invoice &&
    (invoice.status === "emitida" || invoice.status === "aprobada");

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  function handleConfirm() {
    if (!payment) return;
    if (!canReconcile) {
      setError("Esta venta no tiene un pago pendiente para conciliar.");
      return;
    }
    const ok = reconcilePayment(payment.id, payment.orderNumber);
    if (!ok) {
      setError("No se pudo conciliar el cobro con su venta.");
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conciliar cobro</DialogTitle>
          <DialogDescription>
            {payment
              ? `Concilia el cobro de la venta ${payment.orderNumber}.`
              : "Seleccione un cobro."}
          </DialogDescription>
        </DialogHeader>

        {payment && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Cobro</dt>
                <dd className="font-mono text-xs">{payment.id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Venta</dt>
                <dd className="font-mono text-xs">{payment.orderNumber}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">{payment.client}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Método</dt>
                <dd>{paymentMethodLabels[payment.method]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Monto</dt>
                <dd className="font-medium">{formatMoney(payment.amount)}</dd>
              </div>
              {payment.gatewayReference && (
                <div>
                  <dt className="text-muted-foreground">Referencia</dt>
                  <dd className="font-mono text-xs">
                    {payment.gatewayReference}
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">Estado de la venta</span>
              {invoice ? (
                <InvoiceStatusBadge status={invoice.status} />
              ) : (
                <span className="text-muted-foreground">Sin comprobante</span>
              )}
            </div>

            {!canReconcile && (
              <p className="text-sm text-destructive">
                Esta venta no tiene un pago pendiente para conciliar.
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!payment || !canReconcile}>
            Conciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}