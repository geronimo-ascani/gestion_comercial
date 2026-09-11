import {
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";

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
import { FieldError } from "~/components/ui/field-error";
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

import {
  requireText,
  validateAddress,
  validateDocument,
  validateEmail,
  validatePhone,
} from "~/lib/validation";
import { formatDate } from "../sales/sales-types";
import { OrderLineItemsTable } from "../sales/sales-views";
import type { Provider, PurchaseOrder } from "./purchases-types";
import {
  addProvider,
  addPurchaseOrder,
  removeProvider,
  removePurchaseOrder,
  updateProvider,
  useProviders,
  usePurchaseOrders,
} from "./purchases-store";
import { PurchaseOrderStatusBadge } from "./purchases-views";

function NewProviderDialog({
  open,
  onOpenChange,
  provider,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: Provider | null;
  onSaved: (provider: Provider) => void;
}) {
  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [province, setProvince] = useState("");
  const [locality, setLocality] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [apartment, setApartment] = useState("");
  const [bank, setBank] = useState("");
  const [account, setAccount] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (open) {
      setName(provider?.name ?? "");
      setCuit(provider?.cuit ?? "");
      setPhone(provider?.phone ?? "");
      setEmail(provider?.email ?? "");
      setProvince(provider?.address?.province ?? "");
      setLocality(provider?.address?.locality ?? "");
      setStreet(provider?.address?.street ?? "");
      setNumber(provider?.address?.number ?? "");
      setApartment(provider?.address?.apartment ?? "");
      setBank(provider?.bank ?? "");
      setAccount(provider?.account ?? "");
      setErrors({});
    }
  }, [open, provider]);

  function setField(field: string, value: string, setter: (value: string) => void) {
    setter(value);
    setErrors((prev) => ({ ...prev, [field]: null }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: Record<string, string | null> = {
      name: requireText(name, "Nombre / Razón social"),
      cuit: cuit.trim()
        ? validateDocument(cuit)
        : requireText(cuit, "CUIT"),
      email: email.trim()
        ? validateEmail(email)
        : requireText(email, "Correo electrónico"),
      phone: phone.trim() ? validatePhone(phone) : requireText(phone, "Teléfono"),
      address: validateAddress({ province, locality, street, number, apartment }),
    };
    setErrors(next);
    if (Object.values(next).some((error) => error)) return;
    onSaved({
      id: provider?.id ?? crypto.randomUUID(),
      name: name.trim() || "Sin definir",
      cuit: cuit.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: {
        province: province.trim(),
        locality: locality.trim(),
        street: street.trim(),
        number: number.trim(),
        apartment: apartment.trim(),
      },
      bank: bank.trim(),
      account: account.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {provider ? "Editar proveedor" : "Nuevo proveedor"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del proveedor. Nombre / Razón social, CUIT,
            teléfono y correo electrónico son obligatorios.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="provider-name">Nombre / Razón social</Label>
              <Input
                id="provider-name"
                value={name}
                onChange={(event) =>
                  setField("name", event.target.value, setName)
                }
                placeholder="Ej. Distribuidora San Juan"
                aria-invalid={!!errors.name}
              />
              <FieldError message={errors.name} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-cuit">CUIT</Label>
              <Input
                id="provider-cuit"
                value={cuit}
                onChange={(event) =>
                  setField("cuit", event.target.value, setCuit)
                }
                placeholder="20-12345678-9"
                aria-invalid={!!errors.cuit}
              />
              <FieldError message={errors.cuit} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-phone">Teléfono</Label>
              <Input
                id="provider-phone"
                value={phone}
                onChange={(event) =>
                  setField("phone", event.target.value, setPhone)
                }
                placeholder="+54 11 5555-0000"
                aria-invalid={!!errors.phone}
              />
              <FieldError message={errors.phone} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-email">Correo electrónico</Label>
              <Input
                id="provider-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setField("email", event.target.value, setEmail)
                }
                placeholder="ventas@proveedor.com.ar"
                aria-invalid={!!errors.email}
              />
              <FieldError message={errors.email} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Dirección</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="provider-street">Calle</Label>
                  <Input
                    id="provider-street"
                    value={street}
                    onChange={(event) =>
                      setField("address", event.target.value, setStreet)
                    }
                    placeholder="Nombre de la calle"
                    aria-invalid={!!errors.address}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-number">Altura</Label>
                  <Input
                    id="provider-number"
                    value={number}
                    onChange={(event) =>
                      setField("address", event.target.value, setNumber)
                    }
                    placeholder="1234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-apartment">Departamento</Label>
                  <Input
                    id="provider-apartment"
                    value={apartment}
                    onChange={(event) =>
                      setField("address", event.target.value, setApartment)
                    }
                    placeholder="Ej. 3º B"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-locality">Localidad</Label>
                  <Input
                    id="provider-locality"
                    value={locality}
                    onChange={(event) =>
                      setField("address", event.target.value, setLocality)
                    }
                    placeholder="Ej. Córdoba"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="provider-province">Provincia</Label>
                  <Input
                    id="provider-province"
                    value={province}
                    onChange={(event) =>
                      setField("address", event.target.value, setProvince)
                    }
                    placeholder="Ej. Buenos Aires"
                  />
                </div>
              </div>
              <FieldError message={errors.address} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-bank">Banco</Label>
              <Input
                id="provider-bank"
                value={bank}
                onChange={(event) => setBank(event.target.value)}
                placeholder="Ej. Banco Galicia"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provider-account">Número de cuenta</Label>
              <Input
                id="provider-account"
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="CBU / número de cuenta"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">
              {provider ? "Guardar cambios" : "Crear proveedor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewPurchaseOrderDialog({
  open,
  onOpenChange,
  nextNumber,
  providers,
  onCreated,
  onOpenProvider,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextNumber: string;
  providers: Provider[];
  onCreated: (order: PurchaseOrder) => void;
  onOpenProvider: () => void;
}) {
  const [provider, setProvider] = useState("");

  useEffect(() => {
    if (open) setProvider("");
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onCreated({
      number: nextNumber,
      provider: provider || "Sin definir",
      date: formatDate(new Date()),
      items: [],
      total: "$0",
      status: "pendiente",
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva orden de compra</DialogTitle>
          <DialogDescription>
            Seleccione el proveedor, los productos y las cantidades. Si el
            proveedor no existe, puede cargarlo desde aquí.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="order-provider">Proveedor</Label>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={onOpenProvider}
              >
                <Plus />
                Nuevo proveedor
              </Button>
            </div>
            {providers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay proveedores cargados. Cree uno para poder generar la
                orden de compra.
              </p>
            ) : (
              <Select value={provider || undefined} onValueChange={(value) => setProvider(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccionar proveedor" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="order-items">Productos</Label>
              <Button variant="ghost" size="sm" type="button">
                <Plus />
                Agregar producto
              </Button>
            </div>
            <OrderLineItemsTable items={[]} total="" />
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">Crear orden</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
  const [activeTab, setActiveTab] = useState<"orders" | "providers">("orders");
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const providers = useProviders();
  const orders = usePurchaseOrders();

  const nextOrderNumber = `OC-${String(orders.length + 1).padStart(3, "0")}`;

  function openNewProvider() {
    setEditingProvider(null);
    setProviderDialogOpen(true);
  }

  function handleProviderSaved(provider: Provider) {
    if (editingProvider) {
      updateProvider(provider.id, provider);
    } else {
      addProvider(provider);
    }
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
        {activeTab === "orders" ? (
          <Button onClick={() => setOrderDialogOpen(true)}>
            <Plus />
            Nueva orden de compra
          </Button>
        ) : (
          <Button onClick={openNewProvider}>
            <Plus />
            Nuevo proveedor
          </Button>
        )}
      </div>

      <div className="flex w-full gap-2 lg:w-fit">
        <Button
          variant="outline"
          className={cn(
            "flex-1 px-4",
            activeTab === "orders" &&
              "border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
          )}
          onClick={() => setActiveTab("orders")}
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
          onClick={() => setActiveTab("providers")}
        >
          Proveedores
        </Button>
      </div>

      {activeTab === "orders" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar por proveedor o número de orden..."
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
                    <SelectItem value="aprobada">Aprobada</SelectItem>
                    <SelectItem value="recibida">Recibida</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline">Buscar</Button>
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
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay órdenes de compra registradas.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
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
                          <div className="flex justify-end gap-1">
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
                            <ConfirmDeleteDialog
                              title="¿Eliminar orden de compra?"
                              description={`Se eliminará la orden ${order.number} del proveedor ${order.provider}. Esta acción no se puede deshacer.`}
                              onConfirm={() =>
                                removePurchaseOrder(order.number)
                              }
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  aria-label={`Eliminar orden ${order.number}`}
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
            </CardContent>
            <CardFooter className="justify-between text-sm text-muted-foreground">
              <span>Mostrando {orders.length} órdenes</span>
            </CardFooter>
          </Card>
        </section>
      )}

      {activeTab === "providers" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar proveedor por nombre o CUIT..."
              />
            </div>
            <Button variant="outline">Buscar</Button>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Proveedores</CardTitle>
              </div>
              <Badge variant="secondary">{providers.length} proveedores</Badge>
            </CardHeader>
            <CardContent>
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
                  {providers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No hay proveedores registrados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    providers.map((provider) => (
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
                              onClick={() => {
                                setEditingProvider(provider);
                                setProviderDialogOpen(true);
                              }}
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
            </CardContent>
            <CardFooter className="justify-between text-sm text-muted-foreground">
              <span>Mostrando {providers.length} proveedores</span>
            </CardFooter>
          </Card>
        </section>
      )}

      <NewPurchaseOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        nextNumber={nextOrderNumber}
        providers={providers}
        onCreated={addPurchaseOrder}
        onOpenProvider={openNewProvider}
      />

      <NewProviderDialog
        open={providerDialogOpen}
        onOpenChange={setProviderDialogOpen}
        provider={editingProvider}
        onSaved={handleProviderSaved}
      />
    </div>
  );
}