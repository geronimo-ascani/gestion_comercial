import { useSyncExternalStore } from "react";

import { parseNumberInput } from "~/lib/currency";
import type { SalesOrder } from "../sales/sales-types";
import { type Invoice, type InvoiceStatus, type PaymentMethod, type PaymentStatus, type PaymentTransaction } from "./payments-types";

function seed(day: string): { invoices: Invoice[]; payments: PaymentTransaction[] } {
  const invoices: Invoice[] = [
    {
      number: "F-001",
      orderNumber: "PV-DEMO-01",
      clientId: "C-001",
      client: "María González",
      date: `06/${day}/2026`,
      amount: 125000,
      method: "mercadopago",
      status: "aprobada",
    },
    {
      number: "F-002",
      orderNumber: "PV-DEMO-02",
      clientId: "C-002",
      client: "Juan Pérez",
      date: `05/${day}/2026`,
      amount: 45000,
      method: "tarjeta",
      status: "emitida",
    },
    {
      number: "F-003",
      orderNumber: "PV-DEMO-03",
      clientId: "C-003",
      client: "Laura Fernández",
      date: `04/${day}/2026`,
      amount: 90000,
      method: "mercadopago",
      status: "emitida",
    },
    {
      number: "F-004",
      orderNumber: "PV-DEMO-04",
      clientId: "C-004",
      client: "Carlos Rodríguez",
      date: `08/${day}/2026`,
      amount: 60000,
      method: "efectivo",
      status: "pagada",
      paidAt: `08/${day}/2026`,
    },
    {
      number: "F-005",
      orderNumber: "PV-DEMO-05",
      clientId: "C-005",
      client: "Ana Martínez",
      date: `07/${day}/2026`,
      amount: 32000,
      method: "mercadopago",
      status: "emitida",
    },
  ];

  const payments: PaymentTransaction[] = [
    {
      id: "P-001",
      invoiceNumber: "F-001",
      orderNumber: "PV-DEMO-01",
      clientId: "C-001",
      client: "María González",
      method: "mercadopago",
      amount: 125000,
      date: `06/${day}/2026`,
      status: "aprobado",
      gatewayReference: "MP-2026-42110",
      conciliationStatus: "pendiente",
    },
    {
      id: "P-002",
      invoiceNumber: "F-004",
      orderNumber: "PV-DEMO-04",
      clientId: "C-004",
      client: "Carlos Rodríguez",
      method: "efectivo",
      amount: 60000,
      date: `08/${day}/2026`,
      status: "aprobado",
      conciliationStatus: "conciliado",
    },
    {
      id: "P-003",
      invoiceNumber: "F-005",
      orderNumber: "PV-DEMO-05",
      clientId: "C-005",
      client: "Ana Martínez",
      method: "mercadopago",
      amount: 32000,
      date: `07/${day}/2026`,
      status: "aprobado",
      gatewayReference: "MP-2026-30871",
      conciliationStatus: "pendiente",
    },
  ];

  return { invoices, payments };
}

const demo = seed(String(new Date().getMonth() + 1).padStart(2, "0"));

let invoices: Invoice[] = [...demo.invoices];
let payments: PaymentTransaction[] = [...demo.payments];

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

export function useInvoices(): Invoice[] {
  return useSyncExternalStore(subscribe, getInvoices, getInvoices);
}

export function usePayments(): PaymentTransaction[] {
  return useSyncExternalStore(subscribe, getPayments, getPayments);
}

