import { useState, type ReactElement } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { OrderLineItemsTable } from "../sales/sales-views";
import type { PurchaseOrder, PurchaseOrderStatus } from "./purchases-types";
import {
  removeProvider,
  removePurchaseOrder,
  useProviders,
  usePurchaseOrders,
} from "./purchases-store";
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

function ConfirmDeleteDialog({
  title,
  description,
  trigger,
  onConfirm,
}: {
  title: string;
  description: string;
  trigger: ReactElement;
  onConfirm: () => void;
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
            render={<Button variant="destructive" onClick={onConfirm} />}
          >
            Eliminar
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PurchasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: "orders" | "providers" =
    searchParams.get("tab") === "providers" ? "providers" : "orders";
  const providers = useProviders();
  const orders = usePurchaseOrders();
  const loading = useInitialLoading();

  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatus, setOrderStatus] = useState<"all" | PurchaseOrderStatus>("all");
  const [providerQuery, setProviderQuery] = useState("");

  const filteredOrders = orders.filter((order) => {
    const haystack = `${order.number} ${order.provider}`.toLowerCase();
    const matchesQuery = haystack.includes(orderQuery.trim().toLowerCase());
    const matchesStatus = orderStatus === "all" || order.status === orderStatus;
    return matchesQuery && matchesStatus;
  });

  const filteredProviders = providers.filter((provider) => {
    const haystack =
      `${provider.name} ${provider.cuit} ${provider.phone} ${provider.email} ${provider.bank}`.toLowerCase();
    return haystack.includes(providerQuery.trim().toLowerCase());
  });

  function switchTab(tab: "orders" | "providers") {
    setSearchParams({ tab }, { replace: true });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Compras</h1>
          <p className="text-muted-foreground">
            Órdenes de compra y gestión de proveedores.
          </p>
        </div>
        <Button
          onClick={() =>
            navigate(
              activeTab === "orders"
                ? "/purchases/new-order"
                : "/purchases/new-provider"
            )
          }
        >
          <Plus />
          {activeTab === "orders" ? "Nueva orden de compra" : "Nuevo proveedor"}
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
          Órdenes de compra
        </Button>
        <Button
          variant="outline"
          className={cn(
            "flex-1 px-4",
            activeTab === "providers" &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => switchTab("providers")}
        >
          Proveedores
        </Button>
      </div>

      {activeTab === "orders" && (
        <section className="space-y-4">
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
        </section>
      )}

      {activeTab === "providers" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 w-full bg-card pl-10 shadow-sm"
                placeholder="Buscar proveedor por nombre, CUIT, correo o banco..."
                value={providerQuery}
                onChange={(event) => setProviderQuery(event.target.value)}
              />
            </div>
            {providerQuery && (
              <span className="text-sm text-muted-foreground">
                {filteredProviders.length} de {providers.length} proveedores
              </span>
            )}
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Proveedores</CardTitle>
              </div>
              <Badge variant="secondary">{providers.length} proveedores</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={6} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre / Razón social</TableHead>
                      <TableHead>CUIT</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Correo electrónico</TableHead>
                      <TableHead>Banco</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {filteredProviders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        {providers.length === 0
                          ? "No hay proveedores registrados."
                          : "No se encontraron proveedores para la búsqueda."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProviders.map((provider) => (
                      <TableRow key={provider.id}>
                        <TableCell className="font-medium">
                          {provider.name}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {provider.cuit || "—"}
                        </TableCell>
                        <TableCell>{provider.phone || "—"}</TableCell>
                        <TableCell>{provider.email || "—"}</TableCell>
                        <TableCell>{provider.bank || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar proveedor ${provider.name}`}
                              onClick={() =>
                                navigate(
                                  `/purchases/new-provider?edit=${provider.id}`
                                )
                              }
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDeleteDialog
                              title="¿Eliminar proveedor?"
                              description={`Se eliminará el proveedor ${provider.name}. Esta acción no se puede deshacer.`}
                              onConfirm={() => removeProvider(provider.id)}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Eliminar proveedor ${provider.name}`}
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
              <span>Mostrando {filteredProviders.length} de {providers.length} proveedores</span>
            </CardFooter>
          </Card>
        </section>
      )}
    </div>
  );
}