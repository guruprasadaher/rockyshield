import { RequestHandler } from "express";
import { store } from "../data/store";
import { SensorReading, StreamMessage, WorkerTag, SensorDeviceSnapshot } from "@shared/api";

const clients: { id: number; res: any }[] = [];
let interval: NodeJS.Timeout | null = null;
let cid = 0;

export const streamHandler: RequestHandler = (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    // ensure browsers can connect when dev/proxying
    "Access-Control-Allow-Origin": req.get("origin") || "*",
  });
  // make sure headers are flushed
  res.flushHeaders?.();

  const id = ++cid;
  clients.push({ id, res });

  // Send initial zones state
  streamBroadcast({ type: "zones", payload: store.zones });

  // send a comment to establish the stream
  res.write(': connected\n\n');

  req.on("close", () => {
    const idx = clients.findIndex((c) => c.id === id);
    if (idx >= 0) clients.splice(idx, 1);
    if (!clients.length && interval) {
      clearInterval(interval);
      interval = null;
    }
  });

  if (!interval) {
    // main update loop
    interval = setInterval(() => {
      const loopStart = Date.now();
      // Simulate sensor readings per zone
      for (const z of store.zones) {
        const last = store.latestSensors[z.id];
        const reading: SensorReading = {
          timestamp: Date.now(),
          zoneId: z.id,
          displacement: Math.max(0, (last?.displacement ?? 1) + randn(-0.3, 0.8)),
          strain: Math.max(0, (last?.strain ?? 50) + randn(-3, 4)),
          porePressure: Math.max(0, (last?.porePressure ?? 20) + randn(-2, 5)),
          rainfall: Math.max(0, randn(0, 5)),
          temperature: 20 + randn(-0.5, 0.5),
          vibration: Math.max(0, randn(0.2, 0.6)),
        };
        store.latestSensors[z.id] = reading;
  streamBroadcast({ type: "sensor", payload: reading });
      }

      const prediction = store.predict(Date.now());
  streamBroadcast({ type: "prediction", payload: prediction });

      // Occupancy updates (simulate worker drift)
      for (const id in store.workers) {
        const w = store.workers[id];
        const drift: WorkerTag = {
          ...w,
          location: { lat: w.location.lat + randn(-0.0005, 0.0005), lng: w.location.lng + randn(-0.0005, 0.0005) },
          lastSeen: Date.now(),
        };
        store.updateWorker(drift);
  streamBroadcast({ type: "worker", payload: drift });
      }
  streamBroadcast({ type: "occupancy", payload: store.getOccupancy() });

      // Alerts
      prediction.zones.forEach((z) => {
        if (z.risk === "high") {
          // throttle by last alert per zone
          const recent = store.alerts.find((a) => a.zoneId === z.id && Date.now() - a.timestamp < 60_000);
          if (!recent) {
            const alert = {
              id: `${z.id}-${Date.now()}`,
              zoneId: z.id,
              level: "high" as const,
              message: `${z.name}: High rockfall risk (${(z.probability * 100).toFixed(1)}%)`,
              actions: z.recommendedActions,
              timestamp: Date.now(),
            };
            store.alerts.unshift(alert);
            streamBroadcast({ type: "alert", payload: alert });
            // compliance log entry
            store.logAlertEvent(alert);
          }
        }
        // detect resolution: if zone currently medium/low but had an ongoing event
        if (z.risk !== "high") {
          const ongoing = store.events.find(e => e.zone_id === z.id && e.status === "Ongoing");
          if (ongoing) {
            store.resolveZoneEvent(z.id);
          }
        }
      });

      // Update sensor devices health and broadcast snapshots occasionally
      const delta = 4000; // loop interval ms
      store.updateSensorHeartbeats(delta);
      const snapshots: SensorDeviceSnapshot[] = store.sensors.map(s => store.sensorSnapshot(s));
      streamBroadcast({ type: 'sensor_health', payload: snapshots } as any);

      // Maintenance/fault alerts (throttle: only once per 5 min per sensor)
      const now = Date.now();
      snapshots.forEach(s => {
        if (s.status === 'Faulty' || s.status === 'Inactive') {
          const already = store.alerts.find(a => a.zoneId === s.zone_id && a.message.includes(s.sensor_id) && now - a.timestamp < 300_000);
          if (!already) {
            const alert = {
              id: `${s.sensor_id}-${now}`,
              zoneId: s.zone_id,
              level: 'medium' as const,
              message: `Sensor ${s.sensor_id} (${s.type}) ${s.status === 'Faulty' ? 'fault detected' : 'inactive/no heartbeat'}`,
              actions: ['Dispatch maintenance crew','Verify power and connectivity'],
              timestamp: now
            };
            store.alerts.unshift(alert);
            streamBroadcast({ type: 'alert', payload: alert });
            // Log as compliance event (non-high severity) for audit (reuse log but severity medium)
            store.logAlertEvent(alert);
          }
        }
      });
    }, 4000);

    // heartbeat to keep proxies alive
    setInterval(() => {
      clients.forEach((c) => c.res.write(': heartbeat\n\n'));
    }, 15000);
  }
};

export function streamBroadcast(msg: StreamMessage) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  clients.forEach((c) => c.res.write(data));
}

function randn(min: number, max: number) {
  return Math.random() * (max - min) + min;
}
