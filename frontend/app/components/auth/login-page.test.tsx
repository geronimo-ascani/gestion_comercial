import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth-split-layout", () => ({
  AuthSplitLayout: ({
    title,
    subtitle,
    children,
    footer,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      {footer}
    </div>
  ),
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
  const { LoginPage } = await import("./login-page");
  return LoginPage;
}

describe("LoginPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza el formulario de inicio de sesión", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    expect(
      screen.getByRole("heading", { name: "Iniciar sesión" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Iniciar sesión" })
    ).toBeInTheDocument();
  });

  it("muestra errores de obligatoriedad al enviar vacío", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Correo electrónico es obligatorio")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Contraseña es obligatorio")
    ).toBeInTheDocument();
  });

  it("muestra error de formato de correo inválido", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "correo-invalido" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Correo electrónico inválido")
    ).toBeInTheDocument();
  });

  it("no revela si el correo existe ante credenciales incorrectas", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "noexiste@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "loquesea" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Credenciales no válidas.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/login");
  });

  it("usa el mismo mensaje genérico si la contraseña es incorrecta", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "admin@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "clave-incorrecta" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Credenciales no válidas.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/no existe un usuario/i)).not.toBeInTheDocument();
  });

  it("inicia sesión con credenciales válidas y navega al dashboard", async () => {
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "admin@empresa.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "admin123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });
    expect(localStorage.getItem("gc-current-user-id")).toBe("EMP-003");
  });

  it("redirige al dashboard si ya hay una sesión activa", async () => {
    localStorage.setItem("gc-current-user-id", "EMP-003");
    const LoginPage = await loadPage();
    renderLogin(LoginPage);

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });
  });
});
