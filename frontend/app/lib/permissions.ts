import { matchPath } from "react-router";

import type { EmployeeRole } from "~/components/employees/employees-types";

export const ALL_ROLES: readonly EmployeeRole[] = [
  "administrador",
  "ventas",
  "abastecimiento",
];

export const roleHome: Record<EmployeeRole, string> = {
  administrador: "/dashboard",
  ventas: "/sales",
  abastecimiento: "/purchases",
};

interface RouteRule {
  pattern: string;
  roles: readonly EmployeeRole[];
}

// Las reglas más específicas van antes que las dinámicas.
const routeRules: readonly RouteRule[] = [
  { pattern: "/dashboard", roles: ["administrador"] },
  { pattern: "/products", roles: ALL_ROLES },
  { pattern: "/products/new", roles: ["administrador"] },
  { pattern: "/purchases", roles: ["administrador", "abastecimiento"] },
  {
    pattern: "/purchases/new-order",
    roles: ["administrador", "abastecimiento"],
  },
  {
    pattern: "/purchases/new-provider",
    roles: ["administrador", "abastecimiento"],
  },
  {
    pattern: "/purchases/invoices/new",
    roles: ["administrador", "abastecimiento"],
  },
  {
    pattern: "/purchases/invoices/:id",
    roles: ["administrador", "abastecimiento"],
  },
  {
    pattern: "/purchases/invoices",
    roles: ["administrador", "abastecimiento"],
  },
  {
    pattern: "/providers/accounts/:id",
    roles: ["administrador", "abastecimiento"],
  },
  {
    pattern: "/providers/accounts",
    roles: ["administrador", "abastecimiento"],
  },
  { pattern: "/providers", roles: ["administrador", "abastecimiento"] },
  { pattern: "/sales", roles: ["administrador", "ventas"] },
  { pattern: "/sales/new-order", roles: ["administrador", "ventas"] },
  { pattern: "/sales/new-budget", roles: ["administrador", "ventas"] },
  { pattern: "/sales/:number", roles: ["administrador", "ventas"] },
  { pattern: "/customers/accounts/:id", roles: ["administrador", "ventas"] },
  { pattern: "/customers/accounts", roles: ["administrador", "ventas"] },
  { pattern: "/customers", roles: ["administrador", "ventas"] },
  { pattern: "/customers/new", roles: ["administrador", "ventas"] },
  { pattern: "/payments", roles: ["administrador", "ventas"] },
  { pattern: "/payments/new-method", roles: ["administrador"] },
  { pattern: "/employees", roles: ["administrador"] },
  { pattern: "/employees/new", roles: ["administrador"] },
  { pattern: "/employees/:id/edit", roles: ["administrador"] },
  { pattern: "/analytics", roles: ALL_ROLES },
  { pattern: "/company", roles: ALL_ROLES },
];

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function canAccessRoute(
  role: EmployeeRole | null | undefined,
  pathname: string
): boolean {
  if (!role) return false;

  const path = normalizePath(pathname);
  const rule = routeRules.find(
    (candidate) => matchPath(candidate.pattern, path) !== null
  );

  // Las rutas desconocidas las resuelve el router (404).
  return rule ? rule.roles.includes(role) : true;
}

export function defaultRouteForRole(
  role: EmployeeRole | null | undefined
): string {
  return role ? roleHome[role] : "/login";
}

export function navItemsForRole<T extends { roles: readonly EmployeeRole[] }>(
  items: readonly T[],
  role: EmployeeRole | null | undefined
): T[] {
  if (!role) return [];
  return items.filter((item) => item.roles.includes(role));
}
