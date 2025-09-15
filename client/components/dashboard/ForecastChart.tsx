import Plot from "react-plotly.js";
import type { PredictionOutput, Zone } from "@shared/api";

interface Props {
  history: PredictionOutput[];
  focusZoneId?: string | null;
  zones: Zone[];
}

export function ForecastChart({ history, focusZoneId, zones }: Props) {
  const times = history.map((h) => new Date(h.timestamp));
  const chosen = focusZoneId
    ? zones.filter((z) => z.id === focusZoneId)
    : zones;

  const data = chosen.map((z) => ({
    x: times,
    y: history.map((h) => h.zones.find((zz) => zz.id === z.id)?.probability ?? null),
    name: z.name,
    mode: "lines",
    line: { shape: "spline" as const },
  }));

  return (
    <div className="w-full">
      <Plot
        data={data as any}
        layout={{
          autosize: true,
          height: 300,
          margin: { l: 40, r: 10, t: 20, b: 35 },
          yaxis: { title: "Probability", tickformat: ".0%", range: [0, 1] },
          xaxis: { title: "Time" },
          paper_bgcolor: "transparent",
          plot_bgcolor: "transparent",
        }}
        useResizeHandler
        style={{ width: "100%", height: "100%" }}
        config={{ displayModeBar: false }}
      />
    </div>
  );
}
