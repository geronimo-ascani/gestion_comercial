import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Search,
  Send,
  Wallet,
} from "lucide-react";
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
  Combobox,
  type ComboboxOption,
} from "~/components/ui/combobox";
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
import { formatMoney } from "~/lib/currency";
import { compareByDateDesc } from "~/lib/utils";
import { formatInputDate } from "../sales/sales-types";
import { useCurrentUser } from "../auth/session-store";
import { listCustomers } from "../customers/customers-api";
import type { Customer } from "../customers/customers-types";
import { listProviders } from "../purchases/providers-api";
import type { Provider } from "../purchases/purchases-types";
import type { Invoice, PaymentTransaction } from "./payments-types";
import {
  getReporteCobrosPagos,
  downloadReporteCobrosPagosPdf,
  listPagosProveedor,
  type PagoProveedorListadoApi,
  type ReporteCobrosPagosApi,
} from "./payments-api";
import {
  loadPayments,
  useInvoices,
  usePayments,
  usePaymentsLoading,
} from "./payments-store";
import {
  InvoiceStatusBadge,
  InvoiceTypeBadge,
  MethodBadge,
  PaymentStatusBadge,
} from "./payments-views";
import { RecordPaymentDialog } from "./record-payment-dialog";
import { SendInvoiceDialog } from "./send-invoice-dialog";

type PaymentTab = "cobros" | "reportes" | "pagos-proveedor";

interface Feedback {
  type: "success" | "error";
  text: string;
}

