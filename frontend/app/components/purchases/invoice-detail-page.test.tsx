import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const mocks = vi.hoisted(() => ({
  getCachedInvoiceDetail: vi.fn(() => undefined),
  loadInvoiceDetail: vi.fn(),
  addInvoicePayment: vi.fn(),
  updateInvoicePaymentStatus: vi.fn(async () => undefined),
  useCurrentUser: vi.fn(() => ({ role: "administrador" })),
  usePaymentMethods: vi.fn(() => [{ id: "MPG-0001", label: "Efectivo" }]),
  usePaymentMethodsLoading: vi.fn(() => false),
  loadPaymentMethods: vi.fn(async () => undefined),
}));

vi.mock("./invoices-store", () => ({
  getCachedInvoiceDetail: mocks.getCachedInvoiceDetail,
  loadInvoiceDetail: mocks.loadInvoiceDetail,
  addInvoicePayment: mocks.addInvoicePayment,
  updateInvoicePaymentStatus: mocks.updateInvoicePaymentStatus,
}));

vi.mock("../auth/session-store", () => ({
  useCurrentUser: mocks.useCurrentUser,
}));

vi.mock("../payments/payment-methods-store", () => ({
  loadPaymentMethods: mocks.loadPaymentMethods,
  usePaymentMethods: mocks.usePaymentMethods,
  usePaymentMethodsLoading: mocks.usePaymentMethodsLoading,
}));

import { InvoiceDetailPage } from "./invoice-detail-page";
import type { SupplierInvoiceDetail } from "./invoices-types";

const factura: SupplierInvoiceDetail = {
  id: "FP-0006",
  numeroComprobante: "FP-0006",
  numeroCompleto: "FP-0006",
  tipoComprobante: "A",
  estadoPago: "emitida" as const,
  fechaEmision: "2026-11-20T10:00:00",
  fechaVence: "2026-12-20T10:00:00",
  total: 363000,
  saldoPendiente: 363000,
  idEmpresa: "EMP-0001",
  idProveedor: "PRO-0001",
  proveedorRazonSocial: "Proveedor SA",
  idPedidoProveedor: "OC-0006",
  archivoNombre: "factura.pdf",
  archivoMimeType: "application/pdf",
  archivoTamanio: 1234,
  archivoUrl: "/compras/facturas/FP-0006/archivo",
  tieneArchivo: true,
  creadoEn: "2026-11-20T10:01:00",
  proveedorCuit: "20123456789",
  proveedorDomicilio: "Calle 1",
  proveedorCondicionIva: "Responsable Inscripto",
  empresaRazonSocial: "Mi Empresa",
  empresaCuit: "20111111111",
  empresaDomicilio: "Calle 2",
  empresaCondicionIva: "Responsable Inscripto",
  pagos: [],
};

const pagoPendiente: SupplierInvoiceDetail["pagos"][number] = {
  id: "PAG-0002",
  estado: "pendiente" as const,
  fechaPago: "2026-11-20",
  monto: 100,
  referencia: "",
  idMedioPago: "MPG-0001",
  medioPago: "Efectivo",
  creadoEn: "2026-11-20T10:05:00",
  idFacturaProveedor: "FP-0006",
  tipoPago: "pago" as const,
};

function renderPage(detalle: SupplierInvoiceDetail = factura) {
  mocks.loadInvoiceDetail.mockResolvedValue(detalle);
  return render(
    <MemoryRouter initialEntries={["/purchases/invoices/FP-0006"]}>
      <Routes>
        <Route
          path="/purchases/invoices/:id"
          element={<InvoiceDetailPage />}
        />
        <Route path="/purchases/invoices" element={<div>Listado</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("InvoiceDetailPage - marcar como pagada", () => {
  it("muestra el botón cuando la factura está emitida y tiene saldo", async () => {
    renderPage();
    expect(
      await screen.findByRole("button", { name: /Marcar como pagada/i })
    ).toBeTruthy();
  });
});

describe("InvoiceDetailPage - pagos pendientes", () => {
  it("permite aprobar un pago pendiente", async () => {
    renderPage({ ...factura, pagos: [pagoPendiente] });
    const aprobar = await screen.findByRole("button", { name: /Aprobar/i });

    await act(async () => {
      fireEvent.click(aprobar);
    });

    await waitFor(() =>
      expect(mocks.updateInvoicePaymentStatus).toHaveBeenCalledWith(
        "FP-0006",
        "PAG-0002",
        "aprobado"
      )
    );
  });

  it("permite rechazar un pago pendiente", async () => {
    renderPage({ ...factura, pagos: [pagoPendiente] });
    const rechazar = await screen.findByRole("button", { name: /Rechazar/i });

    await act(async () => {
      fireEvent.click(rechazar);
    });

    await waitFor(() =>
      expect(mocks.updateInvoicePaymentStatus).toHaveBeenCalledWith(
        "FP-0006",
        "PAG-0002",
        "rechazado"
      )
    );
  });

  it("no muestra acciones para pagos aprobados", async () => {
    renderPage({
      ...factura,
      pagos: [{ ...pagoPendiente, estado: "aprobado" as const }],
    });

    await screen.findAllByText("Efectivo");
    expect(screen.queryByRole("button", { name: /Aprobar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Rechazar/i })).toBeNull();
  });
});
