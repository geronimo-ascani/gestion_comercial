import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../auth/session-store", () => ({
  logoutUser: vi.fn(),
  useCurrentUser: () => ({ id: "EMP-ADMIN", role: "administrador" }),
}));

vi.mock("./employees-store", () => ({
  loadEmployees: vi.fn().mockResolvedValue(undefined),
  removeEmployee: vi.fn(),
  useEmployees: () => [],
}));

vi.mock("~/lib/use-initial-loading", () => ({
  useInitialLoading: () => false,
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

describe("EmployeesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navega al formulario de empleado desde Nuevo empleado", async () => {
    const { EmployeesPage } = await import("./employees-page");
    render(
      <MemoryRouter initialEntries={["/employees"]}>
        <EmployeesPage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Nuevo empleado" }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/employees/new",
      );
    });
  });
});