function primerDiaDelMes(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

function hoyISO(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
}

function normalizarBusqueda(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function filtrarOpciones<T extends ComboboxOption>(
  opciones: T[],
  busqueda: string
): T[] {
  const texto = normalizarBusqueda(busqueda.trim());
  if (!texto) return opciones;
  const [todas, ...resto] = opciones;
  if (!todas) return opciones;
  return [
    todas,
    ...resto.filter((opcion) =>
      normalizarBusqueda(
        [opcion.label, ...(opcion.keywords ?? [])].join(" ")
      ).includes(texto)
    ),
  ];
}

export function PaymentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useCurrentUser();
  const isAdmin = user?.role === "administrador";
  const initialLoading = useInitialLoading();
  const storeLoading = usePaymentsLoading();
  const loading = initialLoading || storeLoading;
  const invoices = useInvoices();
  const payments = usePayments();

  const requestedTab = searchParams.get("tab");
  const tabSolicitada: PaymentTab =
    requestedTab === "reportes" || requestedTab === "pagos-proveedor"
      ? requestedTab
      : "cobros";
  const activeTab: PaymentTab = isAdmin ? tabSolicitada : "cobros";

  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [desde, setDesde] = useState(primerDiaDelMes);
  const [hasta, setHasta] = useState(hoyISO);
  const [idCliente, setIdCliente] = useState("");
  const [idProveedor, setIdProveedor] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaProveedor, setBusquedaProveedor] = useState("");
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [proveedores, setProveedores] = useState<Provider[]>([]);
  const [reporte, setReporte] = useState<ReporteCobrosPagosApi | null>(null);
  const [pagosProveedor, setPagosProveedor] = useState<
    PagoProveedorListadoApi[]
  >([]);
  const [reporteLoading, setReporteLoading] = useState(false);
  const [proveedorLoading, setProveedorLoading] = useState(false);
  const [reporteError, setReporteError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query);
  const busquedaClienteDebounced = useDebouncedValue(busquedaCliente);
  const busquedaProveedorDebounced = useDebouncedValue(busquedaProveedor);

  const clienteOptions = useMemo(
    () =>
      filtrarOpciones(
        [
          { value: "", label: "Todos los clientes" },
          ...clientes.map((cliente) => ({
            value: cliente.id,
            label: `${cliente.firstName} ${cliente.lastName}`.trim(),
            keywords: [cliente.document, cliente.email],
          })),
        ],
        busquedaClienteDebounced
      ),
    [clientes, busquedaClienteDebounced]
  );
  const proveedorOptions = useMemo(
    () =>
      filtrarOpciones(
        [
          { value: "", label: "Todos los proveedores" },
          ...proveedores.map((proveedor) => ({
            value: proveedor.id,
            label: proveedor.name,
            keywords: [proveedor.cuit, proveedor.email],
          })),
        ],
        busquedaProveedorDebounced
      ),
    [proveedores, busquedaProveedorDebounced]
  );

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    listCustomers()
      .then((result) => {
        if (active) setClientes(result);
      })
      .catch(() => undefined);
    listProviders()
      .then((result) => {
        if (active) setProveedores(result);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    void loadPayments().catch((error: unknown) => {
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los comprobantes y pagos."
      );
    });
  }, []);

  const normalizedQuery = debouncedQuery.trim().toLowerCase();

  const filteredInvoices = useMemo(() => {
    return [...invoices]
      .filter((invoice) => {
        if (!normalizedQuery) return true;
        return `${invoice.number} ${invoice.type} ${invoice.orderNumber} ${invoice.client}`
          .toLowerCase()
          .includes(normalizedQuery);
      })
      .sort((a, b) => {
        const dateDiff = compareByDateDesc(a.date, b.date);
        if (dateDiff !== 0) return dateDiff;
        return b.number.localeCompare(a.number);
      });
  }, [invoices, normalizedQuery]);

  const methodOptions = useMemo(() => {
    const entries = new Map<string, string>();
    for (const payment of payments) {
      entries.set(payment.method, payment.methodLabel);
    }
    return [...entries.entries()].map(([id, label]) => ({ id, label }));
  }, [payments]);

  const methodFilterItems = useMemo(() => {
    const items: Record<string, string> = { all: "Todos" };
    for (const method of methodOptions) {
      items[method.id] = method.label;
    }
    return items;
  }, [methodOptions]);

  const filteredPayments = useMemo(() => {
    return [...payments]
      .filter((payment) => {
        const haystack =
          `${payment.id} ${payment.client} ${payment.invoiceNumber} ${payment.orderNumber} ${payment.reference ?? ""} ${payment.methodLabel}`.toLowerCase();
        const matchesQuery =
          !normalizedQuery || haystack.includes(normalizedQuery);
        const matchesMethod =
          methodFilter === "all" || payment.method === methodFilter;
        return matchesQuery && matchesMethod;
      })
      .sort((a, b) => {
        const dateDiff = compareByDateDesc(a.date, b.date);
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id);
      });
  }, [payments, normalizedQuery, methodFilter]);

  const rangoValido = Boolean(desde && hasta && desde <= hasta);

  useEffect(() => {
    if (!isAdmin || !rangoValido) {
      setReporte(null);
      return;
    }
    let active = true;
    setReporteLoading(true);
    setReporteError(null);
    getReporteCobrosPagos({
      desde,
      hasta,
      id_cliente: idCliente || undefined,
      id_proveedor: idProveedor || undefined,
    })
      .then((result) => {
        if (active) setReporte(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setReporte(null);
        setReporteError(
          cause instanceof Error
            ? cause.message
            : "No se pudo cargar el reporte de cobros y pagos."
        );
      })
      .finally(() => {
        if (active) setReporteLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, rangoValido, desde, hasta, idCliente, idProveedor]);

  useEffect(() => {
    if (!isAdmin || activeTab !== "pagos-proveedor" || !rangoValido) {
      setPagosProveedor([]);
      return;
    }
    let active = true;
    setProveedorLoading(true);
    listPagosProveedor({
      desde,
      hasta,
      id_proveedor: idProveedor || undefined,
    })
      .then((result) => {
        if (active) setPagosProveedor(result);
      })
      .catch(() => {
        if (active) setPagosProveedor([]);
      })
      .finally(() => {
        if (active) setProveedorLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, activeTab, rangoValido, desde, hasta, idProveedor]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadReporteCobrosPagosPdf({
        desde,
        hasta,
        id_cliente: idCliente || undefined,
        id_proveedor: idProveedor || undefined,
      });
    } catch (cause: unknown) {
      setExportError(
        cause instanceof Error
          ? cause.message
          : "No se pudo descargar el reporte."
      );
    } finally {
      setExporting(false);
    }
  }

  function limpiarFiltros() {
    setDesde(primerDiaDelMes());
    setHasta(hoyISO());
    setIdCliente("");
    setIdProveedor("");
    setBusquedaCliente("");
    setBusquedaProveedor("");
  }

  function setTab(tab: PaymentTab) {
    setSearchParams({ tab }, { replace: true });
  }

  function openPayment(invoice: Invoice) {
    setFeedback(null);
    setPaymentTarget(invoice);
    setPaymentOpen(true);
  }

  function openSend(invoice: Invoice) {
    setFeedback(null);
    setSendTarget(invoice);
    setSendOpen(true);
  }

  function handleSent() {
    setFeedback({
      type: "success",
      text: `Comprobante ${sendTarget?.number ?? ""} enviado por correo.`.trim(),
    });
  }

  async function retryLoad() {
    setLoadError(null);
    try {
      await loadPayments(true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar los comprobantes y pagos."
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>
          <p className="text-muted-foreground">
            Comprobantes emitidos, cobros registrados y reportes.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => navigate("/payments/new-method")}>
            <Plus />
            Nuevo medio de pago
          </Button>
        )}
      </div>

      <div className="flex w-full gap-2 lg:w-fit">
        <Button
          variant={activeTab === "cobros" ? "default" : "outline"}
          className="flex-1 px-6"
          onClick={() => setTab("cobros")}
        >
          Cobros
        </Button>
        {isAdmin && (
          <>
            <Button
              variant={activeTab === "reportes" ? "default" : "outline"}
              className="flex-1 px-6"
              onClick={() => setTab("reportes")}
            >
              Reportes
            </Button>
            <Button
              variant={
                activeTab === "pagos-proveedor" ? "default" : "outline"
              }
              className="flex-1 px-6"
              onClick={() => setTab("pagos-proveedor")}
            >
              Pagos a proveedores
            </Button>
          </>
        )}
      </div>

      {feedback && (
        <p
          className={
            feedback.type === "error"
              ? "rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive"
              : "rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700"
          }
          role={feedback.type === "error" ? "alert" : "status"}
        >
          {feedback.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAdmin && reporte && (
          <>
            <KpiCard
              icon={<Wallet className="size-4" />}
              label="Cobros aprobados"
              value={formatMoney(Number(reporte.totales.cobros_realizados))}
            />
            <KpiCard
              icon={<Wallet className="size-4" />}
              label="Pagos aprobados a proveedores"
              value={formatMoney(Number(reporte.totales.pagos_realizados))}
            />
          </>
        )}
        <KpiCard
          icon={<FileText className="size-4" />}
          label="Comprobantes"
          value={String(invoices.length)}
        />
        <KpiCard
          icon={<CheckCircle2 className="size-4" />}
          label="Pagos registrados"
          value={String(payments.length)}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 w-full bg-card pl-10 shadow-sm"
            placeholder="Buscar por cliente, comprobante o pedido..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment-method-filter">Medio de pago</Label>
          <Select
            value={methodFilter}
            items={methodFilterItems}
            onValueChange={(value) => setMethodFilter(value ?? "all")}
          >
            <SelectTrigger id="payment-method-filter" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {methodOptions.map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loadError && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-destructive" role="alert">
              {loadError}
            </p>
            <Button variant="outline" onClick={() => void retryLoad()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      )}

      {isAdmin && activeTab !== "cobros" && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros del reporte</CardTitle>
            <p className="text-sm text-muted-foreground">
              El backend calcula todos los importes con estos filtros.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="reporte-desde"
                className="shrink-0 text-muted-foreground"
              >
                Desde
              </Label>
              <Input
                id="reporte-desde"
                type="date"
                className="w-40"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label
                htmlFor="reporte-hasta"
                className="shrink-0 text-muted-foreground"
              >
                Hasta
              </Label>
              <Input
                id="reporte-hasta"
                type="date"
                className="w-40"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
              />
            </div>
            <Combobox
              value={idCliente}
              onValueChange={setIdCliente}
              options={clienteOptions}
              searchValue={busquedaCliente}
              onSearchChange={setBusquedaCliente}
              searchPlaceholder="Buscar por nombre, DNI/CUIT o email…"
              notFoundText="No se encontraron clientes"
              className="w-56"
            />
            <Combobox
              value={idProveedor}
              onValueChange={setIdProveedor}
              options={proveedorOptions}
              searchValue={busquedaProveedor}
              onSearchChange={setBusquedaProveedor}
              searchPlaceholder="Buscar por razón social, CUIT o email…"
              notFoundText="No se encontraron proveedores"
              className="w-56"
            />
            <Button variant="ghost" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          </CardContent>
        </Card>
      )}

      {activeTab === "cobros" && (
        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Comprobantes emitidos</CardTitle>
              <Badge variant="secondary">
                {filteredInvoices.length} comprobantes
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : (
                <InvoicesTable
                  invoices={filteredInvoices}
                  onRecordPayment={openPayment}
                  onSend={openSend}
                />
              )}
            </CardContent>
            <CardFooter className="text-sm text-muted-foreground">
              Los comprobantes se emiten desde el detalle de un pedido enviado
              o entregado.
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pagos registrados</CardTitle>
              <Badge variant="secondary">
                {filteredPayments.length} pagos
              </Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : (
                <PaymentsTable
                  payments={filteredPayments}
                  emptyText="No se encontraron pagos."
                />
              )}
            </CardContent>
            <CardFooter className="justify-between text-sm text-muted-foreground">
              <span>
                Mostrando {filteredPayments.length} de {payments.length} pagos
              </span>
            </CardFooter>
          </Card>
        </section>
      )}

      {activeTab === "reportes" && (
        <section className="space-y-4">
          {!rangoValido && (
            <p className="text-sm text-destructive" role="alert">
              La fecha "desde" no puede ser posterior a la fecha "hasta".
            </p>
          )}
          {reporteError && (
            <p className="text-sm text-destructive" role="alert">
              {reporteError}
            </p>
          )}
          {exportError && (
            <p className="text-sm text-destructive" role="alert">
              {exportError}
            </p>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Reportes de cobros y pagos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Totales calculados por el backend para el rango seleccionado.
                </p>
              </div>
              <Button
                onClick={() => void handleExport()}
                disabled={!rangoValido || exporting}
              >
                {exporting ? "Generando..." : "Descargar PDF"}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={<Wallet className="size-4" />}
                label="Cobros aprobados"
                value={formatMoney(Number(reporte?.totales.cobros_realizados ?? 0))}
              />
              <KpiCard
                icon={<Wallet className="size-4" />}
                label="Pagos aprobados"
                value={formatMoney(Number(reporte?.totales.pagos_realizados ?? 0))}
              />
              <KpiCard
                icon={<CheckCircle2 className="size-4" />}
                label="Neto realizado"
                value={formatMoney(Number(reporte?.totales.neto_realizado ?? 0))}
              />
              <KpiCard
                icon={<Clock className="size-4" />}
                label="Pendiente (no realizado)"
                value={formatMoney(
                  Number(reporte?.totales.cobros_pendientes ?? 0)
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totales por medio de pago</CardTitle>
            </CardHeader>
            <CardContent>
              {reporteLoading && !reporte ? (
                <TableSkeleton rows={5} columns={4} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medio de pago</TableHead>
                      <TableHead className="text-right">Cobros</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Total aprobado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reporte?.por_medio_pago ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="h-20 text-center text-muted-foreground"
                        >
                          No hay pagos aprobados en el rango seleccionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reporte?.por_medio_pago.map((medio) => (
                        <TableRow key={medio.id_medio_pago}>
                          <TableCell className="font-medium">
                            {medio.medio_pago}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(Number(medio.cobros_aprobados))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatMoney(Number(medio.pagos_aprobados))}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(Number(medio.total_aprobado))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Totales por estado</CardTitle>
            </CardHeader>
            <CardContent>
              {reporteLoading && !reporte ? (
                <TableSkeleton rows={3} columns={5} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Cobros</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(reporte?.por_estado ?? []).map((estado) => (
                      <TableRow key={estado.estado}>
                        <TableCell className="font-medium capitalize">
                          {estado.estado}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(Number(estado.cobros.monto))}
                        </TableCell>
                        <TableCell className="text-right">
                          {estado.cobros.cantidad}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatMoney(Number(estado.pagos.monto))}
                        </TableCell>
                        <TableCell className="text-right">
                          {estado.pagos.cantidad}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      {activeTab === "pagos-proveedor" && (
        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pagos a proveedores</CardTitle>
              <Badge variant="secondary">
                {pagosProveedor.length} pagos
              </Badge>
            </CardHeader>
            <CardContent>
              {proveedorLoading ? (
                <TableSkeleton rows={6} columns={7} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pago</TableHead>
                      <TableHead>Factura</TableHead>
                      <TableHead>Proveedor</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Medio de pago</TableHead>
                      <TableHead>Referencia</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagosProveedor.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={8}
                          className="h-20 text-center text-muted-foreground"
                        >
                          No hay pagos a proveedores en el rango seleccionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pagosProveedor.map((pago) => (
                        <TableRow key={pago.id_pago}>
                          <TableCell className="font-mono text-xs">
                            {pago.id_pago}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {pago.numero_factura}
                          </TableCell>
                          <TableCell className="font-medium">
                            {pago.proveedor_razon_social}
                          </TableCell>
                          <TableCell>
                            {formatInputDate(pago.fecha_pago)}
                          </TableCell>
                          <TableCell>{pago.medio_pago}</TableCell>
                          <TableCell>{pago.referencia || "-"}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMoney(Number(pago.monto))}
                          </TableCell>
                          <TableCell>
                            <PaymentStatusBadge status={pago.estado} />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      )}

      <RecordPaymentDialog
        invoice={paymentTarget}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
      />

      <SendInvoiceDialog
        invoice={sendTarget}
        open={sendOpen}
        onOpenChange={setSendOpen}
        onSent={handleSent}
      />
    </div>
  );
}

function InvoicesTable({
  invoices,
  onRecordPayment,
  onSend,
}: {
  invoices: Invoice[];
  onRecordPayment: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Comprobante</TableHead>
          <TableHead>Pedido</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Cobrado</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invoices.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={9}
              className="h-24 text-center text-muted-foreground"
            >
              No hay comprobantes emitidos.
            </TableCell>
          </TableRow>
        ) : (
          invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">{invoice.number}</span>
                  <InvoiceTypeBadge type={invoice.type} />
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">
                {invoice.orderNumber}
              </TableCell>
              <TableCell className="font-medium">{invoice.client}</TableCell>
              <TableCell>{invoice.date}</TableCell>
              <TableCell className="text-right">
                {formatMoney(invoice.amount)}
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(invoice.paidAmount)}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatMoney(invoice.balance)}
              </TableCell>
              <TableCell>
                <InvoiceStatusBadge status={invoice.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  {invoice.balance > 0 && invoice.status !== "rechazada" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRecordPayment(invoice)}
                    >
                      <Wallet />
                      Cobrar
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={invoice.sent}
                    onClick={() => onSend(invoice)}
                  >
                    <Send />
                    {invoice.sent ? "Enviado" : "Enviar"}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function PaymentsTable({
  payments,
  emptyText = "No se encontraron pagos.",
}: {
  payments: PaymentTransaction[];
  emptyText?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Comprobante</TableHead>
          <TableHead>Pedido</TableHead>
          <TableHead>Método</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Referencia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={9}
              className="h-24 text-center text-muted-foreground"
            >
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-mono text-xs">{payment.id}</TableCell>
              <TableCell>{payment.date}</TableCell>
              <TableCell className="font-medium">{payment.client}</TableCell>
              <TableCell className="font-mono text-xs">
                {payment.invoiceNumber}
              </TableCell>
              <TableCell className="font-mono text-xs">
                {payment.orderNumber}
              </TableCell>
              <TableCell>
                <MethodBadge label={payment.methodLabel} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatMoney(payment.amount)}
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={payment.status} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {payment.reference || "—"}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function KpiCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
