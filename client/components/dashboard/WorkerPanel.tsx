import type { Zone, WorkerTag, ZoneOccupancy, EvacuationAlert } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEvacuationAlerts } from "@/hooks/use-evacuation-alerts";

interface Props {
  zones: Zone[];
  workers: WorkerTag[];
  occupancy: ZoneOccupancy[];
}

export function WorkerPanel({ zones, workers, occupancy }: Props) {
  const { alerts } = useEvacuationAlerts(8000);
  const alertMap: Record<string, EvacuationAlert> = {};
  alerts.forEach(a => { alertMap[a.worker_id] = a; });
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
          <div key={z.id} className="p-2 rounded-md bg-muted/50 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${z.risk === 'high' ? 'bg-red-500' : z.risk === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                <span className="font-medium">{z.name}</span>
              </div>
              <div className="opacity-80">{o?.count ?? 0} worker(s)</div>
            </div>
            {workers.filter(w => w.zoneId === z.id).map(w => {
              const wa = alertMap[w.id];
              const urgencyColor = wa?.urgency === 'High' ? 'text-red-600 font-semibold' : wa?.urgency === 'Medium' ? 'text-amber-600' : 'text-emerald-600';
              return (
                <div key={w.id} className="flex items-start justify-between rounded-md bg-background border px-2 py-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-1 py-0.5 rounded bg-muted">{w.id}</span>
                      {wa && <span className={`text-[10px] ${urgencyColor}`}>{wa.urgency}</span>}
                    </div>
                    <div className="text-[10px] mt-0.5 line-clamp-2 max-w-[180px]">{wa ? wa.message : 'Safe – No Action Required.'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
