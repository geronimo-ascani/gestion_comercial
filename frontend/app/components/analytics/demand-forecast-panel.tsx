import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

import type { DemandForecast } from "./analytics-api";
import { formatNumber } from "./analytics-data";

export function DemandForecastPanel({
  forecasts,
}: {
  forecasts: DemandForecast[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Predicción de demanda</CardTitle>
        <CardDescription>
          Proyección del próximo mes por producto, según su historial.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forecasts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay historial de ventas suficiente para proyectar demanda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Último mes</TableHead>
                <TableHead className="text-right">Pronóstico</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecasts.map((forecast) => (
                <TableRow key={forecast.id}>
                  <TableCell className="font-medium">{forecast.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(
                      forecast.historial[forecast.historial.length - 1] ?? 0,
                      3
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatNumber(forecast.pronostico[0] ?? 0, 3)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
