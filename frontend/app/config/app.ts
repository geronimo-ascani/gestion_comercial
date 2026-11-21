import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Users,
  UsersRound,
  Receipt,
  FileText,
  BarChart3,
  Building2,
  type LucideIcon,
} from "lucide-react";

import type { EmployeeRole } from "~/components/employees/employees-types";
import { ALL_ROLES } from "~/lib/permissions";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: readonly EmployeeRole[];
}

export const appConfig = {
  title: "Gestión Comercial",
};

export const navItems: NavItem[] = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard, roles: ["administrador"] },
  { to: "/products", label: "Productos", icon: Package, roles: ALL_ROLES },
  { to: "/sales", label: "Ventas", icon: ShoppingCart, roles: ["administrador", "ventas"] },
  { to: "/purchases", label: "Compras", icon: ShoppingBag, roles: ["administrador", "abastecimiento"] },
  { to: "/purchases/invoices", label: "Facturas de proveedor", icon: FileText, roles: ["administrador", "abastecimiento"] },
  { to: "/providers", label: "Proveedores", icon: Truck, roles: ["administrador", "abastecimiento"] },
  { to: "/customers", label: "Clientes", icon: Users, roles: ["administrador", "ventas"] },
  { to: "/payments", label: "Pagos", icon: Receipt, roles: ["administrador", "ventas"] },
  { to: "/employees", label: "Empleados", icon: UsersRound, roles: ["administrador"] },
  { to: "/analytics", label: "Analíticas", icon: BarChart3, roles: ALL_ROLES },
  { to: "/company", label: "Mi empresa", icon: Building2, roles: ALL_ROLES },
];
