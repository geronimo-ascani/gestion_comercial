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

import type { PurchaseOrder } from "../purchases/purchases-types";

interface ProviderDeliverySummary {
  providerId: string;
  provider: string;
  totalDays: number;
  orderCount: number;
}

function parseDate(value: string): number | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, day, month, year] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  return timestamp;
}

function getDeliveryRanking(orders: PurchaseOrder[]) {
  const totals = new Map<string, ProviderDeliverySummary>();

  for (const order of orders) {
    if (order.status !== "recibida" || !order.receivedDate) continue;

    const orderedAt = parseDate(order.date);
    const receivedAt = parseDate(order.receivedDate);
    if (orderedAt === null || receivedAt === null || receivedAt < orderedAt) {
      continue;
    }

    const current = totals.get(order.providerId) ?? {
      providerId: order.providerId,
      provider: order.provider,
      totalDays: 0,
      orderCount: 0,
    };
    current.totalDays += Math.round((receivedAt - orderedAt) / 86_400_000);
    current.orderCount += 1;
    totals.set(order.providerId, current);
  }

  return [...totals.values()]
    .map((entry) => ({
      ...entry,
      averageDays: entry.totalDays / entry.orderCount,
    }))
    .sort(
      (first, second) =>
        first.averageDays - second.averageDays ||
        first.provider.localeCompare(second.provider, "es")
    );
}

export function ProviderDeliveryRankingPanel({
  orders,
}: {
  orders: PurchaseOrder[];
}) {
  const ranking = getDeliveryRanking(orders);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiempo promedio de recepción por proveedor</CardTitle>
        <CardDescription>
          Días entre la fecha del pedido y la recepción de la mercadería.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay órdenes recibidas con fechas válidas.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Promedio</TableHead>
                <TableHead className="text-right">Órdenes recibidas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((entry, index) => (
                <TableRow key={entry.providerId}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{entry.provider}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.averageDays.toLocaleString("es-AR", {
                      maximumFractionDigits: 1,
                    })} días
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.orderCount}
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