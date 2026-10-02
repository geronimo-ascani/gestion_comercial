import { useState, type ReactElement } from "react";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import { formatAddress } from "~/lib/address";
import { formatMoney } from "~/lib/currency";
import { removeCustomer, useCustomers } from "./customers-store";
import type { Customer } from "./customers-types";
import { TableSkeleton } from "~/components/ui/skeleton";
import { useInitialLoading } from "~/lib/use-initial-loading";
import { useDebouncedValue } from "~/lib/use-debounced-value";

function CustomerDetailDialog({
  customer,
  trigger,
}: {
  customer: Customer;
  trigger: ReactElement;
}) {
  const details: Array<[string, string]> = [
    ["Documento", customer.document || "—"],
    ["Teléfono", customer.phone || "—"],
    ["Correo electrónico", customer.email || "—"],
    ["Dirección", formatAddress(customer.address) || "—"],
    ["Saldo en cuenta corriente", formatMoney(customer.balance ?? 0)],
  ];
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {customer.firstName} {customer.lastName}
          </DialogTitle>
          <DialogDescription>Datos del cliente</DialogDescription>
        </DialogHeader>
        <dl className="space-y-3">
          {details.map(([label, value]) => (
            <div key={label} className="flex items-start justify-between gap-4">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-right text-sm font-medium break-all">{value}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cerrar
          </DialogClose>
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

export function CustomersPage() {
  const navigate = useNavigate();
  const loading = useInitialLoading();
  const customers = useCustomers();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);

  const filtered = customers.filter((customer) => {
    const haystack =
      `${customer.firstName} ${customer.lastName} ${customer.document} ${customer.phone} ${customer.email} ${formatAddress(customer.address)}`.toLowerCase();
    return haystack.includes(debouncedQuery.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Registro y gestión de clientes.
          </p>
        </div>
        <Button onClick={() => navigate("/customers/new")}>
          <Plus />
          Nuevo cliente
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full bg-card pl-10 shadow-sm"
            placeholder="Buscar cliente por nombre, DNI/CUIT o teléfono..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {query && (
          <span className="text-sm text-muted-foreground">
            {filtered.length} de {customers.length} clientes
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Clientes</CardTitle>
          </div>
          <Badge variant="secondary">{customers.length} clientes</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={5} />
          ) : (
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead>Nombre y apellido</TableHead>
                <TableHead>DNI / CUIT</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {customers.length === 0
                      ? "No hay clientes registrados."
                      : "No se encontraron clientes para la búsqueda."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      {customer.firstName} {customer.lastName}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {customer.document || "—"}
                    </TableCell>
                    <TableCell>{customer.phone || "—"}</TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        (customer.balance ?? 0) < 0
                          ? "text-destructive"
                          : (customer.balance ?? 0) > 0
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {formatMoney(customer.balance ?? 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <CustomerDetailDialog
                          customer={customer}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Ver cliente ${customer.firstName} ${customer.lastName}`}
                            >
                              <Eye />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar cliente ${customer.firstName} ${customer.lastName}`}
                          onClick={() =>
                            navigate(`/customers/new?edit=${customer.id}`)
                          }
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
          )}
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>Mostrando {filtered.length} de {customers.length} clientes</span>
        </CardFooter>
      </Card>
    </div>
  );
}