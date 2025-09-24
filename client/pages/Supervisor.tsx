import React from "react";
import { useRiskAssessment } from "@/hooks/use-risk-assessment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export default function SupervisorPage() {
  const { data, loading, error } = useRiskAssessment(7000);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Supervisor Risk Dashboard</h1>
      {loading && <div className="text-sm opacity-70">Loading risk data...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map(item => {
          const color = item.recommended_action === 'Evacuate immediately' ? 'border-red-500/60 bg-red-50 dark:bg-red-950/30' : item.recommended_action === 'Monitor' ? 'border-amber-500/60 bg-amber-50 dark:bg-amber-950/30' : 'border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30';
          const barColor = item.recommended_action === 'Evacuate immediately' ? 'bg-red-600' : item.recommended_action === 'Monitor' ? 'bg-amber-500' : 'bg-emerald-600';
          return (
            <Card key={item.zone_id} className={`border ${color} relative overflow-hidden`}> 
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Zone {item.zone_id}</span>
                  <span className="text-xs font-normal opacity-70">{item.risk_score}/100</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Workers at risk</div>
                  <div>{item.workers_at_risk}</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Action</div>
                  <div className="text-[11px] font-semibold">
                    {item.recommended_action === 'Evacuate immediately' && <span className="text-red-600">Evacuate</span>}
                    {item.recommended_action === 'Monitor' && <span className="text-amber-600">Monitor</span>}
                    {item.recommended_action === 'Safe' && <span className="text-emerald-600">Safe</span>}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide opacity-70">Risk Score</div>
                  <div className="w-full h-2 rounded bg-muted overflow-hidden">
                    <div className={`h-2 ${barColor}`} style={{ width: `${item.risk_score}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
