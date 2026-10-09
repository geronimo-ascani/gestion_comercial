import { useEffect, useRef, useState } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";

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

import { parseNumberInput } from "~/lib/currency";
import type { PaymentMethod, SalesOrder } from "../sales/sales-types";
import { updateOrder } from "../sales/sales-store";
import { simulateGatewayPayment } from "./payment-gateway";
import {
  createInvoiceFromOrder,
  isGatewayMethod,
  registerPayment,
} from "./payments-store";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SalesOrder | null;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  order,
}: RecordPaymentDialogProps) {
  const [method, setMethod] = useState<PaymentMethod>("efectivo");
  const [amount, setAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open || !order) return;
    setMethod(order.payment);
    setAmount(String(parseNumberInput(order.total)));
    setMessage(null);
    setProcessing(false);
    submittingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.number]);

  async function handleConfirm() {
    if (!order) return;
    if (submittingRef.current || order.paymentStatus === "pagado") return;

    const parsedAmount = parseNumberInput(amount);
    if (parsedAmount <= 0) {
      setMessage("Ingrese un monto válido.");
      return;
    }

    submittingRef.current = true;

    let invoiceNumber = order.invoiceNumber;
    if (!invoiceNumber) {
      invoiceNumber = createInvoiceFromOrder(order);
      updateOrder(order.number, { invoiceNumber });
    }

    if (!isGatewayMethod(method)) {
      registerPayment({
        invoiceNumber,
        orderNumber: order.number,
        clientId: order.clientId ?? "",
        client: order.client,
        method,
        amount: parsedAmount,
        status: "aprobado",
      });
      updateOrder(order.number, { paymentStatus: "pagado" });
      onOpenChange(false);
      return;
    }

    setProcessing(true);
    setMessage("Procesando pago con la pasarela…");
    const result = await simulateGatewayPayment(method);
    registerPayment({
      invoiceNumber,
      orderNumber: order.number,
      clientId: order.clientId ?? "",
      client: order.client,
      method,
      amount: parsedAmount,
      status: result.status,
      gatewayReference: result.reference,
    });
    updateOrder(order.number, {
      paymentStatus: result.status === "aprobado" ? "pagado" : "rechazado",
    });
    setProcessing(false);

    if (result.status === "aprobado") {
      onOpenChange(false);
    } else {
      submittingRef.current = false;
      setMessage("El pago fue rechazado. Puede intentar nuevamente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar pago</DialogTitle>
          <DialogDescription>
            {order
              ? `Pedido ${order.number} · ${order.client} · ${order.total}`
              : "Seleccione un pedido."}
          </DialogDescription>
        </DialogHeader>

        {order && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payment-method">Método de pago</Label>
              <Select
                value={method}
                onValueChange={(value) => setMethod(value as PaymentMethod)}
              >
                <SelectTrigger id="payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">
                    <Wallet className="size-4" /> Efectivo
                  </SelectItem>
                  <SelectItem value="tarjeta">
                    <CreditCard className="size-4" /> Tarjeta de crédito/débito
                  </SelectItem>
                  <SelectItem value="mercadopago">
                    <Wallet className="size-4" /> Billetera MercadoPago
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-amount">Monto</Label>
              <Input
                id="payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="$ 0"
              />
              <p className="text-xs text-muted-foreground">
                Total sugerido: {order.total}
              </p>
            </div>

            {message && (
              <p className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <Button
            onClick={handleConfirm}
            disabled={processing || !order || order.paymentStatus === "pagado"}
          >
            {processing && <Loader2 className="size-4 animate-spin" />}
            {isGatewayMethod(method) ? "Pagar" : "Registrar cobro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}