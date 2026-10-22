import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
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

function renderPage(Page: () => React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={["/forgot-password"]}>
      <Page />
    </MemoryRouter>
  );
}

async function loadPage() {
  vi.resetModules();
  const { ForgotPasswordPage } = await import("./forgot-password-page");
  return ForgotPasswordPage;
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza el formulario de recuperación", async () => {
    const ForgotPasswordPage = await loadPage();
    renderPage(ForgotPasswordPage);

    expect(
      screen.getByRole("heading", { name: "Recuperar contraseña" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar enlace" })
    ).toBeInTheDocument();
  });

  it("muestra error de obligatoriedad al enviar vacío", async () => {
    const ForgotPasswordPage = await loadPage();
    renderPage(ForgotPasswordPage);

    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(
      await screen.findByText("Correo electrónico es obligatorio")
    ).toBeInTheDocument();
  });

  it("muestra error de formato de correo inválido", async () => {
    const ForgotPasswordPage = await loadPage();
    renderPage(ForgotPasswordPage);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "correo-invalido" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(
      await screen.findByText("Correo electrónico inválido")
    ).toBeInTheDocument();
  });

  it("confirma el envío con un correo válido y oculta el formulario", async () => {
    const ForgotPasswordPage = await loadPage();
    renderPage(ForgotPasswordPage);

    fireEvent.change(screen.getByLabelText("Correo electrónico"), {
      target: { value: "usuario@empresa.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace" }));

    expect(
      await screen.findByText(
        "Si el correo existe, recibirás un enlace para restablecer tu contraseña. Revisá tu bandeja de entrada."
      )
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enviar enlace" })
    ).not.toBeInTheDocument();
  });
});
