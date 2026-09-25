import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

export interface HeatmapData {
  days: string[];
  hours: number[];
  values: number[][];
}

const MAX_CELLS = 14;

function cellAlpha(value: number, max: number): number {
  if (max === 0) return 0.06;
  return 0.08 + (value / max) * 0.87;
}

export function HeatmapPanel({ data }: { data: HeatmapData }) {
  const max = Math.max(...data.values.map((row) => Math.max(...row)), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Mapa de calor de horarios pico</CardTitle>
        <CardDescription>
          Ventas por día y franja horaria. Más oscuro = más ventas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${MAX_CELLS}, minmax(2.5rem, 1fr))` }}>
              <div />
              {data.hours.map((hour) => (
                <div
                  key={hour}
                  className="text-center text-xs text-muted-foreground"
                >
                  {hour}h
                </div>
              ))}
              {data.days.map((day, dayIndex) => (
                <HeatmapRow
                  key={day}
                  day={day}
                  values={data.values[dayIndex]}
                  hours={data.hours}
                  max={max}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Menos</span>
          <div className="h-2.5 flex-1 rounded-full bg-gradient-to-r from-blue-500/10 to-blue-500" />
          <span>Más ventas</span>
          <span className="ml-2 rounded border px-2 py-0.5">Máx: {max}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function HeatmapRow({
  day,
  values,
  hours,
  max,
}: {
  day: string;
  values: number[];
  hours: number[];
  max: number;
}) {
  return (
    <>
      <div className="flex items-center text-xs font-medium text-muted-foreground">
        {day}
      </div>
      {values.map((value, index) => {
        const alpha = cellAlpha(value, max);
        const strong = alpha > 0.6;
        return (
          <div
            key={`${day}-${index}`}
            title={`${day} ${hours[index]}:00–${hours[index] + 1}:00 · ${value} ventas`}
            className="flex aspect-square items-center justify-center rounded-md text-xs font-medium"
            style={{
              backgroundColor: `rgba(59, 130, 246, ${alpha})`,
              color: strong ? "white" : "rgba(255,255,255,0.85)",
            }}
          >
            {value}
          </div>
        );
      })}
    </>
  );
}