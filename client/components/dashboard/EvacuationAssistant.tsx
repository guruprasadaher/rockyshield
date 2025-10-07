import type { EvacuationRoute } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  routes: EvacuationRoute[];
  onHighlight?: (zoneId: string) => void;
}

export function EvacuationAssistant({ routes, onHighlight }: Props) {
  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Evacuation Assistant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-72 overflow-y-auto pr-1 space-y-3 custom-scroll-thin">
          {routes.length === 0 && (
            <div className="text-xs text-muted-foreground">No evacuation needed. All zones safe.</div>
          )}
          {routes.map((r) => (
            <div key={`${r.zoneId}-${r.exitId}`} className="p-2 rounded-md bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{r.zoneName} → {r.exitName}</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => onHighlight?.(r.zoneId)}>Highlight</Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    const msg = `Evacuate from ${r.zoneName} to ${r.exitName}. Distance ${(r.distanceMeters/1000).toFixed(2)} km, ETA ${r.etaMinutes.toFixed(1)} min.`;
                    try { await navigator.clipboard.writeText(msg); toast.success('Route copied'); } catch { toast.message('Copied route text'); }
                  }}>Copy</Button>
                </div>
              </div>
              <div className="text-xs mt-1">Distance: {(r.distanceMeters/1000).toFixed(2)} km • ETA: {r.etaMinutes.toFixed(1)} min</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
