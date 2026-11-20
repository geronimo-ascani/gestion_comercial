import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Download,
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
import { useCurrentUser } from "../auth/session-store";
import type { Invoice, PaymentTransaction } from "./payments-types";
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

type PaymentTab = "cobros" | "reportes";

interface Feedback {
  type: "success" | "error";
  text: string;
}

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
  const activeTab: PaymentTab =
    requestedTab === "reportes" ? "reportes" : "cobros";

  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<Invoice | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const debouncedQuery = useDebouncedValue(query);

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

  const totals = useMemo(() => {
    const collected = payments
      .filter((payment) => payment.status === "aprobado")
      .reduce((sum, payment) => sum + payment.amount, 0);
    const pending = invoices
      .filter((invoice) => invoice.status !== "rechazada")
      .reduce((sum, invoice) => sum + invoice.balance, 0);
    const byMethod = new Map<string, { label: string; amount: number }>();
    for (const payment of payments) {
      if (payment.status !== "aprobado") continue;
      const entry = byMethod.get(payment.method) ?? {
        label: payment.methodLabel,
        amount: 0,
      };
      entry.amount += payment.amount;
      byMethod.set(payment.method, entry);
    }
    return {
      collected,
      pending,
      byMethod: [...byMethod.entries()].map(([id, value]) => ({
        id,
        ...value,
      })),
    };
  }, [payments, invoices]);

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

  function handleExport() {
    downloadCsv("cobros-pagos.csv", [
      [
        "ID",
        "Fecha",
        "Cliente",
        "Comprobante",
        "Pedido",
        "Método",
        "Monto",
        "Estado",
        "Referencia",
      ],
      ...filteredPayments.map((payment) => [
        payment.id,
        payment.date,
        payment.client,
        payment.invoiceNumber,
        payment.orderNumber,
        payment.methodLabel,
        payment.amount,
        payment.status,
        payment.reference ?? "",
      ]),
    ]);
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
        <Button
          variant={activeTab === "reportes" ? "default" : "outline"}
          className="flex-1 px-6"
          onClick={() => setTab("reportes")}
        >
          Reportes
        </Button>
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
        <KpiCard
          icon={<Wallet className="size-4" />}
          label="Total cobrado"
          value={formatMoney(totals.collected)}
        />
        <KpiCard
          icon={<Clock className="size-4" />}
          label="Pendiente de cobro"
          value={formatMoney(totals.pending)}
        />
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Reportes de cobros y pagos</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Totales por medio de pago y exportación de la lista filtrada.
                </p>
              </div>
              <Button variant="outline" onClick={handleExport}>
                <Download />
                Exportar CSV
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                icon={<Wallet className="size-4" />}
                label="Total cobrado"
                value={formatMoney(totals.collected)}
              />
              {totals.byMethod.map((entry) => (
                <KpiCard
                  key={entry.id}
                  icon={<Wallet className="size-4" />}
                  label={entry.label}
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
              {loading ? (
                <TableSkeleton rows={8} columns={7} />
              ) : (
                <PaymentsTable
                  payments={filteredPayments}
                  emptyText="No hay pagos registrados."
                />
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
