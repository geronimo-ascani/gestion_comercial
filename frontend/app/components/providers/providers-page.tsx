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

import { TableSkeleton } from "~/components/ui/skeleton";
import { useInitialLoading } from "~/lib/use-initial-loading";
import { useDebouncedValue } from "~/lib/use-debounced-value";
import { formatAddress } from "~/lib/address";
import { formatMoney } from "~/lib/currency";
import type { Provider } from "../purchases/purchases-types";
import { removeProvider, useProviders } from "../purchases/purchases-store";

function ProviderDetailDialog({
  provider,
  trigger,
}: {
  provider: Provider;
  trigger: ReactElement;
}) {
  const details: Array<[string, string]> = [
    ["CUIT", provider.cuit || "—"],
    ["Teléfono", provider.phone || "—"],
    ["Correo electrónico", provider.email || "—"],
    ["Dirección", formatAddress(provider.address) || "—"],
    ["Banco", provider.bank || "—"],
    ["Número de cuenta", provider.account || "—"],
    ["Saldo en cuenta corriente", formatMoney(provider.balance ?? 0)],
  ];
  return (
    <Dialog>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{provider.name}</DialogTitle>
          <DialogDescription>Datos del proveedor</DialogDescription>
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

export function ProvidersPage() {
  const navigate = useNavigate();
  const loading = useInitialLoading();
  const providers = useProviders();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query);

  const filteredProviders = providers.filter((provider) => {
    const haystack =
      `${provider.name} ${provider.cuit} ${provider.phone} ${provider.email} ${provider.bank}`.toLowerCase();
    return haystack.includes(debouncedQuery.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Proveedores</h1>
          <p className="text-muted-foreground">
            Registro y gestión de proveedores.
          </p>
        </div>
        <Button onClick={() => navigate("/purchases/new-provider")}>
          <Plus />
          Nuevo proveedor
        </Button>
      </div>

      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 w-full bg-card pl-10 shadow-sm"
          placeholder="Buscar proveedor por nombre, CUIT o banco..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Listado de proveedores</CardTitle>
          </div>
          <Badge variant="secondary">{providers.length} proveedores</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={4} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre / Razón social</TableHead>
                  <TableHead>CUIT</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredProviders.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <ProviderDetailDialog
                          provider={provider}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Ver proveedor ${provider.name}`}
                            >
                              <Eye />
                            </Button>
                          }
                        />
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
    </div>
  );
}