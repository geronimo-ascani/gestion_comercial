import { useSyncExternalStore } from "react";

import {
  emitirComprobante as emitirComprobanteApi,
  enviarComprobante as enviarComprobanteApi,
  listComprobantes,
  listPagos,
  registrarPago as registrarPagoApi,
  type EnvioApi,
  type EnvioComprobantePayload,
  type PagoPayload,
} from "./payments-api";
import type { Invoice, PaymentTransaction } from "./payments-types";

let invoices: Invoice[] = [];
let payments: PaymentTransaction[] = [];
let loading = false;
let loaded = false;
let loadPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getInvoices() {
  return invoices;
}

function getPayments() {
  return payments;
}

function getLoading() {
  return loading;
}

function upsertInvoice(invoice: Invoice) {
  const exists = invoices.some((item) => item.id === invoice.id);
  invoices = exists
    ? invoices.map((item) => (item.id === invoice.id ? invoice : item))
    : [invoice, ...invoices];
  emit();
}

export function useInvoices(): Invoice[] {
  return useSyncExternalStore(subscribe, getInvoices, getInvoices);
}

export function usePayments(): PaymentTransaction[] {
  return useSyncExternalStore(subscribe, getPayments, getPayments);
}

export function usePaymentsLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoading, () => false);
}

export function useInvoiceForOrder(
  orderNumber: string | undefined
): Invoice | null {
  const all = useInvoices();
  if (!orderNumber) return null;
  return all.find((invoice) => invoice.orderNumber === orderNumber) ?? null;
}

export function getInvoiceByOrder(orderNumber: string): Invoice | undefined {
  return invoices.find((invoice) => invoice.orderNumber === orderNumber);
}

export async function loadPayments(force = false): Promise<void> {
  if (loaded && !force) return;
  if (loadPromise) {
    await loadPromise;
    if (!force) return;
  }

  loading = true;
  emit();

  loadPromise = (async () => {
    try {
      const [nextInvoices, nextPayments] = await Promise.all([
        listComprobantes(),
        listPagos(),
      ]);
      invoices = nextInvoices;
      payments = nextPayments;
      loaded = true;
    } finally {
      loading = false;
      loadPromise = null;
      emit();
    }
  })();

  return loadPromise;
}

export async function emitirComprobante(orderNumber: string): Promise<Invoice> {
  const invoice = await emitirComprobanteApi(orderNumber);
  upsertInvoice(invoice);
  return invoice;
}

export async function registrarPago(
  idComprobante: string,
  payload: PagoPayload
): Promise<void> {
  await registrarPagoApi(idComprobante, payload);
  await loadPayments(true);
}

export async function enviarComprobante(
  idComprobante: string,
  payload: EnvioComprobantePayload = {}
): Promise<EnvioApi> {
  const envio = await enviarComprobanteApi(idComprobante, payload);
  upsertEnvio(idComprobante, envio);
  return envio;
}

function upsertEnvio(idComprobante: string, envio: EnvioApi): void {
  invoices = invoices.map((invoice) =>
    invoice.id === idComprobante
      ? {
          ...invoice,
          sent: envio.estado === "enviado",
          emailStatus: envio.estado,
          emailOrigin: envio.origen,
        }
      : invoice,
  );
  emit();
}
