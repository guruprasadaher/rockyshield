import { SiteHeader } from "@/components/layout/SiteHeader";

export default function History() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Historical Data & Trends</h1>
        <p className="text-muted-foreground">This page will show past rockfall events, sensor trends, and site-wide analytics. Ask to generate detailed analytics if needed.</p>
        <div className="mt-6 rounded-lg border bg-card p-6">
          <div className="text-sm">No historical records yet. Live monitoring will accumulate data over time.</div>
        </div>
      </main>
    </div>
  );
}