function parseDate(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}/${String(
    now.getMonth() + 1
  ).padStart(2, "0")}/${now.getFullYear()}`;
}

export function createInvoiceFromOrder(order: SalesOrder): string {
  const number = `F-${String(invoices.length + 1).padStart(3, "0")}`;
  invoices = [
    ...invoices,
    {
      number,
      orderNumber: order.number,
      clientId: order.clientId ?? "",
      client: order.client,
      date: parseDate(),
      amount: parseNumberInput(order.total),
      method: order.payment,
      status: "emitida",
      sentAt: parseDate(),
      sendCount: 1,
    },
  ];
  emit();
  return number;
}

export function resendInvoice(invoiceNumber: string): boolean {
  const invoice = invoices.find((item) => item.number === invoiceNumber);
  if (!invoice) return false;

  invoices = invoices.map((item) =>
    item.number === invoiceNumber
      ? {
          ...item,
          lastSentAt: parseDate(),
          sendCount: (item.sendCount ?? 0) + 1,
        }
      : item
  );
  emit();
  return true;
}

export function registerPayment({
  invoiceNumber,
  orderNumber,
  clientId,
  client,
  method,
  amount,
  status,
  gatewayReference,
}: {
  invoiceNumber: string;
  orderNumber: string;
  clientId: string;
  client: string;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  gatewayReference?: string;
}) {
  const id = `P-${String(payments.length + 1).padStart(3, "0")}`;
  const date = parseDate();
  const isDirect = method === "efectivo";
  const conciliationStatus = isDirect ? "conciliado" : "pendiente";

  const transaction: PaymentTransaction = {
    id,
    invoiceNumber,
    orderNumber,
    clientId,
    client,
    method,
    amount,
    date,
    status,
    gatewayReference,
    conciliationStatus,
  };
  payments = [...payments, transaction];

  const nextStatus: InvoiceStatus =
    status === "rechazado"
      ? "rechazada"
      : isDirect
        ? "pagada"
        : "aprobada";

  invoices = invoices.map((invoice) =>
    invoice.number === invoiceNumber
      ? {
          ...invoice,
          status: nextStatus,
          paidAt: nextStatus === "pagada" ? date : undefined,
        }
      : invoice
  );
  emit();
}

function matchPendingInvoice(payment: PaymentTransaction): Invoice | undefined {
  return invoices.find(
    (candidate) =>
      candidate.clientId === payment.clientId &&
      candidate.amount === payment.amount &&
      (candidate.status === "aprobada" || candidate.status === "emitida")
  );
}

export function reconcilePayment(
  paymentId: string,
  orderNumber?: string
): boolean {
  const payment = payments.find((item) => item.id === paymentId);
  if (!payment || payment.conciliationStatus === "conciliado") return false;

  const invoice = orderNumber
    ? invoices.find(
        (item) =>
          item.orderNumber === orderNumber &&
          (item.status === "aprobada" || item.status === "emitida")
      )
    : matchPendingInvoice(payment);
  if (!invoice) return false;

  payments = payments.map((item) =>
    item.id === paymentId ? { ...item, conciliationStatus: "conciliado" } : item
  );
  invoices = invoices.map((item) =>
    item.number === invoice.number
      ? { ...item, status: "pagada", paidAt: parseDate() }
      : item
  );
  emit();
  return true;
}

export interface ReconciliationSummary {
  matched: number;
  matchedAmount: number;
  remaining: number;
  remainingAmount: number;
}

export function reconcilePayments(): ReconciliationSummary {
  const pending = payments.filter(
    (payment) =>
      payment.conciliationStatus === "pendiente" &&
      payment.status === "aprobado"
  );

  let matched = 0;
  let matchedAmount = 0;

  for (const payment of pending) {
    const invoice = invoices.find(
      (candidate) =>
        candidate.clientId === payment.clientId &&
        candidate.amount === payment.amount &&
        (candidate.status === "aprobada" || candidate.status === "emitida")
    );
    if (!invoice) continue;

    matched += 1;
    matchedAmount += payment.amount;
    payments = payments.map((item) =>
      item.id === payment.id ? { ...item, conciliationStatus: "conciliado" } : item
    );
    invoices = invoices.map((item) =>
      item.number === invoice.number
        ? { ...item, status: "pagada", paidAt: parseDate() }
        : item
    );
  }

  const remaining = payments.filter(
    (payment) => payment.conciliationStatus === "pendiente"
  );

  emit();
  return {
    matched,
    matchedAmount,
    remaining: remaining.length,
    remainingAmount: remaining.reduce((sum, item) => sum + item.amount, 0),
  };
}

export function isGatewayMethod(method: PaymentMethod): boolean {
  return method === "tarjeta" || method === "mercadopago";
}