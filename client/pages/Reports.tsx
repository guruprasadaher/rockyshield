import { useEffect, useMemo, useState } from 'react';
import type { ComplianceEvent } from '@shared/api';
import { fetchEvents, downloadCsv, EventsQuery } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Reports() {
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<EventsQuery>({});
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: keyof ComplianceEvent; dir: 'asc' | 'desc' }>({ key: 'timestamp', dir: 'desc' });

  async function load() {
    setLoading(true); setError(null);
    try { setEvents(await fetchEvents(query)); } catch (e:any) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [JSON.stringify(query)]);

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
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports & Compliance</h1>
        <p className="text-sm text-muted-foreground">Immutable log of high-risk events for audit, investigation and response analytics.</p>
      </div>

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
        <CardContent className="pt-4 space-y-4">
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
                  <tr key={ev.event_id} className="border-b last:border-b-0 hover:bg-muted/30">
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
                    <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={ev.supervisor_action}>{ev.supervisor_action || '—'}</td>
                  </tr>
                ))}
                {sorted.length === 0 && !loading && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-xs text-muted-foreground">No events match filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
