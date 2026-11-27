import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { CheckCircle2, Download, FileText, Plus } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
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
import {
  loadPaymentMethods,
  usePaymentMethods,
  usePaymentMethodsLoading,
} from "../payments/payment-methods-store";
import { useCurrentUser } from "../auth/session-store";
import { formatMoney, parsePercentInput as parseDecimal } from "~/lib/currency";

import {
  addInvoicePayment,
  getCachedInvoiceDetail,
  loadInvoiceDetail,
  updateInvoicePaymentStatus,
} from "./invoices-store";
import {
  downloadInvoiceFile,
  formatInvoiceDate,
  formatInvoiceDateTime,
  formatInvoiceFileSize,
  openInvoiceFile,
} from "./invoices-api";
import type {
  InvoicePagoEstado,
  InvoicePaymentPayload,
  SupplierInvoiceDetail,
} from "./invoices-types";
import { InvoiceStatusBadge } from "./invoices-views";

function todayInput(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function Amount({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={
          highlight ? "text-lg font-semibold tabular-nums" : "font-medium tabular-nums"
        }
      >
        {formatMoney(value)}
      </dd>
    </div>
  );
}

export function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const paymentMethods = usePaymentMethods();
  const methodsLoading = usePaymentMethodsLoading();
  const [invoice, setInvoice] = useState<SupplierInvoiceDetail | null>(() =>
    id ? (getCachedInvoiceDetail(id) ?? null) : null
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [estado, setEstado] = useState<InvoicePagoEstado>("aprobado");
  const [fechaPago, setFechaPago] = useState(todayInput());
  const [paying, setPaying] = useState(false);
  const [changingPayment, setChangingPayment] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const canManage = ["administrador", "abastecimiento"].includes(
    currentUser?.role ?? ""
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    void loadInvoiceDetail(id, true)
      .then((detail) => {
        if (active) {
          setInvoice(detail);
          setAmount(detail.saldoPendiente.toFixed(2));
          setLoadError(null);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "No se pudo cargar la factura."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    void loadPaymentMethods().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (method || paymentMethods.length === 0) return;
    setMethod(paymentMethods[0].id);
  }, [method, paymentMethods]);

  async function registrarPago(payload: InvoicePaymentPayload): Promise<boolean> {
    if (!id) return false;
    setPaymentError(null);
    setPaying(true);
    try {
      await addInvoicePayment(id, payload);
      setInvoice(await loadInvoiceDetail(id, true));
      return true;
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "No se pudo registrar el pago."
      );
      return false;
    } finally {
      setPaying(false);
    }
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invoice) return;

    const monto = parseDecimal(amount);
    if (!method) {
      setPaymentError("Seleccione un medio de pago.");
      return;
    }
    if (monto <= 0) {
      setPaymentError("Ingrese un monto mayor que cero.");
      return;
    }
    if (estado === "aprobado" && monto > invoice.saldoPendiente + 0.001) {
      setPaymentError(
        `El monto no puede superar el saldo pendiente (${formatMoney(invoice.saldoPendiente)}).`
      );
      return;
    }

    const guardado = await registrarPago({
      id_medio_pago: method,
      monto: monto.toFixed(2),
      referencia: reference.trim() || undefined,
      estado,
      fecha_pago: fechaPago || undefined,
    });
    if (guardado) setReference("");
  }

  async function handlePaymentStatus(
    idPago: string,
    estadoPago: "aprobado" | "rechazado"
  ) {
    if (!id) return;
    setPaymentError(null);
    setChangingPayment(idPago);
    try {
      await updateInvoicePaymentStatus(id, idPago, estadoPago);
      setInvoice(await loadInvoiceDetail(id, true));
    } catch (error) {
      setPaymentError(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el estado del pago."
      );
    } finally {
      setChangingPayment(null);
    }
  }

  async function handleMarkPaid() {
    if (!invoice || invoice.saldoPendiente <= 0) return;
    const medio = method || paymentMethods[0]?.id;
    if (!medio) {
      setPaymentError(
        "No hay medios de pago disponibles. Cree uno desde el catálogo de medios de pago."
      );
      return;
    }
    if (!method) setMethod(medio);
    const guardado = await registrarPago({
      id_medio_pago: medio,
      monto: invoice.saldoPendiente.toFixed(2),
      referencia: "Marcada como pagada",
      estado: "aprobado",
      fecha_pago: fechaPago || undefined,
    });
    if (guardado) setAmount("0.00");
  }

  if (!canManage) {
    return <Navigate to="/purchases/invoices" replace />;
  }

  if (loading && !invoice) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando factura…
      </p>
    );
  }

  if (!invoice) {
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-destructive">
          {loadError ?? "No se encontró la factura."}
        </p>
        <Button variant="outline" onClick={() => navigate("/purchases/invoices")}>
          Volver al listado
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/purchases/invoices"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Volver al listado
          </Link>
          <h1 className="mt-2 text-3xl font-bold">
            Factura {invoice.numeroCompleto || invoice.id}
          </h1>
          <p className="text-muted-foreground">
            {invoice.proveedorRazonSocial} · Orden {invoice.idPedidoProveedor}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InvoiceStatusBadge status={invoice.estadoPago} />
          <Badge variant="outline">Tipo {invoice.tipoComprobante}</Badge>
          {canManage &&
            invoice.estadoPago === "emitida" &&
            invoice.saldoPendiente > 0 && (
              <Button
                variant="secondary"
                onClick={() => void handleMarkPaid()}
                disabled={paying || methodsLoading}
                title={`Registrar un pago por ${formatMoney(invoice.saldoPendiente)}`}
              >
                <CheckCircle2 />
                Marcar como pagada
              </Button>
            )}
          <Button onClick={() => navigate("/purchases/invoices/new")}>
            <Plus />
            Nueva factura
          </Button>
        </div>
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-destructive">
          {loadError}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Comprobante adjunto</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">
              {invoice.archivoNombre || "Archivo de la factura"}
            </p>
            <p className="text-xs text-muted-foreground">
              {invoice.archivoMimeType || "PDF/JPG"} ·{" "}
              {formatInvoiceFileSize(invoice.archivoTamanio)}
            </p>
          </div>
          {invoice.tieneArchivo && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setFileError(null);
                  void openInvoiceFile(invoice.id).catch((error: unknown) => {
                    setFileError(
                      error instanceof Error
                        ? error.message
                        : "No se pudo abrir el archivo."
                    );
                  });
                }}
              >
                <FileText />
                Ver
              </Button>
              <Button
                variant="ghost"
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
                <Download />
                Descargar
              </Button>
            </>
          )}
        </CardContent>
        {fileError && (
          <p role="alert" className="px-6 pb-4 text-sm text-destructive">
            {fileError}
          </p>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <Amount label="Total" value={invoice.total} highlight />
              <Amount label="Saldo pendiente" value={invoice.saldoPendiente} highlight />
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Emisión: {formatInvoiceDateTime(invoice.fechaEmision)} · Vencimiento:{" "}
              {formatInvoiceDateTime(invoice.fechaVence)}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Emisor (proveedor)</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Razón social</dt>
                  <dd className="font-medium">{invoice.proveedorRazonSocial}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">CUIT</dt>
                  <dd>{invoice.proveedorCuit}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Condición de IVA</dt>
                  <dd>{invoice.proveedorCondicionIva}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Domicilio</dt>
                  <dd>{invoice.proveedorDomicilio}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Receptor (empresa)</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Razón social</dt>
                  <dd className="font-medium">{invoice.empresaRazonSocial}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">CUIT</dt>
                  <dd>{invoice.empresaCuit}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Condición de IVA</dt>
                  <dd>{invoice.empresaCondicionIva}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Domicilio</dt>
                  <dd>{invoice.empresaDomicilio}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Medio de pago</TableHead>
                <TableHead>Referencia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.pagos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No hay pagos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                invoice.pagos.map((pago) => (
                  <TableRow key={pago.id}>
                    <TableCell>{formatInvoiceDate(pago.fechaPago)}</TableCell>
                    <TableCell>{pago.medioPago}</TableCell>
                    <TableCell>{pago.referencia || "—"}</TableCell>
                    <TableCell>{pago.estado}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(pago.monto)}
                    </TableCell>
                    <TableCell className="text-right">
                      {pago.estado === "pendiente" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            disabled={changingPayment === pago.id}
                            onClick={() => void handlePaymentStatus(pago.id, "aprobado")}
                          >
                            Aprobar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={changingPayment === pago.id}
                            onClick={() => void handlePaymentStatus(pago.id, "rechazado")}
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar pago</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={handlePayment}>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-method">Medio de pago</Label>
              <Select
                value={method}
                items={Object.fromEntries(
                  paymentMethods.map((item) => [item.id, item.label])
                )}
                onValueChange={(value) => setMethod(value ?? "")}
                disabled={paying || methodsLoading}
              >
                <SelectTrigger id="invoice-payment-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-amount">Monto</Label>
              <Input
                id="invoice-payment-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={paying}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-reference">Referencia</Label>
              <Input
                id="invoice-payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                disabled={paying}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-estado">Estado</Label>
              <Select
                value={estado}
                onValueChange={(value) =>
                  setEstado((value ?? "aprobado") as InvoicePagoEstado)
                }
              >
                <SelectTrigger id="invoice-payment-estado" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-payment-fecha">Fecha de pago</Label>
              <Input
                id="invoice-payment-fecha"
                type="date"
                value={fechaPago}
                max={todayInput()}
                onChange={(event) => setFechaPago(event.target.value)}
                disabled={paying}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={paying || invoice.saldoPendiente <= 0}>
                {paying ? "Guardando…" : "Registrar pago"}
              </Button>
            </div>
            {paymentError && (
              <p role="alert" className="text-sm text-destructive sm:col-span-2">
                {paymentError}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
