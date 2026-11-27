import { useEffect, useMemo, useState } from "react";
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
  Combobox,
  type ComboboxOption,
} from "~/components/ui/combobox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
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
import {
  KpiSkeleton,
  PanelSkeleton,
  Skeleton,
  TableSkeleton,
} from "~/components/ui/skeleton";
import { useDebouncedValue } from "~/lib/use-debounced-value";

import { useCurrentUser } from "../auth/session-store";
import type { Customer } from "../customers/customers-types";
import { listCustomers } from "../customers/customers-api";
import { listarCategorias, type Categoria } from "../products/products-api";
import { listProviders } from "../purchases/providers-api";
import type { Provider } from "../purchases/purchases-types";

import {
  downloadAnalyticsReport,
  fetchAnalytics,
  type AnalyticsData,
  type AnalyticsFilters,
  type Period,
} from "./analytics-api";
import {
  formatAR,
  formatDelta,
  formatPercent,
  paymentColor,
  periodLabel,
  periodOptions,
} from "./analytics-data";
import { AovPanel } from "./aov-panel";
import { CategoryMarginPanel } from "./category-margin-panel";
import { DemandForecastPanel } from "./demand-forecast-panel";
import { HeatmapPanel } from "./heatmap-panel";
import { ImmobilizedInventory } from "./immobilized-inventory";
import { NewVsRecurrent } from "./new-vs-recurrent-panel";
import { PriceComparisonPanel } from "./price-comparison-panel";
import { ProviderDeliveryRankingPanel } from "./provider-delivery-ranking-panel";
import { RankingsPanel } from "./rankings-panel";

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  borderColor: "var(--color-border)",
  borderRadius: 8,
};

function normalizarBusqueda(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es");
}

