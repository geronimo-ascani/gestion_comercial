import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

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
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { formatMoney, parseNumberInput } from "~/lib/currency";
import {
  loadPaymentMethods,
  usePaymentMethods,
  usePaymentMethodsLoading,
} from "./payment-methods-store";
import { registrarPago } from "./payments-store";
import type { Invoice } from "./payments-types";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
}

function formatAmountInput(value: number): string {
  return value.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoice,
}: RecordPaymentDialogProps) {
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const paymentMethods = usePaymentMethods();
  const methodsLoading = usePaymentMethodsLoading();
  const methodItems = Object.fromEntries(
    paymentMethods.map((paymentMethod) => [
      paymentMethod.id,
      paymentMethod.label,
    ])
  );
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(formatAmountInput(invoice.balance));
    setReference("");
    setError(null);
    setSubmitting(false);
    submittingRef.current = false;
    void loadPaymentMethods().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?.id]);

  useEffect(() => {
    if (!open || method) return;
    if (paymentMethods.length === 0) return;
    setMethod(paymentMethods[0].id);
  }, [open, method, paymentMethods]);

  async function handleConfirm() {
    if (!invoice) return;
    if (submittingRef.current || invoice.balance <= 0) return;

    if (!method) {
      setError("Seleccione un medio de pago.");
      return;
    }

    const parsedAmount =
      Math.round(parseNumberInput(amount) * 100) / 100;
    if (parsedAmount <= 0) {
      setError("Ingrese un monto válido.");
      return;
    }
    if (parsedAmount > invoice.balance + 0.001) {
      setError(
        `El monto no puede superar el saldo pendiente (${formatMoney(
          invoice.balance
        )}).`
      );
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await registrarPago(invoice.id, {
        id_medio_pago: method,
        monto: parsedAmount.toFixed(2),
        referencia: reference.trim(),
      });
      onOpenChange(false);
    } catch (submitError) {
      submittingRef.current = false;
      setError(
        submitError instanceof Error
          ? submitError.message
          : "No se pudo registrar el cobro."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar cobro</DialogTitle>
          <DialogDescription>
            {invoice
              ? `Comprobante ${invoice.number} · ${invoice.client} · Saldo ${formatMoney(
                  invoice.balance
                )}`
              : "Seleccione un comprobante."}
          </DialogDescription>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Medio de pago</Label>
              <Select
                value={method}
                items={methodItems}
                onValueChange={(value) => setMethod(value ?? "")}
                disabled={methodsLoading || submitting}
              >
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((paymentMethod) => (
                    <SelectItem key={paymentMethod.id} value={paymentMethod.id}>
                      {paymentMethod.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!methodsLoading && paymentMethods.length === 0 && (
                <p className="text-xs text-destructive">
                  No hay medios de pago disponibles. Cree uno desde Pagos.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Monto</Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                disabled={submitting}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError(null);
                }}
                placeholder="$ 0,00"
              />
              <p className="text-xs text-muted-foreground">
                Saldo pendiente: {formatMoney(invoice.balance)}. Se permiten
                cobros parciales.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-reference">Referencia (opcional)</Label>
              <Input
                id="payment-reference"
                value={reference}
                disabled={submitting}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Ej. transferencia 1234"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" disabled={submitting} />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={() => void handleConfirm()}
            disabled={submitting || !invoice || invoice.balance <= 0}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Registrar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
