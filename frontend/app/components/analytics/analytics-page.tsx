import { useState } from "react";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

type Period = "mes" | "trimestre" | "año";

const periodOptions: { value: Period; label: string }[] = [
  { value: "mes", label: "Último mes" },
  { value: "trimestre", label: "Último trimestre" },
  { value: "año", label: "Este año" },
];

const demoByPeriod: Record<
  Period,
  {
    ventas: string;
    gastos: string;
    neto: string;
    margen: string;
    deltaVentas: string;
    deltaGastos: string;
    deltaNeto: string;
  }
> = {
  mes: {
    ventas: "$1.230.500",
    gastos: "$820.000",
    neto: "$410.500",
    margen: "33,4%",
    deltaVentas: "+12%",
    deltaGastos: "-3%",
    deltaNeto: "+25%",
  },
  trimestre: {
    ventas: "$3.610.200",
    gastos: "$2.410.800",
    neto: "$1.199.400",
    margen: "33,2%",
    deltaVentas: "+18%",
    deltaGastos: "+6%",
    deltaNeto: "+41%",
  },
  año: {
    ventas: "$14.520.000",
    gastos: "$9.880.000",
    neto: "$4.640.000",
    margen: "31,9%",
    deltaVentas: "+22%",
    deltaGastos: "+9%",
    deltaNeto: "+48%",
  },
};

const tendencies = [
  { month: "Ene", ventas: 980000, gastos: 710000 },
  { month: "Feb", ventas: 1050000, gastos: 760000 },
  { month: "Mar", ventas: 1120000, gastos: 790000 },
  { month: "Abr", ventas: 1080000, gastos: 820000 },
  { month: "May", ventas: 1210000, gastos: 840000 },
  { month: "Jun", ventas: 1180000, gastos: 810000 },
  { month: "Jul", ventas: 1260000, gastos: 860000 },
  { month: "Ago", ventas: 1320000, gastos: 880000 },
  { month: "Sep", ventas: 1290000, gastos: 850000 },
  { month: "Oct", ventas: 1370000, gastos: 900000 },
  { month: "Nov", ventas: 1430000, gastos: 920000 },
  { month: "Dic", ventas: 1510000, gastos: 980000 },
];

const payments = [
  { method: "Efectivo", amount: 980000, color: "#3b82f6" },
  { method: "Tarjeta", amount: 1420000, color: "#10b981" },
  { method: "MercadoPago", amount: 760000, color: "#f59e0b" },
];

const topProducts = [
  { rank: 1, product: "Gaseosa 1,5L (promo)", qty: 1240, amount: "$412.300" },
  { rank: 2, product: "Aceite 900ml", qty: 980, amount: "$318.500" },
  { rank: 3, product: "Harina 0000 1kg", qty: 1120, amount: "$296.200" },
  { rank: 4, product: "Arroz 1kg", qty: 860, amount: "$238.400" },
  { rank: 5, product: "Leche entera 1L", qty: 1540, amount: "$220.700" },
];

const topCustomers = [
  { rank: 1, client: "Mini Market El Sol", orders: 42, amount: "$486.000" },
  { rank: 2, client: "Almacén Los Amigos", orders: 35, amount: "$398.500" },
  { rank: 3, client: "Despensa Doña Rosa", orders: 28, amount: "$312.900" },
  { rank: 4, client: "Super 24hs", orders: 24, amount: "$276.300" },
  { rank: 5, client: "Kiosco El Turco", orders: 19, amount: "$142.800" },
];

const formatAmountTooltip = (value: number) =>
  `$${value.toLocaleString("es-AR")}`;

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("mes");
  const data = demoByPeriod[period];

  const kpis = [
    {
      title: "VENTAS TOTALES",
      value: data.ventas,
      delta: data.deltaVentas,
      icon: TrendingUp,
      positive: true,
    },
    {
      title: "GASTOS",
      value: data.gastos,
      delta: data.deltaGastos,
      icon: TrendingDown,
      positive: false,
    },
    {
      title: "INGRESOS NETOS",
      value: data.neto,
      delta: data.deltaNeto,
      icon: DollarSign,
      positive: true,
    },
    {
      title: "MARGEN DE GANANCIA",
      value: data.margen,
      delta: "del neto / ventas",
      icon: TrendingUp,
      positive: true,
    },
  ];

  const totalPayments = payments.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analíticas</h1>
          <p className="text-muted-foreground">
            Indicadores y reportes del negocio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">Exportar reporte</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Datos de demostración hasta conectar el backend.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{kpi.title}</CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-2xl font-bold">{kpi.value}</div>
                <Badge variant={kpi.positive ? "default" : "secondary"}>
                  {kpi.delta}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Período seleccionado
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tendencias de ventas</CardTitle>
            <CardDescription>Últimos 12 meses (ventas vs gastos)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={tendencies}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="month" stroke="var(--color-muted-foreground)" />
                <YAxis
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(value: number) =>
                    `$${Math.round(value / 1000)}k`
                  }
                />
                <Tooltip
                  formatter={(value) => formatAmountTooltip(Number(value))}
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="ventas" name="Ventas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="gastos" name="Gastos" fill="#f87171" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ventas por método de pago</CardTitle>
            <CardDescription>Distribución del período</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={payments}
                  dataKey="amount"
                  nameKey="method"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  label={(entry) => entry.method}
                >
                  {payments.map((entry) => (
                    <Cell key={entry.method} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatAmountTooltip(Number(value))}
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    borderColor: "var(--color-border)",
                    borderRadius: 8,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-2">
              {payments.map((entry) => (
                <div
                  key={entry.method}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    {entry.method}
                  </span>
                  <span className="font-medium">
                    {Math.round((entry.amount / totalPayments) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Productos más vendidos</CardTitle>
            <CardDescription>Ranking del período</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Importe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProducts.map((product) => (
                  <TableRow key={product.rank}>
                    <TableCell className="font-medium">{product.rank}</TableCell>
                    <TableCell>{product.product}</TableCell>
                    <TableCell className="text-right">{product.qty}</TableCell>
                    <TableCell className="text-right font-medium">
                      {product.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Clientes por facturación</CardTitle>
            <CardDescription>Mayores compradores del período</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Facturación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer) => (
                  <TableRow key={customer.rank}>
                    <TableCell className="font-medium">{customer.rank}</TableCell>
                    <TableCell>{customer.client}</TableCell>
                    <TableCell className="text-right">{customer.orders}</TableCell>
                    <TableCell className="text-right font-medium">
                      {customer.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}