function filtrarOpciones<T extends ComboboxOption>(
  opciones: T[],
  busqueda: string
): T[] {
  const texto = normalizarBusqueda(busqueda.trim());
  if (!texto) return opciones;
  // La primera opción ("Todos/Todas…") siempre queda visible para poder
  // volver a seleccionarla sin borrar la búsqueda.
  const [todas, ...resto] = opciones;
  if (!todas) return opciones;
  return [
    todas,
    ...resto.filter((opcion) =>
      normalizarBusqueda(
        [opcion.label, ...(opcion.keywords ?? [])].join(" ")
      ).includes(texto)
    ),
  ];
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("mes");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [idCliente, setIdCliente] = useState("");
  const [idProveedor, setIdProveedor] = useState("");
  const [diasInmovilizado, setDiasInmovilizado] = useState(60);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clientes, setClientes] = useState<Customer[]>([]);
  const [proveedores, setProveedores] = useState<Provider[]>([]);
  const [busquedaCategoria, setBusquedaCategoria] = useState("");
  const [busquedaCliente, setBusquedaCliente] = useState("");
  const [busquedaProveedor, setBusquedaProveedor] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const currentUser = useCurrentUser();
  const role = currentUser?.role;
  const isAdmin = role === "administrador";
  const canSeeSales = isAdmin || role === "ventas";
  const canSeeSupply = isAdmin || role === "abastecimiento";

  const busquedaCategoriaDebounced = useDebouncedValue(busquedaCategoria);
  const busquedaClienteDebounced = useDebouncedValue(busquedaCliente);
  const busquedaProveedorDebounced = useDebouncedValue(busquedaProveedor);

  const categoriaOptions = useMemo(
    () =>
      filtrarOpciones(
        [
          { value: "", label: "Todas las categorías" },
          ...categorias.map((categoria) => ({
            value: categoria.id_categoria,
            label: categoria.nombre,
          })),
        ],
        busquedaCategoriaDebounced
      ),
    [categorias, busquedaCategoriaDebounced]
  );
  const clienteOptions = useMemo(
    () =>
      filtrarOpciones(
        [
          { value: "", label: "Todos los clientes" },
          ...clientes.map((cliente) => ({
            value: cliente.id,
            label: `${cliente.firstName} ${cliente.lastName}`.trim(),
            keywords: [cliente.document, cliente.email],
          })),
        ],
        busquedaClienteDebounced
      ),
    [clientes, busquedaClienteDebounced]
  );
  const proveedorOptions = useMemo(
    () =>
      filtrarOpciones(
        [
          { value: "", label: "Todos los proveedores" },
          ...proveedores.map((proveedor) => ({
            value: proveedor.id,
            label: proveedor.name,
            keywords: [proveedor.cuit, proveedor.email],
          })),
        ],
        busquedaProveedorDebounced
      ),
    [proveedores, busquedaProveedorDebounced]
  );

  const filters: AnalyticsFilters = {
    periodo: period,
    desde: desde || undefined,
    hasta: hasta || undefined,
    id_categoria: idCategoria || undefined,
    id_cliente: canSeeSales ? idCliente || undefined : undefined,
    id_proveedor: canSeeSupply ? idProveedor || undefined : undefined,
    dias_inmovilizado: diasInmovilizado,
  };

  useEffect(() => {
    let active = true;
    listarCategorias()
      .then((result) => {
        if (active) setCategorias(result);
      })
      .catch(() => undefined);
    if (canSeeSales) {
      listCustomers()
        .then((result) => {
          if (active) setClientes(result);
        })
        .catch(() => undefined);
    }
    if (canSeeSupply) {
      listProviders()
        .then((result) => {
          if (active) setProveedores(result);
        })
        .catch(() => undefined);
    }
    return () => {
      active = false;
    };
  }, [canSeeSales, canSeeSupply]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchAnalytics(filters)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar las analíticas."
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    period,
    desde,
    hasta,
    idCategoria,
    idCliente,
    idProveedor,
    diasInmovilizado,
    canSeeSales,
    canSeeSupply,
    reloadKey,
  ]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await downloadAnalyticsReport(filters);
    } catch (cause: unknown) {
      setExportError(
        cause instanceof Error
          ? cause.message
          : "No se pudo descargar el reporte."
      );
    } finally {
      setExporting(false);
    }
  }

  const kpis = data?.kpis ?? null;
  const variacion = data?.variacion ?? null;

  const kpiCards = [
    {
      title: "VENTAS TOTALES",
      value: formatAR(kpis?.ventas ?? 0),
      delta: formatDelta(variacion?.ventas),
      deltaVariant:
        (variacion?.ventas ?? 0) >= 0 ? ("success" as const) : ("destructive" as const),
      icon: TrendingUp,
      visible: canSeeSales,
    },
    {
      title: "GASTOS",
      value: formatAR(kpis?.gastos ?? 0),
      delta: formatDelta(variacion?.gastos),
      deltaVariant: "secondary" as const,
      icon: TrendingDown,
      visible: isAdmin,
    },
    {
      title: "INGRESOS NETOS",
      value: formatAR(kpis?.neto ?? 0),
      delta: formatDelta(variacion?.neto),
      deltaVariant:
        (variacion?.neto ?? 0) >= 0 ? ("success" as const) : ("destructive" as const),
      icon: DollarSign,
      visible: isAdmin,
    },
    {
      title: isAdmin ? "MARGEN DE GANANCIA" : "MARGEN BRUTO",
      value: formatPercent(
        isAdmin ? kpis?.margenPct : kpis?.margenBrutoPct
      ),
      delta: isAdmin ? "del neto / ventas" : "sobre ventas netas",
      deltaVariant: "outline" as const,
      icon: TrendingUp,
      visible: canSeeSales,
    },
  ].filter((card) => card.visible);

  const payments = (data?.mediosPago ?? []).map((payment, index) => ({
    ...payment,
    color: paymentColor(index),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Analíticas</h1>
          <p className="text-muted-foreground">
            Indicadores y reportes del negocio.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={period}
            onValueChange={(value) => setPeriod(value as Period)}
          >
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
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="analytics-desde"
              className="shrink-0 text-muted-foreground"
            >
              Desde
            </Label>
            <Input
              id="analytics-desde"
              type="date"
              className="w-40"
              value={desde}
              onChange={(event) => setDesde(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="analytics-hasta"
              className="shrink-0 text-muted-foreground"
            >
              Hasta
            </Label>
            <Input
              id="analytics-hasta"
              type="date"
              className="w-40"
              value={hasta}
              onChange={(event) => setHasta(event.target.value)}
            />
          </div>
          <Combobox
            value={idCategoria}
            onValueChange={setIdCategoria}
            options={categoriaOptions}
            searchValue={busquedaCategoria}
            onSearchChange={setBusquedaCategoria}
            searchPlaceholder="Buscar categoría…"
            notFoundText="No se encontraron categorías"
            className="w-52"
          />
          {canSeeSales && (
            <Combobox
              value={idCliente}
              onValueChange={setIdCliente}
              options={clienteOptions}
              searchValue={busquedaCliente}
              onSearchChange={setBusquedaCliente}
              searchPlaceholder="Buscar por nombre, DNI/CUIT o email…"
              notFoundText="No se encontraron clientes"
              className="w-56"
            />
          )}
          {canSeeSupply && (
            <Combobox
              value={idProveedor}
              onValueChange={setIdProveedor}
              options={proveedorOptions}
              searchValue={busquedaProveedor}
              onSearchChange={setBusquedaProveedor}
              searchPlaceholder="Buscar por razón social, CUIT o email…"
              notFoundText="No se encontraron proveedores"
              className="w-56"
            />
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setDesde("");
              setHasta("");
              setIdCategoria("");
              setIdCliente("");
              setIdProveedor("");
              setBusquedaCategoria("");
              setBusquedaCliente("");
              setBusquedaProveedor("");
            }}
          >
            Limpiar filtros
          </Button>
          {isAdmin && data && (
            <Button onClick={() => void handleExport()} disabled={exporting}>
              {exporting ? "Generando..." : "Descargar PDF"}
            </Button>
          )}
        </div>
      </div>

      {exportError && (
        <p className="text-sm text-destructive">{exportError}</p>
      )}

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>No se pudieron cargar las analíticas</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : loading || !data ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          {kpiCards.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {kpiCards.map((kpi) => (
                <Card key={kpi.title}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardDescription>{kpi.title}</CardDescription>
                    <kpi.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl font-bold">{kpi.value}</div>
                      <Badge variant={kpi.deltaVariant}>{kpi.delta}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {periodLabel(data.periodo).toLowerCase()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {canSeeSales && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <Card className={isAdmin ? "lg:col-span-2" : "lg:col-span-3"}>
                <CardHeader>
                  <CardTitle>Tendencias de ventas</CardTitle>
                  <CardDescription>
                    {isAdmin
                      ? "Ventas vs gastos del período"
                      : "Ventas del período"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={data.tendencias}>
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
                      {isAdmin && (
                        <Bar
                          dataKey="gastos"
                          name="Gastos"
                          fill="#f87171"
                          radius={[4, 4, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle>Ventas por método de pago</CardTitle>
                    <CardDescription>Distribución del período</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {payments.length === 0 ? (
                      <div className="flex h-[220px] items-center justify-center rounded-lg border text-sm text-muted-foreground">
                        No hay pagos aprobados en el período.
                      </div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={payments}
                              dataKey="monto"
                              nameKey="medioPago"
                              innerRadius={50}
                              outerRadius={85}
                              paddingAngle={3}
                              label={(props) => {
                                const entry = props as unknown as {
                                  medioPago: string;
                                  monto: number;
                                  participacionPct: number;
                                };
                                return `${entry.medioPago} · ${Math.round(
                                  entry.participacionPct
                                )}%`;
                              }}
                            >
                              {payments.map((entry) => (
                                <Cell key={entry.id} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => formatAR(Number(value))}
                              contentStyle={tooltipStyle}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-2 space-y-2">
                          {payments.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className="size-2.5 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                {entry.medioPago}
                              </span>
                              <span className="font-medium">
                                {Math.round(entry.participacionPct)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {canSeeSales && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                {data.mapaCalor && <HeatmapPanel data={data.mapaCalor} />}
              </div>
              <div className="lg:col-span-1">
                <AovPanel
                  series={data.aovUpt}
                  currentAov={data.aovUptActual?.aov ?? 0}
                  currentUpt={data.aovUptActual?.upt ?? 0}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {canSeeSupply && (
              <div className={canSeeSales ? "lg:col-span-2" : "lg:col-span-3"}>
                <ImmobilizedInventory
                  items={data.inventarioInmovilizado}
                  summary={data.resumenInventarioInmovilizado}
                  umbral={diasInmovilizado}
                  onUmbralChange={setDiasInmovilizado}
                />
              </div>
            )}
            {canSeeSales && (
              <div className={canSeeSupply ? "lg:col-span-1" : "lg:col-span-3"}>
                <NewVsRecurrent
                  series={data.nuevosRecurrentes}
                  summary={data.resumenNuevosRecurrentes}
                />
              </div>
            )}
          </div>

          {canSeeSales && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className={canSeeSupply ? "" : "lg:col-span-2"}>
                <RankingsPanel
                  masVendidos={data.rankingProductos}
                  menosVendidos={data.productosMenosVendidos}
                  masRentables={data.productosMasRentables}
                />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Clientes por facturación</CardTitle>
                  <CardDescription>
                    Mayores compradores del período
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.rankingClientes.length === 0 ? (
                    <div className="flex h-32 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                      No hay ventas registradas en el período.
                    </div>
                  ) : (
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
                        {data.rankingClientes.map((customer, index) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">
                              {index + 1}
                            </TableCell>
                            <TableCell>{customer.nombre}</TableCell>
                            <TableCell className="text-right">
                              {customer.pedidos}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatAR(customer.facturacion)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {canSeeSupply && (
            <ProviderDeliveryRankingPanel ranking={data.rankingProveedores} />
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {canSeeSales && (
              <div className={canSeeSupply ? "" : "lg:col-span-2"}>
                <CategoryMarginPanel
                  categories={data.margenCategorias}
                  summary={{
                    costoVentas: kpis?.costoVentas ?? null,
                    margenBruto: kpis?.margenBruto ?? null,
                    margenBrutoPct: kpis?.margenBrutoPct ?? null,
                  }}
                />
              </div>
            )}
            {canSeeSupply && (
              <div className={canSeeSales ? "" : "lg:col-span-2"}>
                <PriceComparisonPanel comparisons={data.comparativaPrecios} />
              </div>
            )}
          </div>

          <DemandForecastPanel forecasts={data.prediccionDemanda} />
        </>
      )}

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
