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

function renderRegister(Page: () => React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Page />
      <LocationProbe />
    </MemoryRouter>
  );
}

async function loadPage() {
  vi.resetModules();
  const { RegisterPage } = await import("./register-page");
  return RegisterPage;
}

function fillForm(fields: {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}) {
  if (fields.firstName !== undefined) {
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: fields.firstName },
    });
  }
  if (fields.lastName !== undefined) {
    fireEvent.change(screen.getByLabelText("Apellido"), {
      target: { value: fields.lastName },
    });
  }
  if (fields.email !== undefined) {
    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: fields.email },
    });
  }
  if (fields.password !== undefined) {
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: fields.password },
    });
  }
  if (fields.confirmPassword !== undefined) {
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: fields.confirmPassword },
    });
  }
}

describe("RegisterPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza el formulario sin selector de rol", async () => {
    const RegisterPage = await loadPage();
    renderRegister(RegisterPage);

    expect(
      screen.getByRole("heading", { name: "Crea tu cuenta" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Apellido")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirmar contraseña")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rol")).not.toBeInTheDocument();
    expect(screen.queryByText("Ventas")).not.toBeInTheDocument();
  });

  it("muestra errores de obligatoriedad al enviar vacío", async () => {
    const RegisterPage = await loadPage();
    renderRegister(RegisterPage);

    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(await screen.findByText("Nombre es obligatorio")).toBeInTheDocument();
    expect(screen.getByText("Apellido es obligatorio")).toBeInTheDocument();
    expect(
      screen.getByText("Correo electrónico es obligatorio")
    ).toBeInTheDocument();
    expect(screen.getByText("Contraseña es obligatorio")).toBeInTheDocument();
    expect(
      screen.getByText("Confirmar contraseña es obligatorio")
    ).toBeInTheDocument();
  });

  it("valida la longitud mínima de la contraseña", async () => {
    const RegisterPage = await loadPage();
    renderRegister(RegisterPage);

    fillForm({
      firstName: "Ana",
      lastName: "López",
      email: "ana@empresa.com",
      password: "123",
      confirmPassword: "123",
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Debe tener al menos 6 caracteres")
    ).toBeInTheDocument();
  });

  it("valida que las contraseñas coincidan", async () => {
    const RegisterPage = await loadPage();
    renderRegister(RegisterPage);

    fillForm({
      firstName: "Ana",
      lastName: "López",
      email: "ana@empresa.com",
      password: "123456",
      confirmPassword: "654321",
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Las contraseñas no coinciden")
    ).toBeInTheDocument();
  });

  it("rechaza un correo ya registrado", async () => {
    const RegisterPage = await loadPage();
    renderRegister(RegisterPage);

    fillForm({
      firstName: "María",
      lastName: "González",
      email: "maria@empresa.com",
      password: "123456",
      confirmPassword: "123456",
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Ya existe una cuenta con ese correo.")
    ).toBeInTheDocument();
  });

  it("crea la cuenta como administrador y navega al dashboard", async () => {
    const RegisterPage = await loadPage();
    renderRegister(RegisterPage);

    fillForm({
      firstName: "Ana",
      lastName: "López",
      email: "ana@empresa.com",
      password: "123456",
      confirmPassword: "123456",
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/dashboard");
    });

    const { getEmployeesSnapshot } = await import(
      "../employees/employees-store"
    );
    const created = getEmployeesSnapshot().find(
      (employee) => employee.email === "ana@empresa.com"
    );
    expect(created).toBeDefined();
    expect(created?.role).toBe("administrador");
    expect(localStorage.getItem("gc-current-user-id")).toBe(created?.id);
  });
});
