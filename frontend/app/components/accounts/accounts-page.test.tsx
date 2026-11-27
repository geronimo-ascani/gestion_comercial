import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

const resumen = {
  id: "CLI-0001",
  nombre: "Ana Pérez",
  documento: "30111111",
  saldoInicial: 60,
  totalCargo: 50,
  totalAbono: 20,
  saldoFinal: 90,
  cantidadDocumentos: 1,
  cantidadPagos: 1,
  ultimaActividad: "2026-11-10",
};

const listado = {
  desde: "2026-11-01",
  hasta: "2026-11-30",
  parametros: { desde: "2026-11-01", hasta: "2026-11-30" },
  totales: {
    saldoInicial: 60,
    totalCargo: 50,
    totalAbono: 20,
    saldoFinal: 90,
    cantidadOperaciones: 2,
    cantidadEntidades: 1,
  },
  resumenes: [resumen],
};

const detalle = {
  desde: "2026-11-01",
  hasta: "2026-11-30",
  resumen,
  movimientos: [
    {
      id: "C-CV-0001",
      tipo: "comprobante",
      idOrigen: "CV-0001",
      numero: "0001-00000001",
      fecha: "2026-11-05",
      descripcion: "Emisión de comprobante",
      monto: 50,
      signo: 1 as const,
      saldoResultante: 110,
      medioPago: null,
    },
  ],
};

const mocks = vi.hoisted(() => ({
  listarCuentas: vi.fn(async () => listado),
  obtenerCuenta: vi.fn(async () => detalle),
  getCustomer: vi.fn(async () => ({
    id: "CLI-0001",
    firstName: "Ana",
    lastName: "Pérez",
    document: "30111111",
    phone: "123456",
    email: "ana@example.com",
    address: {
      province: "Córdoba",
      locality: "Córdoba",
      street: "Calle",
      number: "1",
      apartment: "",
      postalCode: "5000",
    },
  })),
  getProvider: vi.fn(async () => ({
    id: "PRV-0001",
    name: "Proveedor SA",
    cuit: "20111111111",
    phone: "654321",
    email: "proveedor@example.com",
    address: {
      province: "Córdoba",
      locality: "Córdoba",
      street: "Calle",
      number: "2",
      apartment: "",
      postalCode: "5000",
    },
    bank: "Banco",
    account: "Cuenta",
  })),
  refreshCustomers: vi.fn(async () => []),
  refreshProviders: vi.fn(async () => []),
  useCustomers: vi.fn(() => []),
  useProviders: vi.fn(() => []),
}));

vi.mock("./accounts-api", () => ({
  listarCuentas: mocks.listarCuentas,
  obtenerCuenta: mocks.obtenerCuenta,
  filtrosPorDefecto: () => ({ desde: "2026-11-01", hasta: "2026-11-30" }),
}));

vi.mock("../customers/customers-store", () => ({
  refreshCustomers: mocks.refreshCustomers,
  useCustomers: mocks.useCustomers,
}));

vi.mock("../customers/customers-api", () => ({
  getCustomer: mocks.getCustomer,
}));

vi.mock("../purchases/purchases-store", () => ({
  refreshProviders: mocks.refreshProviders,
  useProviders: mocks.useProviders,
}));

vi.mock("../purchases/providers-api", () => ({
  getProvider: mocks.getProvider,
}));

import { CustomerAccountsPage } from "./accounts-page";
import { CustomerAccountDetailPage } from "./accounts-detail-page";

function renderListado() {
  return render(
    <MemoryRouter initialEntries={["/customers/accounts?desde=2026-11-01&hasta=2026-11-30"]}>
      <Routes>
        <Route path="/customers/accounts" element={<CustomerAccountsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderDetalle() {
  return render(
    <MemoryRouter initialEntries={["/customers/accounts/CLI-0001?desde=2026-11-01&hasta=2026-11-30"]}>
      <Routes>
        <Route
          path="/customers/accounts/:id"
          element={<CustomerAccountDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("pantallas de cuentas corrientes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listarCuentas.mockResolvedValue(listado);
    mocks.obtenerCuenta.mockResolvedValue(detalle);
  });

  it("muestra las cifras del backend y enlaza al detalle", async () => {
    renderListado();

    await waitFor(() => {
      expect(screen.getByText("Ana Pérez")).toBeTruthy();
    });
    expect(screen.getAllByText("$ 90").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Ver cuenta" }).getAttribute("href")).toContain(
      "/customers/accounts/CLI-0001?desde=2026-11-01&hasta=2026-11-30",
    );
    expect(mocks.listarCuentas).toHaveBeenCalledWith("cliente", {
      desde: "2026-11-01",
      hasta: "2026-11-30",
      id_cliente: undefined,
    });
  });

  it("muestra los movimientos del backend en el detalle", async () => {
    renderDetalle();

    await waitFor(() => {
      expect(screen.getByText("Emisión de comprobante")).toBeTruthy();
    });
    expect(screen.getByText("$ 110")).toBeTruthy();
    expect(mocks.obtenerCuenta).toHaveBeenCalledWith("cliente", "CLI-0001", {
      desde: "2026-11-01",
      hasta: "2026-11-30",
    });
  });
});
