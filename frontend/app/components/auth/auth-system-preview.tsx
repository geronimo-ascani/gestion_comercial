import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";

const accent = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500"];

function KpiRow() {
  const kpis = [
    { label: "Ventas totales", value: "$1,23M", dot: accent[0] },
    { label: "Gastos", value: "$820k", dot: accent[1] },
    { label: "Ingresos netos", value: "$410k", dot: accent[2] },
    { label: "Margen", value: "33,4%", dot: accent[3] },
  ];
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-md bg-card p-1.5 ring-1 ring-foreground/10"
        >
          <div className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${kpi.dot}`} />
            <span className="h-1.5 w-10 rounded-full bg-muted" />
          </div>
          <p className="mt-1 text-[8px] font-bold leading-none">{kpi.value}</p>
        </div>
      ))}
    </div>
  );
}

function Bars({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex h-20 items-end gap-1 rounded-md bg-card p-2 ring-1 ring-foreground/10">
      {values.map((value, index) => (
        <div key={index} className="flex flex-1 flex-col justify-end gap-0.5">
          <div
            className="w-full rounded-sm bg-blue-500"
            style={{ height: `${(value / max) * 100}%` }}
          />
          <div
            className="w-full rounded-sm bg-red-400/80"
            style={{ height: `${(value / max) * 55}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function Donut() {
  return (
    <div
      className="relative h-16 w-16 shrink-0 rounded-full"
      style={{
        background:
          "conic-gradient(#3b82f6 0 48%, #f59e0b 48% 89%, #10b981 89% 100%)",
      }}
    >
      <div className="absolute inset-2 rounded-full bg-card" />
    </div>
  );
}

function areaPath(values: number[], width = 100, height = 40) {
  const max = Math.max(...values);
  const step = width / (values.length - 1);
  const points = values.map(
    (value, index) =>
      `${(index * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`
  );
  return `M0,${height} L${points.join(" L")} L${width},${height} Z`;
}

function AreaMini() {
  const recurrentes = [40, 48, 52, 58, 62, 70, 76, 82];
  const nuevos = [22, 26, 24, 30, 28, 34, 32, 38];
  return (
    <svg viewBox="0 0 100 40" className="h-16 w-full">
      <path d={areaPath(recurrentes)} fill="#3b82f6" fillOpacity={0.5} />
      <path d={areaPath(nuevos)} fill="#10b981" fillOpacity={0.4} />
    </svg>
  );
}

function HeatmapMini() {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const values = [
    [2, 3, 4, 4, 5, 3, 2, 1],
    [2, 3, 4, 5, 5, 4, 2, 1],
    [3, 4, 5, 6, 6, 4, 3, 2],
    [3, 4, 6, 7, 7, 5, 3, 2],
    [4, 5, 7, 9, 8, 6, 4, 3],
    [6, 8, 10, 12, 11, 9, 6, 4],
    [1, 2, 2, 3, 3, 2, 2, 1],
  ];
  const max = 12;
  return (
    <div className="rounded-md bg-card p-2 ring-1 ring-foreground/10">
      <div className="mb-1 flex justify-between text-[6px] text-muted-foreground">
        <span>Mapa de calor de horarios pico</span>
        <span>8h–16h</span>
      </div>
      <div className="flex gap-0.5">
        <div className="mr-1 flex flex-col gap-0.5">
          {days.map((day) => (
            <span
              key={day}
              className="flex h-3 items-center text-[6px] leading-none text-muted-foreground"
            >
              {day}
            </span>
          ))}
        </div>
        {Array.from({ length: 8 }, (_, col) => (
          <div key={col} className="flex flex-1 flex-col gap-0.5">
            {values.map((row, rowIndex) => {
              const alpha = 0.1 + (row[col] / max) * 0.85;
              return (
                <div
                  key={rowIndex}
                  className="h-3 flex-1 rounded-[1px]"
                  style={{ backgroundColor: `rgba(59,130,246,${alpha})` }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniTable() {
  const rows = [
    { width: "w-14", color: "bg-emerald-500/80" },
    { width: "w-18", color: "bg-violet-500/80" },
    { width: "w-12", color: "bg-emerald-500/80" },
    { width: "w-16", color: "bg-red-500/80" },
  ];
  return (
    <div className="space-y-1 rounded-md bg-card p-2 ring-1 ring-foreground/10">
      <div className="flex justify-between text-[6px] text-muted-foreground">
        <span>Pedidos recientes</span>
      </div>
      {rows.map((row, index) => (
        <div
          key={index}
          className="flex items-center justify-between rounded-sm bg-muted/50 px-1 py-0.5"
        >
          <div className={`h-1.5 ${row.width} rounded-full bg-foreground/25`} />
          <span className={`h-1.5 w-7 rounded-full ${row.color}`} />
        </div>
      ))}
    </div>
  );
}

function BrowserMockup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[540px]">
      {/* Chrome del navegador (estilo macOS) */}
      <div className="flex items-center gap-1.5 rounded-t-xl bg-slate-800 px-3 py-2.5 dark:bg-slate-950">
        <span className="size-2 rounded-full bg-red-400" />
        <span className="size-2 rounded-full bg-amber-400" />
        <span className="size-2 rounded-full bg-emerald-400" />
        <div className="ml-2 h-3.5 flex-1 rounded-full bg-slate-700 px-2 text-left text-[7px] leading-[14px] text-slate-300">
          {label}
        </div>
      </div>
      {/* Pantalla */}
      <div className="relative h-[340px] overflow-hidden rounded-b-xl bg-background shadow-2xl ring-1 ring-foreground/10">
        {children}
      </div>
    </div>
  );
}

function ScreenTopbar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
      <div className="flex items-center gap-1.5">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary text-[6px] font-bold text-primary-foreground">
          GC
        </div>
        <span className="text-[8px] font-semibold">{title}</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="h-2.5 w-6 rounded-full bg-muted" />
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[6px] font-bold text-white">
          AD
        </div>
      </div>
    </div>
  );
}

function ScreenBody({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 top-[30px] flex flex-col gap-1.5 overflow-hidden p-2">
      {children}
    </div>
  );
}

export function DashboardScreen() {
  return (
    <BrowserMockup label="app.gestioncomercial.com/dashboard">
      <ScreenTopbar title="Panel principal" />
      <ScreenBody>
        <KpiRow />
        <div className="flex flex-1 gap-1.5">
          <div className="flex flex-1 flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-medium text-muted-foreground">
                Tendencias de ventas
              </span>
              <div className="flex gap-1">
                <span className="flex items-center gap-0.5 text-[6px] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-blue-500" /> V
                </span>
                <span className="flex items-center gap-0.5 text-[6px] text-muted-foreground">
                  <span className="h-1 w-1 rounded-full bg-red-400" /> G
                </span>
              </div>
            </div>
            <Bars values={[42, 55, 48, 66, 60, 78, 70, 88]} />
          </div>
          <div className="w-32">
            <div className="rounded-md bg-red-500/10 p-1.5 ring-1 ring-red-500/30">
              <p className="text-[7px] font-semibold text-red-500">
                Alertas de stock crítico
              </p>
              <div className="mt-1 space-y-1">
                {[
                  { w: "w-12", n: 2 },
                  { w: "w-14", n: 5 },
                  { w: "w-10", n: 1 },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div
                      className={`h-1.5 ${item.w} rounded-full bg-red-500/50`}
                    />
                    <span className="text-[6px] font-bold text-red-500">
                      {item.n}u
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <MiniTable />
      </ScreenBody>
    </BrowserMockup>
  );
}

export function AnalyticsScreen() {
  return (
    <BrowserMockup label="app.gestioncomercial.com/analiticas">
      <ScreenTopbar title="Reporte ejecutivo de gestión" />
      <ScreenBody>
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-medium text-muted-foreground">
            Inteligencia de negocio · últimos 12 meses
          </span>
          <Badge variant="info" className="h-3.5 px-1 text-[5px]">
            Zoom analítico
          </Badge>
        </div>
        <HeatmapMini />
        <div className="flex flex-1 gap-1.5">
          <div className="flex flex-1 flex-col gap-1.5 rounded-md bg-card p-2 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between">
              <span className="text-[7px] font-medium text-muted-foreground">
                Clientes nuevos vs recurrentes
              </span>
              <Badge variant="success" className="h-3 px-1 text-[5px]">
                74% rec.
              </Badge>
            </div>
            <AreaMini />
            <div className="flex gap-2">
              <span className="flex items-center gap-0.5 text-[6px] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-blue-500" /> Recurrentes
              </span>
              <span className="flex items-center gap-0.5 text-[6px] text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-emerald-500" /> Nuevos
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5 rounded-md bg-card p-2 ring-1 ring-foreground/10">
            <Donut />
            <div className="space-y-0.5">
              {[
                { label: "Efectivo", dot: "bg-blue-500", pct: "48%" },
                { label: "Tarjeta", dot: "bg-amber-500", pct: "41%" },
                { label: "M.Pago", dot: "bg-emerald-500", pct: "11%" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1">
                  <span className={`h-1 w-1 rounded-full ${item.dot}`} />
                  <span className="text-[6px] text-muted-foreground">
                    {item.label} {item.pct}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScreenBody>
    </BrowserMockup>
  );
}

export function ProductsScreen() {
  const products = [
    { name: "Coca-Cola 500ml", width: "w-12", cost: "$620", sale: "$980", margin: "58%", stock: "ok" as const },
    { name: "Aceite 900ml", width: "w-14", cost: "$1.280", sale: "$1.710", margin: "34%", stock: "critical" as const },
    { name: "Harina 0000 1kg", width: "w-16", cost: "$610", sale: "$780", margin: "28%", stock: "ok" as const },
    { name: "Gaseosa 1,5L", width: "w-13", cost: "$720", sale: "$980", margin: "36%", stock: "out" as const },
    { name: "Leche 1L", width: "w-11", cost: "$372", sale: "$410", margin: "10%", stock: "critical" as const },
  ];

  return (
    <BrowserMockup label="app.gestioncomercial.com/productos">
      <ScreenTopbar title="Gestión de productos" />
      <ScreenBody>
        <div className="flex items-center justify-between">
          <span className="text-[7px] font-medium text-muted-foreground">
            Inventario · margen y precio automáticos
          </span>
          <div className="rounded bg-primary px-1 py-0.5 text-[6px] font-semibold text-primary-foreground">
            + Nuevo producto
          </div>
        </div>
        <div className="flex flex-1 flex-col overflow-hidden rounded-md bg-card ring-1 ring-foreground/10">
          <div className="flex items-center justify-between border-b border-border bg-muted/50 px-2 py-1 text-[6px] font-semibold text-muted-foreground">
            <span className="w-16">Producto</span>
            <span className="w-7 text-right">Costo</span>
            <span className="w-7 text-right">Venta</span>
            <span className="w-6 text-right">Margen</span>
            <span className="w-12 text-right">Stock</span>
          </div>
          {products.map((product) => (
            <div
              key={product.name}
              className="flex items-center justify-between border-b border-border px-2 py-1 last:border-b-0"
            >
              <span className="flex w-16 items-center gap-1">
                <span
                  className={`h-1.5 ${product.width} rounded-full bg-foreground/25`}
                />
                <span className="truncate text-[6px] text-muted-foreground">
                  {product.name}
                </span>
              </span>
              <span className="w-7 text-right text-[6px]">{product.cost}</span>
              <span className="w-7 text-right text-[6px] font-semibold">
                {product.sale}
              </span>
              <span className="w-6 text-right text-[6px] text-emerald-500">
                {product.margin}
              </span>
              <span className="flex w-12 justify-end">
                {product.stock === "ok" && (
                  <Badge variant="success" className="h-3.5 px-1 text-[5px]">
                    En stock
                  </Badge>
                )}
                {product.stock === "critical" && (
                  <Badge variant="warning" className="h-3.5 px-1 text-[5px]">
                    Stock crítico
                  </Badge>
                )}
                {product.stock === "out" && (
                  <Badge variant="destructive" className="h-3.5 px-1 text-[5px]">
                    Sin stock
                  </Badge>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1 text-[6px] text-muted-foreground">
          <span className="h-1 w-1 rounded-full bg-emerald-500" />
          Inventario sincronizado · alertas de stock crítico activas
        </div>
      </ScreenBody>
    </BrowserMockup>
  );
}

export type SystemVariant = "dashboard" | "analiticas" | "productos";

const miniScreens: Record<SystemVariant, () => ReactNode> = {
  dashboard: () => <DashboardScreen />,
  analiticas: () => <AnalyticsScreen />,
  productos: () => <ProductsScreen />,
};

export function MiniScreen({
  variant,
  className,
  scale = 0.4,
}: {
  variant: SystemVariant;
  className?: string;
  scale?: number;
}) {
  return (
    <div
      className={cn("pointer-events-none absolute", className)}
      style={{ width: 540 * scale }}
    >
      <div
        className="origin-top-left drop-shadow-2xl"
        style={{ width: 540, transform: `scale(${scale})` }}
      >
        {miniScreens[variant]()}
      </div>
    </div>
  );
}

export const systemMockups: {
  variant: SystemVariant;
  render: () => ReactNode;
}[] = [
  { variant: "dashboard", render: () => <DashboardScreen /> },
  { variant: "analiticas", render: () => <AnalyticsScreen /> },
  { variant: "productos", render: () => <ProductsScreen /> },
];