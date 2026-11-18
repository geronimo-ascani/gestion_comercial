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

import type { ProviderRanking } from "./analytics-api";
import { formatAR, formatNumber } from "./analytics-data";

function sortByDelivery(ranking: ProviderRanking[]): ProviderRanking[] {
  return [...ranking].sort((first, second) => {
    if (first.entregaPromedioDias === null && second.entregaPromedioDias === null) {
      return first.nombre.localeCompare(second.nombre, "es");
    }
    if (first.entregaPromedioDias === null) return 1;
    if (second.entregaPromedioDias === null) return -1;
    return (
      first.entregaPromedioDias - second.entregaPromedioDias ||
      first.nombre.localeCompare(second.nombre, "es")
    );
  });
}

export function ProviderDeliveryRankingPanel({
  ranking,
}: {
  ranking: ProviderRanking[];
}) {
  const ordered = sortByDelivery(ranking);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Proveedores: entrega y volumen</CardTitle>
        <CardDescription>
          Días entre la fecha del pedido y la recepción de la mercadería.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay compras registradas en el período.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Entrega promedio</TableHead>
                <TableHead className="text-right">Pedidos</TableHead>
                <TableHead className="text-right">Volumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordered.map((entry, index) => (
                <TableRow key={entry.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{entry.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.entregaPromedioDias === null
                      ? "—"
                      : `${formatNumber(entry.entregaPromedioDias, 1)} días`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.pedidos}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatAR(entry.volumenCompra)}
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
