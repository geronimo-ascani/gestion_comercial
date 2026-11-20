import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  fetchAnalytics: vi.fn(),
  listarAlertasStock: vi.fn(),
  listSalesOrders: vi.fn(),
}));

vi.mock("../analytics/analytics-api", () => ({
  fetchAnalytics: api.fetchAnalytics,
}));

vi.mock("../products/products-api", () => ({
  listarAlertasStock: api.listarAlertasStock,
}));

vi.mock("../sales/sales-api", () => ({
  listSalesOrders: api.listSalesOrders,
}));

import { DashboardPage } from "./dashboard-page";

function renderPage() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

const analytics = {
  periodo: "mes",
  desde: "2026-11-01",
  hasta: "2026-11-20",
  generadoEn: "2026-11-20T12:00:00Z",
  kpis: {
    ventas: 150000,
    compras: 40000,
    gastos: 55000,
    neto: 95000,
    margenPct: 63.33,
    costoVentas: 40000,
    margenBruto: 40000,
    margenBrutoPct: 50,
  },
  tendencias: [{ label: "Nov", ventas: 150000, gastos: 55000 }],
  aovUpt: [],
  aovUptActual: null,
  nuevosRecurrentes: [],
  rankingProductos: [],
  rankingClientes: [],
  rankingProveedores: [],
  comparativaPrecios: [],
  margenCategorias: [],
  inventarioInmovilizado: [],
  mapaCalor: null,
  mediosPago: [],
  prediccionDemanda: [],
  variacion: { ventas: 12.5, gastos: -3.2, neto: 8.1 },
};

const producto = {
  id: "PRD-0001",
  code: "PRD-0001",
  name: "Leche 1L",
  category: "Lácteos",
  categoryId: "CAT-0001",
  description: "",
  purchasePrice: 300,
  margin: 20,
  salePrice: 400,
  stock: 2,
  minStock: 10,
  alicuotaId: "IVA-0001",
  alicuotaDescripcion: "21%",
  alicuotaPorcentaje: 21,
  stockBajo: true,
};

const pedido = {
  number: "PV-0001",
  client: "Ana Pérez",
  date: "20/11/2026",
  deliveryAddress: {
    province: "Buenos Aires",
    locality: "La Plata",
    street: "Calle 1",
    number: "123",
    apartment: "",
  },
  items: [],
  total: "$150.000",
  status: "pendiente" as const,
  payment: "",
  paymentStatus: "pendiente" as const,
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchAnalytics.mockResolvedValue(analytics);
    api.listarAlertasStock.mockResolvedValue({
      items: [producto],
      total: 1,
      limit: 5,
      offset: 0,
    });
    api.listSalesOrders.mockResolvedValue([pedido]);
  });

  it("muestra los datos del backend en KPIs, alertas y pedidos", async () => {
    renderPage();

    expect(await screen.findByText("$150.000", { selector: "div" })).toBeInTheDocument();
    expect(await screen.findByText("Leche 1L")).toBeInTheDocument();
    expect(await screen.findByText("PV-0001")).toBeInTheDocument();
    expect(api.fetchAnalytics).toHaveBeenCalledWith("mes");
    expect(api.listarAlertasStock).toHaveBeenCalledWith(5);
    expect(api.listSalesOrders).toHaveBeenCalledTimes(1);
  });

  it("muestra un error con reintento cuando falla una fuente", async () => {
    api.fetchAnalytics.mockRejectedValue(new Error("Sin conexión"));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("Sin conexión");
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
