import { useEffect, useState, type ReactElement } from "react";
import { Ban, Check, Eye, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { TableSkeleton } from "~/components/ui/skeleton";
import { useDebouncedValue } from "~/lib/use-debounced-value";
import { refreshProducts } from "../products/products-store";
import { OrderLineItemsTable } from "../sales/sales-views";
import type { PurchaseOrder, PurchaseOrderStatus } from "./purchases-types";
import {
  loadPurchaseOrders,
  savePurchaseOrder,
  usePurchaseOrders,
} from "./purchases-store";
import {
  cancelPurchaseOrder,
  receivePurchaseOrder,
} from "./purchases-api";
import { PurchaseOrderStatusBadge } from "./purchases-views";

function PurchaseOrderDetailDialog({
  order,
  trigger,
}: {
  order: PurchaseOrder;
  trigger: ReactElement;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Orden de compra {order.number} — {order.provider}
          </DialogTitle>
          <DialogDescription>
            Pedido: {order.date} · Recepción: {order.receivedDate ?? "Pendiente"}
          </DialogDescription>
        </DialogHeader>
        <div>
          <PurchaseOrderStatusBadge status={order.status} />
        </div>
        <OrderLineItemsTable items={order.items} total={order.total} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const orders = usePurchaseOrders();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingOrder, setProcessingOrder] = useState<string | null>(null);

  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState<"all" | PurchaseOrderStatus>("all");
  const debouncedOrderQuery = useDebouncedValue(orderQuery);

  useEffect(() => {
    let active = true;
    loadPurchaseOrders()
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las órdenes de compra."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredOrders = orders.filter((order) => {
    const haystack = `${order.number} ${order.provider}`.toLowerCase();
    const matchesQuery = haystack.includes(debouncedOrderQuery.trim().toLowerCase());
    const matchesStatus = orderStatus === "all" || order.status === orderStatus;
    return matchesQuery && matchesStatus;
  });

  async function handleReceive(order: PurchaseOrder) {
    setProcessingOrder(order.number);
    setActionError(null);
    try {
      const received = await receivePurchaseOrder(order.number);
      savePurchaseOrder(received);
      try {
        await refreshProducts();
      } catch {
        setActionError(
          "La recepción se registró, pero no se pudo actualizar la lista de productos."
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo registrar la recepción."
      );
    } finally {
      setProcessingOrder(null);
    }
  }

  async function handleCancel(order: PurchaseOrder) {
    if (!window.confirm(`¿Cancelar la orden ${order.number}?`)) return;
    setProcessingOrder(order.number);
    setActionError(null);
    try {
      const cancelled = await cancelPurchaseOrder(order.number);
      savePurchaseOrder(cancelled);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "No se pudo cancelar la orden."
      );
    } finally {
      setProcessingOrder(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">Órdenes de compra.</p>
        </div>
        <Button onClick={() => navigate("/purchases/new-order")}>
          <Plus />
          Nueva orden de compra
        </Button>
      </div>

      {(loadError || actionError) && (
        <p role="alert" className="text-sm text-destructive">
          {actionError ?? loadError}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full bg-card pl-10 shadow-sm"
            placeholder="Buscar por proveedor o número de orden..."
            value={orderQuery}
            onChange={(event) => setOrderQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor="order-status-filter">Estado</Label>
            <Select
              items={{ all: "Todos" }}
              value={orderStatus}
              onValueChange={(value) =>
                setOrderStatus(value as "all" | PurchaseOrderStatus)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="aprobada">Aprobada</SelectItem>
                <SelectItem value="recibida">Recibida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {orderQuery && (
            <span className="text-sm text-muted-foreground">
              {filteredOrders.length} de {orders.length} órdenes
            </span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Órdenes de compra</CardTitle>
          </div>
          <Badge variant="secondary">{orders.length} órdenes</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={8} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Orden</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Recepción</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {orders.length === 0
                      ? "No hay órdenes de compra registradas."
                      : "No se encontraron órdenes para la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.number}>
                    <TableCell className="font-mono text-xs">
                      {order.number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {order.provider}
                    </TableCell>
                    <TableCell>{order.date}</TableCell>
                    <TableCell>{order.receivedDate ?? "Pendiente"}</TableCell>
                    <TableCell className="text-right">
                      {order.items.length}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {order.total}
                    </TableCell>
                    <TableCell>
                      <PurchaseOrderStatusBadge status={order.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <PurchaseOrderDetailDialog
                          order={order}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-lg"
                              className="size-11"
                              aria-label={`Ver orden ${order.number}`}
                            >
                              <Eye />
                            </Button>
                          }
                        />
                        {["pendiente", "aprobada"].includes(order.status) && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-lg"
                              className="size-11"
                              aria-label={`Recibir orden ${order.number}`}
                              title="Recibir orden"
                              disabled={processingOrder === order.number}
                              onClick={() => void handleReceive(order)}
                            >
                              <Check />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon-lg"
                              className="size-11"
                              aria-label={`Cancelar orden ${order.number}`}
                              title="Cancelar orden"
                              disabled={processingOrder === order.number}
                              onClick={() => void handleCancel(order)}
                            >
                              <Ban />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Mostrando {filteredOrders.length} de {orders.length} órdenes</span>
        </CardFooter>
      </Card>
    </div>
  );
}