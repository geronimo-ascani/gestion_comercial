import { useState, type ReactElement } from "react";
import { Eye, FileText, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";

import { cn } from "~/lib/utils";
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
import type { Budget, SalesOrder } from "./sales-types";
import { removeOrder, useBudgets, useOrders } from "./sales-store";
import {
  BudgetStatusBadge,
  OrderLineItemsTable,
  OrderStatusBadge,
  PaymentBadge,
} from "./sales-views";

function DeleteOrderDialog({
  order,
  trigger,
  onDelete,
}: {
  order: SalesOrder;
  trigger: ReactElement;
  onDelete: (number: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>¿Eliminar pedido?</DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se eliminará el pedido {order.number}{" "}
            del cliente {order.client}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <DialogClose
            render={
              <Button
                variant="destructive"
                onClick={() => onDelete(order.number)}
              />
            }
          >
            Eliminar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDetailDialog({ budget, trigger }: { budget: Budget; trigger: ReactElement }) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Presupuesto {budget.number} — {budget.client}
          </DialogTitle>
          <DialogDescription>
            {budget.date} · Vencimiento: {budget.expires}
          </DialogDescription>
        </DialogHeader>
        <div>
          <BudgetStatusBadge status={budget.status} />
        </div>
        <OrderLineItemsTable items={budget.items} total={budget.total} />
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cerrar
          </DialogClose>
          <Button type="submit">
            <FileText />
            Convertir en pedido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SalesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: "orders" | "budgets" =
    searchParams.get("tab") === "budgets" ? "budgets" : "orders";
  const loading = useInitialLoading();
  const orders = useOrders();
  const budgets = useBudgets();

  function switchTab(tab: "orders" | "budgets") {
    setSearchParams({ tab }, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="text-muted-foreground">
            Pedidos, presupuestos y facturación.
          </p>
        </div>
        <Button
          onClick={() =>
            navigate(activeTab === "orders" ? "/sales/new-order" : "/sales/new-budget")
          }
        >
          <Plus />
          {activeTab === "orders" ? "Nuevo pedido" : "Nuevo presupuesto"}
        </Button>
      </div>

      <div className="flex w-full gap-2 lg:w-fit">
        <Button
          variant="outline"
          className={cn(
            "flex-1 px-4",
            activeTab === "orders" &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => switchTab("orders")}
        >
          Pedidos
        </Button>
        <Button
          variant="outline"
          className={cn(
            "flex-1 px-4",
            activeTab === "budgets" &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => switchTab("budgets")}
        >
          Presupuestos
        </Button>
      </div>

      {activeTab === "orders" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por cliente o número de pedido..."
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="order-status-filter">Estado</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="proceso">En proceso</SelectItem>
                    <SelectItem value="enviado">Enviado</SelectItem>
                    <SelectItem value="entregado">Entregado</SelectItem>
                    <SelectItem value="cancelado">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="order-payment-filter">Pago</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los pagos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline">Buscar</Button>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Pedidos de venta</CardTitle>
              </div>
              <Badge variant="secondary">{orders.length} pedidos</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Productos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Pago</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay pedidos registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.number}>
                        <TableCell className="font-mono text-xs">
                          {order.number}
                        </TableCell>
                        <TableCell className="font-medium">
                          {order.client}
                        </TableCell>
                        <TableCell>{order.date}</TableCell>
                        <TableCell className="text-right">
                          {order.items.length}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {order.total}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={order.status} />
                        </TableCell>
                        <TableCell>
                          <PaymentBadge payment={order.payment} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Ver pedido ${order.number}`}
                              onClick={() => navigate(`/sales/${order.number}`)}
                            >
                              <Eye />
                            </Button>
                            <DeleteOrderDialog
                              order={order}
                              onDelete={removeOrder}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Eliminar pedido ${order.number}`}
                                >
                                  <Trash2 />
                                </Button>
                              }
                            />
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
              <span>Mostrando {orders.length} pedidos</span>
            </CardFooter>
          </Card>
        </section>
      )}

      {activeTab === "budgets" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar presupuesto por cliente o número..."
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="budget-status-filter">Estado</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="aprobado">Aprobado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="convertido">Convertido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline">Buscar</Button>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Presupuestos</CardTitle>
              </div>
              <Badge variant="secondary">{budgets.length} presupuestos</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>N° Presupuesto</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Vence</TableHead>
                      <TableHead className="text-right">Productos</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {budgets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay presupuestos registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgets.map((budget) => (
                      <TableRow key={budget.number}>
                        <TableCell className="font-mono text-xs">
                          {budget.number}
                        </TableCell>
                        <TableCell className="font-medium">
                          {budget.client}
                        </TableCell>
                        <TableCell>{budget.date}</TableCell>
                        <TableCell>{budget.expires}</TableCell>
                        <TableCell className="text-right">
                          {budget.items.length}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {budget.total}
                        </TableCell>
                        <TableCell>
                          <BudgetStatusBadge status={budget.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <BudgetDetailDialog
                            budget={budget}
                            trigger={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Ver presupuesto ${budget.number}`}
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
              <span>Mostrando {budgets.length} presupuestos</span>
            </CardFooter>
          </Card>
        </section>
      )}
    </div>
  );
}