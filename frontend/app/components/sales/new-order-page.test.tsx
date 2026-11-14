import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("./sales-store", () => {
  const orders = [
    {
      number: "PV-0001",
      budgetId: "PRE-0001",
      client: "Cliente",
      clientId: "CLI-0001",
      email: "cliente@example.com",
      phone: "11111111",
      date: "13/11/2026",
      deliveryAddress: {
        province: "Buenos Aires",
        locality: "CABA",
        street: "Corrientes",
        number: "1234",
        apartment: "",
      },
      items: [
        {
          sku: "PRD-0001",
          product: "Producto",
          qty: 1,
          unitPrice: "$ 80,00",
          subtotal: "$ 80,00",
        },
      ],
      subtotal: "$ 80,00",
      total: "$ 80,00",
      status: "pendiente",
      payment: "",
      paymentStatus: "pendiente",
    },
  ];
  return {
    createSalesOrder: vi.fn(),
    loadSalesOrders: vi.fn().mockResolvedValue(undefined),
    updateSalesOrder: vi.fn(),
    useOrders: () => orders,
  };
});

vi.mock("../products/products-store", () => {
  const products = [
    {
      id: "PRD-0001",
      code: "PRD-0001",
      name: "Producto",
      category: "General",
      categoryId: "CAT-0001",
      description: "",
      purchasePrice: 50,
      margin: 20,
      salePrice: 150,
      stock: 10,
      minStock: 1,
      alicuotaId: "IVA-0001",
      alicuotaDescripcion: "21%",
      alicuotaPorcentaje: 21,
      stockBajo: false,
    },
  ];
  return {
    invalidateProducts: vi.fn(),
    refreshProducts: vi.fn().mockResolvedValue(undefined),
    useProducts: () => products,
  };
});

vi.mock("../customers/customers-store", () => {
  const customers: never[] = [];
  return {
    refreshCustomers: vi.fn().mockResolvedValue(undefined),
    useCustomers: () => customers,
  };
});

vi.mock("../auth/session-store", () => ({
  useCurrentUser: () => ({ role: "administrador" }),
}));

describe("NewOrderPage", () => {
  it("muestra el precio cotizado al editar un pedido convertido desde presupuesto", async () => {
    const { NewOrderPage } = await import("./new-order-page");
    render(
      <MemoryRouter initialEntries={["/sales/new-order?edit=PV-0001"]}>
        <NewOrderPage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText("Precio unitario")).toHaveValue("80");
  });
});
