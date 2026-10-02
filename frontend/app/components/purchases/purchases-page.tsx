import { useState, type ReactElement } from "react";
import { Eye, Plus, Search } from "lucide-react";
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
import { useInitialLoading } from "~/lib/use-initial-loading";
import { OrderLineItemsTable } from "../sales/sales-views";
import type { PurchaseOrder, PurchaseOrderStatus } from "./purchases-types";
import { usePurchaseOrders } from "./purchases-store";
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
          <DialogDescription>{order.date}</DialogDescription>
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
  const loading = useInitialLoading();

  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState<"all" | PurchaseOrderStatus>("all");

  const filteredOrders = orders.filter((order) => {
    const haystack = `${order.number} ${order.provider}`.toLowerCase();
    const matchesQuery = haystack.includes(orderQuery.trim().toLowerCase());
    const matchesStatus = orderStatus === "all" || order.status === orderStatus;
    return matchesQuery && matchesStatus;
  });

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
              value={orderStatus}
              onValueChange={(value) =>
                setOrderStatus(value as "all" | PurchaseOrderStatus)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
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
            <TableSkeleton rows={6} columns={7} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>N° Orden</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Fecha</TableHead>
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
                    colSpan={7}
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
                      <PurchaseOrderDetailDialog
                        order={order}
                        trigger={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Ver orden ${order.number}`}
                          >
                            <Eye />
                          </Button>
                        }
                      />
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