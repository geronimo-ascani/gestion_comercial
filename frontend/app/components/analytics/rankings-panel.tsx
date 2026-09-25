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
import { formatAR, formatPercent } from "./analytics-data";

export interface ProductRankRow {
  product: string;
  qty: number;
  unitSale: number;
  unitCost: number;
}

type View = "volumen" | "rentabilidad";

function unitMargin(product: ProductRankRow): number {
  return product.unitSale - product.unitCost;
}

function totalMargin(product: ProductRankRow): number {
  return unitMargin(product) * product.qty;
}

function marginBadge(product: ProductRankRow) {
  const pct = (unitMargin(product) / product.unitSale) * 100;
  const variant = pct >= 20 ? "success" : pct >= 13 ? "warning" : "destructive";
  return <Badge variant={variant}>{formatPercent(pct)}</Badge>;
}

export function RankingsPanel({ products }: { products: ProductRankRow[] }) {
  const [view, setView] = useState<View>("volumen");

  const byVolume = [...products].sort((a, b) => b.qty - a.qty);
  const byProfit = [...products].sort((a, b) => totalMargin(b) - totalMargin(a));

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

        {view === "volumen" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Importe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byVolume.map((product, index) => (
                <TableRow key={product.product}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{product.product}</TableCell>
                  <TableCell className="text-right">{product.qty}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAR(product.qty * product.unitSale)}
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
                <TableHead className="text-right">Costo unit.</TableHead>
                <TableHead className="text-right">Margen neto</TableHead>
                <TableHead className="text-right">Margen %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byProfit.map((product, index) => (
                <TableRow key={product.product}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{product.product}</TableCell>
                  <TableCell className="text-right">
                    {formatAR(product.unitCost)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAR(totalMargin(product))}
                  </TableCell>
                  <TableCell className="text-right">
                    {marginBadge(product)}
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