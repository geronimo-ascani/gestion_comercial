import { useEffect, useState, type FormEvent, type ReactElement } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import type { Customer } from "./customers-types";
import {
  addCustomer,
  removeCustomer,
  updateCustomer,
  useCustomers,
} from "./customers-store";

function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  onSaved: (customer: Customer) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (open) {
      setFirstName(customer?.firstName ?? "");
      setLastName(customer?.lastName ?? "");
      setDocument(customer?.document ?? "");
      setPhone(customer?.phone ?? "");
      setEmail(customer?.email ?? "");
      setAddress(customer?.address ?? "");
    }
  }, [open, customer]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSaved({
      id: customer?.id ?? crypto.randomUUID(),
      firstName: firstName.trim() || "Sin definir",
      lastName: lastName.trim(),
      document: document.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {customer ? "Editar cliente" : "Nuevo cliente"}
          </DialogTitle>
          <DialogDescription>
            Complete los datos del cliente. Nombre, apellido, DNI/CUIT y correo
            electrónico son obligatorios.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customer-first-name">Nombre</Label>
              <Input
                id="customer-first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Ej. Juan"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-last-name">Apellido</Label>
              <Input
                id="customer-last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Ej. Pérez"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-document">DNI / CUIT</Label>
              <Input
                id="customer-document"
                value={document}
                onChange={(event) => setDocument(event.target.value)}
                placeholder="DNI 33.251.234 / CUIT 20-..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Teléfono</Label>
              <Input
                id="customer-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+54 11 5555-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Correo electrónico</Label>
              <Input
                id="customer-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="cliente@mail.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-address">Dirección</Label>
              <Input
                id="customer-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Calle, número y localidad"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancelar
            </DialogClose>
            <Button type="submit">
              {customer ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </DialogFooter>
        </form>
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

export function CustomersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const customers = useCustomers();

  function openNewCustomer() {
    setEditingCustomer(null);
    setFormOpen(true);
  }

  function handleSaved(customer: Customer) {
    if (editingCustomer) {
      updateCustomer(customer.id, customer);
    } else {
      addCustomer(customer);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Registro y gestión de clientes.
          </p>
        </div>
        <Button onClick={openNewCustomer}>
          <Plus />
          Nuevo cliente
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar cliente por nombre, DNI/CUIT o correo..."
          />
        </div>
        <Button variant="outline">Buscar</Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clientes</CardTitle>
          </div>
          <Badge variant="secondary">{customers.length} clientes</Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre y apellido</TableHead>
                <TableHead>DNI / CUIT</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Correo electrónico</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No hay clientes registrados.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.firstName} {customer.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {customer.document || "—"}
                    </TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell>{customer.email || "—"}</TableCell>
                    <TableCell>{customer.address || "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar cliente ${customer.firstName} ${customer.lastName}`}
                          onClick={() => {
                            setEditingCustomer(customer);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmDeleteDialog
                          title="¿Eliminar cliente?"
                          description={`Se eliminará ${customer.firstName} ${customer.lastName}. Esta acción no se puede deshacer.`}
                          onConfirm={() => removeCustomer(customer.id)}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={`Eliminar cliente ${customer.firstName} ${customer.lastName}`}
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
          <span>Mostrando {customers.length} clientes</span>
        </CardFooter>
      </Card>

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
        onSaved={handleSaved}
      />
    </div>
  );
}