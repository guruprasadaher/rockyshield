import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { streamHandler } from "./routes/stream";
import { handlePredict } from "./routes/predict";
import { handleEvacuationAlerts } from "./routes/evacuationAlerts";
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
