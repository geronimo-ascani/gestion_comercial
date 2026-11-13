import { useEffect, useState } from "react";
import { ArrowLeft, User } from "lucide-react";
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { Skeleton, TableSkeleton } from "~/components/ui/skeleton";
import { formatMoney, parseNumberInput, parsePercentInput } from "~/lib/currency";
import type { OrderStatus, SalesOrder } from "./sales-types";
import {
  advanceSalesOrder,
  cancelSalesOrder,
  getSalesOrder,
  loadSalesOrders,
  useOrders,
} from "./sales-store";
import { OrderStatusBadge } from "./sales-views";
import { useCurrentUser } from "../auth/session-store";
import { invalidateProducts } from "../products/products-store";

const nextOrderStatus: Partial<
  Record<OrderStatus, "proceso" | "enviado" | "entregado">
> = {
  pendiente: "proceso",
  proceso: "enviado",
  enviado: "entregado",
};

export function OrderDetailPage() {
  const { number } = useParams<{ number: string }>();
  const orders = useOrders();
  const currentUser = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const order = orders.find((item) => item.number === number);
  const canManage = ["administrador", "ventas"].includes(
    currentUser?.role ?? "",
  );

  useEffect(() => {
    let active = true;
    if (!number) {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    void loadSalesOrders()
      .then(() => getSalesOrder(number))
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "No se pudo cargar el pedido.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [number]);

  async function handleAdvance(next: "proceso" | "enviado" | "entregado") {
    if (!order) return;
    setSaving(true);
    setOperationError(null);
    try {
      await advanceSalesOrder(order.number, next);
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : "No se pudo actualizar el estado.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setSaving(true);
    setOperationError(null);
    try {
      await cancelSalesOrder(order.number);
      invalidateProducts();
      setCancelOpen(false);
    } catch (error) {
      setOperationError(
        error instanceof Error ? error.message : "No se pudo cancelar el pedido.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function retryLoad() {
    if (!number) return;
    setLoading(true);
    setLoadError(null);
    try {
      await loadSalesOrders(true);
      await getSalesOrder(number);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "No se pudo cargar el pedido.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/sales"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
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

      {loading ? (
        <OrderDetailSkeleton />
      ) : loadError ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-destructive" role="alert">{loadError}</p>
            <Button variant="outline" onClick={() => void retryLoad()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
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
        <div className="mx-auto max-w-6xl space-y-6">
          <CustomerDetailsCard order={order} />
          <OrderItemsCard order={order} />
          <OrderSummaryCard order={order} />
          <OrderTimelineCard
            order={order}
            canManage={canManage}
            saving={saving}
            error={operationError}
            onAdvance={handleAdvance}
            onRequestCancel={() => setCancelOpen(true)}
          />
          <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>¿Cancelar pedido?</DialogTitle>
                <DialogDescription>
                  Se devolverá al inventario el stock reservado. Un pedido cancelado no se puede reabrir.
                </DialogDescription>
              </DialogHeader>
              {operationError && (
                <p className="text-sm text-destructive" role="alert">
                  {operationError}
                </p>
              )}
              <DialogFooter>
                <DialogClose render={<Button variant="outline" disabled={saving} />}>
                  Volver
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void handleCancel()}
                >
                  {saving ? "Cancelando…" : "Confirmar cancelación"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

function OrderItemsCard({ order }: { order: SalesOrder }) {
  const hasLineDiscounts = order.items.some((item) => item.discount);
  const columnCount = hasLineDiscounts ? 6 : 5;
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
              {hasLineDiscounts && (
                <TableHead className="text-right">Desc.</TableHead>
              )}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnCount}
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
                  {hasLineDiscounts && (
                    <TableCell className="text-right text-muted-foreground">
                      {item.discount ?? "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">{item.subtotal}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {order.items.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell
                  colSpan={columnCount - 1}
                  className="text-right font-semibold"
                >
                  Total
                </TableCell>
                <TableCell className="text-right text-base font-bold">
                  {order.total}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
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
    description: "Pedido registrado en el sistema.",
  };

  if (status === "cancelado") {
    return [
      { ...placed, state: "done", date: createdDate },
      {
        title: "Cancelado",
        description: "El pedido fue cancelado y se devolvió el stock reservado.",
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

function OrderTimelineCard({
  order,
  canManage,
  saving,
  error,
  onAdvance,
  onRequestCancel,
}: {
  order: SalesOrder;
  canManage: boolean;
  saving: boolean;
  error: string | null;
  onAdvance: (next: "proceso" | "enviado" | "entregado") => void;
  onRequestCancel: () => void;
}) {
  const steps = timelineSteps(order.status, order.date);
  const nextStatus = nextOrderStatus[order.status];

  return (
    <Card>
      <CardHeader className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <CardTitle>Línea de tiempo</CardTitle>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="order-status">Estado</Label>
            <Select
              value={order.status}
              disabled={saving || !nextStatus}
              onValueChange={(value) => {
                if (
                  value === "proceso" ||
                  value === "enviado" ||
                  value === "entregado"
                ) {
                  onAdvance(value);
                }
              }}
            >
              <SelectTrigger id="order-status" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={order.status}>
                  {order.status === "proceso"
                    ? "En proceso"
                    : order.status[0].toUpperCase() + order.status.slice(1)}
                </SelectItem>
                {nextStatus && (
                  <SelectItem value={nextStatus}>
                    {nextStatus === "proceso"
                      ? "En proceso"
                      : nextStatus[0].toUpperCase() + nextStatus.slice(1)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {order.status !== "entregado" && order.status !== "cancelado" && (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={onRequestCancel}
              >
                Cancelar pedido
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
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
                  step.state === "canceled" && "bg-red-500",
                )}
              />
              <div className="min-w-0">
                <p
                  className={cn(
                    "font-semibold",
                    step.state === "upcoming" && "text-muted-foreground",
                    step.state === "canceled" && "text-red-500",
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
          <User className="size-4 text-muted-foreground" aria-hidden="true" />
          Datos del cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label="Nombre y apellido" value={order.client} />
          {order.clientId && <DetailRow label="ID cliente" value={order.clientId} />}
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
  const subtotalAfterLineDiscount = parseNumberInput(
    order.subtotal ?? order.total,
  );
  const orderDiscountPercent = order.discount
    ? parsePercentInput(order.discount)
    : 0;
  const orderDiscountAmount = Math.max(
    0,
    Math.round(
      (subtotalAfterLineDiscount - parseNumberInput(order.total)) * 100,
    ) / 100,
  );
  const grossTotal = order.items.reduce(
    (sum, item) => sum + item.qty * parseNumberInput(item.unitPrice),
    0,
  );
  const lineDiscountTotal = Math.max(
    0,
    Math.round((grossTotal - subtotalAfterLineDiscount) * 100) / 100,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumen del pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2.5">
          <SummaryRow label="Subtotal bruto" value={formatMoney(grossTotal)} />
          {lineDiscountTotal > 0 && (
            <SummaryRow
              label="Descuentos por línea"
              value={`− ${formatMoney(lineDiscountTotal)}`}
            />
          )}
          <SummaryRow
            label="Subtotal tras descuentos por línea"
            value={formatMoney(subtotalAfterLineDiscount)}
          />
          {orderDiscountPercent > 0 && (
            <SummaryRow
              label={`Descuento general (${orderDiscountPercent}%)`}
              value={`− ${formatMoney(orderDiscountAmount)}`}
            />
          )}
        </dl>

        <div className="my-4 border-t border-border" />

        <div className="flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-bold">{order.total}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <DetailSkeletonCard>
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </DetailSkeletonCard>
      <DetailSkeletonCard>
        <Skeleton className="h-5 w-40" />
        <TableSkeleton rows={5} columns={5} />
      </DetailSkeletonCard>
      <DetailSkeletonCard>
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </DetailSkeletonCard>
      <DetailSkeletonCard>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-56 max-w-full" />
        <Skeleton className="h-4 w-48 max-w-full" />
        <Skeleton className="h-4 w-44 max-w-full" />
      </DetailSkeletonCard>
    </div>
  );
}

function DetailSkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const isNegative = value.startsWith("-") || value.startsWith("−");
  return (
    <div className="flex items-center justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("font-medium", isNegative && "text-emerald-600")}>
        {value}
      </dd>
    </div>
  );
}
