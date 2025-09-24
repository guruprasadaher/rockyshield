import "./global.css";
import React from 'react';
import "leaflet/dist/leaflet.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import History from "./pages/History";
import Sensors from "./pages/Sensors";
import Supervisor from "./pages/Supervisor";
import Reports from "./pages/Reports";
import { SiteHeader } from "@/components/layout/SiteHeader";

const queryClient = new QueryClient();

class ErrorBoundary extends React.Component<{ children: any }, { error: any }> {
  constructor(props: any){
    super(props); this.state = { error: null };
  }
  static getDerivedStateFromError(error: any){
    return { error };
  }
  componentDidCatch(error: any, info: any){
    console.error('App boundary caught error', error, info);
  }
  render(){
    if (this.state.error) {
      return <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h1 className="text-xl font-bold mb-2">Runtime Error</h1>
        <pre className="text-sm bg-black/5 p-3 rounded overflow-auto max-h-[50vh] whitespace-pre-wrap">{String(this.state.error?.stack || this.state.error)}</pre>
        <button className="mt-4 underline" onClick={() => this.setState({ error: null })}>Retry</button>
      </div>;
    }
    return this.props.children;
  }
}

// Global listeners to surface silent errors (especially in production)
window.addEventListener('error', (e) => {
  console.error('Global error', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled promise rejection', e.reason);
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="flex min-h-screen w-full">
          <SiteHeader />
          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/history" element={<History />} />
                <Route path="/sensors" element={<Sensors />} />
                <Route path="/supervisor" element={<Supervisor />} />
                <Route path="/reports" element={<Reports />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

createRoot(document.getElementById("root")!).render(<App />);
