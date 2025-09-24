import { RequestHandler } from "express";
import { store } from "../data/store";
import { RiskAssessmentItem, RiskLevel } from "@shared/api";

function levelScore(level: RiskLevel): number {
  switch (level) {
    case "high": return 40;
    case "medium": return 20;
    default: return 10;
  }
}

export const handleRiskAssessment: RequestHandler = (req, res) => {
  const prediction = store.predict(Date.now());

  // Build quick worker occupancy by zone (already computed in store maybe)
  const workersByZone: Record<string, number> = {};
  Object.values(store.workers).forEach(w => {
    if (w.zoneId) workersByZone[w.zoneId] = (workersByZone[w.zoneId] || 0) + 1;
  });

  const items: RiskAssessmentItem[] = prediction.zones.map(z => {
    const base = levelScore(z.risk);
    const probScore = Math.round(z.probability * 50); // 0..50
    const workers = Math.min(workersByZone[z.id] || 0, 10); // cap 10
    const risk_score = Math.min(100, base + probScore + workers);
    const recommended_action: RiskAssessmentItem["recommended_action"] = risk_score >= 70 ? "Evacuate immediately" : risk_score >= 40 ? "Monitor" : "Safe";
    return { zone_id: z.id, risk_score, workers_at_risk: workersByZone[z.id] || 0, recommended_action };
  })
  .sort((a,b) => b.risk_score - a.risk_score);

  res.json(items);
};
