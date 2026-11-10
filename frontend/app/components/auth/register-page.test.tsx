import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth-split-layout", () => ({
  AuthSplitLayout: ({ title, children }: React.PropsWithChildren<{ title: string }>) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("./auth-api", () => ({
  registrarUsuario: vi.fn(),
  mapUsuario: vi.fn((user) => ({
    id: user.id_empleado,
    firstName: user.nombre,
    lastName: user.apellido,
    cuil: user.dni_cuil,
    phone: user.telefono,
    email: user.email,
    hireDate: user.fecha_ingreso,
    role: user.rol,
  })),
}));

vi.mock("../employees/employees-store", () => ({
  refreshEmployees: vi.fn().mockResolvedValue(undefined),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

async function loadPage() {
  vi.resetModules();
  return (await import("./register-page")).RegisterPage;
}

function fillForm() {
  const values: Record<string, string> = {
    Nombre: "Ana",
    Apellido: "López",
    "DNI / CUIL": "20-12345678-9",
    Teléfono: "11111111",
    "Correo electrónico": "ana@empresa.com",
    Contraseña: "password-segura",
    "Confirmar contraseña": "password-segura",
  };
  for (const [label, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

describe("RegisterPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("registra al primer usuario como administrador sin permitir elegir el rol", async () => {
    const RegisterPage = await loadPage();
    const api = await import("./auth-api");
    vi.mocked(api.registrarUsuario).mockResolvedValue({
      access_token: "first-admin-token",
      token_type: "bearer",
      user: {
        id_empleado: "EMP-0001",
        nombre: "Ana",
        apellido: "López",
        dni_cuil: "20-12345678-9",
        telefono: "11111111",
        email: "ana@empresa.com",
        fecha_alta: "2025-01-01T00:00:00Z",
        fecha_ingreso: "2025-01-01",
        fecha_modificacion: null,
        puesto: "Administrador",
        rol: "administrador",
      },
    });
    render(
      <MemoryRouter initialEntries={["/register"]}>
        <RegisterPage />
        <LocationProbe />
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Crea tu cuenta" });
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });
    expect(api.registrarUsuario).toHaveBeenCalledWith(
      expect.objectContaining({ rol: "ventas", email: "ana@empresa.com" })
    );
    expect(sessionStorage.getItem("gc-access-token")).toBe(
      "first-admin-token"
    );
  });

  it("valida longitud mínima de contraseña", async () => {
    const RegisterPage = await loadPage();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Crea tu cuenta" });
    fillForm();
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Debe tener al menos 8 caracteres")
    ).toBeInTheDocument();
  });
});
