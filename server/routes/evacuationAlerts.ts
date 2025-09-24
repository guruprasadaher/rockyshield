import { RequestHandler } from "express";
import { store } from "../data/store";
import { WorkerTag, Zone, EvacuationRoute, EvacuationAlert } from "@shared/api";

function pointInPolygon(point: { lat: number; lng: number }, polygon: { lat: number; lng: number }[]): boolean {
  // Ray-casting algorithm for detecting if point is in polygon
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;
    const intersect = ((yi > point.lng) !== (yj > point.lng)) &&
      (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const handleEvacuationAlerts: RequestHandler = (req, res) => {
  // Get latest prediction and workers
  const prediction = store.predict(Date.now());
  const workers: WorkerTag[] = Object.values(store.workers);
  const highRiskZones = prediction.zones.filter(z => z.risk === "high");
  const alerts: EvacuationAlert[] = workers.map(worker => {
    // Check if worker is in or near a high-risk zone
    let matchedZone: Zone | undefined;
    for (const zone of highRiskZones) {
      if (pointInPolygon(worker.location, zone.polygon)) {
        matchedZone = zone;
        break;
      }
    }
    if (matchedZone) {
      // Find nearest evacuation route
      const route = prediction.evacuationRoutes.find(r => r.zoneId === matchedZone!.id);
      const urgency = "High";
      return {
        worker_id: worker.id,
        message: `Evacuate immediately via safest route to ${route?.exitName ?? "nearest exit"}.`,
        evacuation_route: route ? route.path : [],
        urgency,
        language: "en"
      };
    } else {
      return {
        worker_id: worker.id,
        message: "Safe – No Action Required.",
        evacuation_route: [],
        urgency: "Low",
        language: "en"
      };
    }
  });
  res.json(alerts);
};
