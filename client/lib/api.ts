import type { AlertItem, PredictionOutput, SensorReading, StreamMessage, WorkerTag, Zone, ZoneOccupancy, EvacuationAlert, RiskAssessmentItem } from "@shared/api";

// Robust SSE connection with automatic reconnect/backoff
export function connectStream(onMessage: (msg: StreamMessage) => void) {
  let es: EventSource | null = null;
  let stopped = false;
  let backoff = 1000;
  let reconnectTimer: any = null;

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
        onMessage(data);
      } catch (err) {
        console.error("Stream parse error", err, e.data);
      }
    };

    es.onerror = (err) => {
      console.warn("SSE: connection error", err);
      // Attempt graceful close and reconnect with backoff
      try {
        es?.close();
      } catch (e) {}
      es = null;
      if (!stopped) {
        reconnectTimer = setTimeout(() => start(), backoff);
        backoff = Math.min(30_000, backoff * 1.8);
      }
    };
  }

  start();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
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

export type LiveState = {
  zones: Zone[];
  latestSensors: Record<string, SensorReading>;
  predictions: PredictionOutput[];
  alerts: AlertItem[];
};
