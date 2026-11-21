import { useSyncExternalStore } from "react";

import {
  getInvoice as getInvoiceApi,
  listInvoices as listInvoicesApi,
  registerInvoicePayment as registerInvoicePaymentApi,
} from "./invoices-api";
import type {
  InvoicePaymentPayload,
  InvoicePago,
  SupplierInvoiceDetail,
  SupplierInvoiceSummary,
} from "./invoices-types";

let invoices: SupplierInvoiceSummary[] = [];
const details = new Map<string, SupplierInvoiceDetail>();
let loading = false;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const detailPromises = new Map<string, Promise<SupplierInvoiceDetail>>();

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

function getInvoices(): SupplierInvoiceSummary[] {
  return invoices;
}

function getLoading(): boolean {
  return loading;
}

export function useSupplierInvoices(): SupplierInvoiceSummary[] {
  return useSyncExternalStore(subscribe, getInvoices, getInvoices);
}

export function useSupplierInvoicesLoading(): boolean {
  return useSyncExternalStore(subscribe, getLoading, () => false);
}

function upsertInvoice(invoice: SupplierInvoiceSummary): void {
  const exists = invoices.some((item) => item.id === invoice.id);
  invoices = exists
    ? invoices.map((item) => (item.id === invoice.id ? invoice : item))
    : [invoice, ...invoices];
  emit();
}

export async function loadInvoices(force = false): Promise<void> {
  if (loaded && !force) return;
  if (loadPromise) {
    await loadPromise;
    if (!force) return;
  }

  loading = true;
  emit();

  loadPromise = (async () => {
    try {
      const next = await listInvoicesApi({ limit: 200 });
      invoices = next;
      loaded = true;
    } finally {
      loading = false;
      loadPromise = null;
      emit();
    }
  })();

  return loadPromise;
}

export function getCachedInvoiceDetail(
  id: string
): SupplierInvoiceDetail | undefined {
  return details.get(id);
}

export async function loadInvoiceDetail(
  id: string,
  force = false
): Promise<SupplierInvoiceDetail> {
  if (!force) {
    const cached = details.get(id);
    if (cached) return cached;
    const pending = detailPromises.get(id);
    if (pending) return pending;
  }

  const promise = getInvoiceApi(id)
    .then((detail) => {
      details.set(id, detail);
      upsertInvoice(detail);
      return detail;
    })
    .finally(() => {
      detailPromises.delete(id);
    });

  detailPromises.set(id, promise);
  return promise;
}

export function saveInvoice(detail: SupplierInvoiceDetail): void {
  details.set(detail.id, detail);
  upsertInvoice(detail);
}

export async function addInvoicePayment(
  id: string,
  payload: InvoicePaymentPayload
): Promise<InvoicePago> {
  const pago = await registerInvoicePaymentApi(id, payload);
  await loadInvoiceDetail(id, true);
  return pago;
}
