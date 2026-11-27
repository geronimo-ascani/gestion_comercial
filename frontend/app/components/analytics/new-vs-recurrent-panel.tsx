import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

import type {
  NewRecurrentPoint,
  NewRecurrentSummary,
} from "./analytics-api";
import { formatAR, formatPercent } from "./analytics-data";

export function NewVsRecurrent({
  series,
  summary,
}: {
  series: NewRecurrentPoint[];
  summary?: NewRecurrentSummary | null;
}) {
  const recurrentShare = summary?.recurrentesPct ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          Clientes nuevos vs recurrentes
          <Badge variant="success">
            {formatPercent(recurrentShare)} recurrentes
          </Badge>
        </CardTitle>
        <CardDescription>
          Origen de los ingresos del período: clientes que vuelven vs nuevos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {series.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            No hay ventas registradas en el período.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={series}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-muted-foreground)" />
              <YAxis
                stroke="var(--color-muted-foreground)"
                tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
              />
              <Tooltip
                formatter={(value) => formatAR(Number(value))}
                contentStyle={{
                  backgroundColor: "var(--color-popover)",
                  borderColor: "var(--color-border)",
                  borderRadius: 8,
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="recurrentes"
                name="Recurrentes"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.5}
              />
              <Area
                type="monotone"
                dataKey="nuevos"
                name="Nuevos"
                stackId="1"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
