import { AlertItem, ComplianceEvent, EvacuationRoute, IngestDEM, PredictionOutput, RiskLevel, SafeExit, SensorReading, WorkerTag, Zone, ZoneOccupancy } from "@shared/api";

// In-memory store (replace with database in production)
class Store {
  zones: Zone[] = [];
  zoneSlope: Record<string, number> = {};
  crackIndex: Record<string, number> = {};
  latestSensors: Record<string, SensorReading> = {};
  alerts: AlertItem[] = [];
  // Immutable compliance events log
  events: ComplianceEvent[] = [];
  safeExits: SafeExit[] = [];
  workers: Record<string, WorkerTag> = {};

  seed() {
    if (this.zones.length) return;
    // Seed with 3 zones around a sample location
    const base: Zone[] = [
      {
        id: "z1",
        name: "North Slope",
        polygon: [
          { lat: -24.6, lng: 135.1 },
          { lat: -24.61, lng: 135.12 },
          { lat: -24.62, lng: 135.09 },
          { lat: -24.6, lng: 135.08 },
        ],
        probability: 0.1,
        risk: "low",
        recommendedActions: ["Routine inspection"]
      },
      {
        id: "z2",
        name: "East Ramp",
        polygon: [
          { lat: -24.605, lng: 135.13 },
          { lat: -24.615, lng: 135.14 },
          { lat: -24.625, lng: 135.12 },
          { lat: -24.61, lng: 135.11 },
        ],
        probability: 0.2,
        risk: "low",
        recommendedActions: ["Routine inspection"]
      },
      {
        id: "z3",
        name: "Haul Road Cut",
        polygon: [
          { lat: -24.59, lng: 135.11 },
          { lat: -24.6, lng: 135.15 },
          { lat: -24.61, lng: 135.14 },
          { lat: -24.6, lng: 135.1 },
        ],
        probability: 0.15,
        risk: "low",
        recommendedActions: ["Routine inspection"]
      }
    ];
    this.zones = base;
    this.zoneSlope = { z1: 38, z2: 32, z3: 28 };
    this.crackIndex = { z1: 0.2, z2: 0.15, z3: 0.1 };
    this.safeExits = [
      { id: "e1", name: "Muster Point A", type: "muster", location: { lat: -24.595, lng: 135.105 } },
      { id: "e2", name: "Muster Point B", type: "muster", location: { lat: -24.615, lng: 135.145 } },
      { id: "e3", name: "South Gate", type: "gate", location: { lat: -24.625, lng: 135.085 } },
    ];
    // Seed workers
    this.workers = {
      w1: { id: "w1", name: "Crew A-1", type: "rfid", lastSeen: Date.now(), location: { lat: -24.603, lng: 135.119 } },
      w2: { id: "w2", name: "Crew A-2", type: "rfid", lastSeen: Date.now(), location: { lat: -24.61, lng: 135.13 } },
      w3: { id: "w3", name: "Surveyor B", type: "ble", lastSeen: Date.now(), location: { lat: -24.6, lng: 135.112 } },
    };
    this.updateWorkerZones();
  }

  updateFromDEM(payload: IngestDEM) {
    // Update zone polygons and slopes
    payload.zones.forEach(z => {
      this.zoneSlope[z.id] = z.slope;
      const existing = this.zones.find(zz => zz.id === z.id);
      if (existing) {
        existing.name = z.name;
        existing.polygon = z.polygon;
      } else {
        this.zones.push({ id: z.id, name: z.name, polygon: z.polygon, probability: 0, risk: "low", recommendedActions: ["Routine inspection"] });
      }
    });
  }

  predict(now: number = Date.now()): PredictionOutput {
    // Simple logistic model using slope, crack index, displacement rate, rainfall, pore pressure
    const zones = this.zones.map((z) => {
      const slope = this.zoneSlope[z.id] ?? 25;
      const crack = this.crackIndex[z.id] ?? 0.1;
      const s = this.latestSensors[z.id];
      const disp = s ? s.displacement : 2;
      const rain = s ? s.rainfall : 0;
      const pore = s ? s.porePressure : 10;
      const vib = s ? s.vibration : 0.5;

      // Feature scaling
      const fSlope = slope / 45; // 0..~1
      const fCrack = crack; // 0..1
      const fDisp = Math.min(disp / 20, 1); // >=20mm
      const fRain = Math.min(rain / 30, 1); // 30mm/hr
      const fPore = Math.min(pore / 100, 1);
      const fVib = Math.min(vib / 10, 1);

      const score = 3.0 * fSlope + 2.5 * fCrack + 2.2 * fDisp + 1.8 * fRain + 1.5 * fPore + 1.2 * fVib - 2.2;
      const probability = 1 / (1 + Math.exp(-score));

      const risk: RiskLevel = probability > 0.7 ? "high" : probability > 0.4 ? "medium" : "low";
      const recommendedActions = this.actionsForRisk(risk);

      return { ...z, probability, risk, recommendedActions };
    });

    const barricade = zones.some((z) => z.risk === "high");
    const evacuationRoutes = this.computeEvacuationRoutes(zones);
    const out: PredictionOutput = { timestamp: now, zones, flags: { barricade }, evacuationRoutes };
    return out;
  }

