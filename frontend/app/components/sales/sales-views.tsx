import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import type {
  BudgetStatus,
  LineItem,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from "./sales-types";
import { formatMoney, parseNumberInput } from "~/lib/currency";
import { getPaymentMethodLabel } from "../payments/payment-methods-store";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config: Record<OrderStatus, { label: string; variant: "success" | "warning" | "info" | "secondary" | "destructive" }> = {
    pendiente: { label: "Pendiente", variant: "warning" },
    proceso: { label: "En proceso", variant: "info" },
    enviado: { label: "Enviado", variant: "secondary" },
    entregado: { label: "Entregado", variant: "success" },
    cancelado: { label: "Cancelado", variant: "destructive" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function PaymentBadge({ payment }: { payment: PaymentMethod }) {
  const variant =
    payment === "mercadopago"
      ? "info"
      : payment === "tarjeta"
        ? "outline"
        : "secondary";
  return <Badge variant={variant}>{getPaymentMethodLabel(payment)}</Badge>;
}

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const config: Record<BudgetStatus, { label: string; variant: "success" | "warning" | "info" | "destructive" }> = {
    pendiente: { label: "Pendiente", variant: "warning" },
    aprobado: { label: "Aprobado", variant: "success" },
    vencido: { label: "Vencido", variant: "destructive" },
    convertido: { label: "Convertido", variant: "info" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function OrderPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config: Record<PaymentStatus, { label: string; variant: "success" | "warning" | "destructive" }> = {
    pendiente: { label: "Pendiente", variant: "warning" },
    pagado: { label: "Pagado", variant: "success" },
    rechazado: { label: "Rechazado", variant: "destructive" },
  };
  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function OrderLineItemsTable({
  items,
  total,
  subtotal,
  discount,
}: {
  items: LineItem[];
  total: string;
  subtotal?: string;
  discount?: string;
}) {
  const hasLineDiscounts = items.some((item) => item.discount);
  const columnCount = hasLineDiscounts ? 5 : 4;
  const lineDiscountTotal = items.reduce(
    (sum, item) =>
      sum + (item.discountAmount ? parseNumberInput(item.discountAmount) : 0),
    0
  );
  const grossSubtotal = items.reduce(
    (sum, item) => sum + item.qty * parseNumberInput(item.unitPrice),
    0
  );
  const hasSubtotal = subtotal !== undefined || lineDiscountTotal > 0;
  const subtotalDisplay =
    lineDiscountTotal > 0 ? formatMoney(grossSubtotal) : subtotal;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead className="text-right">P. unitario</TableHead>
          {hasLineDiscounts && (
            <TableHead className="text-right">Desc.</TableHead>
          )}
          <TableHead className="text-right">Subtotal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.product}>
            <TableCell className="font-medium">{item.product}</TableCell>
            <TableCell className="text-right">{item.qty}</TableCell>
            <TableCell className="text-right">{item.unitPrice}</TableCell>
            {hasLineDiscounts && (
              <TableCell className="text-right text-muted-foreground">
                {item.discount ?? "—"}
              </TableCell>
            )}
            <TableCell className="text-right">{item.subtotal}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={columnCount}
              className="h-16 text-center text-muted-foreground"
            >
              Sin productos cargados.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      <TableFooter>
        {hasSubtotal && (
          <TableRow>
            <TableCell colSpan={columnCount - 1} className="text-muted-foreground">
              Subtotal
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {subtotalDisplay}
            </TableCell>
          </TableRow>
        )}
        {lineDiscountTotal > 0 && (
          <TableRow>
            <TableCell colSpan={columnCount - 1} className="text-muted-foreground">
              Descuento por línea
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              − {formatMoney(lineDiscountTotal)}
            </TableCell>
          </TableRow>
        )}
        {discount && (
          <TableRow>
            <TableCell colSpan={columnCount - 1} className="text-muted-foreground">
              Descuento
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {discount}
            </TableCell>
          </TableRow>
        )}
        <TableRow>
          <TableCell colSpan={columnCount - 1}>Total</TableCell>
          <TableCell className="text-right font-medium">{total}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}