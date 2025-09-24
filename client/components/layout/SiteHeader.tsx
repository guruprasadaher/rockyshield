import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createSite } from "@/lib/api";

export function SiteHeader() {
  const location = useLocation();
  const nav = [
    { to: "/", label: "Dashboard" },
    { to: "/history", label: "History" },
    { to: "/sensors", label: "Sensors" },
    { to: "/supervisor", label: "Supervisor" },
    { to: "/reports", label: "Reports" },
  ];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (!name || isNaN(latNum) || isNaN(lngNum)) {
      setError("Please provide valid name, latitude and longitude");
      return;
    }
    try {
      setSubmitting(true);
      await createSite({ name, lat: latNum, lng: lngNum });
      setSubmitting(false);
      setName(""); setLat(""); setLng("");
      setOpen(false);
    } catch (err:any) {
      setSubmitting(false);
      setError(err.message || 'Failed to create site');
    }
  }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-white dark:bg-neutral-900 border-r flex flex-col">
      <div className="flex items-center gap-2 px-4 h-14 border-b">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-teal-500 shadow" />
          <span className="font-extrabold tracking-tight text-lg">MineKavach</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3 text-sm">
        {nav.map(n => (
          <Link key={n.to} to={n.to} className={cn(
            "block px-3 py-2 rounded-md transition-colors",
            location.pathname === n.to ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
          )}>{n.label}</Link>
        ))}
      </nav>
      <div className="p-3 border-t">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full" onClick={() => setOpen(true)}>New Site</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Create New Site</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-3 mt-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="North Bench" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Latitude</label>
                  <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-24.600" required />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Longitude</label>
                  <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="135.120" required />
                </div>
              </div>
              {error && <div className="text-xs text-red-600">{error}</div>}
              <DialogFooter>
                <Button type="submit" size="sm" disabled={submitting} className="w-full">{submitting ? 'Creating...' : 'Create Site'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </aside>
  );
}
