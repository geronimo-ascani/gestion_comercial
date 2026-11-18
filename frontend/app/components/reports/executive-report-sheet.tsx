import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { AnalyticsData, Period } from "../analytics/analytics-api";
import {
  formatAR,
  formatCompact,
  formatPercent,
  heatDayLabel,
  paymentColor,
  periodLabel,
} from "../analytics/analytics-data";
import { ReportPage } from "./report-page";

const axisTick = { fontSize: 10, fill: "#64748b" };
const legendStyle = { fontSize: 11 };

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 border-b border-slate-200 pb-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
      {children}
    </h3>
  );
}

const tableHeadCls =
  "border-b-2 border-slate-300 bg-slate-100 px-1 py-1 text-left font-semibold text-slate-600";
const tableCellCls = "px-1 py-1 text-slate-600";

const RADIAN = Math.PI / 180;

function variationLabel(value: number | null | undefined): string | null {
  if (value == null) return null;
  return `${value > 0 ? "+" : ""}${formatPercent(value)}`;
}

function renderSlicePercentLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
}) {
  const {
    cx = 0,
    cy = 0,
    midAngle = 0,
    innerRadius = 0,
    outerRadius = 0,
    percent = 0,
  } = props;
  const pct = Math.round(percent * 100);
  if (pct <= 0) return null;
  const radius = (innerRadius + outerRadius) / 2;
  return (
    <text
      x={cx + radius * Math.cos(-midAngle * RADIAN)}
      y={cy + radius * Math.sin(-midAngle * RADIAN)}
      fill="#ffffff"
      fontSize={10}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {pct}%
    </text>
  );
}

