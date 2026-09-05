import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react";

const kpis = [
  { title: "VENTAS TOTALES", icon: TrendingUp },
  { title: "GASTOS", icon: TrendingDown },
  { title: "INGRESOS NETOS", icon: DollarSign },
  { title: "MARGEN DE GANANCIA", icon: TrendingUp },
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Panel principal</h1>
          <p className="text-muted-foreground">
            Métricas operativas del sistema para el período actual.
          </p>
        </div>
        <Button variant="outline">Exportar reporte</Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardDescription>{kpi.title}</CardDescription>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">—</div>
              <p className="text-xs text-muted-foreground">
                Sin datos disponibles
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Tendencias de ventas</CardTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <span className="text-xl leading-none">⋮</span>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
              Sin datos de ventas disponibles
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-red-500 flex items-center gap-2">
              Alertas de stock crítico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[300px] items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
              No hay alertas de stock crítico
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Pedidos recientes</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <span className="text-xl leading-none">⋮</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center rounded-lg border text-center text-sm text-muted-foreground">
            No hay pedidos recientes
          </div>
        </CardContent>
      </Card>
    </div>
  );
}