import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import { FileText } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Combobox } from "~/components/ui/combobox";
import { FieldError } from "~/components/ui/field-error";
import { FormPage } from "~/components/ui/form-page";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { formatMoney, parsePercentInput as parseDecimal } from "~/lib/currency";
import { enfocarPrimerCampoInvalido } from "~/lib/focus-invalid-field";
import { useDebouncedValue } from "~/lib/use-debounced-value";

import { useCurrentUser } from "../auth/session-store";
import { listPurchaseOrders } from "./purchases-api";
import type { PurchaseOrder } from "./purchases-types";
import {
  createInvoice,
  defaultDateTimeInput,
  formatInvoiceDateTime,
  toIsoDateTime,
} from "./invoices-api";
import { saveInvoice } from "./invoices-store";
import type { InvoicePayload, SupplierInvoiceDetail } from "./invoices-types";

const MAX_ARCHIVO_BYTES = 3 * 1024 * 1024;
const MIME_POR_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const CAMPOS_VALIDACION = [
  { key: "pedido", elementId: "invoice-pedido" },
  { key: "fechaEmision", elementId: "invoice-fecha-emision" },
  { key: "fechaVence", elementId: "invoice-fecha-vence" },
  { key: "total", elementId: "invoice-total" },
  { key: "archivo", elementId: "invoice-archivo" },
] as const;

