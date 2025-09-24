import { RequestHandler } from "express";
import { store } from "../data/store";

export const handlePredict: RequestHandler = (req, res) => {
  const out = store.predict(Date.now());
  // Find highest risk zone
  const highest = out.zones.reduce((max, z) => (z.probability > max.probability ? z : max), out.zones[0]);
  const status = highest.risk === "high" ? "Risk Detected" : "Safe";
  const probability = Number(highest.probability.toFixed(2));
  // Estimate time window (simple logic: higher probability = sooner event)
  let estimated_time_window = null;
  if (highest.risk === "high") {
    estimated_time_window = probability > 0.9 ? "5-15 minutes" : probability > 0.7 ? "15-30 minutes" : "30-60 minutes";
  }
  // Visualization-ready data: highlight unstable zones
  const unstable_zones = out.zones.filter(z => z.risk !== "low").map(z => ({
    zone_id: z.id,
    name: z.name,
    polygon: z.polygon,
    risk_level: z.risk,
    probability: Number(z.probability.toFixed(2)),
    recommendedActions: z.recommendedActions
  }));
  // Sensor summary (simulate, or pull from store.latestSensors)
  const sensor_summary = {};
  for (const z of out.zones) {
    const s: import("@shared/api").SensorReading | undefined = store.latestSensors[z.id];
    sensor_summary[z.id] = {
      doppler_radar: { value: s ? s.displacement : null, status: s && typeof s.displacement === "number" ? "ok" : "missing" },
      vibration: { value: s ? s.vibration : null, status: s && typeof s.vibration === "number" ? "ok" : "missing" },
      slope_stability: { value: s ? s.porePressure : null, status: s && typeof s.porePressure === "number" ? "ok" : "missing" }
    };
  }
  res.json({
    status,
    probability,
    estimated_time_window,
    unstable_zones,
    sensor_summary,
    timestamp: new Date(out.timestamp).toISOString()
  });
};
