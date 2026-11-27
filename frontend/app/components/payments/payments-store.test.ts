import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listComprobantes: vi.fn(),
  listPagos: vi.fn(),
  emitirComprobante: vi.fn(),
  registrarPago: vi.fn(),
  enviarComprobante: vi.fn(),
}));

vi.mock("./payments-api", () => api);

import type { Invoice, PaymentTransaction } from "./payments-types";
import {
  emitirComprobante,
  enviarComprobante,
  getInvoiceByOrder,
  loadPayments,
  registrarPago,
} from "./payments-store";

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "CPB-0001",
    number: "0001-00000001",
    type: "B",
    orderNumber: "PV-0001",
    clientId: "CLI-0001",
    client: "Ana Pérez",
    clientEmail: "ana@example.com",
    date: "10/11/2026",
    amount: 100,
    paidAmount: 0,
    balance: 100,
    method: "",
    status: "emitida",
    ...overrides,
  };
}

function payment(overrides: Partial<PaymentTransaction> = {}): PaymentTransaction {
  return {
    id: "PAG-0001",
    invoiceId: "CPB-0001",
    invoiceNumber: "0001-00000001",
    orderNumber: "PV-0001",
    clientId: "CLI-0001",
    client: "Ana Pérez",
    method: "MPG-0001",
    methodLabel: "Efectivo",
    amount: 40,
    date: "10/11/2026",
    status: "aprobado",
    ...overrides,
  };
}

describe("payments-store", () => {
  beforeEach(() => {
    api.listComprobantes.mockReset();
    api.listPagos.mockReset();
    api.emitirComprobante.mockReset();
    api.registrarPago.mockReset();
    api.enviarComprobante.mockReset();
  });

  it("loads invoices and payments from the API once", async () => {
    api.listComprobantes.mockResolvedValue([invoice()]);
    api.listPagos.mockResolvedValue([payment()]);

    await loadPayments(true);
    expect(api.listComprobantes).toHaveBeenCalledTimes(1);
    expect(api.listPagos).toHaveBeenCalledTimes(1);
    expect(getInvoiceByOrder("PV-0001")?.id).toBe("CPB-0001");

    await loadPayments();
    expect(api.listComprobantes).toHaveBeenCalledTimes(1);
    expect(api.listPagos).toHaveBeenCalledTimes(1);
  });

  it("forces a reload when requested", async () => {
    api.listComprobantes.mockResolvedValue([invoice()]);
    api.listPagos.mockResolvedValue([]);

    await loadPayments(true);
    await loadPayments(true);

    expect(api.listComprobantes).toHaveBeenCalledTimes(2);
    expect(api.listPagos).toHaveBeenCalledTimes(2);
  });

  it("stores the invoice returned when emitting", async () => {
    api.emitirComprobante.mockResolvedValue(
      invoice({ id: "CPB-0002", orderNumber: "PV-0002" }),
    );

    const created = await emitirComprobante("PV-0002");

    expect(api.emitirComprobante).toHaveBeenCalledWith("PV-0002");
    expect(created.id).toBe("CPB-0002");
    expect(getInvoiceByOrder("PV-0002")?.id).toBe("CPB-0002");
  });

  it("registers a payment and refreshes invoices and payments", async () => {
    api.listComprobantes.mockResolvedValue([
      invoice({ paidAmount: 40, balance: 60, status: "aprobada" }),
    ]);
    api.listPagos.mockResolvedValue([payment()]);
    api.registrarPago.mockResolvedValue({});

    await registrarPago("CPB-0001", {
      id_medio_pago: "MPG-0001",
      monto: "40.00",
    });

    expect(api.registrarPago).toHaveBeenCalledWith("CPB-0001", {
      id_medio_pago: "MPG-0001",
      monto: "40.00",
    });
    expect(api.listComprobantes).toHaveBeenCalledTimes(1);
    expect(api.listPagos).toHaveBeenCalledTimes(1);
    expect(getInvoiceByOrder("PV-0001")?.balance).toBe(60);
  });

  it("sends the invoice through the API", async () => {
    api.enviarComprobante.mockResolvedValue({
      id_envio: 1,
      destinatario: "ana@example.com",
      cc: ["copia@example.com"],
      bcc: [],
      estado: "enviado",
      origen: "manual",
      error: null,
      enviado_en: "2026-11-10T12:00:00",
    });

    const envio = await enviarComprobante("CPB-0001", {
      destinatario: "ana@example.com",
      cc: ["copia@example.com"],
      bcc: [],
    });

    expect(api.enviarComprobante).toHaveBeenCalledWith("CPB-0001", {
      destinatario: "ana@example.com",
      cc: ["copia@example.com"],
      bcc: [],
    });
    expect(envio.estado).toBe("enviado");
  });

  it("marks the invoice as pending while the backend queues the email", async () => {
    api.listComprobantes.mockResolvedValue([invoice()]);
    api.listPagos.mockResolvedValue([]);
    await loadPayments(true);
    api.enviarComprobante.mockResolvedValue({
      id_envio: 2,
      destinatario: "ana@example.com",
      cc: [],
      bcc: [],
      estado: "pendiente",
      origen: "automatico",
      error: null,
      enviado_en: "2026-11-19T12:00:00",
    });

    await enviarComprobante("CPB-0001");

    const actual = getInvoiceByOrder("PV-0001");
    expect(actual?.emailStatus).toBe("pendiente");
    expect(actual?.emailOrigin).toBe("automatico");
    expect(actual?.sent).toBe(false);
  });
});
