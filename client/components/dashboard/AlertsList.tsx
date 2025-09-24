import type { AlertItem } from "@shared/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  alerts: AlertItem[];
}

export function AlertsList({ alerts }: Props) {
  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 h-64 overflow-y-auto rounded-md border border-gray-200 bg-white p-4">
        {alerts.length === 0 && (
          <div className="text-xs text-muted-foreground">No alerts</div>
        )}
        {alerts.map((a) => (
          <div key={a.id} className="p-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">{a.message}</div>
              <div className="text-[10px] opacity-70">{new Date(a.timestamp).toLocaleTimeString()}</div>
            </div>
            <ul className="list-disc ml-4 mt-1 text-xs">
              {a.actions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
