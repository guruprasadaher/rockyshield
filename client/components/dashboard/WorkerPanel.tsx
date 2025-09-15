import type { Zone, WorkerTag, ZoneOccupancy } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  zones: Zone[];
  workers: WorkerTag[];
  occupancy: ZoneOccupancy[];
}

export function WorkerPanel({ zones, workers, occupancy }: Props) {
  const byZone: Record<string, ZoneOccupancy> = {};
  occupancy.forEach((o) => (byZone[o.zoneId] = o));
  const list = zones.map((z) => ({ z, o: byZone[z.id] }));

  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Worker Occupancy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {list.map(({ z, o }) => (
          <div key={z.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${z.risk === 'high' ? 'bg-red-500' : z.risk === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              <span className="font-medium">{z.name}</span>
            </div>
            <div className="opacity-80">{o?.count ?? 0} worker(s)</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
