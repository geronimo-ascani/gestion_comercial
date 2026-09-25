import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  Users,
  UsersRound,
  BarChart3,
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
  { to: "/employees", label: "Empleados", icon: UsersRound },
  { to: "/analytics", label: "Analíticas", icon: BarChart3 },
];