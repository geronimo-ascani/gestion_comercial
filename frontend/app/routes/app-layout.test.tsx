import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import AppLayoutRoute from "./app-layout";

vi.mock("~/components/auth/session-store", () => ({
  initializeSession: vi.fn().mockResolvedValue(undefined),
  useCurrentUser: () => ({
    id: "EMP-0002",
    firstName: "Vera",
    lastName: "Ventas",
    cuil: "20123456786",
    phone: "11111111",
    email: "vera@empresa.com",
    hireDate: "01/01/2025",
    hireDateISO: "2025-01-01",
    position: "Vendedora",
    role: "ventas",
  }),
  logoutUser: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<AppLayoutRoute />}>
          <Route path="dashboard" element={<div>dashboard page</div>} />
          <Route path="sales" element={<div>sales page</div>} />
        </Route>
      </Routes>
      <LocationProbe />
    </MemoryRouter>
  );
}

describe("AppLayoutRoute", () => {
  it("redirige al inicio del rol cuando la ruta no está permitida", async () => {
    renderAt("/dashboard");

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/sales");
    });
    expect(screen.getByText("sales page")).toBeInTheDocument();
  });

  it("muestra solo la navegación permitida para el rol", async () => {
    renderAt("/sales");

    expect(
      await screen.findByRole("link", { name: "Ventas" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Panel" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Empleados" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Compras" })
    ).not.toBeInTheDocument();
  });
});
