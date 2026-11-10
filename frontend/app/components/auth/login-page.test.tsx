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
  iniciarSesion: vi.fn(),
  obtenerUsuarioActual: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderLogin(Page: () => React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Page />
      <LocationProbe />
    </MemoryRouter>
  );
}

async function loadPage() {
  vi.resetModules();
  return (await import("./login-page")).LoginPage;
}

describe("LoginPage", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("renderiza el formulario de inicio de sesión", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    expect(
      screen.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("valida campos requeridos antes de enviar", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Correo electrónico es obligatorio")
    ).toBeInTheDocument();
    expect(screen.getByText("Contraseña es obligatorio")).toBeInTheDocument();
  });

  it("usa un mensaje genérico ante credenciales incorrectas", async () => {
    const LoginPage = await loadPage();
    const api = await import("./auth-api");
    vi.mocked(api.iniciarSesion).mockRejectedValue(
      new Error("Credenciales no válidas.")
    );
    renderLogin(LoginPage);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "usuario@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "incorrecta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Credenciales no válidas.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("inicia sesión y navega al dashboard", async () => {
    const LoginPage = await loadPage();
    const api = await import("./auth-api");
    vi.mocked(api.iniciarSesion).mockResolvedValue({
      access_token: "test-token",
      token_type: "bearer",
    });
    vi.mocked(api.obtenerUsuarioActual).mockResolvedValue({
      id: "EMP-0001",
      firstName: "Ana",
      lastName: "Pérez",
      cuil: "20-12345678-9",
      phone: "11111111",
      email: "ana@empresa.com",
      hireDate: "01/01/2025",
      role: "administrador",
    });
    renderLogin(LoginPage);
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "ana@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "password-segura" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });
    expect(sessionStorage.getItem("gc-access-token")).toBe("test-token");
  });
});
