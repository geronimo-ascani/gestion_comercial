import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { CheckCircle2, FileText, Plus, Search } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
import { formatMoney } from "~/lib/currency";
import { useDebouncedValue } from "~/lib/use-debounced-value";

import {
  downloadInvoiceFile,
  formatInvoiceDate,
  formatInvoiceFileSize,
} from "./invoices-api";
import {
  addInvoicePayment,
  loadInvoices,
  useSupplierInvoices,
  useSupplierInvoicesLoading,
} from "./invoices-store";
import {
  loadPaymentMethods,
  usePaymentMethods,
} from "../payments/payment-methods-store";
import type { InvoiceEstadoPago } from "./invoices-types";
import { InvoiceStatusBadge } from "./invoices-views";
import { refreshProviders, useProviders } from "./purchases-store";

export function InvoicesPage() {
  const navigate = useNavigate();
  const invoices = useSupplierInvoices();
  const loading = useSupplierInvoicesLoading();
  const providers = useProviders();
  const paymentMethods = usePaymentMethods();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<"all" | InvoiceEstadoPago>("all");
  const [idProveedor, setIdProveedor] = useState("all");
  const debouncedQuery = useDebouncedValue(query);

  useEffect(() => {
    let active = true;
    void loadInvoices(true)
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las facturas de proveedor."
          );
        }
      });
    void refreshProviders().catch(() => undefined);
    void loadPaymentMethods().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function handleMarkPaid(id: string, saldo: number) {
    const medio = paymentMethods[0]?.id;
    if (!medio) {
      setLoadError("No hay medios de pago disponibles para registrar el pago.");
      return;
    }
    setMarkingId(id);
    setLoadError(null);
    try {
      await addInvoicePayment(id, {
        id_medio_pago: medio,
        monto: saldo.toFixed(2),
        referencia: "Marcada como pagada",
        estado: "aprobado",
      });
      await loadInvoices(true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudo marcar la factura como pagada."
      );
    } finally {
      setMarkingId(null);
    }
  }

  const filtered = invoices.filter((invoice) => {
    const haystack = `${invoice.numeroCompleto} ${invoice.proveedorRazonSocial} ${invoice.idPedidoProveedor}`.toLowerCase();
    return (
      haystack.includes(debouncedQuery.trim().toLowerCase()) &&
      (estado === "all" || invoice.estadoPago === estado) &&
      (idProveedor === "all" || invoice.idProveedor === idProveedor)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Facturas de proveedor</h1>
          <p className="text-muted-foreground">
            Comprobantes recibidos de sus proveedores.
          </p>
        </div>
        <Button onClick={() => navigate("/purchases/invoices/new")}>
          <Plus />
          Nueva factura
        </Button>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}
      {fileError && (
        <p role="alert" className="text-sm text-destructive">
          {fileError}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full bg-card pl-10 shadow-sm"
            placeholder="Buscar por número, proveedor u orden..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="invoice-estado-filter">Estado de pago</Label>
            <Select
              value={estado}
              items={{
                all: "Todos",
                emitida: "Emitida",
                pagada: "Pagada",
              }}
              onValueChange={(value) =>
                setEstado((value ?? "all") as "all" | InvoiceEstadoPago)
              }
            >
              <SelectTrigger id="invoice-estado-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="pagada">Pagada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-proveedor-filter">Proveedor</Label>
            <Select
              value={idProveedor}
              items={{
                all: "Todos",
                ...Object.fromEntries(
                  providers.map((provider) => [provider.id, provider.name])
                ),
              }}
              onValueChange={(value) => setIdProveedor(value ?? "all")}
            >
              <SelectTrigger id="invoice-proveedor-filter" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Facturas registradas</CardTitle>
          <Badge variant="secondary">{invoices.length} facturas</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={6} columns={10} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Proveedor</TableHead>
                  <TableHead>Orden</TableHead>
                  <TableHead>Emisión</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="h-24 text-center text-muted-foreground"
                    >
                      {invoices.length === 0
                        ? "No hay facturas de proveedor registradas."
                        : "No se encontraron facturas para los filtros elegidos."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono text-xs">
                        <Link
                          to={`/purchases/invoices/${invoice.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {invoice.numeroCompleto || invoice.id}
                        </Link>
                      </TableCell>
                      <TableCell className="font-medium">
                        {invoice.proveedorRazonSocial}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {invoice.idPedidoProveedor}
                      </TableCell>
                      <TableCell>{formatInvoiceDate(invoice.fechaEmision)}</TableCell>
                      <TableCell>{formatInvoiceDate(invoice.fechaVence)}</TableCell>
                      <TableCell>{invoice.tipoComprobante}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(invoice.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(invoice.saldoPendiente)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={invoice.estadoPago} />
                      </TableCell>
                      <TableCell>
                        {invoice.tieneArchivo ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={`Descargar ${invoice.archivoNombre} (${formatInvoiceFileSize(invoice.archivoTamanio)})`}
                            aria-label={`Descargar archivo de la factura ${invoice.numeroCompleto}`}
                            onClick={() => {
                              setFileError(null);
                              void downloadInvoiceFile(invoice.id).catch(
                                (error: unknown) => {
                                  setFileError(
                                    error instanceof Error
                                      ? error.message
                                      : "No se pudo descargar el archivo."
                                  );
                                }
                              );
                            }}
                          >
                            <FileText />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {invoice.estadoPago === "emitida" &&
                        invoice.saldoPendiente > 0 ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title={`Marcar ${invoice.numeroCompleto} como pagada`}
                            aria-label={`Marcar la factura ${invoice.numeroCompleto} como pagada`}
                            disabled={markingId === invoice.id}
                            onClick={() =>
                              void handleMarkPaid(
                                invoice.id,
                                invoice.saldoPendiente
                              )
                            }
                          >
                            <CheckCircle2 />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {filtered.length} de {invoices.length} facturas
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
