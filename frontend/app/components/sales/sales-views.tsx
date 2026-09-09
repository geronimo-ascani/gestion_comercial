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
} from "./sales-types";

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
  const config: Record<PaymentMethod, { label: string; variant: "secondary" | "outline" | "info" }> = {
    efectivo: { label: "Efectivo", variant: "secondary" },
    tarjeta: { label: "Tarjeta", variant: "outline" },
    mercadopago: { label: "MercadoPago", variant: "info" },
  };
  const { label, variant } = config[payment];
  return <Badge variant={variant}>{label}</Badge>;
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

export function OrderLineItemsTable({ items, total }: { items: LineItem[]; total: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Producto</TableHead>
          <TableHead className="text-right">Cantidad</TableHead>
          <TableHead className="text-right">P. unitario</TableHead>
          <TableHead className="text-right">Subtotal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.product}>
            <TableCell className="font-medium">{item.product}</TableCell>
            <TableCell className="text-right">{item.qty}</TableCell>
            <TableCell className="text-right">{item.unitPrice}</TableCell>
            <TableCell className="text-right">{item.subtotal}</TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={4}
              className="h-16 text-center text-muted-foreground"
            >
              Sin productos cargados.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total</TableCell>
          <TableCell className="text-right font-medium">{total}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}