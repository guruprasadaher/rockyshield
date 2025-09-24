import { useEffect, useState } from "react";
import type { EvacuationAlert } from "@shared/api";
import { fetchEvacuationAlerts } from "@/lib/api";

export function useEvacuationAlerts(pollMs: number = 5000) {
  const [alerts, setAlerts] = useState<EvacuationAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: any;

    async function load() {
      try {
        const data = await fetchEvacuationAlerts();
        if (!cancelled) {
          setAlerts(data);
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || "Failed to load evacuation alerts");
          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          timer = setTimeout(load, pollMs);
        }
      }
    }

    load();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [pollMs]);

  return { alerts, loading, error };
}
