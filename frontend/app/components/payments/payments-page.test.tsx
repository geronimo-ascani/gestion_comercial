import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const reporte = {
  desde: "2026-11-01",
  hasta: "2026-11-30",
  generado_en: "2026-11-30T12:00:00Z",
  parametros: {
    desde: "2026-11-01",
    hasta: "2026-11-30",
    id_cliente: null,
    id_proveedor: null,
  },
  totales: {
    cobros_aprobados: "100.00",
    cobros_pendientes: "20.00",
    cobros_rechazados: "0.00",
    pagos_aprobados: "40.00",
    pagos_pendientes: "0.00",
    pagos_rechazados: "0.00",
    cobros_realizados: "100.00",
    pagos_realizados: "40.00",
    neto_realizado: "60.00",
  },
  por_estado: [],
  por_medio_pago: [],
};

const mocks = vi.hoisted(() => ({
  useCurrentUser: vi.fn(() => ({ role: "administrador" })),
  loadPayments: vi.fn(async () => undefined),
  useInvoices: vi.fn(() => []),
  usePayments: vi.fn(() => []),
  usePaymentsLoading: vi.fn(() => false),
  getReporteCobrosPagos: vi.fn(async () => undefined),
  downloadReporteCobrosPagosPdf: vi.fn(async () => undefined),
  listPagosProveedor: vi.fn(async () => []),
  listCustomers: vi.fn(async () => []),
  listProviders: vi.fn(async () => []),
}));

vi.mock("../auth/session-store", () => ({
  useCurrentUser: mocks.useCurrentUser,
}));

vi.mock("./payments-store", () => ({
  loadPayments: mocks.loadPayments,
  useInvoices: mocks.useInvoices,
  usePayments: mocks.usePayments,
  usePaymentsLoading: mocks.usePaymentsLoading,
}));

vi.mock("./payments-api", () => ({
  getReporteCobrosPagos: mocks.getReporteCobrosPagos,
  downloadReporteCobrosPagosPdf: mocks.downloadReporteCobrosPagosPdf,
  listPagosProveedor: mocks.listPagosProveedor,
}));

vi.mock("../customers/customers-api", () => ({
  listCustomers: mocks.listCustomers,
}));

vi.mock("../purchases/providers-api", () => ({
  listProviders: mocks.listProviders,
}));

vi.mock("~/lib/use-initial-loading", () => ({
  useInitialLoading: () => false,
}));

vi.mock("./record-payment-dialog", () => ({
  RecordPaymentDialog: () => null,
}));

vi.mock("./send-invoice-dialog", () => ({
  SendInvoiceDialog: () => null,
}));

import { PaymentsPage } from "./payments-page";

function renderPage(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/payments" element={<PaymentsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PaymentsPage - RF-20", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCurrentUser.mockReturnValue({ role: "administrador" });
    mocks.getReporteCobrosPagos.mockResolvedValue(reporte);
    mocks.listPagosProveedor.mockResolvedValue([]);
    mocks.listCustomers.mockResolvedValue([]);
    mocks.listProviders.mockResolvedValue([]);
  });

  it("muestra tabs de reporte y pagos a proveedores solo para administrador", async () => {
    renderPage("/payments?tab=reportes");

    expect(
      screen.getByRole("button", { name: "Pagos a proveedores" })
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Descargar PDF" })).toBeTruthy();

    await waitFor(() => {
      expect(mocks.getReporteCobrosPagos).toHaveBeenCalledWith({
        desde: expect.any(String),
        hasta: expect.any(String),
        id_cliente: undefined,
        id_proveedor: undefined,
      });
    });
  });

  it("muestra totales del backend sin recalcularlos en el cliente", async () => {
    renderPage("/payments?tab=reportes");

    await waitFor(() => {
      expect(screen.getAllByText("$ 100").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("$ 40").length).toBeGreaterThan(0);
    expect(screen.getByText("$ 60")).toBeTruthy();
  });

  it("ventas no ve los tabs admin-only ni consulta el reporte", () => {
    mocks.useCurrentUser.mockReturnValue({ role: "ventas" });

    renderPage("/payments?tab=reportes");

    expect(screen.queryByRole("button", { name: "Reportes" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Pagos a proveedores" })
    ).toBeNull();
    expect(mocks.getReporteCobrosPagos).not.toHaveBeenCalled();
    expect(screen.getByText("Comprobantes emitidos")).toBeTruthy();
  });
});
