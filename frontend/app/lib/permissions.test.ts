import { describe, expect, it } from "vitest";

import { navItems } from "../config/app";
import type { EmployeeRole } from "../components/employees/employees-types";
import {
  canAccessRoute,
  defaultRouteForRole,
  navItemsForRole,
} from "./permissions";

const ROLES: EmployeeRole[] = ["administrador", "ventas", "abastecimiento"];

describe("permissions", () => {
  it("asigna a cada rol un inicio al que puede acceder", () => {
    expect(defaultRouteForRole("administrador")).toBe("/dashboard");
    expect(defaultRouteForRole("ventas")).toBe("/sales");
    expect(defaultRouteForRole("abastecimiento")).toBe("/purchases");

    for (const role of ROLES) {
      expect(canAccessRoute(role, defaultRouteForRole(role))).toBe(true);
    }
  });

  it("reserva el dashboard, empleados y alta de productos al administrador", () => {
    expect(canAccessRoute("administrador", "/dashboard")).toBe(true);
    expect(canAccessRoute("ventas", "/dashboard")).toBe(false);
    expect(canAccessRoute("abastecimiento", "/dashboard")).toBe(false);

    expect(canAccessRoute("ventas", "/employees")).toBe(false);
    expect(canAccessRoute("abastecimiento", "/employees/new")).toBe(false);

    expect(canAccessRoute("ventas", "/products/new")).toBe(false);
    expect(canAccessRoute("abastecimiento", "/products/new")).toBe(false);
    expect(canAccessRoute("ventas", "/products")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/products")).toBe(true);
  });

  it("separa los módulos de ventas y abastecimiento", () => {
    expect(canAccessRoute("ventas", "/sales")).toBe(true);
    expect(canAccessRoute("ventas", "/sales/ORD-0001")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/sales")).toBe(false);

    expect(canAccessRoute("abastecimiento", "/purchases")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/providers")).toBe(true);
    expect(canAccessRoute("ventas", "/purchases")).toBe(false);
    expect(canAccessRoute("ventas", "/providers")).toBe(false);

    expect(canAccessRoute("abastecimiento", "/purchases/invoices")).toBe(true);
    expect(canAccessRoute("administrador", "/purchases/invoices/new")).toBe(true);
    expect(canAccessRoute("administrador", "/purchases/invoices/FAC-0001")).toBe(true);
    expect(canAccessRoute("ventas", "/purchases/invoices")).toBe(false);
    expect(canAccessRoute("ventas", "/purchases/invoices/FAC-0001")).toBe(false);

    expect(canAccessRoute("ventas", "/customers")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/customers")).toBe(false);

    expect(canAccessRoute("ventas", "/customers/accounts")).toBe(true);
    expect(canAccessRoute("ventas", "/customers/accounts/CLI-0001")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/customers/accounts")).toBe(false);
    expect(canAccessRoute("abastecimiento", "/customers/accounts/CLI-0001")).toBe(false);

    expect(canAccessRoute("abastecimiento", "/providers/accounts")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/providers/accounts/PRV-0001")).toBe(true);
    expect(canAccessRoute("ventas", "/providers/accounts")).toBe(false);
    expect(canAccessRoute("ventas", "/providers/accounts/PRV-0001")).toBe(false);
  });

  it("mantiene analíticas, catálogo y mi empresa para los tres roles", () => {
    for (const role of ROLES) {
      expect(canAccessRoute(role, "/analytics")).toBe(true);
      expect(canAccessRoute(role, "/products")).toBe(true);
      expect(canAccessRoute(role, "/company")).toBe(true);
    }
  });

  it("permite cobrar a ventas pero reserva los medios de pago al administrador", () => {
    expect(canAccessRoute("ventas", "/payments")).toBe(true);
    expect(canAccessRoute("administrador", "/payments")).toBe(true);
    expect(canAccessRoute("abastecimiento", "/payments")).toBe(false);

    expect(canAccessRoute("administrador", "/payments/new-method")).toBe(true);
    expect(canAccessRoute("ventas", "/payments/new-method")).toBe(false);
    expect(canAccessRoute("abastecimiento", "/payments/new-method")).toBe(false);
  });

  it("filtra la navegación lateral según el rol", () => {
    expect(
      navItemsForRole(navItems, "ventas").map((item) => item.to)
    ).toEqual([
      "/products",
      "/sales",
      "/customers",
      "/payments",
      "/analytics",
      "/company",
    ]);

    expect(
      navItemsForRole(navItems, "abastecimiento").map((item) => item.to)
    ).toEqual([
      "/products",
      "/purchases",
      "/purchases/invoices",
      "/providers",
      "/analytics",
      "/company",
    ]);

    expect(navItemsForRole(navItems, "administrador")).toHaveLength(
      navItems.length
    );
  });

  it("no permite navegar sin rol", () => {
    expect(navItemsForRole(navItems, null)).toEqual([]);
    expect(canAccessRoute(null, "/products")).toBe(false);
    expect(defaultRouteForRole(null)).toBe("/login");
  });
});
