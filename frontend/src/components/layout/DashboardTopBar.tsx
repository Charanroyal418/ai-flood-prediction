"use client";

import { useEffect, useState } from "react";
import { Menu, Circle } from "lucide-react";
import { useFloodData } from "@/context/FloodDataContext";

export default function DashboardTopBar() {
  const [mounted, setMounted] = useState(false);
  const { mode, stormSimulationActive, relativeSyncTime } = useFloodData();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  return (
    <header className="h-10 bg-paper-100 border-b border-line flex items-center px-4 gap-4 flex-shrink-0 z-10 text-sm">
      {/* Mobile hamburger menu */}
      <button
        type="button"
        onClick={() => {
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("toggle-mobile-nav"));
          }
        }}
        className="md:hidden w-6 h-6 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu className="w-4 h-4" />
      </button>

      <div className="flex-1 flex items-center gap-4 min-w-0 font-mono text-xs text-text-secondary">
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full shadow-sm ${
            isStormActive
              ? "bg-orange-100 text-orange-700"
              : "bg-emerald-100 text-emerald-700"
          }`}
        >
          <Circle
            className={`w-2 h-2 fill-current animate-pulse-soft ${
              isStormActive ? "text-orange-500" : "text-emerald-500"
            }`}
          />
          <span className="font-bold font-sans">
            {isStormActive ? "SYSTEM: SIMULATED" : "SYSTEM: NOMINAL"}
          </span>
        </div>
        <div className="h-4 w-px bg-line hidden sm:block" />
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold shadow-sm">
          <span>LAST SYNC:</span>
          <span className="font-mono">{!mounted ? "..." : relativeSyncTime}</span>
        </div>
      </div>
    </header>
  );
}
