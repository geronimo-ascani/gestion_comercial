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
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { formatMoney } from "~/lib/currency";
import type { PaymentTransaction } from "./payments-types";
import { paymentMethodLabels } from "./payments-types";
import { reconcilePayment, useInvoices } from "./payments-store";

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
  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "emitida" || invoice.status === "aprobada"
  );
  const [orderNumber, setOrderNumber] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !payment) return;
    const best = pendingInvoices.find(
      (invoice) =>
        invoice.clientId === payment.clientId &&
        invoice.amount === payment.amount
    );
    setOrderNumber(best?.orderNumber ?? pendingInvoices[0]?.orderNumber ?? "");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, payment]);

  function handleConfirm() {
    if (!payment) return;
    if (!orderNumber) {
      setError("Seleccione una venta para conciliar el cobro.");
      return;
    }
    const ok = reconcilePayment(payment.id, orderNumber);
    if (!ok) {
      setError("No se pudo conciliar el cobro con la venta seleccionada.");
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
            Empareje el cobro con su venta para marcarlo como conciliado.
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
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Referencia</dt>
                  <dd className="font-mono text-xs">
                    {payment.gatewayReference}
                  </dd>
                </div>
              )}
            </dl>

            <div className="space-y-2">
              <Label htmlFor="reconcile-order">Venta</Label>
              {pendingInvoices.length === 0 ? (
                <p className="rounded-lg border p-3 text-center text-sm text-muted-foreground">
                  No hay ventas pendientes para conciliar.
                </p>
              ) : (
                <Select
                  value={orderNumber}
                  onValueChange={(value) => {
                    if (value) setOrderNumber(value);
                  }}
                >
                  <SelectTrigger id="reconcile-order" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pendingInvoices.map((invoice) => (
                      <SelectItem
                        key={invoice.number}
                        value={invoice.orderNumber}
                      >
                        {invoice.orderNumber} · {invoice.client} ·{" "}
                        {formatMoney(invoice.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={!payment || pendingInvoices.length === 0}
          >
            Conciliar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}