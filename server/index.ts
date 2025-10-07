import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { streamHandler } from "./routes/stream";
import { handlePredict } from "./routes/predict";
import { listEvents, exportCsv } from "./routes/events";
import { listSensors, sensorStats, sensorsCsv } from "./routes/sensors";
import { handleEvacuationAlerts } from "./routes/evacuationAlerts";
import { handleRiskAssessment } from "./routes/riskAssessment";
import { json } from "express";
import type { CreateSiteRequest, Zone } from "@shared/api";
import { store } from "./data/store";
import { ingestDEM, ingestDrone, ingestEnv, ingestGeotech, ingestWorker } from "./routes/ingest";
import { listAlerts, sendAlert } from "./routes/alerts";
import { streamBroadcast } from "./routes/stream";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Real-time stream (SSE)
  app.get("/api/stream", streamHandler);

  // Prediction
  app.get("/api/predict", handlePredict);
  app.get("/api/evacuation-alerts", handleEvacuationAlerts);
  app.get("/api/risk-assessment", handleRiskAssessment);
  app.get("/api/events", listEvents);
  app.get("/api/events.csv", exportCsv);
  app.get("/api/sensors", listSensors);
  app.get("/api/sensor-stats", sensorStats);
  app.get("/api/sensors.csv", sensorsCsv);
  app.post("/api/site", json(), (req, res) => {
    const body = req.body as CreateSiteRequest;
    if (!body || typeof body.name !== 'string' || typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    const id = `z${Date.now().toString(36)}`;
    // create simple square polygon around point or approximate circle
    const radius = (body.radiusMeters ?? 60) / 111320; // degrees approx
    const polygon = [
      { lat: body.lat + radius, lng: body.lng - radius },
      { lat: body.lat + radius, lng: body.lng + radius },
      { lat: body.lat - radius, lng: body.lng + radius },
      { lat: body.lat - radius, lng: body.lng - radius },
    ];
    const zone: Zone = { id, name: body.name, polygon, probability: 0.05, risk: 'low', recommendedActions: ['Routine inspection'] };
    store.zones.push(zone);
    // broadcast updated zones via SSE (reuse stream handler helper if accessible)
    // Minimal inline broadcast duplication (similar logic to stream.ts send of zones)
    try {
      // dynamic import to avoid circular
      const { streamBroadcast } = require('./routes/stream');
      streamBroadcast?.({ type: 'zones', payload: store.zones });
    } catch {}
    res.json({ id, zone });
  });

  // Ingestion endpoints
  app.post("/api/ingest/dem", ingestDEM);
  app.post("/api/ingest/drone", ingestDrone);
  app.post("/api/ingest/geotech", ingestGeotech);
  app.post("/api/ingest/environment", ingestEnv);
  app.post("/api/ingest/worker", ingestWorker);

  // Alerts
  app.get("/api/alerts", listAlerts);
  app.post("/api/alerts", sendAlert);

  // Thresholds configuration
  app.get('/api/thresholds', (_req, res) => {
    res.json(store.getThresholds());
  });
  app.post('/api/thresholds', (req, res) => {
    try {
      const { high, medium } = req.body || {};
      const updated = store.setThresholds({ high, medium });
      // Optionally emit a new prediction snapshot so UI reflects changes quickly
      const prediction = store.predict();
      streamBroadcast({ type: 'prediction', payload: prediction } as any);
      res.json(updated);
    } catch (e:any) {
      res.status(400).json({ error: e.message || 'Invalid thresholds' });
    }
  });

  // Mock drill: create a simulated high alert for a zone
  app.post('/api/mock-drill', (req, res) => {
    const { zoneId, message } = req.body || {};
    const z = store.zones.find(zz => zz.id === zoneId) || store.zones[0];
    if (!z) return res.status(400).json({ error: 'No zones available' });
    const alert = {
      id: `mock-${z.id}-${Date.now()}`,
      zoneId: z.id,
      level: 'high' as const,
      message: message || `${z.name}: Mock drill – evacuate now` ,
      actions: store.actionsForRisk('high'),
      timestamp: Date.now(),
    };
    store.alerts.unshift(alert);
    streamBroadcast({ type: 'alert', payload: alert } as any);
    store.logAlertEvent(alert);
    // Also ensure prediction reflects a high-risk state for this zone briefly
    // by nudging its crack index temporarily
    store.crackIndex[z.id] = Math.max(store.crackIndex[z.id] ?? 0.1, 0.85);
    const prediction = store.predict();
    streamBroadcast({ type: 'prediction', payload: prediction } as any);
    res.json({ ok: true, alert });
  });

  // Bootstrap snapshot for environments where SSE may be delayed (e.g., serverless)
  app.get('/api/bootstrap', (_req, res) => {
    const prediction = store.predict();
    res.json({
      zones: store.zones,
      prediction,
      alerts: store.alerts.slice(0, 50),
      sensor_stats: store.getSensorStats?.(),
      thresholds: store.getThresholds?.(),
      sensors: store.sensors.map(s => store.sensorSnapshot(s))
    });
  });

  return app;
}
