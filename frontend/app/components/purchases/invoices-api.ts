import { apiFetchBlob, apiRequest } from "~/lib/api";

import type {
  InvoiceEstadoPago,
  InvoicePago,
  InvoiceTipoComprobante,
  SupplierInvoiceDetail,
  SupplierInvoiceSummary,
  InvoiceFilters,
  InvoicePayload,
  InvoicePaymentPayload,
} from "./invoices-types";

interface InvoiceResumenApi {
  id_factura_proveedor: string;
  numero_comprobante: string;
  numero_completo: string;
  tipo_comprobante: InvoiceTipoComprobante;
  estado_pago: InvoiceEstadoPago;
  fecha_emision: string;
  fecha_vence: string;
  total: string | number;
  saldo_pendiente: string | number;
  id_empresa: string;
  id_proveedor: string;
  proveedor_razon_social: string;
  id_pedido_proveedor: string;
  archivo_nombre: string | null;
  archivo_mime_type: string | null;
  archivo_tamanio: number | null;
  archivo_url: string;
  tiene_archivo: boolean;
}

interface InvoicePagoApi {
  id_pago: string;
  estado: InvoicePago["estado"];
  fecha_pago: string;
  monto: string | number;
  referencia: string;
  id_medio_pago: string;
  medio_pago: string;
  creado_en: string;
  id_comprobante_venta: string | null;
  id_factura_proveedor: string | null;
  tipo_pago: "pago" | null;
}

interface InvoiceDetalleApi extends InvoiceResumenApi {
  creado_en: string;
  proveedor_cuit: string;
  proveedor_domicilio: string;
  proveedor_condicion_iva: string;
  empresa_razon_social: string;
  empresa_cuit: string;
  empresa_domicilio: string;
  empresa_condicion_iva: string;
  pagos: InvoicePagoApi[];
}

/** Los importes Decimal llegan como string o número; la UI trabaja con number. */
function importe(valor: string | number | null | undefined): number {
  const resultado = Number(valor ?? 0);
  return Number.isFinite(resultado) ? resultado : 0;
}

export function mapInvoiceResumen(factura: InvoiceResumenApi): SupplierInvoiceSummary {
  return {
    id: factura.id_factura_proveedor,
    numeroComprobante: factura.numero_comprobante,
    numeroCompleto: factura.numero_completo,
    tipoComprobante: factura.tipo_comprobante,
    estadoPago: factura.estado_pago,
    fechaEmision: factura.fecha_emision,
    fechaVence: factura.fecha_vence,
    total: importe(factura.total),
    saldoPendiente: importe(factura.saldo_pendiente),
    idEmpresa: factura.id_empresa,
    idProveedor: factura.id_proveedor,
    proveedorRazonSocial: factura.proveedor_razon_social,
    idPedidoProveedor: factura.id_pedido_proveedor,
    archivoNombre: factura.archivo_nombre ?? "",
    archivoMimeType: factura.archivo_mime_type ?? "",
    archivoTamanio: importe(factura.archivo_tamanio),
    archivoUrl: factura.archivo_url,
    tieneArchivo: factura.tiene_archivo,
  };
}

export function mapInvoicePago(pago: InvoicePagoApi): InvoicePago {
  return {
    id: pago.id_pago,
    estado: pago.estado,
    fechaPago: pago.fecha_pago,
    monto: importe(pago.monto),
    referencia: pago.referencia ?? "",
    idMedioPago: pago.id_medio_pago,
    medioPago: pago.medio_pago,
    creadoEn: pago.creado_en,
    idFacturaProveedor: pago.id_factura_proveedor ?? "",
    tipoPago: pago.tipo_pago ?? null,
  };
}

