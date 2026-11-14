import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/session-store", () => ({
  useCurrentUser: () => ({ id: "EMP-ADMIN", role: "administrador" }),
}));

vi.mock("./employees-store", () => ({
  createEmployee: vi.fn(),
  getEmployee: vi.fn(),
  updateEmployee: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("EmployeeFormPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un formulario propio en /employees/new y crea el empleado", async () => {
    const { EmployeeFormPage } = await import("./employee-form-page");
    const store = await import("./employees-store");
    vi.mocked(store.createEmployee).mockResolvedValue({
      id: "EMP-0002",
      firstName: "Ana",
      lastName: "Pérez",
      cuil: "20123456789",
      phone: "11111111",
      email: "ana@example.com",
      hireDate: "1/1/2026",
      hireDateISO: "2026-01-01",
      position: "Vendedora",
      role: "ventas",
    });

    render(
      <MemoryRouter initialEntries={["/employees/new"]}>
        <EmployeeFormPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("heading", { name: "Nuevo empleado" }),
    ).toBeInTheDocument();

    const values: Record<string, string> = {
      Nombre: "Ana",
      Apellido: "Pérez",
      "DNI / CUIL": "20123456789",
      Teléfono: "11111111",
      "Correo electrónico": "ana@example.com",
      "Fecha de ingreso": "2026-01-01",
      Puesto: "Vendedora",
      Contraseña: "password-segura",
      "Confirmar contraseña": "password-segura",
    };
    for (const [label, value] of Object.entries(values)) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }

    fireEvent.click(screen.getByRole("button", { name: "Crear empleado" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/employees");
    });
    expect(store.createEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: "Ana",
        email: "ana@example.com",
        rol: "ventas",
        password: "password-segura",
      }),
    );
  });
});
