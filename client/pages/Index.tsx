import { useEffect, useMemo, useState } from "react";
import type { AlertItem, PredictionOutput, SensorReading, WorkerTag, Zone, ZoneOccupancy } from "@shared/api";
import { connectStream, fetchAlerts } from "@/lib/api";
import { RiskMap } from "@/components/dashboard/RiskMap";
import { ForecastChart } from "@/components/dashboard/ForecastChart";
import { AlertsList } from "@/components/dashboard/AlertsList";
import { EvacuationAssistant } from "@/components/dashboard/EvacuationAssistant";
import { WorkerPanel } from "@/components/dashboard/WorkerPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Index() {
  const [zones, setZones] = useState<Zone[]>([]);
  // Sensor readings moved to dedicated Sensors page
  const [latestSensors, setLatestSensors] = useState<Record<string, SensorReading>>({});
  const [predictions, setPredictions] = useState<PredictionOutput[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [routes, setRoutes] = useState<PredictionOutput["evacuationRoutes"]>([]);
  const [workers, setWorkers] = useState<Record<string, WorkerTag>>({});
  const [occupancy, setOccupancy] = useState<ZoneOccupancy[]>([]);

  useEffect(() => {
    const disconnect = connectStream((msg) => {
      if (msg.type === "zones") setZones(msg.payload);
  if (msg.type === "sensor") setLatestSensors((s) => ({ ...s, [msg.payload.zoneId]: msg.payload })); // maintained for forecast & risk map context
      if (msg.type === "prediction") {
        setPredictions((p) => [...p.slice(-60), msg.payload]);
        setRoutes(msg.payload.evacuationRoutes || []);
      }
      if (msg.type === "worker") setWorkers((w) => ({ ...w, [msg.payload.id]: msg.payload }));
      if (msg.type === "occupancy") setOccupancy(msg.payload);
      if (msg.type === "alert") setAlerts((a) => [msg.payload, ...a].slice(0, 50));
    });
    fetchAlerts().then(setAlerts).catch(() => {});
    return () => disconnect();
  }, []);

  const overall = useMemo(() => {
    const last = predictions.slice(-1)[0];
    if (!last) return { avg: 0, high: 0, barricade: false };
    const probs = last.zones.map((z) => z.probability);
    return { avg: probs.reduce((a, b) => a + b, 0) / probs.length, high: last.zones.filter((z) => z.risk === "high").length, barricade: !!last.flags?.barricade };
  }, [predictions]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      <main className="px-4 py-6 space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Real-time Risk Map</h2>
                  <p className="text-sm text-muted-foreground">Interactive zones color-coded by risk</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${overall.barricade ? 'bg-red-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>
                    {overall.barricade ? 'Barricade activated' : 'Barricade normal'}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setSelectedZone(null)}>All Zones</Button>
                </div>
              </div>
              <RiskMap zones={latestZones(predictions)} routes={routes} workers={Object.values(workers)} onZoneClick={(id) => setSelectedZone(id)} />
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Average Probability</div>
                    <div className="text-2xl font-bold">{(overall.avg * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">High-risk Zones</div>
                    <div className="text-2xl font-bold">{overall.high}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <EvacuationAssistant routes={routes} onHighlight={(id) => setSelectedZone(id)} />
            <WorkerPanel zones={latestZones(predictions)} workers={Object.values(workers)} occupancy={occupancy} />
            <AlertsList alerts={alerts} />
          </div>
        </div>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Probability Forecast</h2>
                <p className="text-sm text-muted-foreground">Likelihood of rockfall over time</p>
              </div>
            </div>
            <ForecastChart history={predictions} zones={zones} focusZoneId={selectedZone} />
          </CardContent>
        </Card>

        {/* Sensor Monitoring moved to /sensors page */}
      </main>
    </div>
  );
}

function latestZones(predictions: PredictionOutput[]): Zone[] {
  const last = predictions.slice(-1)[0];
  return last ? last.zones : [];
}
