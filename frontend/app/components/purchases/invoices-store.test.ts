import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
  registerInvoicePayment: vi.fn(),
}));

vi.mock("./invoices-api", () => api);

import {
  addInvoicePayment,
  getCachedInvoiceDetail,
  loadInvoiceDetail,
  loadInvoices,
} from "./invoices-store";
import type {
  SupplierInvoiceDetail,
  SupplierInvoiceSummary,
} from "./invoices-types";

function resumen(id: string): SupplierInvoiceSummary {
  return {
    id,
    numeroComprobante: id,
    numeroCompleto: id,
    tipoComprobante: "B",
    estadoPago: "emitida",
    fechaEmision: "2026-11-20T10:00:00",
    fechaVence: "2026-12-20T10:00:00",
    total: 121,
    saldoPendiente: 121,
    idEmpresa: "EMP-0001",
    idProveedor: "PRO-0001",
    proveedorRazonSocial: "Proveedor SA",
    idPedidoProveedor: "OC-0001",
    archivoNombre: "factura.pdf",
    archivoMimeType: "application/pdf",
    archivoTamanio: 1234,
    archivoUrl: `/compras/facturas/${id}/archivo`,
    tieneArchivo: true,
  };
}

function detalle(id: string): SupplierInvoiceDetail {
  return {
    ...resumen(id),
    creadoEn: "2026-11-20T10:00:00",
    proveedorCuit: "20123456789",
    proveedorDomicilio: "Calle 1",
    proveedorCondicionIva: "Responsable inscripto",
    empresaRazonSocial: "Mi Empresa",
    empresaCuit: "20111111111",
    empresaDomicilio: "Calle 2",
    empresaCondicionIva: "Monotributista",
    pagos: [],
  };
}

describe("invoices-store", () => {
  beforeEach(() => {
    api.listInvoices.mockReset();
    api.getInvoice.mockReset();
    api.registerInvoicePayment.mockReset();
  });

  it("carga el listado una sola vez y permite forzar la recarga", async () => {
    api.listInvoices.mockResolvedValue([resumen("FAC-0001")]);

    await loadInvoices(true);
    await loadInvoices();
    expect(api.listInvoices).toHaveBeenCalledTimes(1);

    await loadInvoices(true);
    expect(api.listInvoices).toHaveBeenCalledTimes(2);
  });

  it("cachea el detalle y lo actualiza al registrar un pago", async () => {
    api.getInvoice.mockResolvedValue(detalle("FAC-0002"));
    api.registerInvoicePayment.mockResolvedValue({ id: "PAG-0001" });

    await loadInvoiceDetail("FAC-0002");
    await loadInvoiceDetail("FAC-0002");
    expect(api.getInvoice).toHaveBeenCalledTimes(1);
    expect(getCachedInvoiceDetail("FAC-0002")?.estadoPago).toBe("emitida");

    api.getInvoice.mockResolvedValue({
      ...detalle("FAC-0002"),
      estadoPago: "pagada",
      saldoPendiente: 0,
    });

    const pago = await addInvoicePayment("FAC-0002", {
      id_medio_pago: "MPG-0001",
      monto: "121.00",
    });

    expect(pago.id).toBe("PAG-0001");
    expect(api.getInvoice).toHaveBeenCalledTimes(2);
    expect(getCachedInvoiceDetail("FAC-0002")?.saldoPendiente).toBe(0);
    expect(getCachedInvoiceDetail("FAC-0002")?.estadoPago).toBe("pagada");
  });
});
