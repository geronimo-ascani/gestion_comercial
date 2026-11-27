import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  apiFetchBlob: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("~/lib/api", () => api);

import {
  downloadReporteCobrosPagosPdf,
  getReporteCobrosPagos,
  listPagosProveedor,
} from "./payments-api";

describe("reportes de cobros y pagos (RF-20)", () => {
  beforeEach(() => {
    api.apiRequest.mockReset();
    api.apiFetchBlob.mockReset();
  });

  it("pide el reporte con el rango y los filtros exactos", async () => {
    const respuesta = {
      totales: { cobros_realizados: "100.00" },
    };
    api.apiRequest.mockResolvedValue(respuesta);

    const resultado = await getReporteCobrosPagos({
      desde: "2026-11-01",
      hasta: "2026-11-30",
      id_cliente: "CLI-0001",
      id_proveedor: "PRV-0001",
    });

    expect(resultado).toBe(respuesta);
    expect(api.apiRequest).toHaveBeenCalledWith(
      "/reportes/cobros-pagos?desde=2026-11-01&hasta=2026-11-30&id_cliente=CLI-0001&id_proveedor=PRV-0001",
    );
  });

  it("descarga el PDF del backend con los mismos filtros", async () => {
    const click = vi.fn();
    const createElement = vi
      .spyOn(document, "createElement")
      .mockImplementation(() => ({ click, remove: vi.fn() }) as never);
    const appendChild = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node);
    URL.createObjectURL = vi.fn(() => "blob:reporte");
    URL.revokeObjectURL = vi.fn();
    api.apiFetchBlob.mockResolvedValue({
      blob: new Blob(["%PDF"]),
      filename: "reporte-cobros-pagos.pdf",
      contentType: "application/pdf",
    });

    await downloadReporteCobrosPagosPdf({
      desde: "2026-11-01",
      hasta: "2026-11-30",
    });

    expect(api.apiFetchBlob).toHaveBeenCalledWith(
      "/reportes/cobros-pagos/reporte.pdf?desde=2026-11-01&hasta=2026-11-30",
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:reporte");
    appendChild.mockRestore();
    createElement.mockRestore();
  });

  it("lista pagos a proveedor con filtros opcionales", async () => {
    api.apiRequest.mockResolvedValue([]);

    await listPagosProveedor({
      desde: "2026-11-01",
      hasta: "2026-11-30",
      id_proveedor: "PRV-0001",
      estado: "aprobado",
      limit: 25,
    });

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/compras/pagos?desde=2026-11-01&hasta=2026-11-30&id_proveedor=PRV-0001&estado=aprobado&limit=25",
    );
  });
});
