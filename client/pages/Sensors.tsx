import { useEffect, useState, useMemo } from 'react';
import type { PredictionOutput, SensorReading, Zone } from '@shared/api';
import { connectStream } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { SensorPanel } from '@/components/dashboard/SensorPanel';
import { ForecastChart } from '@/components/dashboard/ForecastChart';

export default function Sensors() {
  const [predictions, setPredictions] = useState<PredictionOutput[]>([]);
  const [latestSensors, setLatestSensors] = useState<Record<string, SensorReading>>({});
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  useEffect(() => {
    const disconnect = connectStream(msg => {
      if (msg.type === 'prediction') setPredictions(p => [...p.slice(-120), msg.payload]);
      if (msg.type === 'sensor') setLatestSensors(s => ({ ...s, [msg.payload.zoneId]: msg.payload }));
      if (msg.type === 'zones') setZones(msg.payload);
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
        <p className="text-sm text-muted-foreground">Live environmental & geotechnical telemetry by zone. Select a zone to focus drill-down charts.</p>
      </header>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <h2 className="font-semibold">Probability Trend (All Zones)</h2>
            <p className="text-xs text-muted-foreground">Rolling prediction snapshots</p>
          </div>
          <ForecastChart history={predictions} zones={latestZones} focusZoneId={selectedZone} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-semibold">Live Sensors</h2>
              <p className="text-xs text-muted-foreground">Current readings with deltas</p>
            </div>
          </div>
          <SensorPanel zones={latestZones} latest={latestSensors} selected={selectedZone} />
        </CardContent>
      </Card>
    </div>
  );
}
