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

import type { PriceComparison } from "./analytics-api";
import { formatAR } from "./analytics-data";

const MAX_PRODUCTS = 6;

function formatDate(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function PriceComparisonPanel({
  comparisons,
}: {
  comparisons: PriceComparison[];
}) {
  const rows = comparisons.slice(0, MAX_PRODUCTS).flatMap((product) =>
    product.proveedores.map((provider) => ({
      key: `${product.id}-${provider.id}`,
      producto: product.nombre,
      ...provider,
    }))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparativa de precios por proveedor</CardTitle>
        <CardDescription>
          Precio mínimo y promedio ponderado de compras del período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay compras registradas en el período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Precio mín.</TableHead>
                <TableHead className="text-right">Precio prom.</TableHead>
                <TableHead className="text-right">Última compra</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.producto}</TableCell>
                  <TableCell>{row.proveedor}</TableCell>
                  <TableCell className="text-right">
                    {formatAR(row.precioMinimo)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatAR(row.precioPromedio)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatDate(row.ultimaCompra)}
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
