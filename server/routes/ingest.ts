import { RequestHandler } from "express";
import { IngestDEM, IngestDroneImagery, IngestEnvironment, IngestGeotech, IngestWorkerLocation, WorkerTag } from "@shared/api";
import { store } from "../data/store";

export const ingestDEM: RequestHandler = (req, res) => {
  const body = req.body as IngestDEM;
  if (!body?.zones?.length) return res.status(400).json({ error: "zones required" });
  store.updateFromDEM(body);
  return res.json({ ok: true });
};

export const ingestDrone: RequestHandler = (req, res) => {
  const body = req.body as IngestDroneImagery;
  if (!body?.zoneId) return res.status(400).json({ error: "zoneId required" });
  store.crackIndex[body.zoneId] = Math.max(0, Math.min(1, body.crackIndex));
  return res.json({ ok: true });
};

export const ingestGeotech: RequestHandler = (req, res) => {
  const body = req.body as IngestGeotech;
  if (!body?.reading?.zoneId) return res.status(400).json({ error: "reading.zoneId required" });
  store.latestSensors[body.reading.zoneId] = body.reading;
  return res.json({ ok: true });
};

export const ingestEnv: RequestHandler = (req, res) => {
  const body = req.body as IngestEnvironment;
  if (!body?.zoneId) return res.status(400).json({ error: "zoneId required" });
  const last = store.latestSensors[body.zoneId] ?? {
    timestamp: Date.now(),
    zoneId: body.zoneId,
    displacement: 1,
    strain: 20,
    porePressure: 10,
    rainfall: 0,
    temperature: 20,
    vibration: 0.2,
  };
  store.latestSensors[body.zoneId] = { ...last, rainfall: body.rainfall, temperature: body.temperature, vibration: body.vibration };
  return res.json({ ok: true });
};

export const ingestWorker: RequestHandler = (req, res) => {
  const body = req.body as IngestWorkerLocation;
  if (!body?.id || !body?.location) return res.status(400).json({ error: "id & location required" });
  const tag: WorkerTag = {
    id: body.id,
    name: body.name,
    type: body.type || "rfid",
    lastSeen: Date.now(),
    location: body.location,
  };
  store.updateWorker(tag);
  return res.json({ ok: true });
};
