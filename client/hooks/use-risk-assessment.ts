import { useEffect, useState } from "react";
import type { RiskAssessmentItem } from "@shared/api";
import { fetchRiskAssessment } from "@/lib/api";

export function useRiskAssessment(pollMs: number = 6000) {
  const [data, setData] = useState<RiskAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: any;
    async function load() {
      try {
        const res = await fetchRiskAssessment();
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to load risk assessment");
          setLoading(false);
        }
      } finally {
        if (!cancelled) timer = setTimeout(load, pollMs);
      }
    }
    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pollMs]);

  return { data, loading, error };
}
