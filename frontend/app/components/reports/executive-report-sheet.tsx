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

import {
  aovSeries,
  basePayments,
  buildHeatmap,
  formatAR,
  formatPercent,
  oldStock,
  periodConfigs,
  recurrentSeries,
  tendencies,
  topCustomers,
  topProducts,
  type Period,
} from "../analytics/analytics-data";
import { ReportPage } from "./report-page";

const axisTick = { fontSize: 10, fill: "#64748b" };
const legendStyle = { fontSize: 11 };

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="mb-2 border-b border-slate-200 pb-1.5 text-xs font-bold uppercase tracking-wide text-slate-700">
      {children}
    </h3>
  );
}

const tableHeadCls =
  "border-b-2 border-slate-300 bg-slate-100 px-1 py-1 text-left font-semibold text-slate-600";
const tableCellCls = "px-1 py-1 text-slate-600";

function scale(value: number, factor: number): number {
  return Math.round(value * factor);
}

const RADIAN = Math.PI / 180;

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

export function ExecutiveReportSheet({ period }: { period: Period }) {
  const config = periodConfigs[period];

  const generatedAt = new Date().toLocaleString("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const k = config.kpis;
  const kpis = [
    { label: "Ventas totales", value: formatAR(k.ventas), delta: k.deltaVentas },
    { label: "Gastos", value: formatAR(k.gastos), delta: k.deltaGastos },
    { label: "Ingresos netos", value: formatAR(k.neto), delta: k.deltaNeto },
    { label: "Margen de ganancia", value: formatPercent(k.margenPct), delta: null },
  ];

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

  const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
  const heatmap = buildHeatmap(config.factor);
  const heatLevels = [2, 4, 6, 8, 10];

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
            <p className="font-semibold text-slate-700">Período: {config.label}</p>
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
          <SectionTitle>Rendimiento financiero · Ventas vs Gastos (últimos 12 meses)</SectionTitle>
          <div className="h-[430px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tendencies}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="month"
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
                <AreaChart data={recurrentSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={axisTick} tickMargin={6} />
                  <YAxis
                    tick={axisTick}
                    tickMargin={4}
                    tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                  />
                  <Legend wrapperStyle={legendStyle} iconSize={10} />
                  <Area stackId="1" dataKey="recurrentes" name="Recurrentes" stroke="#2563eb" fill="#2563eb" fillOpacity={0.65} />
                  <Area stackId="1" dataKey="nuevos" name="Nuevos" stroke="#10b981" strokeDasharray="6 3" fill="#10b981" fillOpacity={0.55} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex min-w-0 flex-col">
            <SectionTitle>Métodos de pago</SectionTitle>
            <div className="h-[180px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={payments}
                    dataKey="amount"
                    nameKey="method"
                    innerRadius={38}
                    outerRadius={72}
                    paddingAngle={3}
                    label={renderSlicePercentLabel}
                  >
{payments.map((entry) => (
                      <Cell key={entry.method} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-1.5">
              {payments.map((entry) => (
                <div
                  key={entry.method}
                  className="flex items-center justify-between text-xs text-slate-600"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="truncate">{entry.method}</span>
                  </span>
                  <span className="font-semibold text-slate-700">
                    {Math.round((entry.amount / paymentsTotal) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 min-w-0">
          <SectionTitle>
            Ticket promedio (AOV) y UPT · evolución mensual
          </SectionTitle>
          <div className="h-[300px] min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aovSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={axisTick} tickMargin={6} />
                <YAxis
                  yAxisId="aov"
                  tick={axisTick}
                  tickMargin={4}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                />
                <YAxis
                  yAxisId="upt"
                  orientation="right"
                  domain={[0, 4]}
                  tick={axisTick}
                  tickMargin={4}
                  width={30}
                />
                <Legend wrapperStyle={legendStyle} iconSize={10} />
                <Line yAxisId="aov" type="monotone" dataKey="aov" name="AOV ($)" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line yAxisId="upt" type="monotone" dataKey="upt" name="UPT (art.)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </ReportPage>

      <ReportPage pageLabel="Página 3 de 3">
        <PageHeader />

        <section className="mt-5 min-w-0">
          <SectionTitle>Mapa de calor · Horarios pico de ventas</SectionTitle>
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: "auto repeat(14, minmax(0, 1fr))",
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
                key={heatmap.days[dayIndex]}
                day={heatmap.days[dayIndex]}
                row={row}
                hours={heatmap.hours}
              />
            ))}
          </div>
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
                {oldStock.map((item) => (
                  <tr key={item.product} className="border-b border-slate-100">
                    <td className={`${tableCellCls} max-w-0 truncate`}>
                      {item.product}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {formatAR(item.stock * item.cost)}
                    </td>
                    <td className={`${tableCellCls} text-right`}>
                      {item.daysSinceSale}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <SectionTitle>Escala de actividad por franja horaria</SectionTitle>
          <div className="flex items-center gap-4">
            {heatLevels.map((level) => (
              <span
                key={level}
                className="flex items-center gap-1.5 text-[10px] text-slate-500"
              >
                <span
                  className={`inline-block h-4 w-7 rounded-sm ${
                    level <= 2
                      ? "bg-blue-200"
                      : level <= 4
                        ? "bg-blue-300"
                        : level <= 6
                          ? "bg-blue-400"
                          : level <= 8
                            ? "bg-blue-500"
                            : "bg-blue-600"
                  }`}
                />
                {level === 2 ? "Baja" : level === 10 ? "Alta" : `${level} ventas`}
              </span>
            ))}
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
}: {
  day: string;
  row: number[];
  hours: number[];
}) {
  return (
    <>
      <span className="flex items-center pr-2 text-[10px] font-medium text-slate-500">
        {day}
      </span>
      {row.map((value, index) => (
        <span
          key={`${day}-${hours[index]}`}
          className={`flex h-6 items-center justify-center rounded-[3px] text-[10px] font-medium ${
            value <= 2
              ? "bg-blue-200 text-blue-900"
              : value <= 4
                ? "bg-blue-300 text-blue-950"
                : value <= 6
                  ? "bg-blue-400 text-white"
                  : value <= 8
                    ? "bg-blue-500 text-white"
                    : "bg-blue-600 text-white"
          }`}
        >
          {value}
        </span>
      ))}
    </>
  );
}