"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ActivitySquare, Waves } from "lucide-react";

export default function RiverIntelligencePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["riverIntelligence"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/dashboard/river");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">River Intelligence</h1>
        <p className="text-slate-500 font-medium">Monitoring hydrological levels and overflow conditions.</p>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-xl p-6 min-h-[400px] flex items-center justify-center border border-slate-200/60 bg-white/80">
          <ActivitySquare className="w-12 h-12 text-blue-500 animate-pulse" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 glass-card p-6 rounded-xl bg-white/80 border border-slate-200/60">
              <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                 <Waves className="w-5 h-5 mr-2 text-blue-500" />
                 River Station Telemetry
              </h2>
              <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 font-bold uppercase text-xs">
                       <tr>
                          <th className="px-4 py-3 rounded-tl-lg">River Name</th>
                          <th className="px-4 py-3">Station</th>
                          <th className="px-4 py-3">Current Level (m)</th>
                          <th className="px-4 py-3">Danger Level (m)</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 rounded-tr-lg">Timestamp</th>
                       </tr>
                    </thead>
                    <tbody>
                       {data?.length > 0 ? data.map((r: any, idx: number) => {
                           const isDanger = r.current_level >= r.danger_level;
                           const isWarning = r.current_level >= r.danger_level * 0.8;
                           return (
                             <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 font-bold text-slate-800">{r.river_name}</td>
                                <td className="px-4 py-3 font-medium">{r.station_name}</td>
                                <td className={`px-4 py-3 font-bold ${isDanger ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
                                   {r.current_level?.toFixed(2)}
                                </td>
                                <td className="px-4 py-3 text-slate-400">{r.danger_level?.toFixed(2)}</td>
                                <td className="px-4 py-3">
                                   <span className={`px-2 py-1 rounded text-xs font-bold ${isDanger ? 'bg-rose-100 text-rose-700' : isWarning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                       {isDanger ? 'OVERFLOW' : isWarning ? 'WARNING' : 'NORMAL'}
                                   </span>
                                </td>
                                <td className="px-4 py-3 text-xs">{new Date(r.recorded_at).toLocaleString()}</td>
                             </tr>
                           );
                       }) : (
                           <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No river telemetry available.</td>
                           </tr>
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
           
           <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg border-0">
                 <h3 className="text-emerald-100 font-bold uppercase text-xs mb-1">Statewide Capacity</h3>
                 <div className="flex justify-between items-end">
                    <div className="text-5xl font-heading font-bold flex items-start">
                       62<span className="text-2xl mt-1">%</span>
                    </div>
                 </div>
                 <div className="w-full bg-emerald-900/40 rounded-full h-2 mt-4">
                    <div className="bg-white h-2 rounded-full shadow" style={{ width: '62%' }}></div>
                 </div>
                 <p className="text-xs text-emerald-100 font-medium mt-2 text-right">Average Basin Saturation</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
