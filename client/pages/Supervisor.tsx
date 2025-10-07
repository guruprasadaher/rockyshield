import React, { useEffect, useMemo, useState } from "react";
import { useRiskAssessment } from "@/hooks/use-risk-assessment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getThresholds, setThresholds, triggerMockDrill } from "@/lib/api";
import type { Zone } from "@shared/api";
import { connectStream } from "@/lib/api";

export default function SupervisorPage() {
  const { data, loading, error, stale, lastUpdated, refresh } = useRiskAssessment(7000);
  const [th, setTh] = useState<{ high: number; medium: number } | null>(null);
  const [updating, setUpdating] = useState(false);
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [drilling, setDrilling] = useState(false);

  useEffect(() => {
    getThresholds().then(setTh).catch(()=>{});
    const disconnect = connectStream((msg) => { if (msg.type === 'zones') setZones(msg.payload); });
    return () => disconnect();
  }, []);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold">Supervisor Risk Dashboard</h1>
        {stale && <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">Stale data – retrying…</span>}
        {lastUpdated && !loading && !stale && (
          <span className="text-[11px] text-muted-foreground">Updated {timeAgo(lastUpdated)}</span>
        )}
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Thresholds</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Adjust probability cutoffs for medium/high risk classification.</div>
            <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
              e.preventDefault();
              if (!th) return;
              try {
                setUpdating(true);
                const updated = await setThresholds({ high: th.high, medium: th.medium });
                setTh(updated);
              } catch (e) {} finally { setUpdating(false); }
            }}>
              <label className="space-y-1">
                <div className="text-xs font-medium">Medium ≥</div>
                <input type="number" step="0.01" min={0.01} max={0.99} value={th?.medium ?? 0.4} onChange={(e)=> setTh(t => ({ ...(t||{high:0.7,medium:0.4}), medium: parseFloat(e.target.value) }))} className="w-full rounded border px-2 py-1 bg-background" />
              </label>
              <label className="space-y-1">
                <div className="text-xs font-medium">High ≥</div>
                <input type="number" step="0.01" min={0.02} max={0.99} value={th?.high ?? 0.7} onChange={(e)=> setTh(t => ({ ...(t||{high:0.7,medium:0.4}), high: parseFloat(e.target.value) }))} className="w-full rounded border px-2 py-1 bg-background" />
              </label>
              <div className="col-span-2">
                <Button size="sm" type="submit" disabled={updating}>{updating ? 'Saving…' : 'Save Thresholds'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Trigger Mock Drill</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="text-xs text-muted-foreground">Simulate a high-severity alert to validate procedures.</div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="space-y-1 col-span-2">
                <div className="text-xs font-medium">Zone</div>
                <select value={selectedZone} onChange={(e)=> setSelectedZone(e.target.value)} className="w-full rounded border px-2 py-1 bg-background">
                  <option value="">Select a zone</option>
                  {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </label>
              <div className="col-span-2">
                <Button size="sm" disabled={!selectedZone || drilling} onClick={async ()=>{
                  try { setDrilling(true); await triggerMockDrill(selectedZone!); } catch (e) {} finally { setDrilling(false); }
                }}>{drilling ? 'Triggering…' : 'Start Drill'}</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {loading && <div className="text-sm opacity-70">Loading risk data...</div>}
      {error && !data.length && <div className="text-sm text-red-600">{error}</div>}
      {!loading && !data.length && !error && (
        <div className="text-xs text-muted-foreground">No zones available.</div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map(item => {
          const color = item.recommended_action === 'Evacuate immediately' ? 'border-red-500/60 bg-red-50 dark:bg-red-950/30' : item.recommended_action === 'Monitor' ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30' : 'border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30';
          const barColor = item.recommended_action === 'Evacuate immediately' ? 'bg-red-600' : item.recommended_action === 'Monitor' ? 'bg-amber-500' : 'bg-emerald-600';
          return (
            <Card key={item.zone_id} className={`border ${color} relative overflow-hidden`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Zone {item.zone_id}</span>
                  <span className="text-xs font-normal opacity-70">{item.risk_score}/100</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Workers at risk</div>
                  <div>{item.workers_at_risk}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Action</div>
                  <div className="text-[11px] font-semibold">
                    {item.recommended_action === 'Evacuate immediately' && <span className="text-red-600">Evacuate</span>}
                    {item.recommended_action === 'Monitor' && <span className="text-amber-600">Monitor</span>}
                    {item.recommended_action === 'Safe' && <span className="text-emerald-600">Safe</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide opacity-70">Risk Score</div>
                  <div className="w-full h-2 rounded bg-muted overflow-hidden">
                    <div className={`h-2 ${barColor}`} style={{ width: `${item.risk_score}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 10_000) return 'just now';
  if (diff < 60_000) return Math.floor(diff/1000) + 's ago';
  return Math.floor(diff/60000) + 'm ago';
}
