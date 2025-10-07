import { useEffect, useRef, useState } from "react";
import type { RiskAssessmentItem } from "@shared/api";
import { fetchRiskAssessment } from "@/lib/api";

export function useRiskAssessment(pollMs: number = 6000) {
  const [data, setData] = useState<RiskAssessmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const timerRef = useRef<any>(null);
  const cancelledRef = useRef(false);

  async function load(manual = false) {
    if (manual) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetchRiskAssessment();
      if (cancelledRef.current) return;
      setData(res);
      setLastUpdated(Date.now());
      setStale(false);
      setError(null);
      setLoading(false);
    } catch (e: any) {
      if (cancelledRef.current) return;
      // Keep previous data, mark stale if we had data before
      if (data.length) setStale(true);
      setError(e.message || "Failed to load risk assessment");
      setLoading(false);
    } finally {
      if (!cancelledRef.current) timerRef.current = setTimeout(() => load(false), pollMs);
    }
  }

  useEffect(() => {
    load(false);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  return { data, loading, error, stale, lastUpdated, refresh: () => load(true) };
}
