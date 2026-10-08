import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ShoppingBag,
  Truck,
  Users,
  UsersRound,
  Receipt,
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
  { to: "/providers", label: "Proveedores", icon: Truck },
  { to: "/customers", label: "Clientes", icon: Users },
  { to: "/payments", label: "Pagos", icon: Receipt },
  { to: "/employees", label: "Empleados", icon: UsersRound },
  { to: "/analytics", label: "Analíticas", icon: BarChart3 },
];