import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const appConfig = {
  title: "Gestión Comercial",
};

export const navItems: NavItem[] = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/products", label: "Productos", icon: Package },
  { to: "/sales", label: "Ventas", icon: ShoppingCart },
  { to: "/purchases", label: "Compras", icon: ShoppingBag },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/analytics", label: "Analíticas", icon: BarChart3 },
  { to: "/settings", label: "Configuración", icon: Settings },
];

export const headerConfig = {
  searchPlaceholder: "Buscar productos, clientes, pedidos...",
};