export function ExecutiveReportSheet({
  period,
  data,
}: {
  period: Period;
  data: AnalyticsData;
}) {
  const generatedAt = new Date().toLocaleString("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const k = data.kpis;
  const kpis = [
    {
      label: "Ventas totales",
      value: formatAR(k?.ventas ?? 0),
      delta: variationLabel(data.variacion?.ventas),
    },
    {
      label: "Gastos",
      value: formatAR(k?.gastos ?? 0),
      delta: variationLabel(data.variacion?.gastos),
    },
    {
      label: "Ingresos netos",
      value: formatAR(k?.neto ?? 0),
      delta: variationLabel(data.variacion?.neto),
    },
    {
      label: "Margen de ganancia",
      value: formatPercent(k?.margenPct),
      delta: null,
    },
  ];

  const payments = data.mediosPago.map((payment, index) => ({
    ...payment,
    color: paymentColor(index),
  }));
  const paymentsTotal = payments.reduce((sum, item) => sum + item.monto, 0);

  const products = data.rankingProductos.map((product, index) => ({
    rank: index + 1,
    product: product.nombre,
    qty: product.cantidad,
  }));

  const customers = data.rankingClientes.map((customer, index) => ({
    rank: index + 1,
    client: customer.nombre,
    amount: customer.facturacion,
  }));

  const heatmap = data.mapaCalor;
  const heatMax = heatmap
    ? Math.max(...heatmap.values.flatMap((row) => row), 1)
    : 1;

  return (
    <>
      <ReportPage pageLabel="Página 1 de 3">
        <header className="flex items-start justify-between gap-4 border-b-2 border-slate-300 pb-3">
          <div>
            <h2 className="text-xl font-bold uppercase tracking-wide text-slate-800">
              Reporte ejecutivo de gestión
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Análisis de gestión comercial · Datos consolidados del período
            </p>
          </div>
          <div className="text-right text-xs leading-tight text-slate-500">
            <p className="font-semibold text-slate-700">
              Período: {periodLabel(period)}
            </p>
            <p>Generado el {generatedAt}</p>
          </div>
        </header>

        <section className="mt-6">
          <SectionTitle>Indicadores clave del período</SectionTitle>
          <div className="grid grid-cols-4 gap-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="rounded-md border border-slate-200 bg-slate-50 p-3"
              >
                <p className="truncate text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
                  {kpi.label}
                </p>
                <p className="mt-1 text-lg font-bold leading-tight text-slate-800">
                  {kpi.value}
                </p>
                {kpi.delta ? (
                  <span
                    className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      kpi.delta.startsWith("-")
                        ? "bg-red-100 text-red-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {kpi.delta.startsWith("-") ? "▼" : "▲"} {kpi.delta}
                  </span>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-400">
                    del neto / ventas
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 min-w-0">
          <SectionTitle>
            Rendimiento financiero · Ventas vs Gastos ({periodLabel(period)})
          </SectionTitle>
          <div className="h-[430px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.tendencias}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="label"
                  tick={axisTick}
                  tickMargin={8}
                  interval={0}
                />
                <YAxis
                  tick={axisTick}
                  tickMargin={4}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                />
                <Legend wrapperStyle={legendStyle} iconSize={10} />
                <Bar
                  dataKey="ventas"
                  name="Ventas"
                  fill="#2563eb"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={34}
                  label={{
                    position: "insideTop",
                    fill: "#ffffff",
                    fontSize: 9,
                    formatter: () => "V",
                  }}
                />
                <Bar
                  dataKey="gastos"
                  name="Gastos"
                  fill="#f87171"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={34}
                  label={{
                    position: "insideTop",
                    fill: "#ffffff",
                    fontSize: 9,
                    formatter: () => "G",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </ReportPage>

      <ReportPage pageLabel="Página 2 de 3">
        <PageHeader />

        <section className="mt-5 grid grid-cols-3 gap-5">
          <div className="col-span-2 min-w-0">
            <SectionTitle>Clientes nuevos vs recurrentes</SectionTitle>
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.nuevosRecurrentes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={axisTick} tickMargin={6} />
                  <YAxis
                    tick={axisTick}
                    tickMargin={4}
                    tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                  />
                  <Legend wrapperStyle={legendStyle} iconSize={10} />
                  <Area
                    stackId="1"
                    dataKey="recurrentes"
                    name="Recurrentes"
                    stroke="#2563eb"
                    fill="#2563eb"
                    fillOpacity={0.65}
                  />
                  <Area
                    stackId="1"
                    dataKey="nuevos"
                    name="Nuevos"
                    stroke="#10b981"
                    strokeDasharray="6 3"
                    fill="#10b981"
                    fillOpacity={0.55}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <SectionTitle>Métodos de pago</SectionTitle>
            {payments.length === 0 || paymentsTotal === 0 ? (
              <p className="text-[10px] text-slate-400">
                Sin pagos aprobados en el período.
              </p>
            ) : (
              <>
                <div className="h-[180px] w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={payments}
                        dataKey="monto"
                        nameKey="medioPago"
                        innerRadius={38}
                        outerRadius={72}
                        paddingAngle={3}
                        label={renderSlicePercentLabel}
                      >
                        {payments.map((entry) => (
                          <Cell key={entry.id} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1.5">
                  {payments.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between text-xs text-slate-600"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate">{entry.medioPago}</span>
                      </span>
                      <span className="font-semibold text-slate-700">
                        {Math.round((entry.monto / paymentsTotal) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section className="mt-8 min-w-0">
          <SectionTitle>
            Ticket promedio (AOV) y UPT · evolución del período
          </SectionTitle>
          <div className="h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.aovUpt}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={axisTick} tickMargin={6} />
                <YAxis
                  yAxisId="aov"
                  tick={axisTick}
                  tickMargin={4}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                />
                <YAxis
                  yAxisId="upt"
                  orientation="right"
                  domain={[0, "auto"]}
                  tick={axisTick}
                  tickMargin={4}
                  width={30}
                />
                <Legend wrapperStyle={legendStyle} iconSize={10} />
                <Line
                  yAxisId="aov"
                  type="monotone"
                  dataKey="aov"
                  name="AOV ($)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="upt"
                  type="monotone"
                  dataKey="upt"
                  name="UPT (art.)"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </ReportPage>

      <ReportPage pageLabel="Página 3 de 3">
        <PageHeader />

        <section className="mt-5 min-w-0">
          <SectionTitle>Mapa de calor · Horarios pico de ventas</SectionTitle>
          {heatmap ? (
            <div
              className="grid gap-1"
              style={{
                gridTemplateColumns: `auto repeat(${heatmap.hours.length}, minmax(0, 1fr))`,
              }}
            >
              <span />
              {heatmap.hours.map((hour) => (
                <span
                  key={hour}
                  className="text-center text-[9px] text-slate-400"
                >
                  {hour}h
                </span>
              ))}
              {heatmap.values.map((row, dayIndex) => (
                <HeatmapRow
                  key={dayIndex}
                  day={heatDayLabel(dayIndex)}
                  row={row}
                  hours={heatmap.hours}
                  max={heatMax}
                />
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-slate-400">
              Sin datos de horarios para el período.
            </p>
          )}
          <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500">
            <span>Menos</span>
            <div className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-blue-200 via-blue-400 to-blue-600" />
            <span>Más ventas</span>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-3 gap-5">
          <div className="min-w-0">
            <SectionTitle>Top productos</SectionTitle>
            <table className="w-full table-fixed border-collapse text-[9px]">
              <thead>
                <tr>
                  <th className={`${tableHeadCls} w-8`}>#</th>
                  <th className={tableHeadCls}>Producto</th>
                  <th className={`${tableHeadCls} w-14 text-right`}>Unid.</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.product} className="border-b border-slate-100">
                    <td className={`${tableCellCls} font-semibold text-slate-700`}>
                      {product.rank}
                    </td>
                    <td className={`${tableCellCls} max-w-0 truncate`}>
                      {product.product}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {product.qty.toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="min-w-0">
            <SectionTitle>Top clientes</SectionTitle>
            <table className="w-full table-fixed border-collapse text-[9px]">
              <thead>
                <tr>
                  <th className={`${tableHeadCls} w-8`}>#</th>
                  <th className={tableHeadCls}>Cliente</th>
                  <th className={`${tableHeadCls} w-14 text-right`}>Fact.</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.client} className="border-b border-slate-100">
                    <td className={`${tableCellCls} font-semibold text-slate-700`}>
                      {customer.rank}
                    </td>
                    <td className={`${tableCellCls} max-w-0 truncate`}>
                      {customer.client}
                    </td>
                    <td className={`${tableCellCls} text-right font-semibold text-slate-700`}>
                      {formatAR(customer.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="min-w-0">
            <SectionTitle>Inventario inmovilizado</SectionTitle>
            <table className="w-full table-fixed border-collapse text-[9px]">
              <thead>
                <tr>
                  <th className={tableHeadCls}>Producto</th>
                  <th className={`${tableHeadCls} text-right`}>Capital</th>
                  <th className={`${tableHeadCls} w-12 text-right`}>Días</th>
                </tr>
              </thead>
              <tbody>
                {data.inventarioInmovilizado.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className={`${tableCellCls} max-w-0 truncate`}>
                      {item.nombre}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {formatAR(item.capital)}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {item.diasSinVenta === null ? "—" : item.diasSinVenta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle>Escala de actividad por franja horaria</SectionTitle>
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <span>Baja</span>
            {[0.2, 0.4, 0.6, 0.8, 1].map((alpha) => (
              <span
                key={alpha}
                className="inline-block h-4 w-7 rounded-sm"
                style={{ backgroundColor: `rgba(37, 99, 235, ${alpha})` }}
              />
            ))}
            <span>Alta</span>
          </div>
        </section>
      </ReportPage>
    </>
  );
}

function PageHeader() {
  return (
    <header className="border-b border-slate-200 pb-2">
      <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-slate-400">
        Reporte Ejecutivo de Gestión
      </p>
    </header>
  );
}

function HeatmapRow({
  day,
  row,
  hours,
  max,
}: {
  day: string;
  row: number[];
  hours: number[];
  max: number;
}) {
  return (
    <>
      <span className="flex items-center pr-2 text-[10px] font-medium text-slate-500">
        {day}
      </span>
      {row.map((value, index) => {
        const alpha = max === 0 ? 0.08 : 0.12 + (value / max) * 0.88;
        const strong = alpha > 0.55;
        return (
          <span
            key={`${day}-${hours[index]}`}
            className="flex h-6 items-center justify-center rounded-[3px] text-[8px] font-medium"
            style={{
              backgroundColor: `rgba(37, 99, 235, ${alpha})`,
              color: strong ? "#ffffff" : "#1e3a8a",
            }}
          >
            {value === 0 ? "" : formatCompact(value)}
          </span>
        );
      })}
    </>
  );
}
