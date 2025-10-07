import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AlertItem, PredictionOutput, Zone, WorkerTag, ZoneOccupancy } from "@shared/api";
import { connectStream, fetchAlerts } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { RiskMap } from "@/components/dashboard/RiskMap";
import { EvacuationAssistant } from "@/components/dashboard/EvacuationAssistant";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AlertsEvacPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [pred, setPred] = useState<PredictionOutput | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [occupancy, setOccupancy] = useState<ZoneOccupancy[]>([]);
  const [workers, setWorkers] = useState<Record<string, WorkerTag>>({});
  const [zones, setZones] = useState<Zone[]>([]);

  useEffect(() => {
    const disconnect = connectStream((msg) => {
      if (msg.type === 'prediction') setPred(msg.payload);
      if (msg.type === 'alert') setAlerts((a) => [msg.payload, ...a].slice(0, 80));
      if (msg.type === 'zones') setZones(msg.payload);
      if (msg.type === 'occupancy') setOccupancy(msg.payload);
      if (msg.type === 'worker') setWorkers((w) => ({ ...w, [msg.payload.id]: msg.payload }));
    });
    fetchAlerts().then((res) => setAlerts(res)).catch(() => {});
    return () => disconnect();
  }, []);

  // Priority sort: high → medium → low, then newest first
  const sorted = useMemo(() => {
    const order = { high: 0, medium: 1, low: 2 } as Record<AlertItem['level'], number>;
    return [...alerts].sort((a, b) => {
      const byLevel = order[a.level] - order[b.level];
      if (byLevel !== 0) return byLevel;
      return b.timestamp - a.timestamp;
    });
  }, [alerts]);

  const routes = pred?.evacuationRoutes ?? [];
  const latestZones = pred?.zones ?? zones;

  const beforeAfter = useMemo(() => {
    // workers currently in risky (high) zones vs safe
    const riskyIds = new Set(latestZones.filter(z => z.risk === 'high').map(z => z.id));
    let inRisk = 0, safe = 0;
    occupancy.forEach(o => {
      if (riskyIds.has(o.zoneId)) inRisk += o.count; else safe += o.count;
    });
    return { inRisk, safe };
  }, [occupancy, latestZones]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Alerts & Evacuation</h1>
        <div className="text-xs text-muted-foreground">At-risk: <b>{beforeAfter.inRisk}</b> • Safe: <b>{beforeAfter.safe}</b></div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold">Evacuation Map</h2>
                <p className="text-xs text-muted-foreground">High-risk zones, routes, and workers</p>
              </div>
              <button className="text-xs underline" onClick={() => setSelectedZone(null)}>All Zones</button>
            </div>
            <RiskMap zones={latestZones} routes={routes} workers={Object.values(workers)} selectedZoneId={selectedZone} onZoneClick={(id) => setSelectedZone(id)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <EvacuationAssistant routes={routes} onHighlight={setSelectedZone} />

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm font-semibold mb-2">Active Alerts</div>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scroll-thin pr-1">
                {sorted.length === 0 && (
                  <div className="text-xs text-muted-foreground">No alerts</div>
                )}
                {sorted.map((a) => (
                  <div key={a.id} className={`p-2 rounded border ${a.level === 'high' ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' : a.level === 'medium' ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900'}`}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{a.message}</div>
                      <div className="text-[10px] opacity-70">{new Date(a.timestamp).toLocaleTimeString()}</div>
                    </div>
                    <ul className="list-disc ml-4 mt-1 text-xs">
                      {a.actions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Incident Command Panel */}
      <IncidentCommandPanel routesCount={routes.length} atRisk={beforeAfter.inRisk} safe={beforeAfter.safe} />
    </div>
  );
}

function IncidentCommandPanel({ routesCount, atRisk, safe }: { routesCount: number; atRisk: number; safe: number }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [muster, setMuster] = useState({ reached: 0, total: atRisk + safe });

  useEffect(() => { setMuster(m => ({ ...m, total: atRisk + safe })); }, [atRisk, safe]);
  useEffect(() => {
    if (running) {
      const start = Date.now() - elapsed;
      timerRef.current = window.setInterval(() => setElapsed(Date.now() - start), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current); timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const minutes = Math.floor(elapsed / 60000);
  const seconds = Math.floor((elapsed % 60000) / 1000);

  const scripts = [
    `All units: commence evacuation. Follow posted routes to nearest muster points.`,
    `High-risk zones identified. Supervisors, confirm headcount and report status.`,
    `Barricades active. Avoid re-entry until incident commander gives the all clear.`,
  ];

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-semibold">Incident Command</div>
            <div className="text-xs text-muted-foreground">Routes: {routesCount} • At-risk: {atRisk} • Safe: {safe}</div>
          </div>
          <div className="flex items-center gap-2">
            {!running ? (
              <Button size="sm" onClick={() => setRunning(true)}>Start Timer</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setRunning(false)}>Pause</Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => { setRunning(false); setElapsed(0); }}>Reset</Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4 items-start">
          <div className="md:col-span-1">
            <div className="text-3xl font-bold tabular-nums">{String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}</div>
            <div className="mt-2">
              <div className="text-xs mb-1">Muster Progress</div>
              <div className="w-full h-2 rounded bg-muted overflow-hidden">
                <div className="h-2 bg-emerald-600" style={{ width: `${muster.total ? (muster.reached / Math.max(1, muster.total)) * 100 : 0}%` }} />
              </div>
              <div className="text-xs mt-1">{muster.reached}/{muster.total} accounted</div>
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setMuster(m => ({ ...m, reached: Math.min(m.total, m.reached + 1) }))}>+1 Reached</Button>
                <Button size="sm" variant="ghost" onClick={() => setMuster(m => ({ ...m, reached: Math.max(0, m.reached - 1) }))}>-1</Button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2">
            <div className="text-xs font-medium">Broadcast Scripts</div>
            {scripts.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-2 p-2 rounded border bg-muted/30">
                <div className="text-xs">{s}</div>
                <Button size="sm" variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(s); toast.success('Copied'); } catch { toast.message('Copied'); } }}>Copy</Button>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
