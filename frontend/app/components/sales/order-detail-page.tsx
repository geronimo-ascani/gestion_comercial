import { ArrowLeft, Printer, User } from "lucide-react";
import { Link, useParams } from "react-router";

import { cn } from "~/lib/utils";
import { buttonVariants, Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import type { OrderStatus, SalesOrder } from "./sales-types";
import { updateOrder, useOrders } from "./sales-store";
import { OrderStatusBadge, PaymentBadge } from "./sales-views";

export function OrderDetailPage() {
  const { number } = useParams<{ number: string }>();
  const orders = useOrders();
  const order = orders.find((item) => item.number === number);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/sales"
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Volver a Ventas
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">Pedido {number}</h1>
            {order && <OrderStatusBadge status={order.status} />}
          </div>
          {order && (
            <p className="mt-1 text-sm text-muted-foreground">
              Creado el {order.date}.
            </p>
          )}
        </div>
        {order && (
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Printer />
              Imprimir PDF
            </Button>
          </div>
        )}
      </div>

      {!order ? (
        <Card>
          <CardContent className="flex h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-muted-foreground">
              No se encontró el pedido {number}.
            </p>
            <Link to="/sales" className={buttonVariants({ variant: "default" })}>
              Ir a Ventas
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="space-y-6 lg:col-span-3">
            <OrderItemsCard order={order} />
            <OrderTimelineCard order={order} />
          </div>
          <div className="space-y-6 lg:col-span-2">
            <CustomerDetailsCard order={order} />
            <OrderSummaryCard order={order} />
          </div>
        </div>
      )}
    </div>
  );
}

function OrderItemsCard({ order }: { order: SalesOrder }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Artículos del pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Cant.</TableHead>
              <TableHead className="text-right">P. unitario</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-16 text-center text-muted-foreground"
                >
                  Sin productos cargados.
                </TableCell>
              </TableRow>
            ) : (
              order.items.map((item, index) => (
                <TableRow key={`${item.sku ?? index}-${item.product}`}>
                  <TableCell className="font-mono text-xs">
                    {item.sku ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">{item.product}</TableCell>
                  <TableCell className="text-right">{item.qty}</TableCell>
                  <TableCell className="text-right">{item.unitPrice}</TableCell>
                  <TableCell className="text-right">{item.subtotal}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

type StepState = "done" | "active" | "upcoming" | "canceled";

interface TimelineStep {
  title: string;
  description: string;
  state: StepState;
  date?: string;
}

function timelineSteps(status: OrderStatus, createdDate: string): TimelineStep[] {
  const placed = {
    title: "Pedido creado",
    description: "Comprobante registrado en el sistema.",
  };

  if (status === "cancelado") {
    return [
      { ...placed, state: "done", date: createdDate },
      {
        title: "Cancelado",
        description: "El pedido fue cancelado.",
        state: "canceled",
      },
    ];
  }

  const activeIndex =
    status === "pendiente" ? 0 : status === "proceso" ? 1 : status === "enviado" ? 2 : 3;

  const steps: Omit<TimelineStep, "state" | "date">[] = [
    placed,
    { title: "En proceso", description: "Preparación del pedido." },
    { title: "Enviado", description: "En camino al cliente." },
    { title: "Entregado", description: "Entregado al cliente." },
  ];

  return steps.map((step, index) => ({
    ...step,
    date: index === 0 ? createdDate : undefined,
    state:
      index < activeIndex ? "done" : index === activeIndex ? "active" : "upcoming",
  }));
}

function OrderTimelineCard({ order }: { order: SalesOrder }) {
  const steps = timelineSteps(order.status, order.date);

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <CardTitle>Línea de tiempo</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="order-status">Estado</Label>
          <Select
            value={order.status}
            onValueChange={(value) =>
              updateOrder(order.number, { status: value as OrderStatus })
            }
          >
            <SelectTrigger id="order-status" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="proceso">En proceso</SelectItem>
              <SelectItem value="enviado">Enviado</SelectItem>
              <SelectItem value="entregado">Entregado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ol className="space-y-6">
          {steps.map((step, index) => (
            <li key={step.title} className="relative flex gap-4">
              {index < steps.length - 1 && (
                <span
                  className="absolute top-5 bottom-0 left-[7px] w-px bg-border"
                  aria-hidden="true"
                />
              )}
              <span
                className={cn(
                  "relative mt-1.5 size-3.5 shrink-0 rounded-full",
                  step.state === "done" && "bg-emerald-500",
                  step.state === "active" && "bg-violet-500 ring-4 ring-violet-500/20",
                  step.state === "upcoming" && "bg-border",
                  step.state === "canceled" && "bg-red-500"
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-semibold",
                    step.state === "upcoming" && "text-muted-foreground",
                    step.state === "canceled" && "text-red-500"
                  )}
                >
                  {step.title}
                </p>
                {step.date && (
                  <p className="text-sm text-muted-foreground">{step.date}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function CustomerDetailsCard({ order }: { order: SalesOrder }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4 text-muted-foreground" />
          Datos del cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <DetailRow label="Razón social" value={order.company ?? order.client} />
          <DetailRow label="Persona de contacto" value={order.contact ?? "—"} />
          <DetailRow label="Email" value={order.email ?? "—"} />
          <DetailRow label="Teléfono" value={order.phone ?? "—"} />
          <DetailRow
            label="Dirección de envío"
            value={order.deliveryAddress || "—"}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function OrderSummaryCard({ order }: { order: SalesOrder }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen del pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5">
          <SummaryRow label="Subtotal" value={order.subtotal ?? order.total} />
          <SummaryRow label="Envío" value={order.shipping ?? "—"} />
          <SummaryRow label="Impuestos" value={order.tax ?? "—"} />
          <SummaryRow label="Descuento" value={order.discount ?? "—"} />
        </dl>

        <div className="my-4 border-t border-border" />

        <div className="flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">{order.total}</span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
          <span className="text-sm text-muted-foreground">Estado de pago</span>
          <PaymentBadge payment={order.payment} />
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const isNegative = value.startsWith("-");
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", isNegative && "text-emerald-600")}>
        {value}
      </dd>
    </div>
  );
}