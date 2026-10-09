import { useState, type ReactElement } from "react";
import { Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";

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
import { useDebouncedValue } from "~/lib/use-debounced-value";
import type {
  Budget,
  BudgetStatus,
  OrderStatus,
  PaymentMethod,
  SalesOrder,
} from "./sales-types";
import { removeBudget, removeOrder, useBudgets, useOrders } from "./sales-store";
import { restoreOrderStock } from "./sales-stock";
import {
  BudgetStatusBadge,
  OrderLineItemsTable,
  OrderStatusBadge,
  PaymentBadge,
} from "./sales-views";

function ConfirmDeleteDialog({
  title,
  description,
  trigger,
  onDelete,
}: {
  title: string;
  description: string;
  trigger: ReactElement;
  onDelete: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancelar
          </DialogClose>
          <DialogClose
            render={
              <Button variant="destructive" onClick={onDelete} />
            }
          >
            Eliminar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BudgetDetailDialog({
  budget,
  trigger,
  onConvert,
}: {
  budget: Budget;
  trigger: ReactElement;
  onConvert: () => void;
}) {
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
          <DialogClose
            render={
              <Button onClick={onConvert} disabled={budget.status === "convertido"} />
            }
          >
            <FileText />
            {budget.status === "convertido"
              ? "Ya convertido"
              : "Convertir en pedido"}
          </DialogClose>
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

  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState<"all" | OrderStatus>("all");
  const [orderPayment, setOrderPayment] = useState<"all" | PaymentMethod>("all");
  const [budgetQuery, setBudgetQuery] = useState("");
  const [budgetStatus, setBudgetStatus] = useState<"all" | BudgetStatus>("all");
  const debouncedOrderQuery = useDebouncedValue(orderQuery);
  const debouncedBudgetQuery = useDebouncedValue(budgetQuery);

  const filteredOrders = orders.filter((order) => {
    const haystack = `${order.number} ${order.client} ${order.payment}`.toLowerCase();
    const matchesQuery = haystack.includes(debouncedOrderQuery.trim().toLowerCase());
    const matchesStatus = orderStatus === "all" || order.status === orderStatus;
    const matchesPayment = orderPayment === "all" || order.payment === orderPayment;
    return matchesQuery && matchesStatus && matchesPayment;
  });

  const filteredBudgets = budgets.filter((budget) => {
    const haystack = `${budget.number} ${budget.client}`.toLowerCase();
    const matchesQuery = haystack.includes(debouncedBudgetQuery.trim().toLowerCase());
    const matchesStatus = budgetStatus === "all" || budget.status === budgetStatus;
    return matchesQuery && matchesStatus;
  });

  function switchTab(tab: "orders" | "budgets") {
    setSearchParams({ tab }, { replace: true });
  }

  function handleConvertBudget(budget: Budget) {
    navigate(`/sales/new-order?fromBudget=${budget.number}`);
  }

  function handleRemoveOrder(order: SalesOrder) {
    if (order.status !== "cancelado") restoreOrderStock(order.items);
    removeOrder(order.number);
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
          variant={activeTab === "orders" ? "default" : "outline"}
          className="flex-1 px-4"
          onClick={() => switchTab("orders")}
        >
          Pedidos
        </Button>
        <Button
          variant={activeTab === "budgets" ? "default" : "outline"}
          className="flex-1 px-4"
          onClick={() => switchTab("budgets")}
        >
          Presupuestos
        </Button>
      </div>

      {activeTab === "orders" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 w-full bg-card pl-10 shadow-sm"
                placeholder="Buscar por cliente o número de pedido..."
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
                    setOrderStatus(value as "all" | OrderStatus)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
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
                <Select
                  items={{ all: "Todos" }}
                  value={orderPayment}
                  onValueChange={(value) =>
                    setOrderPayment(value as "all" | PaymentMethod)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="mercadopago">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {orderQuery && (
                <span className="text-sm text-muted-foreground">
                  {filteredOrders.length} de {orders.length} pedidos
                </span>
              )}
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
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {orders.length === 0
                          ? "No hay pedidos registrados."
                          : "No se encontraron pedidos para la búsqueda."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
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
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar pedido ${order.number}`}
                              onClick={() =>
                                navigate(`/sales/new-order?edit=${order.number}`)
                              }
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDeleteDialog
                              title="¿Eliminar pedido?"
                              description={`Esta acción no se puede deshacer. Se eliminará el pedido ${order.number} del cliente ${order.client}.`}
                              onDelete={() => handleRemoveOrder(order)}
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
              <span>Mostrando {filteredOrders.length} de {orders.length} pedidos</span>
            </CardFooter>
          </Card>
        </section>
      )}

      {activeTab === "budgets" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 w-full bg-card pl-10 shadow-sm"
                placeholder="Buscar presupuesto por cliente o número..."
                value={budgetQuery}
                onChange={(event) => setBudgetQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="budget-status-filter">Estado</Label>
                <Select
                  items={{ all: "Todos" }}
                  value={budgetStatus}
                  onValueChange={(value) =>
                    setBudgetStatus(value as "all" | BudgetStatus)
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="aprobado">Aprobado</SelectItem>
                    <SelectItem value="vencido">Vencido</SelectItem>
                    <SelectItem value="convertido">Convertido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {budgetQuery && (
                <span className="text-sm text-muted-foreground">
                  {filteredBudgets.length} de {budgets.length} presupuestos
                </span>
              )}
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
                  {filteredBudgets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {budgets.length === 0
                          ? "No hay presupuestos registrados."
                          : "No se encontraron presupuestos para la búsqueda."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBudgets.map((budget) => (
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
                          <div className="flex justify-end gap-1">
                            <BudgetDetailDialog
                              budget={budget}
                              onConvert={() => handleConvertBudget(budget)}
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
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar presupuesto ${budget.number}`}
                              onClick={() =>
                                navigate(`/sales/new-budget?edit=${budget.number}`)
                              }
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDeleteDialog
                              title="¿Eliminar presupuesto?"
                              description={`Esta acción no se puede deshacer. Se eliminará el presupuesto ${budget.number} del cliente ${budget.client}.`}
                              onDelete={() => removeBudget(budget.number)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Eliminar presupuesto ${budget.number}`}
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
              <span>Mostrando {filteredBudgets.length} de {budgets.length} presupuestos</span>
            </CardFooter>
          </Card>
        </section>
      )}
    </div>
  );
}