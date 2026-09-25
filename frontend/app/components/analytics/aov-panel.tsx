import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatAR } from "./analytics-data";

const tooltipStyle = {
  backgroundColor: "var(--color-popover)",
  borderColor: "var(--color-border)",
  borderRadius: 8,
};

export function AovPanel({
  series,
  currentAov,
  currentUpt,
}: {
  series: { month: string; aov: number; upt: number }[];
  currentAov: number;
  currentUpt: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Ticket promedio (AOV) y UPT</CardTitle>
        <CardDescription>
          Cuánto gasta y cuántos artículos lleva cada cliente por compra.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">Ticket promedio</p>
            <p className="text-lg font-bold">{formatAR(currentAov)}</p>
          </div>
          <div className="rounded-lg border bg-muted/40 px-3 py-2">
            <p className="text-xs text-muted-foreground">UPT (art./compra)</p>
            <p className="text-lg font-bold">{currentUpt}</p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="month" stroke="var(--color-muted-foreground)" />
            <YAxis
              yAxisId="aov"
              stroke="var(--color-muted-foreground)"
              tickFormatter={(value: number) => formatAR(value)}
            />
            <YAxis
              yAxisId="upt"
              orientation="right"
              domain={[0, 4]}
              stroke="var(--color-muted-foreground)"
            />
            <Tooltip
              formatter={(value, name) =>
                name === "UPT" ? String(value) : formatAR(Number(value))
              }
              contentStyle={tooltipStyle}
            />
            <Legend />
            <Line
              yAxisId="aov"
              type="monotone"
              dataKey="aov"
              name="AOV ($)"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="upt"
              type="monotone"
              dataKey="upt"
              name="UPT (artículos)"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}