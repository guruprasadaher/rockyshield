import { useEffect, useState, useMemo } from 'react';
import type { PredictionOutput, SensorReading, Zone } from '@shared/api';
import { connectStream, indexSensorHealth } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { SensorPanel } from '@/components/dashboard/SensorPanel';
import { ForecastChart } from '@/components/dashboard/ForecastChart';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface SensorPoint { t: number; displacement: number; strain: number; porePressure: number; rainfall: number; vibration: number; temperature: number; }

export default function Sensors() {
  const [predictions, setPredictions] = useState<PredictionOutput[]>([]);
  const [latestSensors, setLatestSensors] = useState<Record<string, SensorReading>>({});
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [sensorHistory, setSensorHistory] = useState<Record<string, SensorPoint[]>>({});
  const [sensorHealth, setSensorHealth] = useState<Record<string, any>>({});
  const { toast } = useToast();

  useEffect(() => {
    const disconnect = connectStream(msg => {
      if (msg.type === 'prediction') setPredictions(p => [...p.slice(-120), msg.payload]);
      if (msg.type === 'sensor') {
        setLatestSensors(s => ({ ...s, [msg.payload.zoneId]: msg.payload }));
        setSensorHistory(h => {
          const arr = h[msg.payload.zoneId] ? [...h[msg.payload.zoneId]] : [];
          arr.push({ t: msg.payload.timestamp, displacement: msg.payload.displacement, strain: msg.payload.strain, porePressure: msg.payload.porePressure, rainfall: msg.payload.rainfall, vibration: msg.payload.vibration, temperature: msg.payload.temperature });
          // keep last 300 points (~20 min @4s) per zone
          const trimmed = arr.slice(-300);
          return { ...h, [msg.payload.zoneId]: trimmed };
        });
      }
      if (msg.type === 'zones') setZones(msg.payload);
      if (msg.type === 'sensor_health') {
        setSensorHealth(prev => {
          const indexed = indexSensorHealth(msg.payload);
            // detect transitions to Faulty/Inactive
          Object.values(indexed).forEach(s => {
            const before = prev[s.sensor_id];
            if (before && before.status !== s.status) {
              if (s.status === 'Faulty' || s.status === 'Inactive') {
                toast({
                  title: `Sensor ${s.sensor_id} ${s.status}`,
                  description: `Status change in zone ${s.zone_id}`,
                  variant: 'destructive'
                });
              } else if (before.status === 'Faulty' && s.status === 'Active') {
                toast({
                  title: `Sensor ${s.sensor_id} restored`,
                  description: `Back to Active in zone ${s.zone_id}`
                });
              }
            }
          });
          return { ...prev, ...indexed };
        });
      }
    });
    return () => disconnect();
  }, []);

  const latestZones = useMemo(() => {
    const last = predictions.slice(-1)[0];
    return last ? last.zones : zones;
  }, [predictions, zones]);

  return (
    <div className="px-6 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sensor Monitoring</h1>
        <p className="text-sm text-muted-foreground">Live environmental & geotechnical telemetry. Choose a zone to drill into its historical traces, or view all.</p>
      </header>

      <div className="flex flex-wrap gap-4 items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium">Focus Zone</label>
          <Select value={selectedZone ?? 'all'} onValueChange={(v) => setSelectedZone(v === 'all' ? null : v)}>
            <SelectTrigger className="w-56 h-8">
              <SelectValue placeholder="All zones" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {latestZones.map(z => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {selectedZone && (
          <Button variant="outline" size="sm" onClick={() => exportCsv(selectedZone, sensorHistory[selectedZone] || [])}>Export CSV</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <h2 className="font-semibold">Probability Trend</h2>
            <p className="text-xs text-muted-foreground">Rolling prediction snapshots {selectedZone ? `(zone ${selectedZone})` : '(all zones)'}</p>
          </div>
          <ForecastChart history={predictions} zones={latestZones} focusZoneId={selectedZone} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Live Sensors</h2>
              <p className="text-xs text-muted-foreground">Current readings {selectedZone ? `for ${selectedZone}` : 'across all zones'}</p>
            </div>
          </div>
          <SensorPanel zones={latestZones} latest={latestSensors} selected={selectedZone} />
        </CardContent>
      </Card>

      {selectedZone && (
        <Card>
          <CardContent className="pt-4 space-y-6">
            <div>
              <h2 className="font-semibold">Historical Metrics • Zone {selectedZone}</h2>
              <p className="text-xs text-muted-foreground">Last {(sensorHistory[selectedZone]?.length || 0)} samples</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {miniCharts(selectedZone, sensorHistory)}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function exportCsv(zoneId: string, pts: SensorPoint[]) {
  const header = ['timestamp','displacement','strain','porePressure','rainfall','vibration','temperature'];
  const lines = pts.map(p => [new Date(p.t).toISOString(), p.displacement, p.strain, p.porePressure, p.rainfall, p.vibration, p.temperature].join(','));
  const csv = [header.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `zone-${zoneId}-sensors.csv`; a.click();
  URL.revokeObjectURL(url);
}

function miniCharts(zoneId: string, history: Record<string, SensorPoint[]>) {
  const metrics: { key: keyof SensorPoint; label: string; unit: string }[] = [
    { key: 'displacement', label: 'Displacement', unit: 'mm' },
    { key: 'strain', label: 'Strain', unit: 'με' },
    { key: 'porePressure', label: 'Pore Pressure', unit: 'kPa' },
    { key: 'rainfall', label: 'Rainfall', unit: 'mm/h' },
    { key: 'vibration', label: 'Vibration', unit: 'mm/s' },
    { key: 'temperature', label: 'Temperature', unit: '°C' },
  ];
  const pts = history[zoneId] || [];
  return metrics.map(m => (
    <MiniLine key={m.key as string} data={pts} metric={m.key} label={m.label} unit={m.unit} />
  ));
}

interface MiniLineProps { data: SensorPoint[]; metric: keyof SensorPoint; label: string; unit: string; }
function MiniLine({ data, metric, label, unit }: MiniLineProps) {
  // Lightweight inline SVG sparkline
  if (!data.length) return (
    <div className="p-2 rounded border bg-muted/30 flex flex-col justify-between text-xs h-28">
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground text-[10px]">No data</div>
    </div>
  );
  const values = data.map(d => d[metric] as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const norm = (v: number) => (max - min === 0 ? 0.5 : (v - min) / (max - min));
  const points = values.map((v,i) => {
    const x = (i / Math.max(values.length - 1, 1)) * 100;
    const y = 100 - norm(v) * 100;
    return `${x},${y}`;
  }).join(' ');
  const last = values[values.length - 1];
  return (
    <div className="p-2 rounded border bg-muted/30 flex flex-col gap-1 text-xs h-28">
      <div className="flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <span className="font-mono text-[10px]">{last.toFixed(1)} {unit}</span>
      </div>
      <div className="flex-1">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          <polyline fill="none" stroke="hsl(var(--primary))" strokeWidth={1.2} points={points} />
        </svg>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>min {min.toFixed(1)}</span>
        <span>max {max.toFixed(1)}</span>
      </div>
    </div>
  );
}
