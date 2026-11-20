import { useEffect, useState } from "react";
import {
  AlertTriangle,
  DollarSign,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "react-router";

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
import { KpiSkeleton, PanelSkeleton } from "~/components/ui/skeleton";

import {
  fetchAnalytics,
  type AnalyticsData,
  type Period,
} from "../analytics/analytics-api";
import {
  formatAR,
  formatDelta,
  formatPercent,
  periodOptions,
} from "../analytics/analytics-data";
import {
  listarAlertasStock,
  type ProductoListado,
} from "../products/products-api";
import type { Product } from "../products/products-types";
import { listSalesOrders } from "../sales/sales-api";
import type { SalesOrder } from "../sales/sales-types";
import { OrderStatusBadge } from "../sales/sales-views";

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  borderColor: "var(--color-border)",
  borderRadius: 8,
};

const MAX_ALERTAS = 5;
const MAX_PEDIDOS = 5;

interface DashboardData {
  analytics: AnalyticsData;
  alertasStock: Product[];
  pedidosRecientes: SalesOrder[];
}

export function DashboardPage() {
  const [period, setPeriod] = useState<Period>("mes");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchAnalytics(period),
      listarAlertasStock(MAX_ALERTAS),
      listSalesOrders(),
    ])
      .then(([analytics, alertas, pedidos]: [AnalyticsData, ProductoListado, SalesOrder[]]) => {
        if (!active) return;
        setData({
          analytics,
          alertasStock: alertas.items,
          pedidosRecientes: pedidos.slice(0, MAX_PEDIDOS),
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar los datos del panel.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period, reloadKey]);

  const kpis = data?.analytics.kpis ?? null;
  const variacion = data?.analytics.variacion ?? null;

  const kpiCards = [
    {
      title: "VENTAS TOTALES",
      value: formatAR(kpis?.ventas ?? 0),
      delta: formatDelta(variacion?.ventas),
      positive: (variacion?.ventas ?? 0) >= 0,
      icon: TrendingUp,
    },
    {
      title: "GASTOS",
      value: formatAR(kpis?.gastos ?? 0),
      delta: formatDelta(variacion?.gastos),
      positive: (variacion?.gastos ?? 0) >= 0,
      icon: TrendingDown,
    },
    {
      title: "INGRESOS NETOS",
      value: formatAR(kpis?.neto ?? 0),
      delta: formatDelta(variacion?.neto),
      positive: (variacion?.neto ?? 0) >= 0,
      icon: DollarSign,
    },
    {
      title: "MARGEN DE GANANCIA",
      value: formatPercent(kpis?.margenPct),
      delta: "del neto / ventas",
      positive: true,
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Panel principal</h1>
          <p className="text-muted-foreground">
            Métricas operativas del sistema para el período seleccionado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as Period)}
          >
            <SelectTrigger className="w-44" aria-label="Período del panel">
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
          <Button
            variant="outline"
            size="icon"
            aria-label="Recargar panel"
            title="Recargar"
            onClick={() => setReloadKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
            <p className="text-destructive" role="alert">
              {error}
            </p>
            <Button
              variant="outline"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => (
              <Card key={kpi.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{kpi.title}</CardDescription>
                  <kpi.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpi.value}</div>
                  <p
                    className={
                      kpi.positive
                        ? "text-xs text-emerald-600"
                        : "text-xs text-destructive"
                    }
                  >
                    {kpi.delta}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Tendencias de ventas</CardTitle>
                <CardDescription>
                  Ventas y gastos · {data.analytics.periodo}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.analytics.tendencias.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
                    Sin datos de ventas disponibles
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.analytics.tendencias}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        dataKey="label"
                        stroke="var(--color-muted-foreground)"
                      />
                      <YAxis
                        stroke="var(--color-muted-foreground)"
                        tickFormatter={(value: number) =>
                          `$${Math.round(value / 1000)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value) => formatAR(Number(value))}
                        contentStyle={tooltipStyle}
                      />
                      <Legend />
                      <Bar
                        dataKey="ventas"
                        name="Ventas"
                        fill="#3b82f6"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="gastos"
                        name="Gastos"
                        fill="#f87171"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  Alertas de stock crítico
                </CardTitle>
                <CardDescription>
                  Productos con stock por debajo del mínimo
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.alertasStock.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
                    No hay alertas de stock crítico
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {data.alertasStock.map((producto) => (
                      <li
                        key={producto.id}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {producto.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Mínimo: {producto.minStock}
                          </p>
                        </div>
                        <Badge variant="destructive">
                          {producto.stock} uds.
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pedidos recientes</CardTitle>
              <CardDescription>Últimos pedidos registrados</CardDescription>
            </CardHeader>
            <CardContent>
              {data.pedidosRecientes.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
                  No hay pedidos recientes
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.pedidosRecientes.map((pedido) => (
                      <TableRow key={pedido.number}>
                        <TableCell className="font-mono text-xs">
                          <Link
                            to={`/sales/${encodeURIComponent(pedido.number)}`}
                            className="hover:underline"
                          >
                            {pedido.number}
                          </Link>
                        </TableCell>
                        <TableCell className="font-medium">
                          {pedido.client}
                        </TableCell>
                        <TableCell>{pedido.date}</TableCell>
                        <TableCell className="text-right">
                          {pedido.total}
                        </TableCell>
                        <TableCell>
                          <OrderStatusBadge status={pedido.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <KpiSkeleton count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelSkeleton
          height={300}
          titleClassName="h-5 w-40"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2"
        />
        <PanelSkeleton
          height={300}
          titleClassName="h-5 w-36"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        />
      </div>
      <PanelSkeleton
        height={160}
        titleClassName="h-5 w-36"
        className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      />
    </div>
  );
}
