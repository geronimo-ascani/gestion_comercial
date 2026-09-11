import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  index("routes/home.tsx"),

  layout("routes/app-layout.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("products", "routes/products.tsx"),
    route("purchases", "routes/purchases.tsx"),
    route("sales", "routes/sales.tsx"),
    route("customers", "routes/customers.tsx"),
    route("sales/:number", "routes/sales-detail.tsx"),
  ]),
] satisfies RouteConfig;
