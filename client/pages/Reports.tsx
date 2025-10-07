import { useEffect, useMemo, useState } from 'react';
import type { ComplianceEvent } from '@shared/api';
import { fetchEvents, downloadCsv, EventsQuery, fetchSensorStats, fetchSensors, SensorListItem, downloadSensorsCsv } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Reports() {
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<EventsQuery>({});
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: keyof ComplianceEvent; dir: 'asc' | 'desc' }>({ key: 'timestamp', dir: 'desc' });
  const [sensorStats, setSensorStats] = useState<{ total: number; byStatus: Record<string, number>; averageUptimePct: number } | null>(null);
  const [sensors, setSensors] = useState<SensorListItem[]>([]);
  const [sensorSort, setSensorSort] = useState<{ key: keyof SensorListItem; dir: 'asc' | 'desc' }>({ key: 'sensor_id', dir: 'asc' });

  const refreshSensors = async () => {
    try {
      setSensorStats(await fetchSensorStats());
      setSensors(await fetchSensors());
    } catch (e) {
      console.warn('Failed refreshing sensors', e);
    }
  };

  const toggleSensorSort = (k: keyof SensorListItem) => {
    setSensorSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' });
  };

  const sortedSensors = useMemo(() => {
    return [...sensors].sort((a,b) => {
      const av = a[sensorSort.key]; const bv = b[sensorSort.key];
      if (av === bv) return 0;
      return (av as any) > (bv as any) ? (sensorSort.dir === 'asc' ? 1 : -1) : (sensorSort.dir === 'asc' ? -1 : 1);
    });
  }, [sensors, sensorSort]);

  async function load() {
    setLoading(true); setError(null);
    try { setEvents(await fetchEvents(query)); } catch (e:any) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [JSON.stringify(query)]);
  useEffect(() => {
    (async () => {
      try {
        setSensorStats(await fetchSensorStats());
        setSensors(await fetchSensors());
      } catch (e) {
        console.warn('Failed loading sensor stats', e);
      }
    })();
  }, []);

  function toggleSort(k: keyof ComplianceEvent) {
    setSort(s => s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' });
  }

  const sorted = useMemo(() => {
    return [...events].sort((a,b) => {
      const av = a[sort.key]; const bv = b[sort.key];
      if (av === bv) return 0;
      return (av as any) > (bv as any) ? (sort.dir === 'asc' ? 1 : -1) : (sort.dir === 'asc' ? -1 : 1);
    });
  }, [events, sort]);

  const stats = useMemo(() => {
    const total = events.length;
    const resolved = events.filter(e => e.status === 'Resolved').length;
    // approximate response time: difference between resolved shadow and original event with same base id
    let responseSum = 0, responseCount = 0;
    const baseMap: Record<string, ComplianceEvent> = {};
    events.forEach(e => {
      const base = e.event_id.replace(/R$/, '');
      if (!baseMap[base]) baseMap[base] = e;
      if (e.event_id.endsWith('R')) {
        const orig = events.find(o => o.event_id === base);
        if (orig) {
          responseSum += (new Date(e.timestamp).getTime() - new Date(orig.timestamp).getTime());
          responseCount += 1;
        }
      }
    });
    const avgResponseMs = responseCount ? responseSum / responseCount : 0;
    return { total, resolved, ongoing: total - resolved, avgResponseMs };
  }, [events]);

  function updateQuery(partial: EventsQuery) {
    setQuery(q => ({ ...q, ...partial }));
  }

  return (
    <div className="px-6 py-6 flex flex-col h-full max-h-screen">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Compliance</h1>
        <p className="text-sm text-muted-foreground">Immutable log of high-risk events for audit, investigation and response analytics.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="grid sm:grid-cols-4 gap-4 text-center">
              <Stat label="Total Events" value={stats.total} />
              <Stat label="Resolved" value={stats.resolved} />
              <Stat label="Ongoing" value={stats.ongoing} />
              <Stat label="Avg Response" value={stats.avgResponseMs ? formatDuration(stats.avgResponseMs) : '—'} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold mb-3">Sensor Health</h2>
            {sensorStats ? (
              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <Stat label="Total Sensors" value={sensorStats.total} />
                <Stat label="Active" value={sensorStats.byStatus['Active'] || 0} />
                <Stat label="Fault/Inactive" value={(sensorStats.byStatus['Faulty']||0) + (sensorStats.byStatus['Inactive']||0)} />
                <Stat label="Maintenance" value={sensorStats.byStatus['Maintenance'] || 0} />
                <Stat label="Avg Uptime" value={((sensorStats.averageUptimePct||0)*100).toFixed(1) + '%'} />
                <div className="p-3 rounded-md bg-muted/50 flex flex-col justify-center">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Health Index</div>
                  <div className="text-lg font-semibold mt-1">
                    {healthIndex(sensorStats).toFixed(0)}
                  </div>
                </div>
              </div>
            ) : <div className="text-xs text-muted-foreground">Loading sensor stats…</div>}
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => refreshSensors()}>Refresh</Button>
              <Button size="sm" variant="secondary" onClick={() => downloadSensorsCsv()}>Export Sensors CSV</Button>
              <Button size="sm" variant="ghost" asChild>
                <a href="/sensors" className="text-xs">Open Sensors Page →</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 min-h-0">
        <Card className="h-full flex flex-col">
          <CardContent className="pt-4 flex flex-col h-full">
            <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-2 custom-scroll-thin" style={{maxHeight:'60vh'}}>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-medium">Zone</label>
              <Input placeholder="z1" value={query.zone || ''} onChange={e => updateQuery({ zone: e.target.value || undefined })} className="w-32" />
            </div>
            <div>
              <label className="text-xs font-medium">Worker</label>
              <Input placeholder="w1" value={query.worker || ''} onChange={e => updateQuery({ worker: e.target.value || undefined })} className="w-32" />
            </div>
            <div>
              <label className="text-xs font-medium">Severity</label>
              <Input placeholder="high" value={query.severity || ''} onChange={e => updateQuery({ severity: e.target.value || undefined })} className="w-32" />
            </div>
            <div>
              <label className="text-xs font-medium">From (ISO)</label>
              <Input placeholder="2025-09-25T00:00:00Z" value={query.from || ''} onChange={e => updateQuery({ from: e.target.value || undefined })} className="w-56" />
            </div>
            <div>
              <label className="text-xs font-medium">To (ISO)</label>
              <Input placeholder="2025-09-26T00:00:00Z" value={query.to || ''} onChange={e => updateQuery({ to: e.target.value || undefined })} className="w-56" />
            </div>
            <Button variant="secondary" onClick={() => load()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
            <Button onClick={() => downloadCsv(query)} variant="outline">Export CSV</Button>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}

          <div className="overflow-x-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['event_id','timestamp','zone_id','workers','severity','status','action'].map(col => (
                    <Th key={col} label={col} onClick={() => toggleSort(col === 'workers' ? 'workers_alerted' as any : col as keyof ComplianceEvent)} sort={sort} mapping={col} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(ev => (
                  <tr key={ev.event_id} className="border-b last:border-b-0 hover:bg-muted/30 align-top">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap">{ev.event_id}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">{new Date(ev.timestamp).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs">{ev.zone_id}</td>
                    <td className="px-3 py-2 text-xs">
                      <details>
                        <summary className="cursor-pointer select-none">{ev.workers_alerted.length} worker(s)</summary>
                        <div className="mt-1 space-y-0.5">
                          {ev.workers_alerted.map(w => (
                            <div key={w} className="font-mono">{w}</div>
                          ))}
                        </div>
                      </details>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={sevBadge(ev.severity)}>{ev.severity}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className={ev.status === 'Resolved' ? 'text-emerald-600 font-medium' : 'text-amber-600 font-medium'}>{ev.status}</span>
                    </td>
                    <td className="px-3 py-2 text-xs max-w-[260px]">
                      <div className="truncate" title={ev.supervisor_action}>{ev.supervisor_action || '—'}</div>
                      {ev.sensors_used && ev.sensors_used.length > 0 && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">{ev.sensors_used.length} sensor(s)</summary>
                          <div className="mt-1 max-h-40 overflow-auto pr-1 space-y-0.5">
                            {ev.sensors_used.map(s => (
                              <div key={s.sensor_id} className="flex items-center justify-between gap-2 text-[11px] font-mono">
                                <span>{s.sensor_id}</span>
                                <span className="text-xs">{s.type}</span>
                                <span className={sensorStatusBadge(s.status)}>{s.status}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
                {sorted.length === 0 && !loading && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">No events match filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Sensors inventory moved to dedicated Sensors page */}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Th({ label, onClick, sort, mapping }: { label: string; onClick: () => void; sort: { key: keyof ComplianceEvent; dir: 'asc' | 'desc' }; mapping: string }) {
  const active = (mapping === 'workers' ? 'workers_alerted' : mapping) === sort.key;
  return (
    <th onClick={onClick} className="px-3 py-2 text-left text-[11px] uppercase tracking-wide font-semibold cursor-pointer select-none">
      {label}
      {active && <span className="ml-1 text-[10px]">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
    </th>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-md bg-muted/50">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="text-lg font-semibold mt-1">{value}</div>
    </div>
  );
}

function sevBadge(level: ComplianceEvent['severity']) {
  const base = 'inline-flex px-2 py-0.5 rounded text-[10px] font-semibold';
  switch(level) {
    case 'high': return base + ' bg-orange-500 text-white';
    case 'medium': return base + ' bg-amber-400 text-black';
    default: return base + ' bg-emerald-500 text-white';
  }
}

function formatDuration(ms: number) {
  const mins = ms / 60000;
  if (mins < 1) return (ms/1000).toFixed(1) + 's';
  return mins.toFixed(1) + 'm';
}

function sensorStatusBadge(status: string) {
  const base = 'inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium';
  switch(status) {
    case 'Active': return base + ' bg-emerald-500 text-white';
    case 'Faulty': return base + ' bg-orange-500 text-white';
    case 'Inactive': return base + ' bg-gray-400 text-white';
    case 'Maintenance': return base + ' bg-blue-500 text-white';
    default: return base + ' bg-slate-300 text-black';
  }
}

function healthIndex(stats: { total: number; byStatus: Record<string, number>; averageUptimePct: number }) {
  if (!stats.total) return 0;
  const activeRatio = (stats.byStatus['Active']||0)/stats.total;
  const faultPenalty = (stats.byStatus['Faulty']||0) * 0.5 / stats.total;
  const inactivePenalty = (stats.byStatus['Inactive']||0) * 0.3 / stats.total;
  const maintAdj = (stats.byStatus['Maintenance']||0) * 0.1 / stats.total; // small penalty
  const base = activeRatio - faultPenalty - inactivePenalty - maintAdj;
  const uptime = stats.averageUptimePct; // 0..1
  return Math.max(0, Math.min(100, (base * 0.6 + uptime * 0.4) * 100));
}

// ===== Sensor table sorting helpers =====
// (helper removed – handled inline where needed)

