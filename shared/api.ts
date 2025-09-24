/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

export interface DemoResponse {
  message: string;
}

export type RiskLevel = "low" | "medium" | "high";

export interface LatLng {
  lat: number;
  lng: number;
}

export type WorkerType = "rfid" | "ble";

export interface WorkerTag {
  id: string;
  name?: string;
  type: WorkerType;
  lastSeen: number; // ms
  location: LatLng;
  zoneId?: string; // resolved server-side when inside a zone
}

export interface ZoneOccupancy {
  zoneId: string;
  zoneName: string;
  count: number;
  workers: Pick<WorkerTag, "id" | "name" | "type">[];
}

export interface Zone {
  id: string;
  name: string;
  polygon: LatLng[];
  probability: number; // 0..1
  risk: RiskLevel;
  recommendedActions: string[];
}

export interface SafeExit {
  id: string;
  name: string;
  location: LatLng;
  type: "muster" | "gate" | "safezone";
}

export interface EvacuationRoute {
  zoneId: string;
  zoneName: string;
  exitId: string;
  exitName: string;
  path: LatLng[]; // ordered path from zone centroid -> exit
  distanceMeters: number;
  etaMinutes: number;
}

export interface SensorReading {
  timestamp: number; // ms
  zoneId: string;
  displacement: number; // mm
  strain: number; // με
  porePressure: number; // kPa
  rainfall: number; // mm/hr
  temperature: number; // C
  vibration: number; // mm/s
}

export interface PredictionOutput {
  timestamp: number;
  zones: Zone[];
  flags: {
    barricade: boolean;
  };
  evacuationRoutes: EvacuationRoute[];
}

export interface AlertItem {
  id: string;
  zoneId: string;
  level: RiskLevel;
  message: string;
  actions: string[];
  timestamp: number;
}

// Personalized evacuation alert for a worker
export interface EvacuationAlert {
  worker_id: string;
  message: string; // Short life-saving instruction
  evacuation_route: LatLng[]; // Ordered polyline
  urgency: "High" | "Medium" | "Low";
  language: string; // ISO code e.g., 'en'
}

// Supervisor risk ranking item
export interface RiskAssessmentItem {
  zone_id: string;
  risk_score: number; // 0-100
  workers_at_risk: number;
  recommended_action: "Evacuate immediately" | "Monitor" | "Safe";
}

export type StreamMessage =
  | { type: "sensor"; payload: SensorReading }
  | { type: "prediction"; payload: PredictionOutput }
  | { type: "alert"; payload: AlertItem }
  | { type: "zones"; payload: Zone[] }
  | { type: "worker"; payload: WorkerTag }
  | { type: "occupancy"; payload: ZoneOccupancy[] };

// Ingest payloads
export interface IngestDEM {
  zones: { id: string; name: string; polygon: LatLng[]; slope: number }[];
}

export interface IngestDroneImagery {
  zoneId: string;
  crackIndex: number; // 0..1
}

export interface IngestGeotech {
  reading: SensorReading;
}

export interface IngestEnvironment {
  zoneId: string;
  rainfall: number;
  temperature: number;
  vibration: number;
}

export interface IngestWorkerLocation {
  id: string;
  type: WorkerType;
  name?: string;
  location: LatLng;
}
