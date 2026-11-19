import { ApiError, apiRequest } from "~/lib/api";
import { formatInputDate } from "../sales/sales-types";
import type { Invoice, PaymentTransaction } from "./payments-types";

export interface MedioPagoApi {
  id_medio_pago: string;
  medio_pago: string;
  tipo_cobro: string;
}

export interface EmpresaApi {
  id_empresa: string;
  razon_social: string;
  nombre_fantasia: string;
  cuit: string;
  condicion_iva: "responsable_inscripto" | "monotributista" | "exento";
  domicilio: string;
  punto_venta: string;
  email: string;
  telefono: string;
  activa: boolean;
  ingresos_brutos: string;
  inicio_actividades: string | null;
  codigo_postal: string;
  localidad: string;
  provincia: string;
}

export type EmpresaPayload = Omit<EmpresaApi, "id_empresa">;

interface ComprobanteResumenApi {
  id_comprobante_venta: string;
  numero_comprobante: string | null;
  numero_completo: string | null;
  punto_venta: string;
  tipo_comprobante: "A" | "B" | "C" | "E";
  estado_pago: Invoice["status"];
  fecha_emision: string;
  monto: string;
  saldo_pendiente: string;
  id_pedido_cliente: string;
  cliente_nombre: string;
  cliente_apellido: string;
  id_empresa: string;
  empresa_razon_social: string;
}

interface ComprobanteApi extends ComprobanteResumenApi {
  total_pagado: string;
  estado_envio: string;
  observaciones: string;
  creado_en: string;
  empresa: EmpresaApi;
  cliente: {
    id_cliente: string;
    nombre: string;
    apellido: string;
    dni_cuit: string;
    email: string;
    telefono: string;
    condicion_iva_codigo: string;
    condicion_iva_descripcion: string;
  };
  pagos: PagoApi[];
}

interface PagoApi {
  id_pago: string;
  estado: "aprobado" | "pendiente" | "rechazado";
  fecha_pago: string;
  monto: string;
  referencia: string;
  id_medio_pago: string;
  medio_pago: string;
  creado_en: string;
}

export interface PagoListadoApi extends PagoApi {
  id_comprobante_venta: string;
  numero_comprobante: string | null;
  punto_venta: string;
  id_pedido_cliente: string;
  id_cliente: string;
  cliente_nombre: string;
  cliente_apellido: string;
}

export interface EnvioApi {
  id_envio: number;
  destinatario: string;
  estado: "enviado" | "fallido";
  error: string | null;
  enviado_en: string;
}

export interface PagoPayload {
  id_medio_pago: string;
  monto: string;
  referencia?: string;
  estado?: "aprobado" | "pendiente" | "rechazado";
}

function clienteNombre(nombre: string, apellido: string): string {
  return `${nombre} ${apellido}`.trim();
}

