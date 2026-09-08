import { type RouteConfig, index, route, layout } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  route("register", "routes/register.tsx"),
  index("routes/home.tsx"),

  layout("routes/app-layout.tsx", [
    route("dashboard", "routes/dashboard.tsx"),
    route("products", "routes/products.tsx"),
  ]),
] satisfies RouteConfig;
