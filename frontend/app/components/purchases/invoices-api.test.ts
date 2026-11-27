import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("~/lib/api", () => api);

import {
  createInvoice,
  listInvoices,
  mapInvoiceDetalle,
  registerInvoicePayment,
  updateInvoicePaymentStatus,
} from "./invoices-api";
import type { InvoicePayload } from "./invoices-types";

const resumen = {
  id_factura_proveedor: "FAC-0001",
  numero_comprobante: "FAC-0001",
  numero_completo: "FAC-0001",
  tipo_comprobante: "B" as const,
  estado_pago: "emitida" as const,
  fecha_emision: "2026-11-20T10:00:00",
  fecha_vence: "2026-12-20T10:00:00",
  total: "121.50",
  saldo_pendiente: "121.50",
  id_empresa: "EMP-0001",
  id_proveedor: "PRO-0001",
  proveedor_razon_social: "Proveedor SA",
  id_pedido_proveedor: "OC-0001",
  archivo_nombre: "factura proveedor.pdf",
  archivo_mime_type: "application/pdf",
  archivo_tamanio: 1234,
  archivo_url: "/compras/facturas/FAC-0001/archivo",
  tiene_archivo: true,
};

const detalle = {
  ...resumen,
  creado_en: "2026-11-20T10:01:00",
  proveedor_cuit: "20123456789",
  proveedor_domicilio: "Calle 1",
  proveedor_condicion_iva: "Responsable inscripto",
  empresa_razon_social: "Mi Empresa",
  empresa_cuit: "20111111111",
  empresa_domicilio: "Calle 2",
  empresa_condicion_iva: "Monotributista",
  pagos: [],
};

describe("invoices-api", () => {
  beforeEach(() => {
    api.apiRequest.mockReset();
  });

  it("arma los filtros y convierte importes Decimal a number", async () => {
    api.apiRequest.mockResolvedValue([resumen]);

    const facturas = await listInvoices({
      estadoPago: "pagada",
      idProveedor: "PRO-0001",
      q: "factura 12",
      limit: 20,
    });

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/compras/facturas?estado_pago=pagada&id_proveedor=PRO-0001&q=factura+12&limit=20"
    );
    expect(facturas[0]).toMatchObject({
      id: "FAC-0001",
      total: 121.5,
      saldoPendiente: 121.5,
      proveedorRazonSocial: "Proveedor SA",
      archivoNombre: "factura proveedor.pdf",
      archivoUrl: "/compras/facturas/FAC-0001/archivo",
      tieneArchivo: true,
    });
  });

  it("mapea el detalle con metadatos del archivo", () => {
    const mapped = mapInvoiceDetalle(detalle);

    expect(mapped.archivoNombre).toBe("factura proveedor.pdf");
    expect(mapped.archivoMimeType).toBe("application/pdf");
    expect(mapped.archivoTamanio).toBe(1234);
    expect(mapped.proveedorRazonSocial).toBe("Proveedor SA");
    expect(mapped.pagos).toEqual([]);
  });

  it("envía solo los metadatos del listado y el archivo como multipart", async () => {
    api.apiRequest.mockResolvedValue(detalle);
    const payload: InvoicePayload = {
      id_pedido_proveedor: "OC-0001",
      fecha_emision: "2026-11-20T10:00:00",
      fecha_vence: "2026-12-20T10:00:00",
      total: "121.50",
    };
    const archivo = new File(["%PDF-1.4"], "factura.pdf", {
      type: "application/pdf",
    });

    await createInvoice(payload, archivo);

    const [path, init] = api.apiRequest.mock.calls[0];
    const body = init.body as FormData;
    expect(path).toBe("/compras/facturas");
    expect(init.method).toBe("POST");
    expect(body.get("metadata")).toBe(JSON.stringify(payload));
    const archivoEnviado = body.get("archivo") as File;
    expect(archivoEnviado.name).toBe("factura.pdf");
    expect(archivoEnviado.type).toBe("application/pdf");
    expect(archivoEnviado.size).toBe(archivo.size);
    expect(body.has("id_empresa")).toBe(false);
    expect(body.has("items")).toBe(false);
    expect(body.has("numero_comprobante")).toBe(false);
  });

  it("registra pagos con la ruta y el cuerpo esperados", async () => {
    api.apiRequest.mockResolvedValue({
      id_pago: "PAG-0001",
      estado: "aprobado",
      fecha_pago: "2026-11-20",
      monto: "50.00",
      referencia: "",
      id_medio_pago: "MPG-0001",
      medio_pago: "Efectivo",
      creado_en: "2026-11-20T10:05:00",
      id_comprobante_venta: null,
      id_factura_proveedor: "FAC-0001",
      tipo_pago: "pago",
    });

    const pago = await registerInvoicePayment("FAC-0001", {
      id_medio_pago: "MPG-0001",
      monto: "50.00",
    });

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/compras/facturas/FAC-0001/pagos",
      {
        method: "POST",
        body: JSON.stringify({ id_medio_pago: "MPG-0001", monto: "50.00" }),
      }
    );
    expect(pago.monto).toBe(50);
    expect(pago.tipoPago).toBe("pago");
  });

  it("cambia el estado de un pago pendiente con PATCH", async () => {
    api.apiRequest.mockResolvedValue({
      id_pago: "PAG-0002",
      estado: "aprobado",
      fecha_pago: "2026-11-20",
      monto: "50.00",
      referencia: "",
      id_medio_pago: "MPG-0001",
      medio_pago: "Efectivo",
      creado_en: "2026-11-20T10:05:00",
      id_comprobante_venta: null,
      id_factura_proveedor: "FAC-0001",
      tipo_pago: "pago",
    });

    const pago = await updateInvoicePaymentStatus(
      "FAC-0001",
      "PAG-0002",
      "aprobado"
    );

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/compras/facturas/FAC-0001/pagos/PAG-0002",
      { method: "PATCH", body: JSON.stringify({ estado: "aprobado" }) }
    );
    expect(pago.estado).toBe("aprobado");
  });
});
