import { useMemo, useState } from "react";
import { CheckCheck, Download, Pencil, Search, Wallet } from "lucide-react";
import { useSearchParams } from "react-router";

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
import { useInitialLoading } from "~/lib/use-initial-loading";
import { useDebouncedValue } from "~/lib/use-debounced-value";
import { formatMoney } from "~/lib/currency";
import { useCurrentUser } from "../auth/session-store";
import type { PaymentMethod, PaymentTransaction } from "./payments-types";
import { paymentMethodLabels } from "./payments-types";
import {
  reconcilePayments,
  useInvoices,
  usePayments,
  type ReconciliationSummary,
} from "./payments-store";
import {
  ConciliationBadge,
  InvoiceStatusBadge,
  MethodBadge,
} from "./payments-views";
import { ReconcilePaymentDialog } from "./reconcile-payment-dialog";

type PaymentTab = "cobros" | "conciliacion" | "reportes";

const methodOptions: PaymentMethod[] = ["efectivo", "tarjeta", "mercadopago"];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");
  const blob = new Blob([`\ufeff${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function PaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const user = useCurrentUser();
  const isAdmin = user?.role === "administrador";
  const loading = useInitialLoading();
  const invoices = useInvoices();
  const payments = usePayments();

  const activeTab: PaymentTab =
    requestedTab === "conciliacion" && isAdmin
      ? "conciliacion"
      : requestedTab === "reportes" && isAdmin
        ? "reportes"
        : "cobros";

  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<"all" | PaymentMethod>("all");
  const [conciliationFilter, setConciliationFilter] = useState<
    "all" | "conciliado" | "pendiente"
  >("all");
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [reconcileTarget, setReconcileTarget] =
    useState<PaymentTransaction | null>(null);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query);

  const filteredPayments = payments.filter((payment) => {
    const haystack =
      `${payment.id} ${payment.client} ${payment.invoiceNumber} ${payment.orderNumber} ${payment.gatewayReference ?? ""}`.toLowerCase();
    const matchesQuery = haystack.includes(debouncedQuery.trim().toLowerCase());
    const matchesMethod =
      methodFilter === "all" || payment.method === methodFilter;
    const matchesConciliation =
      conciliationFilter === "all" ||
      payment.conciliationStatus === conciliationFilter;
    return matchesQuery && matchesMethod && matchesConciliation;
  });

  const totals = useMemo(() => {
    const collected = payments
      .filter((payment) => payment.status === "aprobado")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pending = invoices
      .filter((invoice) => invoice.status !== "pagada")
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const byMethod = methodOptions.map((method) => ({
      method,
      amount: payments
        .filter(
          (payment) => payment.status === "aprobado" && payment.method === method
        )
        .reduce((sum, payment) => sum + payment.amount, 0),
    }));
    return { collected, pending, byMethod };
  }, [payments, invoices]);

  const pendingVirtual = payments.filter(
    (payment) =>
      payment.conciliationStatus === "pendiente" && payment.status === "aprobado"
  );
  const pendingInvoices = invoices.filter(
    (invoice) => invoice.status === "emitida" || invoice.status === "aprobada"
  );

  function setTab(tab: PaymentTab) {
    setSearchParams({ tab }, { replace: true });
  }

  function handleReconcile() {
    setSummary(reconcilePayments());
  }

  function openReconcile(payment: PaymentTransaction) {
    setReconcileTarget(payment);
    setReconcileOpen(true);
  }

  function handleExport() {
    downloadCsv("cobros-pagos.csv", [
      [
        "ID",
        "Fecha",
        "Cliente",
        "Pedido",
        "Método",
        "Monto",
        "Conciliación",
        "Referencia",
      ],
      ...filteredPayments.map((payment) => [
        payment.id,
        payment.date,
        payment.client,
        payment.orderNumber,
        paymentMethodLabels[payment.method],
        payment.amount,
        payment.conciliationStatus,
        payment.gatewayReference ?? "",
      ]),
    ]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>
          <p className="text-muted-foreground">
            Cobros, conciliación de facturas y reportes.
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="flex w-full gap-2 lg:w-fit">
          <Button
            variant={activeTab === "conciliacion" ? "default" : "outline"}
            className="flex-1 px-4"
            onClick={() =>
              setTab(activeTab === "conciliacion" ? "cobros" : "conciliacion")
            }
          >
            Conciliación
          </Button>
          <Button
            variant={activeTab === "reportes" ? "default" : "outline"}
            className="flex-1 px-4"
            onClick={() =>
              setTab(activeTab === "reportes" ? "cobros" : "reportes")
            }
          >
            Reportes
          </Button>
        </div>
      )}

      {activeTab !== "conciliacion" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <KpiCard label="Total cobrado" value={formatMoney(totals.collected)} />
          <KpiCard
            label="Pendiente de cobro"
            value={formatMoney(totals.pending)}
          />
        </div>
      )}

      {activeTab === "cobros" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 w-full bg-card pl-10 shadow-sm"
                placeholder="Buscar por cliente, venta o referencia..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-2">
                <Label htmlFor="payment-method-filter">Método</Label>
                <Select
                  items={{ all: "Todos" }}
                  value={methodFilter}
                  onValueChange={(value) =>
                    setMethodFilter(value as "all" | PaymentMethod)
                  }
                >
                  <SelectTrigger id="payment-method-filter" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {methodOptions.map((method) => (
                      <SelectItem key={method} value={method}>
                        {paymentMethodLabels[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-conciliation-filter">Conciliación</Label>
                <Select
                  items={{ all: "Todos" }}
                  value={conciliationFilter}
                  onValueChange={(value) =>
                    setConciliationFilter(
                      value as "all" | "conciliado" | "pendiente"
                    )
                  }
                >
                  <SelectTrigger
                    id="payment-conciliation-filter"
                    className="w-40"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="conciliado">Conciliado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pagos registrados</CardTitle>
              <Badge variant="secondary">{payments.length} pagos</Badge>
            </CardHeader>
            <CardContent>
              {loading ? (
                <TableSkeleton rows={6} columns={8} />
              ) : (
                <PaymentsTable
                  payments={filteredPayments}
                  onReconcile={openReconcile}
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

      {activeTab === "conciliacion" && isAdmin && (
        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Conciliación automática</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Empareja los cobros virtuales con las ventas pendientes por
                  cliente y monto.
                </p>
              </div>
              <Button onClick={handleReconcile}>
                <CheckCheck />
                Conciliar pagos
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Pagos por conciliar"
                value={String(pendingVirtual.length)}
              />
              <KpiCard
                label="Ventas pendientes"
                value={String(pendingInvoices.length)}
              />
              <KpiCard
                label="Última conciliación"
                value={summary ? `${summary.matched} pagos` : "—"}
              />
            </CardContent>
            {summary && (
              <CardFooter className="text-sm text-muted-foreground">
                Se conciliaron {summary.matched} pagos por{" "}
                {formatMoney(summary.matchedAmount)}. Quedan {summary.remaining}{" "}
                pagos sin conciliar.
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cobros virtuales pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentsTable
                payments={pendingVirtual}
                onReconcile={openReconcile}
                emptyText="No hay cobros pendientes de conciliar."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ventas pendientes de pago</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingInvoices.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No hay ventas pendientes.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvoices.map((invoice) => (
                      <TableRow key={invoice.number}>
                        <TableCell className="font-mono text-xs">
                          {invoice.orderNumber}
                        </TableCell>
                        <TableCell className="font-medium">
                          {invoice.client}
                        </TableCell>
                        <TableCell>{invoice.date}</TableCell>
                        <TableCell className="text-right">
                          {formatMoney(invoice.amount)}
                        </TableCell>
                        <TableCell>
                          <InvoiceStatusBadge status={invoice.status} />
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

      {activeTab === "reportes" && isAdmin && (
        <section className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Reportes de cobros y pagos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Totales por método de pago y exportación de la lista filtrada.
                </p>
              </div>
              <Button variant="outline" onClick={handleExport}>
                <Download />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-4">
              <KpiCard
                label="Total cobrado"
                value={formatMoney(totals.collected)}
              />
              {totals.byMethod.map((entry) => (
                <KpiCard
                  key={entry.method}
                  label={paymentMethodLabels[entry.method]}
                  value={formatMoney(entry.amount)}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <PaymentsTable
                payments={payments}
                emptyText="No hay pagos registrados."
              />
            </CardContent>
          </Card>
        </section>
      )}

      <ReconcilePaymentDialog
        payment={reconcileTarget}
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
      />
    </div>
  );
}

function PaymentsTable({
  payments,
  onReconcile,
  emptyText = "No se encontraron pagos.",
}: {
  payments: ReturnType<typeof usePayments>;
  onReconcile?: (payment: PaymentTransaction) => void;
  emptyText?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ID</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Pedido</TableHead>
          <TableHead>Método</TableHead>
          <TableHead className="text-right">Monto</TableHead>
          <TableHead>Conciliación</TableHead>
          {onReconcile && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={onReconcile ? 8 : 7}
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
                {payment.orderNumber}
              </TableCell>
              <TableCell>
                <MethodBadge method={payment.method} />
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatMoney(payment.amount)}
              </TableCell>
              <TableCell>
                <ConciliationBadge status={payment.conciliationStatus} />
              </TableCell>
              {onReconcile && (
                <TableCell className="text-right">
                  {payment.conciliationStatus === "pendiente" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onReconcile(payment)}
                    >
                      <Pencil />
                      Modificar
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Wallet className="size-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}