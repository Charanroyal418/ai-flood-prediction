"use client";

import { ActivitySquare, CloudRain, Droplets, Waves, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

export default function RealTimeMonitoringPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We would fetch real-time telemetry here
    // For now, simulating the EOC telemetry feed
    setTimeout(() => {
      setData({
        rainfall: "142.5 mm",
        weather: "Heavy Rain, 28°C",
        river_level: "Adyar: 4.8m (Warning)",
        reservoir: "Chembarambakkam: 82%",
        district_risk: "Chennai: High (88%)",
        latest_prediction: "Severe flooding likely in Velachery within 4 hours",
        last_updated: new Date().toLocaleTimeString(),
        system_status: "Online"
      });
      setLoading(false);
    }, 1000);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Real-Time Monitoring</h1>
        <p className="text-slate-500 font-medium">Live telemetry feed from meteorological and hydrological sensors.</p>
      </div>

      {loading ? (
        <div className="glass-card rounded-xl p-12 flex flex-col items-center justify-center bg-white/80 border border-slate-200/60 shadow-sm animate-pulse">
           <ActivitySquare className="w-12 h-12 text-blue-500 mb-4 animate-spin" />
           <p className="text-slate-500">Connecting to telemetry stream...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CloudRain className="w-16 h-16" />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Current Rainfall</h3>
            <p className="text-3xl font-bold text-blue-600">{data?.rainfall}</p>
          </div>
          
          <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Activity className="w-16 h-16" />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Weather</h3>
            <p className="text-3xl font-bold text-slate-700">{data?.weather}</p>
          </div>
          
          <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Waves className="w-16 h-16" />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">River Levels</h3>
            <p className="text-3xl font-bold text-amber-600">{data?.river_level}</p>
          </div>
          
          <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Droplets className="w-16 h-16" />
            </div>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Reservoir Status</h3>
            <p className="text-3xl font-bold text-emerald-600">{data?.reservoir}</p>
          </div>

          <div className="xl:col-span-4 glass-card rounded-xl p-6 bg-slate-900 border border-slate-800 shadow-xl">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div>
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">System Status</h3>
                   <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-emerald-400 font-bold">{data?.system_status}</span>
                      <span className="text-slate-500 ml-4">Last Sync: {data?.last_updated}</span>
                   </div>
                </div>
                <div className="mt-4 md:mt-0 text-right">
                   <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">District Risk Focus</h3>
                   <span className="text-rose-400 font-bold text-xl">{data?.district_risk}</span>
                </div>
             </div>
             
             <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-1">Latest AI Prediction</h3>
                <p className="text-red-200 font-medium text-lg">{data?.latest_prediction}</p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
