"use client";

import { CloudRain, Wind, Thermometer, Droplets, Waves, Gauge } from "lucide-react";
import { RainfallTrendChart } from "@/components/analytics/RainfallTrendChart";
import { useEffect, useState } from "react";

export default function TelemetryPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Weather & Rivers</h1>
        <p className="text-slate-500 font-medium">Hydrological and meteorological telemetry.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card rounded-xl p-4 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
          <Thermometer className="w-8 h-8 text-rose-500 mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase">Temp</p>
          <p className="text-xl font-bold text-slate-800">28.4°C</p>
        </div>
        
        <div className="glass-card rounded-xl p-4 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
          <Droplets className="w-8 h-8 text-blue-400 mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase">Humidity</p>
          <p className="text-xl font-bold text-slate-800">84%</p>
        </div>
        
        <div className="glass-card rounded-xl p-4 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
          <Wind className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase">Wind</p>
          <p className="text-xl font-bold text-slate-800">14 km/h</p>
        </div>
        
        <div className="glass-card rounded-xl p-4 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
          <Gauge className="w-8 h-8 text-indigo-400 mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase">Pressure</p>
          <p className="text-xl font-bold text-slate-800">1012 hPa</p>
        </div>

        <div className="glass-card rounded-xl p-4 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
          <Waves className="w-8 h-8 text-amber-500 mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase">Avg River Lvl</p>
          <p className="text-xl font-bold text-slate-800">3.2m</p>
        </div>

        <div className="glass-card rounded-xl p-4 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col items-center justify-center text-center">
          <Database className="w-8 h-8 text-emerald-500 mb-2" />
          <p className="text-xs font-bold text-slate-500 uppercase">Reservoir Cap</p>
          <p className="text-xl font-bold text-slate-800">76%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
            <CloudRain className="w-5 h-5 mr-2 text-blue-600" />
            Rainfall Trend (Last 7 Days)
          </h2>
          <div className="h-64">
            <RainfallTrendChart />
          </div>
        </div>

        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center">
            <Waves className="w-5 h-5 mr-2 text-amber-600" />
            Critical River Basins
          </h2>
          <div className="flex-1 space-y-4">
             <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-amber-900">Adyar River</h3>
                  <p className="text-xs text-amber-700">Warning Level: 4.5m | Danger: 5.0m</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-amber-600">4.8m</span>
                </div>
             </div>
             
             <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-700">Cooum River</h3>
                  <p className="text-xs text-slate-500">Warning Level: 3.5m | Danger: 4.0m</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-600">2.1m</span>
                </div>
             </div>

             <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-700">Palar River</h3>
                  <p className="text-xs text-slate-500">Warning Level: 6.0m | Danger: 7.0m</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-slate-600">3.4m</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Ensure lucide icon imports matching above
function Database(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>;
}
