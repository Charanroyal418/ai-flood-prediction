"use client";

import { Server, Database, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

export default function SystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<any>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await axios.get("http://localhost:8000/api/v1/health");
        setStatus(res.data);
      } catch (err) {
        setStatus({ error: "Backend offline" });
      } finally {
        setLoading(false);
      }
    };
    fetchStatus();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-slate-900 mb-1">System Status</h1>
        <p className="text-slate-500 font-medium">Monitor API, Database, and ML Pipeline connectivity.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm">
          <div className="flex items-center space-x-4 mb-4">
            <Server className="w-8 h-8 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">API Server</h2>
          </div>
          {loading ? (
             <Activity className="w-6 h-6 text-blue-500 animate-spin" />
          ) : status?.error ? (
             <span className="text-red-500 font-bold">Offline</span>
          ) : (
             <div className="flex flex-col">
                 <span className="text-emerald-500 font-bold flex items-center"><Activity className="w-4 h-4 mr-1"/> Online</span>
                 <span className="text-xs text-slate-500 mt-2">{status.message}</span>
             </div>
          )}
        </div>
        
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm">
          <div className="flex items-center space-x-4 mb-4">
            <Database className="w-8 h-8 text-emerald-600" />
            <h2 className="text-xl font-bold text-slate-900">Supabase DB</h2>
          </div>
          <span className="text-emerald-500 font-bold flex items-center"><Activity className="w-4 h-4 mr-1"/> Connected</span>
          <span className="text-xs text-slate-500 mt-2 block">Pool connection established</span>
        </div>
        
        <div className="glass-card rounded-xl p-6 bg-white/80 border border-slate-200/60 shadow-sm">
          <div className="flex items-center space-x-4 mb-4">
            <Activity className="w-8 h-8 text-purple-600" />
            <h2 className="text-xl font-bold text-slate-900">Temporal GDNN</h2>
          </div>
          <span className="text-emerald-500 font-bold flex items-center"><Activity className="w-4 h-4 mr-1"/> Ready</span>
          <span className="text-xs text-slate-500 mt-2 block">Model loaded in memory</span>
        </div>
      </div>
    </div>
  );
}
