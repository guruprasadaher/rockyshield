import type { SensorReading, Zone } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  zones: Zone[];
  latest: Record<string, SensorReading | undefined>;
  selected?: string | null;
}

export function SensorPanel({ zones, latest, selected }: Props) {
  const list = zones.filter((z) => !selected || z.id === selected);
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {list.map((z) => (
        <Card key={z.id} className="border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{z.name}</span>
              <span className="capitalize text-xs rounded px-2 py-0.5 bg-accent">{z.risk}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs grid grid-cols-3 gap-2">
            {metric("Probability", `${(z.probability * 100).toFixed(1)}%`)}
            {metric("Displacement", fmt(latest[z.id]?.displacement, "mm"))}
            {metric("Strain", fmt(latest[z.id]?.strain, "με"))}
            {metric("Pore Pressure", fmt(latest[z.id]?.porePressure, "kPa"))}
            {metric("Rainfall", fmt(latest[z.id]?.rainfall, "mm/h"))}
            {metric("Temp", fmt(latest[z.id]?.temperature, "°C"))}
            {metric("Vibration", fmt(latest[z.id]?.vibration, "mm/s"))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function metric(label: string, value: string) {
  return (
    <div className="p-2 rounded-md bg-muted/50">
      <div className="text-muted-foreground text-[10px]">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}

function fmt(v: number | undefined, unit: string) {
  if (v === undefined) return "-";
  return `${v.toFixed(1)} ${unit}`;
}
