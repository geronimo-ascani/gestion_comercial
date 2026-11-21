export type InvoiceEstadoPago = "emitida" | "pagada";
export type InvoiceTipoComprobante = "A" | "B" | "C" | "E";
export type InvoicePagoEstado = "aprobado" | "pendiente" | "rechazado";

export interface InvoicePago {
  id: string;
  estado: InvoicePagoEstado;
  fechaPago: string;
  monto: number;
  referencia: string;
  idMedioPago: string;
  medioPago: string;
  creadoEn: string;
  idFacturaProveedor: string;
  tipoPago: "pago" | null;
}

export interface SupplierInvoiceSummary {
  id: string;
  numeroComprobante: string;
  numeroCompleto: string;
  tipoComprobante: InvoiceTipoComprobante;
  estadoPago: InvoiceEstadoPago;
  fechaEmision: string;
  fechaVence: string;
  total: number;
  saldoPendiente: number;
  idEmpresa: string;
  idProveedor: string;
  proveedorRazonSocial: string;
  idPedidoProveedor: string;
  archivoNombre: string;
  archivoMimeType: string;
  archivoTamanio: number;
  archivoUrl: string;
  tieneArchivo: boolean;
}

export interface SupplierInvoiceDetail extends SupplierInvoiceSummary {
  creadoEn: string;
  proveedorCuit: string;
  proveedorDomicilio: string;
  proveedorCondicionIva: string;
  empresaRazonSocial: string;
  empresaCuit: string;
  empresaDomicilio: string;
  empresaCondicionIva: string;
  pagos: InvoicePago[];
}

/** Metadatos visibles en el listado, transcritos del PDF/JPG. */
export interface InvoicePayload {
  id_pedido_proveedor: string;
  fecha_emision: string;
  fecha_vence: string;
  total: string;
}

export interface InvoicePaymentPayload {
  id_medio_pago: string;
  monto: string;
  referencia?: string;
  estado?: InvoicePagoEstado;
  fecha_pago?: string;
}

export interface InvoiceFilters {
  estadoPago?: InvoiceEstadoPago;
  idPedidoProveedor?: string;
  idProveedor?: string;
  q?: string;
  limit?: number;
  offset?: number;
}
