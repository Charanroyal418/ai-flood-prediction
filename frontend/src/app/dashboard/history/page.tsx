"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { History, Calendar, AlertTriangle, Users } from "lucide-react";

export default function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["historicalData"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/dashboard/history");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">Historical Analytics</h1>
        <p className="text-slate-500 font-medium">Analyze past flood events and patterns across districts.</p>
      </div>

      {isLoading ? (
        <div className="glass-card rounded-xl p-6 min-h-[400px] flex items-center justify-center border border-slate-200/60 bg-white/80">
          <History className="w-12 h-12 text-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {data?.map((event: any, idx: number) => (
               <div key={idx} className="glass-card p-6 rounded-xl bg-white/80 border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                     <div>
                        <h3 className="text-lg font-bold text-slate-800">{event.event}</h3>
                        <div className="flex items-center text-slate-500 text-sm mt-1">
                           <Calendar className="w-4 h-4 mr-1" />
                           {event.year}
                        </div>
                     </div>
                     <span className={`px-2 py-1 rounded text-xs font-bold ${
                         event.severity === 'Extreme' ? 'bg-red-100 text-red-700' : 
                         event.severity === 'Severe' ? 'bg-orange-100 text-orange-700' : 
                         'bg-yellow-100 text-yellow-700'
                     }`}>
                        {event.severity}
                     </span>
                  </div>
                  
                  <div className="border-t border-slate-100 pt-4 mt-4">
                     <div className="flex justify-between items-center text-sm">
                        <span className="flex items-center text-slate-500"><Users className="w-4 h-4 mr-2" /> Population Affected</span>
                        <span className="font-bold text-slate-800">{(event.affected / 1000000).toFixed(1)}M</span>
                     </div>
                  </div>
               </div>
           ))}
           
           {(!data || data.length === 0) && (
               <div className="col-span-full py-12 text-center text-slate-500">
                  No historical data available.
               </div>
           )}
        </div>
      )}
    </div>
  );
}
