import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const location = useLocation();
  const nav = [
    { to: "/", label: "Dashboard" },
    { to: "/history", label: "History" },
    { to: "/supervisor", label: "Supervisor" },
  ];
  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-black/50 backdrop-blur border-b">
      <div className="container mx-auto flex items-center justify-between py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary to-teal-500 shadow"></div>
          <span className="font-extrabold tracking-tight text-lg">RockShield AI</span>
        </Link>
        <nav className="flex items-center gap-2">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={cn("px-3 py-1 rounded-md text-sm hover:bg-accent", location.pathname === n.to && "bg-accent text-foreground font-semibold")}>{n.label}</Link>
          ))}
          <Button size="sm" className="ml-2 hidden md:inline-flex">New Site</Button>
        </nav>
      </div>
    </header>
  );
}
