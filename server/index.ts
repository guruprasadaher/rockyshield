import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { streamHandler } from "./routes/stream";
import { handlePredict } from "./routes/predict";
import { listEvents, exportCsv } from "./routes/events";
import { handleEvacuationAlerts } from "./routes/evacuationAlerts";
import { handleRiskAssessment } from "./routes/riskAssessment";
import { json } from "express";
import type { CreateSiteRequest, Zone } from "@shared/api";
import { store } from "./data/store";
import { ingestDEM, ingestDrone, ingestEnv, ingestGeotech, ingestWorker } from "./routes/ingest";
import { listAlerts, sendAlert } from "./routes/alerts";

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

  return app;
}
