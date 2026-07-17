"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Server, Cpu, HardDrive } from "lucide-react";

export default function SystemHealthWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["systemStatus"],
    queryFn: async () => {
      const res = await api.get("/system/status");
      return res.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  if (isLoading) {
    return <div className="h-48 rounded-xl bg-white animate-pulse border border-slate-200 shadow-sm"></div>;
  }

  const hardware = data?.hardware || { cpu_percent: 0, memory_percent: 0 };
  const etl = data?.last_etl_job || { status: 'PENDING' };

  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-900 flex items-center">
          <Server className="w-5 h-5 mr-2 text-emerald-500" />
          System Health
        </h3>
        <div className={`px-2 py-1 text-xs font-bold rounded-full ${etl.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
          ETL: {etl.status}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1 text-slate-600 font-medium">
            <span className="flex items-center"><Cpu className="w-4 h-4 mr-1 text-slate-400"/> CPU Usage</span>
            <span>{hardware.cpu_percent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 border border-slate-200">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${hardware.cpu_percent}%` }}></div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1 text-slate-600 font-medium">
            <span className="flex items-center"><HardDrive className="w-4 h-4 mr-1 text-slate-400"/> Memory Usage</span>
            <span>{hardware.memory_percent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 border border-slate-200">
            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${hardware.memory_percent}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
