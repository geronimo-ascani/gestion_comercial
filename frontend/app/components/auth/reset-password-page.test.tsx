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
  restablecerContrasena: vi.fn().mockResolvedValue(undefined),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía la contraseña nueva y vuelve al inicio de sesión", async () => {
    const { ResetPasswordPage } = await import("./reset-password-page");
    const api = await import("./auth-api");
    render(
      <MemoryRouter initialEntries={["/reset-password?token=reset-token"]}>
        <ResetPasswordPage />
        <LocationProbe />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "password-nueva" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "password-nueva" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/login");
    });
    expect(api.restablecerContrasena).toHaveBeenCalledWith(
      "reset-token",
      "password-nueva"
    );
  });

  it("requiere una contraseña de ocho caracteres como mínimo", async () => {
    const { ResetPasswordPage } = await import("./reset-password-page");
    render(
      <MemoryRouter initialEntries={["/reset-password?token=reset-token"]}>
        <ResetPasswordPage />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cambiar contraseña" }));

    expect(
      await screen.findByText("La contraseña debe tener al menos 8 caracteres.")
    ).toBeInTheDocument();
  });
});
