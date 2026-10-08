import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  route("forgot-password", "routes/forgot-password.tsx"),
  index("routes/home.tsx"),

  layout("routes/app-layout.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("products", "routes/products.tsx"),
    route("products/new", "routes/products-new.tsx"),
    route("purchases", "routes/purchases.tsx"),
    route("employees", "routes/employees.tsx"),
    route("employees/new", "routes/employees-new.tsx"),
    route("sales", "routes/sales.tsx"),
    route("sales/new-order", "routes/sales-new-order.tsx"),
    route("sales/new-budget", "routes/sales-new-budget.tsx"),
    route("sales/:number", "routes/sales-detail.tsx"),
    route("customers", "routes/customers.tsx"),
    route("customers/new", "routes/customers-new.tsx"),
    route("payments", "routes/payments.tsx"),
    route("purchases/new-order", "routes/purchases-new-order.tsx"),
    route("purchases/new-provider", "routes/purchases-new-provider.tsx"),
    route("providers", "routes/providers.tsx"),
    route("analytics", "routes/analytics.tsx"),
  ]),
] satisfies RouteConfig;