function numeroComprobante(
  numeroCompleto: string | null,
  puntoVenta: string,
  numero: string | null,
  id: string,
): string {
  if (numeroCompleto) return numeroCompleto;
  if (numero) return `${puntoVenta}-${numero}`;
  return id;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function mapResumen(comprobante: ComprobanteResumenApi): Invoice {
  const monto = Number(comprobante.monto);
  const saldo = Number(comprobante.saldo_pendiente);
  return {
    id: comprobante.id_comprobante_venta,
    number: numeroComprobante(
      comprobante.numero_completo,
      comprobante.punto_venta,
      comprobante.numero_comprobante,
      comprobante.id_comprobante_venta,
    ),
    type: comprobante.tipo_comprobante,
    orderNumber: comprobante.id_pedido_cliente,
    clientId: "",
    client: clienteNombre(
      comprobante.cliente_nombre,
      comprobante.cliente_apellido,
    ),
    date: formatInputDate(comprobante.fecha_emision),
    amount: monto,
    paidAmount: monto - saldo,
    balance: saldo,
    method: "",
    status: comprobante.estado_pago,
  };
}

function mapComprobante(comprobante: ComprobanteApi): Invoice {
  const resumen = mapResumen(comprobante);
  const pagosAprobados = comprobante.pagos.filter(
    (pago) => pago.estado === "aprobado",
  );
  const ultimoPago = pagosAprobados.at(-1);
  return {
    ...resumen,
    clientId: comprobante.cliente.id_cliente,
    method: ultimoPago?.id_medio_pago ?? "",
    paidAmount: Number(comprobante.total_pagado),
  };
}

function mapPagoListado(pago: PagoListadoApi): PaymentTransaction {
  return {
    id: pago.id_pago,
    invoiceId: pago.id_comprobante_venta,
    invoiceNumber: numeroComprobante(
      null,
      pago.punto_venta,
      pago.numero_comprobante,
      pago.id_comprobante_venta,
    ),
    orderNumber: pago.id_pedido_cliente,
    clientId: pago.id_cliente,
    client: clienteNombre(pago.cliente_nombre, pago.cliente_apellido),
    method: pago.id_medio_pago,
    methodLabel: pago.medio_pago,
    amount: Number(pago.monto),
    date: formatInputDate(pago.fecha_pago),
    status: pago.estado,
    reference: pago.referencia || undefined,
  };
}

export async function listComprobantes(): Promise<Invoice[]> {
  const comprobantes = await apiRequest<ComprobanteResumenApi[]>(
    "/ventas/comprobantes?limit=200",
  );
  return comprobantes.map(mapResumen);
}

export async function getComprobante(id: string): Promise<Invoice> {
  const comprobante = await apiRequest<ComprobanteApi>(
    `/ventas/comprobantes/${encodeURIComponent(id)}`,
  );
  return mapComprobante(comprobante);
}

export async function getComprobanteByOrder(
  orderNumber: string,
): Promise<Invoice | null> {
  try {
    const comprobante = await apiRequest<ComprobanteApi>(
      `/ventas/pedidos/${encodeURIComponent(orderNumber)}/comprobante`,
    );
    return mapComprobante(comprobante);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function emitirComprobante(
  orderNumber: string,
): Promise<Invoice> {
  const comprobante = await apiRequest<ComprobanteApi>(
    `/ventas/pedidos/${encodeURIComponent(orderNumber)}/comprobante`,
    { method: "POST", body: JSON.stringify({}) },
  );
  return mapComprobante(comprobante);
}

export async function listPagos(): Promise<PaymentTransaction[]> {
  const pagos = await apiRequest<PagoListadoApi[]>("/ventas/pagos?limit=200");
  return pagos.map(mapPagoListado);
}

export async function listPagosDeComprobante(
  idComprobante: string,
): Promise<PagoApi[]> {
  return apiRequest<PagoApi[]>(
    `/ventas/comprobantes/${encodeURIComponent(idComprobante)}/pagos`,
  );
}

export async function registrarPago(
  idComprobante: string,
  payload: PagoPayload,
): Promise<PagoApi> {
  return apiRequest<PagoApi>(
    `/ventas/comprobantes/${encodeURIComponent(idComprobante)}/pagos`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

export async function enviarComprobante(
  idComprobante: string,
  destinatario?: string,
): Promise<EnvioApi> {
  return apiRequest<EnvioApi>(
    `/ventas/comprobantes/${encodeURIComponent(idComprobante)}/envio`,
    {
      method: "POST",
      body: JSON.stringify(destinatario ? { destinatario } : {}),
    },
  );
}

export async function listEnvios(
  idComprobante: string,
): Promise<EnvioApi[]> {
  return apiRequest<EnvioApi[]>(
    `/ventas/comprobantes/${encodeURIComponent(idComprobante)}/envios`,
  );
}

export function formatEnvioDate(value: string): string {
  return formatDateTime(value);
}

export async function listMediosPago(): Promise<MedioPagoApi[]> {
  return apiRequest<MedioPagoApi[]>("/medios-pago");
}

export async function crearMedioPago(payload: {
  medio_pago: string;
  tipo_cobro: string;
}): Promise<MedioPagoApi> {
  return apiRequest<MedioPagoApi>("/medios-pago", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function obtenerEmpresaActual(): Promise<EmpresaApi> {
  return apiRequest<EmpresaApi>("/empresas/actual");
}

export async function actualizarEmpresa(
  idEmpresa: string,
  payload: Partial<EmpresaPayload>,
): Promise<EmpresaApi> {
  return apiRequest<EmpresaApi>(`/empresas/${encodeURIComponent(idEmpresa)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