function decimal(value: string): string {
  return parseDecimal(value).toFixed(2);
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function InvoiceFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentUser = useCurrentUser();

  const [pedido, setPedido] = useState(searchParams.get("pedido") ?? "");
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [orderSearch, setOrderSearch] = useState("");
  const [loadingOrders, setLoadingOrders] = useState(true);
  const debouncedOrderSearch = useDebouncedValue(orderSearch, 300);

  const [fechaEmision, setFechaEmision] = useState(defaultDateTimeInput());
  const [fechaVence, setFechaVence] = useState(defaultDateTimeInput(30));
  const [total, setTotal] = useState("");

  const [archivo, setArchivo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<SupplierInvoiceDetail | null>(null);

  const canCreate = ["administrador", "abastecimiento"].includes(
    currentUser?.role ?? ""
  );

  useEffect(() => {
    let active = true;
    setLoadingOrders(true);
    void listPurchaseOrders(debouncedOrderSearch)
      .then((pedidos) => {
        if (!active) return;
        setOrders(pedidos);
        setSelectedOrder((previous: PurchaseOrder | null) =>
          previous ?? pedidos.find((item) => item.number === pedido) ?? null
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "No se pudieron cargar las órdenes de compra."
          );
        }
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });
    return () => {
      active = false;
    };
  }, [debouncedOrderSearch, pedido]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const orderOptions = useMemo(() => {
    const options = orders.map((order) => ({
      value: order.number,
      label: `${order.number} · ${order.provider}`,
      description: order.date,
      keywords: [order.number, order.provider, order.total],
    }));
    if (
      selectedOrder &&
      !options.some((option) => option.value === selectedOrder.number)
    ) {
      options.unshift({
        value: selectedOrder.number,
        label: `${selectedOrder.number} · ${selectedOrder.provider}`,
        description: "Seleccionada",
        keywords: [selectedOrder.number, selectedOrder.provider],
      });
    }
    return options;
  }, [orders, selectedOrder]);

  function setField(
    field: string,
    value: string,
    setter: (value: string) => void
  ) {
    setter(value);
    setErrors((previous) => ({ ...previous, [field]: null }));
    setSubmitError(null);
  }

  function seleccionarPedido(value: string) {
    setPedido(value);
    setSelectedOrder(orders.find((order) => order.number === value) ?? null);
    setErrors((previous) => ({ ...previous, pedido: null }));
    setSubmitError(null);
  }

  function procesarArchivo(file: File | undefined | null) {
    setErrors((previous) => ({ ...previous, archivo: null }));
    setSubmitError(null);
    if (!file) {
      setArchivo(null);
      setPreviewUrl("");
      return;
    }

    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    const mimeEsperado = MIME_POR_EXTENSION[extension];
    if (!mimeEsperado || file.type !== mimeEsperado) {
      setArchivo(null);
      setPreviewUrl("");
      setErrors((previous) => ({
        ...previous,
        archivo: "Seleccione un archivo PDF o JPG válido.",
      }));
      return;
    }
    if (file.size === 0 || file.size > MAX_ARCHIVO_BYTES) {
      setArchivo(null);
      setPreviewUrl("");
      setErrors((previous) => ({
        ...previous,
        archivo: "El archivo debe tener entre 1 byte y 3 MB.",
      }));
      return;
    }

    setArchivo(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    const ahora = defaultDateTimeInput();
    const nextErrors: Record<string, string | null> = {
      pedido: pedido ? null : "Seleccione una orden de compra",
      fechaEmision: !fechaEmision
        ? "Ingrese la fecha de emisión"
        : fechaEmision > ahora
          ? "La fecha de emisión no puede ser futura"
          : null,
      fechaVence:
        fechaVence && fechaVence >= fechaEmision
          ? null
          : "La fecha de vencimiento debe ser posterior a la emisión",
      total: total.trim() && parseDecimal(total) >= 0 ? null : "Ingrese el total",
      archivo: archivo ? null : "Adjunte el PDF o JPG de la factura",
    };
    setErrors(nextErrors);
    enfocarPrimerCampoInvalido(nextErrors, CAMPOS_VALIDACION);
    if (Object.values(nextErrors).some(Boolean) || !archivo) return;

    const payload: InvoicePayload = {
      id_pedido_proveedor: pedido,
      fecha_emision: toIsoDateTime(fechaEmision),
      fecha_vence: toIsoDateTime(fechaVence),
      total: decimal(total),
    };

    setSubmitting(true);
    try {
      const factura = await createInvoice(payload, archivo);
      saveInvoice(factura);
      setCreated(factura);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "No se pudo guardar la factura."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!canCreate) {
    return <Navigate to="/purchases/invoices" replace />;
  }

  if (created) {
    return (
      <FormPage
        backLabel="Volver al listado"
        backTo="/purchases/invoices"
        title="Factura registrada"
        description="El comprobante y su archivo quedaron guardados de forma inmutable."
      >
        <Card>
          <CardHeader>
            <CardTitle>
              Factura {created.numeroCompleto || created.id} · {created.proveedorRazonSocial}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-muted-foreground">Archivo</dt>
                <dd className="font-medium">{created.archivoNombre}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Tipo</dt>
                <dd className="font-medium">{created.tipoComprobante}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Total</dt>
                <dd className="font-medium tabular-nums">{formatMoney(created.total)}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Saldo pendiente</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(created.saldoPendiente)}
                </dd>
              </div>
            </dl>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => navigate("/purchases/invoices")}>
              Volver al listado
            </Button>
            <Button onClick={() => navigate(`/purchases/invoices/${created.id}`)}>
              Ver detalle
            </Button>
          </CardFooter>
        </Card>
      </FormPage>
    );
  }

  return (
    <FormPage
      backLabel="Volver al listado"
      backTo="/purchases/invoices"
      title="Nueva factura de proveedor"
      description="Cargue el PDF/JPG recibido y transcriba solo los datos que se muestran en el listado."
    >
      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Datos de la factura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoice-pedido">Orden de compra</Label>
                <Combobox
                  id="invoice-pedido"
                  value={pedido}
                  onValueChange={seleccionarPedido}
                  options={orderOptions}
                  placeholder={
                    loadingOrders ? "Cargando órdenes…" : "Buscar orden de compra…"
                  }
                  searchPlaceholder="Buscar por número o proveedor…"
                  searchValue={orderSearch}
                  onSearchChange={setOrderSearch}
                  ariaInvalid={!!errors.pedido}
                />
                <p className="text-xs text-muted-foreground">
                  El proveedor se deriva de la orden elegida. La búsqueda filtra por
                  número, proveedor o total.
                </p>
                <FieldError message={errors.pedido} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Proveedor</Label>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  {selectedOrder?.provider ?? "Seleccione una orden de compra"}
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Número de factura</Label>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  Se genera automáticamente al guardar (FP-####)
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-fecha-emision">Fecha de emisión</Label>
                <Input
                  id="invoice-fecha-emision"
                  type="datetime-local"
                  value={fechaEmision}
                  max={defaultDateTimeInput()}
                  onChange={(event) =>
                    setField("fechaEmision", event.target.value, setFechaEmision)
                  }
                  aria-invalid={!!errors.fechaEmision}
                />
                <FieldError message={errors.fechaEmision} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice-fecha-vence">Fecha de vencimiento</Label>
                <Input
                  id="invoice-fecha-vence"
                  type="datetime-local"
                  value={fechaVence}
                  onChange={(event) =>
                    setField("fechaVence", event.target.value, setFechaVence)
                  }
                  aria-invalid={!!errors.fechaVence}
                />
                <FieldError message={errors.fechaVence} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="invoice-total">Total</Label>
                <Input
                  id="invoice-total"
                  inputMode="decimal"
                  value={total}
                  onChange={(event) => setField("total", event.target.value, setTotal)}
                  placeholder="0.00"
                  aria-invalid={!!errors.total}
                />
                <FieldError message={errors.total} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vista previa en el listado</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Número</dt>
                <dd className="font-medium">Se genera al guardar</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Proveedor</dt>
                <dd className="font-medium">{selectedOrder?.provider ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Orden</dt>
                <dd className="font-medium">{pedido || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Emisión</dt>
                <dd>{formatInvoiceDateTime(fechaEmision)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vencimiento</dt>
                <dd>{formatInvoiceDateTime(fechaVence)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>Según condiciones de IVA</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium tabular-nums">{formatMoney(parseDecimal(total))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Saldo</dt>
                <dd className="font-medium tabular-nums">{formatMoney(parseDecimal(total))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Estado</dt>
                <dd>Emitida</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Archivo del comprobante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="rounded-lg border border-dashed p-6 text-center"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                procesarArchivo(event.dataTransfer.files?.[0]);
              }}
            >
              <FileText className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                Arrastre el PDF o JPG, o seleccione el archivo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF o JPG · máximo 3 MB
              </p>
              <Input
                id="invoice-archivo"
                type="file"
                className="mx-auto mt-4 max-w-sm"
                accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                onChange={(event) => procesarArchivo(event.target.files?.[0])}
                aria-invalid={!!errors.archivo}
              />
              <FieldError message={errors.archivo} />
            </div>

            {archivo && previewUrl && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{archivo.name}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {tamanoLegible(archivo.size)}
                  </span>
                </div>
                {archivo.type === "application/pdf" ? (
                  <iframe
                    title="Vista previa de la factura"
                    src={previewUrl}
                    className="h-96 w-full rounded border bg-white"
                  />
                ) : (
                  <img
                    alt="Vista previa de la factura"
                    src={previewUrl}
                    className="mx-auto max-h-96 rounded border object-contain"
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {submitError && (
          <p role="alert" className="text-sm text-destructive">
            {submitError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/purchases/invoices")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Guardando…" : "Guardar factura"}
          </Button>
        </div>
      </form>
    </FormPage>
  );
}
