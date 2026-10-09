import { useState } from "react";
import { ArrowLeft, Download, FileText, RefreshCw, User } from "lucide-react";
import { Link, useParams } from "react-router";

import { cn } from "~/lib/utils";
import { formatAddress } from "~/lib/address";
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

import { Skeleton, TableSkeleton } from "~/components/ui/skeleton";
import { useInitialLoading } from "~/lib/use-initial-loading";
import type { OrderStatus, SalesOrder } from "./sales-types";
import { updateOrder, useOrders } from "./sales-store";
import { applyOrderStock, restoreOrderStock } from "./sales-stock";
import { OrderPaymentStatusBadge, OrderStatusBadge, PaymentBadge } from "./sales-views";
import { useCustomers } from "../customers/customers-store";
import { createInvoiceFromOrder, resendInvoice, useInvoices } from "../payments/payments-store";
import { InvoiceSendBadge, InvoiceStatusBadge } from "../payments/payments-views";
import { RecordPaymentDialog } from "../payments/record-payment-dialog";
import { exportInvoiceAsPdf } from "~/lib/invoice-pdf";

export function OrderDetailPage() {
  const { number } = useParams<{ number: string }>();
  const orders = useOrders();
  const loading = useInitialLoading();
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
      </div>

      {loading ? (
        <OrderDetailSkeleton />
      ) : !order ? (
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
            <OrderPaymentCard order={order} />
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
            onValueChange={(value) => {
              const next = value as OrderStatus;
              if (order.status !== "cancelado" && next === "cancelado") {
                restoreOrderStock(order.items);
              } else if (order.status === "cancelado" && next !== "cancelado") {
                applyOrderStock(order.items);
              }
              updateOrder(order.number, { status: next });
            }}
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
  const customers = useCustomers();
  const customer = order.clientId
    ? customers.find((item) => item.id === order.clientId)
    : undefined;
  const displayName = customer
    ? `${customer.firstName} ${customer.lastName}`
    : order.client;

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
          <DetailRow label="Nombre y apellido" value={displayName} />
          {customer && <DetailRow label="ID cliente" value={customer.id} />}
          {order.company && <DetailRow label="Razón social" value={order.company} />}
          <DetailRow label="Persona de contacto" value={order.contact ?? "—"} />
          <DetailRow label="Email" value={order.email ?? "—"} />
          <DetailRow label="Teléfono" value={order.phone ?? "—"} />
          <DetailRow
            label="Dirección de envío"
            value={formatAddress(order.deliveryAddress) || "—"}
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

function OrderPaymentCard({ order }: { order: SalesOrder }) {
  const invoices = useInvoices();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const invoice = invoices.find((item) => item.orderNumber === order.number);

  function handleEmitInvoice() {
    if (order.invoiceNumber) return;
    const number = createInvoiceFromOrder(order);
    updateOrder(order.number, { invoiceNumber: number });
    setFeedback("Comprobante emitido y enviado por email.");
  }

  function handleResend() {
    if (!invoice) return;
    if (resendInvoice(invoice.number)) {
      setFeedback(`Comprobante reenviado a ${order.email ?? "el cliente"}.`);
    }
  }

  async function handleDownload() {
    if (!invoice) return;
    setGenerating(true);
    try {
      await exportInvoiceAsPdf(order, invoice);
    } finally {
      setGenerating(false);
    }
  }

  const resendCount = (invoice?.sendCount ?? 0) - 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          Factura y pago
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-3">
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">N° de factura</dt>
            <dd className="font-mono text-sm font-medium">
              {order.invoiceNumber ?? "Sin emitir"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-sm text-muted-foreground">Estado de pago</dt>
            <dd>
              <OrderPaymentStatusBadge status={order.paymentStatus} />
            </dd>
          </div>
          {invoice && (
            <>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">
                  Estado de factura
                </dt>
                <dd>
                  <InvoiceStatusBadge status={invoice.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-muted-foreground">
                  Envío del comprobante
                </dt>
                <dd>
                  <InvoiceSendBadge sendCount={invoice.sendCount} />
                </dd>
              </div>
            </>
          )}
        </dl>

        {invoice?.sentAt && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            Enviado a {order.email ?? "el cliente"} el {invoice.sentAt}.
            {resendCount > 0 && invoice.lastSentAt && (
              <> Reenviado el {invoice.lastSentAt} (x{resendCount}).</>
            )}
          </p>
        )}

        {feedback && (
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {feedback}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {!order.invoiceNumber && (
            <Button variant="outline" onClick={handleEmitInvoice}>
              <FileText />
              Emitir comprobante
            </Button>
          )}
          {invoice && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleDownload} disabled={generating}>
                <Download />
                {generating ? "Generando…" : "Descargar PDF"}
              </Button>
              <Button variant="outline" onClick={handleResend}>
                <RefreshCw />
                Reenviar
              </Button>
            </div>
          )}
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={order.paymentStatus === "pagado"}
          >
            <User />
            {order.paymentStatus === "pagado" ? "Pago registrado" : "Registrar pago"}
          </Button>
        </div>
      </CardContent>

      <RecordPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={order}
      />
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

function DetailSkeletonCard({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <DetailSkeletonCard>
          <Skeleton className="h-5 w-40" />
          <TableSkeleton rows={5} columns={5} />
        </DetailSkeletonCard>
        <DetailSkeletonCard>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56 max-w-full" />
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-4 w-44 max-w-full" />
          <Skeleton className="h-4 w-40 max-w-full" />
        </DetailSkeletonCard>
      </div>
      <div className="space-y-6 lg:col-span-2">
        <DetailSkeletonCard>
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </DetailSkeletonCard>
        <DetailSkeletonCard>
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="border-t border-border pt-4">
            <Skeleton className="h-5 w-24" />
          </div>
        </DetailSkeletonCard>
      </div>
    </div>
  );
}