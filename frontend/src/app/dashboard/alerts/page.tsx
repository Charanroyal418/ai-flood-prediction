"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { AlertTriangle, Bell, Shield, Clock, MapPin, Brain, ChevronDown, RefreshCw, CheckCircle2 } from "lucide-react";

const LEVEL_CONFIG: Record<string, { border: string; bg: string; text: string; dot: string; icon: string }> = {
  Critical: { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", icon: "🚨" },
  Warning:  { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", icon: "⚠️" },
  Watch:    { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", icon: "👁️" },
};

function AlertCard({ alert, index }: { alert: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.Watch;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`glass-card border ${cfg.border} overflow-hidden`}
    >
      <button
        className="w-full p-5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} text-lg`}>
            {cfg.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                {alert.level}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {new Date(alert.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{alert.message}</p>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {alert.district}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Brain className="w-2.5 h-2.5" /> {(alert.confidence * 100).toFixed(0)}% AI confidence
              </span>
            </div>
          </div>

          {/* Expand arrow */}
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`px-5 pb-5 pt-0 border-t ${cfg.border} ${cfg.bg}`}>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rainfall</p>
                  <p className="text-sm font-bold text-slate-800">{alert.rainfall_mm}mm/24h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">AI Confidence</p>
                  <p className="text-sm font-bold text-slate-800">{(alert.confidence * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-white/60 border border-white">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Recommended Action</p>
                <p className="text-xs text-slate-700 font-medium">{alert.suggested_response}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AlertCenterPage() {
  const [filterLevel, setFilterLevel] = useState("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const res = await api.get("/dashboard/alerts");
      return res.data as any[];
    },
    refetchInterval: 8000,
  });

  const alerts = data || [];
  const filtered = filterLevel === "all" ? alerts : alerts.filter(a => a.level === filterLevel);
  const critical = alerts.filter(a => a.level === "Critical").length;
  const warning = alerts.filter(a => a.level === "Warning").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">Alert Center</h1>
          <p className="text-sm text-slate-500 mt-1">GDNN-generated alerts · Auto-dispatched from risk engine</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-ping absolute" />
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <span className="text-xs font-semibold text-slate-600">{alerts.length} Active Alerts</span>
          <button onClick={() => refetch()} className="ml-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card-flat bg-red-50 p-4 text-center">
          <p className="text-2xl font-heading font-bold text-red-700">{critical}</p>
          <p className="text-[11px] text-red-500 mt-0.5 font-semibold">Critical Alerts</p>
        </div>
        <div className="glass-card-flat bg-amber-50 p-4 text-center">
          <p className="text-2xl font-heading font-bold text-amber-700">{warning}</p>
          <p className="text-[11px] text-amber-500 mt-0.5 font-semibold">Warnings</p>
        </div>
        <div className="glass-card-flat bg-green-50 p-4 text-center">
          <p className="text-2xl font-heading font-bold text-green-700">{38 - alerts.length}</p>
          <p className="text-[11px] text-green-500 mt-0.5 font-semibold">Districts Safe</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "Critical", "Warning"].map(level => (
          <button
            key={level}
            onClick={() => setFilterLevel(level)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterLevel === level
                ? level === "Critical" ? "bg-red-500 text-white" : level === "Warning" ? "bg-amber-500 text-white" : "bg-violet-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            {level === "all" ? "All Alerts" : level}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-24 skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <h2 className="text-lg font-heading font-bold text-slate-700">All Clear</h2>
          <p className="text-sm text-slate-500 mt-2">No active alerts at this time. The GDNN is continuously monitoring all 38 districts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((alert, i) => <AlertCard key={alert.id} alert={alert} index={i} />)}
        </div>
      )}
    </div>
  );
}
