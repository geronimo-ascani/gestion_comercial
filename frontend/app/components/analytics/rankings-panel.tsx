import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
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

import type { ProductRanking } from "./analytics-api";
import { formatAR, formatNumber, formatPercent } from "./analytics-data";

type View = "volumen" | "rentabilidad";

function marginBadge(margenPct: number) {
  const variant =
    margenPct >= 20 ? "success" : margenPct >= 13 ? "warning" : "destructive";
  return <Badge variant={variant}>{formatPercent(margenPct)}</Badge>;
}

export function RankingsPanel({ products }: { products: ProductRanking[] }) {
  const [view, setView] = useState<View>("volumen");

  const byVolume = [...products].sort((a, b) => b.cantidad - a.cantidad);
  const byProfit = [...products].sort((a, b) => b.margen - a.margen);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Productos más vendidos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex w-full gap-2">
          <Button
            variant={view === "volumen" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setView("volumen")}
          >
            Volumen
          </Button>
          <Button
            variant={view === "rentabilidad" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setView("rentabilidad")}
          >
            Rentabilidad
          </Button>
        </div>

        {products.length === 0 ? (
          <EmptyState />
        ) : view === "volumen" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Venta neta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byVolume.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{product.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(product.cantidad, 3)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAR(product.ventaNeta)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Costo</TableHead>
                <TableHead className="text-right">Margen neto</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProfit.map((product, index) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{product.nombre}</TableCell>
                  <TableCell className="text-right">
                    {formatAR(product.costo)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAR(product.margen)}
                  </TableCell>
                  <TableCell className="text-right">
                    {marginBadge(product.margenPct)}
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

function EmptyState() {
  return (
    <div className="flex h-32 items-center justify-center rounded-lg border text-sm text-muted-foreground">
      No hay ventas registradas en el período.
    </div>
  );
}
