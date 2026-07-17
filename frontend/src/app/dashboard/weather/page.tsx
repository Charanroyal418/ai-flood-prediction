"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { CloudRain, Wind, Thermometer, Droplets } from "lucide-react";

export default function WeatherIntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["weatherIntelligence"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/dashboard/weather");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Weather Intelligence</h1>
        <p className="text-slate-500 font-medium">Real-time meteorological conditions driving the GNN.</p>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-xl p-6 min-h-[400px] flex items-center justify-center border border-slate-200/60 bg-white/80">
          <CloudRain className="w-12 h-12 text-blue-500 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 glass-card p-6 rounded-xl bg-white/80 border border-slate-200/60">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                 <CloudRain className="w-5 h-5 mr-2 text-blue-600" />
                 Recent Telemetry
              </h2>
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                       <tr>
                          <th className="px-4 py-3 rounded-tl-lg">District ID</th>
                          <th className="px-4 py-3">Temp (°C)</th>
                          <th className="px-4 py-3">Humidity (%)</th>
                          <th className="px-4 py-3">Pressure (hPa)</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 rounded-tr-lg">Timestamp</th>
                       </tr>
                    </thead>
                    <tbody>
                       {data?.length > 0 ? data.map((w: any, idx: number) => (
                           <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-3 font-medium text-slate-800">{w.district_id}</td>
                              <td className="px-4 py-3">{w.temperature || 'N/A'}</td>
                              <td className="px-4 py-3">{w.humidity || 'N/A'}</td>
                              <td className="px-4 py-3">{w.pressure || 'N/A'}</td>
                              <td className="px-4 py-3">
                                 <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">{w.status || 'Active'}</span>
                              </td>
                              <td className="px-4 py-3 text-xs">{new Date(w.recorded_at).toLocaleString()}</td>
                           </tr>
                       )) : (
                           <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No telemetry data available.</td>
                           </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
           
           <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg border-0">
                 <h3 className="text-blue-100 font-bold uppercase text-xs mb-1">Statewide Average</h3>
                 <div className="flex justify-between items-end">
                    <div className="text-5xl font-heading font-bold flex items-start">
                       28<span className="text-2xl mt-1">°C</span>
                    </div>
                    <Thermometer className="w-12 h-12 text-blue-300 opacity-50" />
                 </div>
                 <div className="mt-4 grid grid-cols-2 gap-4 text-sm font-medium">
                    <div>
                       <p className="text-blue-200">Humidity</p>
                       <p className="text-lg">82%</p>
                    </div>
                    <div>
                       <p className="text-blue-200">Pressure</p>
                       <p className="text-lg">1008 hPa</p>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
