import { useState } from "react";
import { PackageX } from "lucide-react";

import { Badge } from "~/components/ui/badge";
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

import type { ImmobilizedItem } from "./analytics-api";
import { formatAR, formatNumber } from "./analytics-data";

const thresholdOptions = [30, 60, 90];

function isImmobilized(item: ImmobilizedItem, threshold: number): boolean {
  return item.diasSinVenta === null || item.diasSinVenta >= threshold;
}

export function ImmobilizedInventory({ items }: { items: ImmobilizedItem[] }) {
  const [threshold, setThreshold] = useState(60);

  const filtered = items
    .filter((item) => isImmobilized(item, threshold))
    .sort((a, b) => {
      if (a.diasSinVenta === null && b.diasSinVenta === null) {
        return a.nombre.localeCompare(b.nombre, "es");
      }
      if (a.diasSinVenta === null) return -1;
      if (b.diasSinVenta === null) return 1;
      return b.diasSinVenta - a.diasSinVenta;
    });

  const immobilizedCapital = filtered.reduce(
    (sum, item) => sum + item.capital,
    0
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="size-4 text-muted-foreground" />
            Inventario inmovilizado
          </CardTitle>
          <CardDescription>
            Productos sin ventas que inmovilizan capital.
          </CardDescription>
        </div>
        <Select
          value={String(threshold)}
          onValueChange={(value) => setThreshold(Number(value))}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {thresholdOptions.map((option) => (
              <SelectItem key={option} value={String(option)}>
                Desde {option} días
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Productos detectados</p>
            <p className="text-xl font-bold">{filtered.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Capital inmovilizado</p>
            <p className="text-xl font-bold">{formatAR(immobilizedCapital)}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Sugerimos liquidar para recuperar capital.
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="flex h-32 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            No hay productos inmovilizados con este umbral.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Días sin venderse</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Capital inmovilizado</TableHead>
                <TableHead className="text-right">Sugerencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const days = item.diasSinVenta;
                const liquidate = days === null || days >= threshold * 2;
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nombre}</TableCell>
                    <TableCell className="text-right">
                      {days === null ? "Nunca vendido" : days}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(item.stock, 3)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAR(item.capital)}
                    </TableCell>
                    <TableCell className="text-right">
                      {liquidate ? (
                        <Badge variant="destructive">Liquidar</Badge>
                      ) : (
                        <Badge variant="warning">Revisar</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
