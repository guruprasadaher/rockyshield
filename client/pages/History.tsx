import { useEffect, useState, useMemo } from "react";
import type { PredictionOutput, AlertItem, Zone } from "@shared/api";
import { connectStream, fetchAlerts } from "@/lib/api";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { Card, CardContent } from "@/components/ui/card";

export default function History() {
  const [predictions, setPredictions] = useState<PredictionOutput[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    const disconnect = connectStream((msg) => {
      if (msg.type === "prediction") {
        setPredictions((p) => [...p.slice(-300), msg.payload]);
      }
      if (msg.type === "alert") {
        setAlerts((a) => [msg.payload, ...a].slice(0, 200));
      }
      if (msg.type === "zones") {
        setZones(msg.payload);
      }
    });
    fetchAlerts().then((a) => setAlerts(a)).catch(() => {});
    return () => disconnect();
  }, []);

  const latestZones = useMemo(() => {
    const last = predictions.slice(-1)[0];
    return last ? last.zones : zones;
  }, [predictions, zones]);

  return (
    <div className="px-6 py-6 space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Historical Data & Trends</h1>
        <p className="text-muted-foreground text-sm">Rolling timeline of probabilities and past alerts. Data accumulates while the system runs.</p>
      </header>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Probability Timeline</h2>
            <p className="text-xs text-muted-foreground">Latest {(predictions.length)} prediction snapshots (most recent on right)</p>
          </div>
          {predictions.length > 0 ? (
            <ForecastChart history={predictions} zones={latestZones} focusZoneId={null} />
          ) : (
            <div className="text-sm text-muted-foreground">Collecting data… stay on the dashboard to let history build.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent Alerts</h2>
              <p className="text-xs text-muted-foreground">Last {alerts.length} alert events (max 200 cached)</p>
            </div>
          </div>
          {alerts.length === 0 && (
            <div className="text-sm text-muted-foreground">No alerts yet.</div>
          )}
          <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
            {alerts.map(a => (
              <li key={a.id} className="text-xs flex items-start gap-2 border rounded-md px-3 py-2">
                <span className={alertBadge(a.level)}>{a.level.toUpperCase()}</span>
                <div className="flex-1">
                  <div className="font-medium">Zone {a.zoneId}</div>
                  <div>{a.message}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(a.timestamp).toLocaleTimeString()}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function alertBadge(level: AlertItem["level"]) {
  const base = "inline-flex shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold";
  switch (level) {
    case "high": return base + " bg-orange-500 text-white";
    case "medium": return base + " bg-amber-400 text-black";
    case "low":
    default:
      return base + " bg-emerald-500 text-white";
  }
}
