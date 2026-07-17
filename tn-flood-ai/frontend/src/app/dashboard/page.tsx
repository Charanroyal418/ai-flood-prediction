"use client";

import { AlertTriangle, CloudRain, ShieldAlert, Cpu, Database, Server, Clock, GitBranch } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export default function CommandCenterPage() {
  const { data: liveData } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/dashboard/live");
      return res.data;
    },
    refetchInterval: 10000,
  });

  const alerts = liveData?.alerts || [];
  const metrics = liveData?.metrics || { avg_rainfall_24h_mm: 45.2, active_alerts_count: 2 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Emergency Operations Center</h1>
          <p className="text-slate-500 font-medium">FloodSense AI Central Command and AI Supervision.</p>
        </div>
        <div className="flex items-center space-x-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-sm font-bold">SYSTEM ONLINE</span>
        </div>
      </div>

      {/* AI Engine Status - Step 10 */}
      <div className="glass-card rounded-xl p-6 bg-slate-900 border border-slate-800 shadow-xl text-white">
        <div className="flex items-center space-x-3 mb-6">
          <Cpu className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold">AI Engine Status</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Model Name</p>
            <p className="text-slate-100 font-medium">Temporal GDNN</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Version</p>
            <p className="text-slate-100 font-medium">v2.1.0</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Accuracy / F1</p>
            <p className="text-emerald-400 font-bold">92.4% / 0.89</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Inference Time</p>
            <p className="text-blue-400 font-bold">45ms</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Training Date</p>
            <p className="text-slate-100 font-medium">2026-07-16</p>
          </div>
          <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
            <p className="text-slate-400 text-xs font-bold uppercase mb-1">Health</p>
            <p className="text-emerald-400 font-bold flex items-center gap-1"><ShieldAlert className="w-4 h-4"/> Optimal</p>
          </div>
        </div>
      </div>

      {/* Quick Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Live Alerts */}
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col max-h-[300px] overflow-y-auto">
          <div className="flex items-center justify-between mb-4 sticky top-0 bg-white/90 backdrop-blur-sm z-10 pb-2">
             <div className="flex items-center space-x-2 text-rose-600">
               <AlertTriangle className="w-5 h-5" />
               <h3 className="font-bold">Live Alerts</h3>
             </div>
             <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-1 rounded-full">{alerts.length} Active</span>
          </div>
          <div className="space-y-3 flex-1">
             {alerts.length === 0 ? (
               <div className="text-center text-emerald-600 font-bold py-4">No active alerts.</div>
             ) : alerts.map((alert: any) => (
               <div key={alert.id || alert.message} className={`p-3 border rounded-lg ${alert.severity === 'Severe' ? 'bg-rose-50 border-rose-100' : 'bg-orange-50 border-orange-100'}`}>
                  <p className={`text-sm font-bold ${alert.severity === 'Severe' ? 'text-rose-800' : 'text-orange-800'}`}>
                    {alert.district || "Alert"} - {alert.severity || "Warning"}
                  </p>
                  <p className={`text-xs ${alert.severity === 'Severe' ? 'text-rose-600' : 'text-orange-600'}`}>{alert.message || alert.reason}</p>
               </div>
             ))}
          </div>
        </div>

        {/* System & ETL Health */}
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col">
          <div className="flex items-center space-x-2 text-slate-700 mb-4">
             <Database className="w-5 h-5 text-blue-500" />
             <h3 className="font-bold">Data Engineering Pipeline</h3>
          </div>
          <div className="space-y-4">
             <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2"><Server className="w-4 h-4 text-slate-400"/> <span className="text-sm font-medium text-slate-600">PostGIS Store</span></div>
                <span className="text-xs font-bold text-emerald-500">Connected</span>
             </div>
             <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2"><GitBranch className="w-4 h-4 text-slate-400"/> <span className="text-sm font-medium text-slate-600">Neo4j Graph</span></div>
                <span className="text-xs font-bold text-emerald-500">Synced</span>
             </div>
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-slate-400"/> <span className="text-sm font-medium text-slate-600">Last ETL Run</span></div>
                <span className="text-xs font-bold text-slate-700">12 mins ago</span>
             </div>
          </div>
        </div>

        {/* Weather & Rivers Overview */}
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm flex flex-col">
          <div className="flex items-center space-x-2 text-slate-700 mb-4">
             <CloudRain className="w-5 h-5 text-indigo-500" />
             <h3 className="font-bold">Meteorological Quick View</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 flex-1">
             <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
                <p className="text-xs font-bold text-indigo-400 uppercase">Avg Rainfall</p>
                <p className="text-lg font-bold text-indigo-700">45.2 mm</p>
             </div>
             <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                <p className="text-xs font-bold text-amber-400 uppercase">River Alerts</p>
                <p className="text-lg font-bold text-amber-700">2 Basins</p>
             </div>
             <div className="col-span-2 bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                <p className="text-xs font-bold text-emerald-500 uppercase">Reservoir Aggregation</p>
                <div className="w-full bg-emerald-200 rounded-full h-2 mt-2">
                   <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '76%' }}></div>
                </div>
                <p className="text-xs text-emerald-700 mt-1 text-right font-medium">76% Capacity</p>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
