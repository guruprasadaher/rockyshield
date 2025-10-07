import { useEffect, useMemo, Fragment } from "react";
import { MapContainer, TileLayer, Polygon, Tooltip, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { EvacuationRoute, WorkerTag, Zone } from "@shared/api";

interface Props {
  zones: Zone[];
  routes?: EvacuationRoute[];
  workers?: WorkerTag[];
  onZoneClick?: (id: string) => void;
  selectedZoneId?: string | null;
}

export function RiskMap({ zones, routes = [], workers = [], onZoneClick, selectedZoneId }: Props) {
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

  const selected = selectedZoneId ? zones.find(z => z.id === selectedZoneId) : null;

  return (
    <div className="relative h-[480px] md:h-[560px] xl:h-[620px] w-full rounded-lg overflow-hidden border bg-background">
  {/** Cast to any to bypass prop type mismatch stemming from react-leaflet type version vs TS bundler mode */}
  { /* eslint-disable-next-line @typescript-eslint/ban-ts-comment */ }
  {/* @ts-ignore */}
      <MapContainer center={center} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          // @ts-expect-error react-leaflet type narrowing under bundler mode drops attribution prop; runtime ok
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
            <Tooltip
              // @ts-expect-error sticky prop sometimes missing due to type version mismatch
              sticky>
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
            <CircleMarker key={`ex-${r.exitId}`} center={[r.path[1].lat, r.path[1].lng]}
              // @ts-expect-error radius exists at runtime; type mismatch from older defs
              radius={6} pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 1 }}>
              <Tooltip>{r.exitName} • {(r.distanceMeters/1000).toFixed(2)} km • ETA {r.etaMinutes.toFixed(1)} min</Tooltip>
            </CircleMarker>
          </Fragment>
        ))}
        {workers.map((w) => (
          <CircleMarker key={`w-${w.id}`} center={[w.location.lat, w.location.lng]}
            // @ts-expect-error radius prop present at runtime
            radius={5} pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.9 }}>
            <Tooltip
              // @ts-expect-error sticky prop present at runtime
              sticky>{w.name || w.id} {w.zoneId ? `• ${w.zoneId}` : ""}</Tooltip>
          </CircleMarker>
        ))}
        {/* Selected zone overlay panel (fills unused vertical space elegantly) */}
        {selected && (
          <div className="absolute bottom-2 left-2 max-w-xs w-[260px] bg-white/90 dark:bg-neutral-900/80 backdrop-blur-sm rounded-md shadow-md border p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <div className="font-semibold truncate pr-2">{selected.name}</div>
              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium" style={{background: colorForRisk(selected.risk), color: '#fff'}}>{selected.risk}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Probability" value={(selected.probability*100).toFixed(1)+'%'} />
              <Metric label="Vertices" value={selected.polygon.length} />
              <Metric label="Actions" value={selected.recommendedActions.length} />
              <Metric label="ID" value={selected.id} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide font-medium mb-1 opacity-70">Recommendations</div>
              <ul className="space-y-1">
                {selected.recommendedActions.slice(0,3).map(a => <li key={a} className="flex items-start gap-1"><span className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-500" /> <span>{a}</span></li>)}
              </ul>
            </div>
          </div>
        )}
      </MapContainer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: any }) {
  return (
    <div className="p-2 rounded bg-muted/50 flex flex-col">
      <span className="text-[9px] uppercase tracking-wide opacity-60 font-medium">{label}</span>
      <span className="text-[11px] font-semibold mt-0.5 leading-tight">{value}</span>
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
