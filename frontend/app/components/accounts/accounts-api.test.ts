import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock("~/lib/api", () => api);

import {
  filtrosPorDefecto,
  listarCuentas,
  obtenerCuenta,
} from "./accounts-api";

const parametros = {
  desde: "2026-11-01",
  hasta: "2026-11-30",
  id_cliente: null,
};

const listadoClientes = {
  desde: "2026-11-01",
  hasta: "2026-11-30",
  generado_en: "2026-11-30T12:00:00Z",
  parametros,
  totales: {
    saldo_inicial: "60.00",
    total_cargo: "50.00",
    total_abono: "20.00",
    saldo_final: "90.00",
    cantidad_operaciones: 2,
    cantidad_entidades: 1,
  },
  clientes: [
    {
      id_cliente: "CLI-0001",
      nombre: "Ana",
      apellido: "Pérez",
      dni_cuit: "30111111",
      saldo_inicial: "60.00",
      total_cargo: "50.00",
      total_abono: "20.00",
      saldo_final: "90.00",
      cantidad_comprobantes: 1,
      cantidad_pagos: 1,
      ultima_actividad: "2026-11-10",
    },
  ],
};

const movimiento = {
  id_movimiento: "C-CV-0001",
  tipo_movimiento: "comprobante",
  id_origen: "CV-0001",
  numero: "0001-00000001",
  fecha: "2026-11-05",
  descripcion: "Emisión de comprobante",
  monto: "50.00",
  signo: 1,
  saldo_resultante: "110.00",
  id_medio_pago: null,
  medio_pago: null,
};

describe("cuentas corrientes - cliente API", () => {
  beforeEach(() => {
    api.apiRequest.mockReset();
  });

  it("pide el listado de clientes con los filtros y usa cifras del backend", async () => {
    api.apiRequest.mockResolvedValue(listadoClientes);

    const resultado = await listarCuentas("cliente", {
      desde: "2026-11-01",
      hasta: "2026-11-30",
      id_cliente: "CLI-0001",
    });

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/cuentas-corrientes/clientes?desde=2026-11-01&hasta=2026-11-30&id_cliente=CLI-0001",
    );
    expect(resultado.totales.saldoFinal).toBe(90);
    expect(resultado.resumenes[0]).toMatchObject({
      id: "CLI-0001",
      nombre: "Ana Pérez",
      documento: "30111111",
      cantidadDocumentos: 1,
      saldoFinal: 90,
    });
  });

  it("mapea facturas como cargos en el listado de proveedores", async () => {
    api.apiRequest.mockResolvedValue({
      ...listadoClientes,
      parametros: { desde: "2026-11-01", hasta: "2026-11-30" },
      proveedores: [
        {
          id_proveedor: "PRV-0001",
          razon_social: "Proveedor SA",
          cuit: "20111111111",
          saldo_inicial: "0.00",
          total_cargo: "121.50",
          total_abono: "21.50",
          saldo_final: "100.00",
          cantidad_facturas: 1,
          cantidad_pagos: 1,
          ultima_actividad: "2026-11-09",
        },
      ],
    });

    const resultado = await listarCuentas("proveedor", {
      desde: "2026-11-01",
      hasta: "2026-11-30",
      id_proveedor: "PRV-0001",
    });

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/cuentas-corrientes/proveedores?desde=2026-11-01&hasta=2026-11-30&id_proveedor=PRV-0001",
    );
    expect(resultado.resumenes[0]).toMatchObject({
      id: "PRV-0001",
      nombre: "Proveedor SA",
      cantidadDocumentos: 1,
      saldoFinal: 100,
    });
  });

  it("obtiene el detalle con movimientos y saldos resultantes", async () => {
    api.apiRequest.mockResolvedValue({
      desde: "2026-11-01",
      hasta: "2026-11-30",
      generado_en: "2026-11-30T12:00:00Z",
      parametros,
      cliente: { ...listadoClientes.clientes[0], movimientos: [movimiento] },
    });

    const detalle = await obtenerCuenta("cliente", "CLI-0001", {
      desde: "2026-11-01",
      hasta: "2026-11-30",
    });

    expect(api.apiRequest).toHaveBeenCalledWith(
      "/cuentas-corrientes/clientes/CLI-0001?desde=2026-11-01&hasta=2026-11-30",
    );
    expect(detalle.resumen.saldoFinal).toBe(90);
    expect(detalle.movimientos[0]).toMatchObject({
      tipo: "comprobante",
      monto: 50,
      signo: 1,
      saldoResultante: 110,
    });
  });

  it("propone el mes corriente por defecto", () => {
    const filtros = filtrosPorDefecto();
    expect(filtros.desde.endsWith("-01")).toBe(true);
    expect(filtros.hasta >= filtros.desde).toBe(true);
  });
});
