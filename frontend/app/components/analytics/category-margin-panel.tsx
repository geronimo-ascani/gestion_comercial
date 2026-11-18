import { Badge } from "~/components/ui/badge";
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

import type { CategoryMargin } from "./analytics-api";
import { formatAR, formatPercent } from "./analytics-data";

function marginVariant(margenPct: number) {
  if (margenPct >= 30) return "success" as const;
  if (margenPct >= 15) return "warning" as const;
  return "destructive" as const;
}

export function CategoryMarginPanel({
  categories,
  summary,
}: {
  categories: CategoryMargin[];
  summary?: {
    costoVentas: number | null;
    margenBruto: number | null;
    margenBrutoPct: number | null;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Margen por categoría</CardTitle>
        <CardDescription>
          Ventas netas menos el costo actual de los productos vendidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary && summary.margenBrutoPct !== null && (
          <div className="flex flex-wrap gap-2">
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Costo de ventas</p>
              <p className="text-lg font-bold">
                {formatAR(summary.costoVentas ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Margen bruto</p>
              <p className="text-lg font-bold">
                {formatAR(summary.margenBruto ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/40 px-3 py-2">
              <p className="text-xs text-muted-foreground">Margen bruto %</p>
              <p className="text-lg font-bold">
                {formatPercent(summary.margenBrutoPct)}
              </p>
            </div>
          </div>
        )}
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay ventas registradas en el período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Venta neta</TableHead>
                <TableHead className="text-right">Margen</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.nombre}</TableCell>
                  <TableCell className="text-right">
                    {formatAR(category.ventaNeta)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAR(category.margen)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={marginVariant(category.margenPct)}>
                      {formatPercent(category.margenPct)}
                    </Badge>
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
