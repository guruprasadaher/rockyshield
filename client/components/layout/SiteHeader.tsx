import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const location = useLocation();
  const nav = [
    { to: "/", label: "Dashboard" },
    { to: "/history", label: "History" },
    { to: "/supervisor", label: "Supervisor" },
  ];
  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 bg-white dark:bg-neutral-900 border-r flex flex-col">
      <div className="flex items-center gap-2 px-4 h-14 border-b">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-teal-500 shadow" />
          <span className="font-extrabold tracking-tight text-lg">RockShield</span>
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
        <Button size="sm" className="w-full">New Site</Button>
      </div>
    </aside>
  );
}
