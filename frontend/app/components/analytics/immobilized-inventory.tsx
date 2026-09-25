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
import { formatAR, type OldStockItem } from "./analytics-data";

const thresholdOptions = [30, 60, 90];

export function ImmobilizedInventory({ items }: { items: OldStockItem[] }) {
  const [threshold, setThreshold] = useState(60);

  const filtered = items
    .filter((item) => item.daysSinceSale >= threshold)
    .sort((a, b) => b.daysSinceSale - a.daysSinceSale);

  const immobilizedCapital = filtered.reduce(
    (sum, item) => sum + item.stock * item.cost,
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
        <Select value={String(threshold)} onValueChange={(value) => setThreshold(Number(value))}>
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
              {filtered.map((item) => (
                <TableRow key={item.product}>
                  <TableCell className="font-medium">{item.product}</TableCell>
                  <TableCell className="text-right">{item.daysSinceSale}</TableCell>
                  <TableCell className="text-right">{item.stock}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAR(item.stock * item.cost)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.daysSinceSale >= threshold * 2 ? (
                      <Badge variant="destructive">Liquidar</Badge>
                    ) : (
                      <Badge variant="warning">Revisar</Badge>
                    )}
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