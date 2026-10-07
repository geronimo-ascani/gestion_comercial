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

import { KpiSkeleton, PanelSkeleton, Skeleton, TableSkeleton } from "~/components/ui/skeleton";
import { useInitialLoading } from "~/lib/use-initial-loading";
import { ExecutiveReportSheet } from "~/components/reports/executive-report-sheet";
import { ReportPreviewDialog } from "~/components/reports/report-preview-dialog";

import { AovPanel } from "./aov-panel";
import {
  aovSeries,
  basePayments,
  buildHeatmap,
  formatAR,
  oldStock,
  periodConfigs,
  periodOptions,
  recurrentSeries,
  tendencies,
  topCustomers,
  topProducts,
  type Period,
} from "./analytics-data";
import { HeatmapPanel } from "./heatmap-panel";
import { ImmobilizedInventory } from "./immobilized-inventory";
import { NewVsRecurrent } from "./new-vs-recurrent-panel";
import { RankingsPanel } from "./rankings-panel";

function scale(value: number, factor: number): number {
  return Math.round(value * factor);
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("mes");
  const [previewOpen, setPreviewOpen] = useState(false);
  const loading = useInitialLoading();
  const config = periodConfigs[period];

  const payments = basePayments.map((payment) => ({
    ...payment,
    amount: scale(payment.amount, config.factor),
  }));

  const products = topProducts.map((product) => ({
    ...product,
    qty: Math.max(1, scale(product.qty, Math.max(1, config.factor))),
  }));

  const customers = topCustomers.map((customer) => ({
    ...customer,
    orders: Math.max(1, scale(customer.orders, config.factor)),
    amount: scale(customer.amount, config.factor),
  }));

  const kpis = [
    {
      title: "VENTAS TOTALES",
      value: formatAR(config.kpis.ventas),
      delta: config.kpis.deltaVentas,
      icon: TrendingUp,
      badge: "success" as const,
    },
    {
      title: "GASTOS",
      value: formatAR(config.kpis.gastos),
      delta: config.kpis.deltaGastos,
      icon: TrendingDown,
      badge: "secondary" as const,
    },
    {
      title: "INGRESOS NETOS",
      value: formatAR(config.kpis.neto),
      delta: config.kpis.deltaNeto,
      icon: DollarSign,
      badge: "success" as const,
    },
    {
      title: "MARGEN DE GANANCIA",
      value: `${config.kpis.margenPct.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`,
      delta: "del neto / ventas",
      icon: TrendingUp,
      badge: "outline" as const,
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
          <Button onClick={() => setPreviewOpen(true)}>Exportar reporte</Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Datos de demostración hasta conectar el backend.
      </p>

      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <>
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
                <Badge variant={kpi.badge}>{kpi.delta}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {config.label.toLowerCase()}
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
                  tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => formatAR(Number(value))}
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
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={payments}
                  dataKey="amount"
                  nameKey="method"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  label={(props) => {
                    const entry = props as unknown as {
                      method: string;
                      amount: number;
                    };
                    return `${entry.method} · ${Math.round(
                      (entry.amount / totalPayments) * 100
                    )}%`;
                  }}
                >
                  {payments.map((entry) => (
                    <Cell key={entry.method} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatAR(Number(value))}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeatmapPanel data={buildHeatmap(config.factor)} />
        </div>
        <div className="lg:col-span-1">
          <AovPanel
            series={aovSeries}
            currentAov={aovSeries[aovSeries.length - 1].aov}
            currentUpt={aovSeries[aovSeries.length - 1].upt}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ImmobilizedInventory items={oldStock} />
        </div>
        <div className="lg:col-span-1">
          <NewVsRecurrent series={recurrentSeries} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RankingsPanel products={products} />
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
                {customers.map((customer, index) => (
                  <TableRow key={customer.client}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{customer.client}</TableCell>
                    <TableCell className="text-right">{customer.orders}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAR(customer.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
        </>
      )}

      <ReportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Previsualización de reporte"
      >
        <ExecutiveReportSheet />
      </ReportPreviewDialog>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <KpiSkeleton count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelSkeleton
          height={340}
          titleClassName="h-5 w-44"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2"
        />
        <PanelSkeleton
          height={340}
          titleClassName="h-5 w-48"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <PanelSkeleton
          height={300}
          titleClassName="h-5 w-40"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2"
        />
        <PanelSkeleton
          height={300}
          titleClassName="h-5 w-40"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <PanelSkeleton
          height={320}
          titleClassName="h-5 w-40"
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        />
        <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
          <TableSkeleton rows={6} columns={4} />
        </div>
      </div>
    </div>
  );
}