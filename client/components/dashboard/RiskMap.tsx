import { useEffect, useMemo, Fragment } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { EvacuationRoute, WorkerTag, Zone } from "@shared/api";

interface Props {
  zones: Zone[];
  routes?: EvacuationRoute[];
  workers?: WorkerTag[];
  onZoneClick?: (id: string) => void;
}

export function RiskMap({ zones, routes = [], workers = [], onZoneClick }: Props) {
  const center = useMemo(() => {
    if (zones.length) {
      const p = zones[0].polygon[0];
      return [p.lat, p.lng] as [number, number];
    }
    return [-24.605, 135.12] as [number, number];
  }, [zones]);

  useEffect(() => {
    // Leaflet CSS is imported above
  }, []);

  return (
    <div className="h-[420px] md:h-[520px] w-full rounded-lg overflow-hidden border">
      <MapContainer center={center} zoom={14} scrollWheelZoom={true} className="h-full w-full">
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {zones.map((z) => (
          <Polygon
            key={z.id}
            positions={z.polygon.map((p) => [p.lat, p.lng]) as any}
            pathOptions={{ color: colorForRisk(z.risk), weight: 2, fillOpacity: 0.35, fillColor: colorForRisk(z.risk) }}
            eventHandlers={{ click: () => onZoneClick?.(z.id) }}
          >
            <Tooltip sticky>
              <div className="text-xs">
                <div className="font-semibold">{z.name}</div>
                <div>Risk: <span className="font-medium capitalize">{z.risk}</span></div>
                <div>Prob: {(z.probability * 100).toFixed(1)}%</div>
              </div>
            </Tooltip>
          </Polygon>
        ))}
        {routes.map((r) => (
          <Fragment key={`route-${r.zoneId}-${r.exitId}`}>
            <Polyline key={`pl-${r.zoneId}-${r.exitId}`} positions={r.path.map((p) => [p.lat, p.lng]) as any} pathOptions={{ color: "#0ea5e9", weight: 4, dashArray: "6 8" }} />
            <CircleMarker key={`ex-${r.exitId}`} center={[r.path[1].lat, r.path[1].lng]} radius={6} pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 1 }}>
              <Tooltip>{r.exitName} • {(r.distanceMeters/1000).toFixed(2)} km • ETA {r.etaMinutes.toFixed(1)} min</Tooltip>
            </CircleMarker>
          </Fragment>
        ))}
        {workers.map((w) => (
          <CircleMarker key={`w-${w.id}`} center={[w.location.lat, w.location.lng]} radius={5} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.9 }}>
            <Tooltip sticky>{w.name || w.id} {w.zoneId ? `• ${w.zoneId}` : ""}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

function colorForRisk(risk: Zone["risk"]) {
  switch (risk) {
    case "high":
      return "#ef4444"; // red-500
    case "medium":
      return "#f59e0b"; // amber-500
    default:
      return "#22c55e"; // green-500
  }
}
