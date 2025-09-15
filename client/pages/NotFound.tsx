import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SiteHeader } from "@/components/layout/SiteHeader";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-xl text-muted-foreground mb-6">Oops! Page not found</p>
        <a href="/" className="inline-block px-4 py-2 rounded-md bg-primary text-primary-foreground">Return to Dashboard</a>
      </div>
    </div>
  );
};

export default NotFound;