export function mapInvoiceDetalle(factura: InvoiceDetalleApi): SupplierInvoiceDetail {
  return {
    ...mapInvoiceResumen(factura),
    creadoEn: factura.creado_en,
    proveedorCuit: factura.proveedor_cuit,
    proveedorDomicilio: factura.proveedor_domicilio,
    proveedorCondicionIva: factura.proveedor_condicion_iva,
    empresaRazonSocial: factura.empresa_razon_social,
    empresaCuit: factura.empresa_cuit,
    empresaDomicilio: factura.empresa_domicilio,
    empresaCondicionIva: factura.empresa_condicion_iva,
    pagos: (factura.pagos ?? []).map(mapInvoicePago),
  };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listInvoices(
  filtros: InvoiceFilters = {}
): Promise<SupplierInvoiceSummary[]> {
  const query = buildQuery({
    estado_pago: filtros.estadoPago,
    id_pedido_proveedor: filtros.idPedidoProveedor,
    id_proveedor: filtros.idProveedor,
    q: filtros.q?.trim() || undefined,
    limit: filtros.limit,
    offset: filtros.offset,
  });
  const facturas = await apiRequest<InvoiceResumenApi[]>(`/compras/facturas${query}`);
  return facturas.map(mapInvoiceResumen);
}

export async function getInvoice(id: string): Promise<SupplierInvoiceDetail> {
  const factura = await apiRequest<InvoiceDetalleApi>(
    `/compras/facturas/${encodeURIComponent(id)}`
  );
  return mapInvoiceDetalle(factura);
}

export async function listInvoicesForOrder(
  idPedidoProveedor: string
): Promise<SupplierInvoiceSummary[]> {
  const facturas = await apiRequest<InvoiceResumenApi[]>(
    `/compras/pedidos/${encodeURIComponent(idPedidoProveedor)}/facturas`
  );
  return facturas.map(mapInvoiceResumen);
}

export async function listInvoicePayments(
  id: string
): Promise<InvoicePago[]> {
  const pagos = await apiRequest<InvoicePagoApi[]>(
    `/compras/facturas/${encodeURIComponent(id)}/pagos`
  );
  return pagos.map(mapInvoicePago);
}

export async function createInvoice(
  payload: InvoicePayload,
  archivo: File
): Promise<SupplierInvoiceDetail> {
  const body = new FormData();
  body.append("metadata", JSON.stringify(payload));
  body.append("archivo", archivo, archivo.name);
  const factura = await apiRequest<InvoiceDetalleApi>("/compras/facturas", {
    method: "POST",
    body,
  });
  return mapInvoiceDetalle(factura);
}

function abrirBlob(
  blob: Blob,
  filename: string,
  modo: "ver" | "descargar"
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener,noreferrer";
  if (modo === "descargar") {
    link.download = filename;
  } else {
    link.target = "_blank";
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), modo === "ver" ? 60000 : 1000);
}

async function obtenerArchivo(
  id: string
): Promise<{ blob: Blob; filename: string }> {
  const { blob, filename } = await apiFetchBlob(
    `/compras/facturas/${encodeURIComponent(id)}/archivo`
  );
  return { blob, filename };
}

/** Abre el comprobante en una pestaña nueva con la autorización de la API. */
export async function openInvoiceFile(id: string): Promise<void> {
  const { blob, filename } = await obtenerArchivo(id);
  abrirBlob(blob, filename, "ver");
}

export async function downloadInvoiceFile(id: string): Promise<void> {
  const { blob, filename } = await obtenerArchivo(id);
  abrirBlob(blob, filename, "descargar");
}

export async function registerInvoicePayment(
  id: string,
  payload: InvoicePaymentPayload
): Promise<InvoicePago> {
  const pago = await apiRequest<InvoicePagoApi>(
    `/compras/facturas/${encodeURIComponent(id)}/pagos`,
    { method: "POST", body: JSON.stringify(payload) }
  );
  return mapInvoicePago(pago);
}

export function formatInvoiceFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatInvoiceDateTime(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatInvoiceDate(value: string): string {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return formatInvoiceDateTime(value);
}

/** Convierte un valor `datetime-local` en un ISO datetime aceptado por la API. */
export function toIsoDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function dateTimeInput(date: Date): string {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultDateTimeInput(daysFromNow = 0): string {
  const date = new Date();
  if (daysFromNow) date.setDate(date.getDate() + daysFromNow);
  return dateTimeInput(date);
}
