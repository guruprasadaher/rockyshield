import type { AlertItem, PredictionOutput, SensorReading, StreamMessage, WorkerTag, Zone, ZoneOccupancy, EvacuationAlert, RiskAssessmentItem, CreateSiteRequest, CreateSiteResponse, SensorDeviceSnapshot } from "@shared/api";
import { ComplianceEvent } from "@shared/api";

// Robust SSE connection with automatic reconnect/backoff
export function connectStream(onMessage: (msg: StreamMessage) => void) {
  let es: EventSource | null = null;
  let stopped = false;
  let backoff = 1000;
  let reconnectTimer: any = null;
  let firstMessageTimer: any = null;
  let receivedAny = false;
  let errorCount = 0;
  let pollingInterval: any = null;

  async function startPolling() {
    if (pollingInterval) return;
    console.warn('SSE fallback: switching to polling');
    // poll a subset of endpoints every 6s
    async function poll() {
      try {
        const [prediction, alerts] = await Promise.all([
          fetchPredict().catch(()=>null),
          fetchAlerts().catch(()=>[]),
        ]);
        if (prediction) onMessage({ type: 'prediction', payload: prediction } as any);
        if (alerts) alerts.slice(0,5).forEach(a => onMessage({ type: 'alert', payload: a } as any));
      } catch (e) {
        // swallow
      }
    }
    poll();
    pollingInterval = setInterval(poll, 6000);
  }

  function start() {
    if (stopped) return;
    es = new EventSource("/api/stream");

    es.onopen = () => {
      console.info("SSE: connected");
      backoff = 1000; // reset
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StreamMessage;
        if (!receivedAny) {
          receivedAny = true;
          if (firstMessageTimer) clearTimeout(firstMessageTimer);
        }
        onMessage(data);
      } catch (err) {
        console.error("Stream parse error", err, e.data);
      }
    };

    es.onerror = (err) => {
      console.warn("SSE: connection error", err);
      errorCount += 1;
      // Attempt graceful close and reconnect with backoff
      try {
        es?.close();
      } catch (e) {}
      es = null;
      if (!stopped) {
        reconnectTimer = setTimeout(() => start(), backoff);
        backoff = Math.min(30_000, backoff * 1.8);
      }
      if (errorCount >= 5) {
        startPolling();
      }
    };
  }

  start();

  // Fallback: if no SSE message within 2500ms, pull bootstrap snapshot once
  firstMessageTimer = setTimeout(async () => {
    if (!receivedAny && !stopped) {
      try {
        const boot = await fetchBootstrap();
        // emit synthetic messages to hydrate state
        onMessage({ type: 'zones', payload: boot.zones } as any);
        onMessage({ type: 'prediction', payload: boot.prediction } as any);
        boot.alerts.forEach(a => onMessage({ type: 'alert', payload: a } as any));
        if (boot.sensors) {
          onMessage({ type: 'sensor_health', payload: boot.sensors } as any);
        }
      } catch (e) {
        console.warn('Bootstrap fetch failed', e);
      }
    }
  }, 2500);

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (firstMessageTimer) clearTimeout(firstMessageTimer);
    if (pollingInterval) clearInterval(pollingInterval);
    try {
      es?.close();
    } catch (e) {}
  };
}

export async function fetchPredict(): Promise<PredictionOutput> {
  const res = await fetch("/api/predict");
  return res.json();
}

export async function fetchAlerts(): Promise<AlertItem[]> {
  const res = await fetch("/api/alerts");
  const data = await res.json();
  return data.alerts as AlertItem[];
}

export async function fetchEvacuationAlerts(): Promise<EvacuationAlert[]> {
  const res = await fetch("/api/evacuation-alerts");
  return res.json();
}

export async function fetchRiskAssessment(): Promise<RiskAssessmentItem[]> {
  const res = await fetch("/api/risk-assessment");
  return res.json();
}

export async function createSite(payload: CreateSiteRequest): Promise<CreateSiteResponse> {
  const res = await fetch('/api/site', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Failed to create site');
  return res.json();
}

export interface EventsQuery {
  zone?: string;
  worker?: string;
  status?: string;
  severity?: string;
  from?: string;
  to?: string;
}

export async function fetchEvents(q: EventsQuery = {}): Promise<ComplianceEvent[]> {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => { if (v) params.set(k, v); });
  const res = await fetch(`/api/events?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  const data = await res.json();
  return data.events;
}

export function downloadCsv(q: EventsQuery = {}) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => { if (v) params.set(k, v); });
  const url = `/api/events.csv?${params.toString()}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'events.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export type LiveState = {
  zones: Zone[];
  latestSensors: Record<string, SensorReading>;
  predictions: PredictionOutput[];
  alerts: AlertItem[];
};

// ==== Sensor Health APIs ====
export interface SensorListItem {
  sensor_id: string;
  type: string;
  zone_id: string;
  status: string; // SensorStatus but keep generic to avoid extra export
  last_heartbeat: number;
  uptime_pct: number; // 0..1
}

export interface SensorStatsResponse {
  total: number;
  byStatus: Record<string, number>;
  averageUptimePct: number; // 0..1
}

export async function fetchSensors(): Promise<SensorListItem[]> {
  const res = await fetch('/api/sensors');
  if (!res.ok) throw new Error('Failed to fetch sensors');
  const data = await res.json();
  return data.sensors as SensorListItem[];
}

export async function fetchSensorStats(): Promise<SensorStatsResponse> {
  const res = await fetch('/api/sensor-stats');
  if (!res.ok) throw new Error('Failed to fetch sensor stats');
  return res.json();
}

export function downloadSensorsCsv() {
  const a = document.createElement('a');
  a.href = '/api/sensors.csv';
  a.download = 'sensors.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Helper to merge sensor_health SSE messages into a snapshot map
export function indexSensorHealth(snapshots: SensorDeviceSnapshot[]): Record<string, SensorDeviceSnapshot> {
  const map: Record<string, SensorDeviceSnapshot> = {};
  for (const s of snapshots) map[s.sensor_id] = s;
  return map;
}

// Bootstrap fetch (for serverless / initial hydration when SSE delayed)
export interface BootstrapResponse {
  zones: Zone[];
  prediction: PredictionOutput;
  alerts: AlertItem[];
  sensor_stats?: any;
  sensors?: SensorDeviceSnapshot[];
}

export async function fetchBootstrap(): Promise<BootstrapResponse> {
  const res = await fetch('/api/bootstrap');
  if (!res.ok) throw new Error('Failed bootstrap');
  return res.json();
}