  updateWorker(tag: WorkerTag) {
    this.workers[tag.id] = { ...this.workers[tag.id], ...tag, lastSeen: Date.now() };
    this.updateWorkerZones();
  }

  updateWorkerZones() {
    for (const id in this.workers) {
      const w = this.workers[id];
      w.zoneId = undefined;
      for (const z of this.zones) {
        if (pointInPolygon(w.location, z.polygon)) {
          w.zoneId = z.id;
          break;
        }
      }
    }
  }

  getOccupancy(): ZoneOccupancy[] {
    const by: Record<string, ZoneOccupancy> = {};
    for (const z of this.zones) by[z.id] = { zoneId: z.id, zoneName: z.name, count: 0, workers: [] };
    for (const id in this.workers) {
      const w = this.workers[id];
      if (w.zoneId && by[w.zoneId]) by[w.zoneId].count += 1, by[w.zoneId].workers.push({ id: w.id, name: w.name, type: w.type });
    }
    return Object.values(by);
  }

  computeEvacuationRoutes(zones: Zone[]): EvacuationRoute[] {
    const risky = zones.filter((z) => z.risk === "high");
    const routes: EvacuationRoute[] = [];
    for (const z of risky) {
      const centroid = polyCentroid(z.polygon);
      let best: { exit: SafeExit; dist: number } | null = null;
      for (const e of this.safeExits) {
        const d = haversine(centroid, e.location);
        if (!best || d < best.dist) best = { exit: e, dist: d };
      }
      if (best) {
        const speedMps = 1.2; // approx walking with PPE
        const etaMinutes = best.dist / speedMps / 60;
        routes.push({
          zoneId: z.id,
          zoneName: z.name,
          exitId: best.exit.id,
          exitName: best.exit.name,
          path: [centroid, best.exit.location],
          distanceMeters: best.dist,
          etaMinutes,
        });
      }
    }
    return routes;
  }

  actionsForRisk(risk: RiskLevel): string[] {
    if (risk === "high")
      return [
        "Evacuate personnel from affected zone",
        "Establish exclusion barriers",
        "Deploy spotters and drones",
        "Schedule immediate geotech inspection"
      ];
    if (risk === "medium")
      return [
        "Increase monitoring frequency",
        "Reduce equipment speeds",
        "Inspect drainage and catch berms"
      ];
    return ["Routine inspection"];
  }

  logAlertEvent(alert: AlertItem) {
    // Determine current workers in the zone at alert time
    const workersInZone = Object.values(this.workers).filter(w => w.zoneId === alert.zoneId);
    const timestamp = new Date(alert.timestamp).toISOString();
    const event: ComplianceEvent = {
      event_id: `E${alert.id}`,
      timestamp,
      zone_id: alert.zoneId,
      workers_alerted: workersInZone.map(w => w.id),
      alert_delivery_time: Object.fromEntries(workersInZone.map(w => [w.id, timestamp])),
      supervisor_action: undefined,
      status: "Ongoing",
      severity: alert.level,
    };
    this.events.unshift(event); // newest first, immutable append
  }

  resolveZoneEvent(zoneId: string) {
    // find most recent ongoing event for zone and mark as resolved (immutably by adding a new record?)
    const last = this.events.find(e => e.zone_id === zoneId && e.status === "Ongoing");
    if (last) {
      // create a resolved shadow entry to keep immutability of previous state
      const resolved: ComplianceEvent = { ...last, status: "Resolved", event_id: last.event_id + "R", timestamp: new Date().toISOString() };
      this.events.unshift(resolved);
    }
  }
}

function polyCentroid(poly: { lat: number; lng: number }[]): { lat: number; lng: number } {
  let x = 0, y = 0, z = 0;
  poly.forEach((p) => {
    const lat = (p.lat * Math.PI) / 180;
    const lng = (p.lng * Math.PI) / 180;
    x += Math.cos(lat) * Math.cos(lng);
    y += Math.cos(lat) * Math.sin(lng);
    z += Math.sin(lat);
  });
  const total = poly.length;
  x /= total; y /= total; z /= total;
  const lng = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hyp);
  return { lat: (lat * 180) / Math.PI, lng: (lng * 180) / Math.PI };
}

function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng, yi = polygon[i].lat;
    const xj = polygon[j].lng, yj = polygon[j].lat;
    const intersect = (yi > point.lat) !== (yj > point.lat) && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const c = 2 * Math.asin(Math.sqrt(sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng));
  return R * c; // meters
}

export const store = new Store();
store.seed();
