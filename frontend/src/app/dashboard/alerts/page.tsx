"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, Shield, Clock, MapPin, Brain, ChevronDown, RefreshCw, CheckCircle2, Activity } from "lucide-react";

const LEVEL_CONFIG: Record<string, { border: string; bg: string; text: string; dot: string; icon: string }> = {
  Critical: { border: "border-red-200", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", icon: "🚨" },
  Warning:  { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", icon: "⚠️" },
  Watch:    { border: "border-blue-200", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", icon: "👁️" },
};

import { useFloodData } from "@/context/FloodDataContext";

function AlertCard({ alert, index }: { alert: any; index: number }) {
  const { mode, stormSimulationActive } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";
  const [expanded, setExpanded] = useState(false);
  const cfg = LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.Watch;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`glass-card border ${isStormActive ? "border-amber-300 bg-amber-50/30" : cfg.border} overflow-hidden`}
    >
      <button
        className="w-full p-5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isStormActive ? "bg-amber-100 text-amber-800" : cfg.bg} text-lg font-bold`}>
            {isStormActive ? "🟠" : cfg.icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isStormActive
                  ? "bg-amber-500 text-white border-amber-600 shadow-sm"
                  : `${cfg.bg} ${cfg.text} ${cfg.border}`
              }`}>
                {isStormActive ? "🟠 SIMULATION ALERT" : `🚨 ${alert.level} LIVE ALERT`}
              </span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" /> {new Date(alert.created_at || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{alert.message}</p>
            {isStormActive && (
              <p className="text-[10px] font-bold text-amber-700 mt-1 bg-amber-100/80 px-2 py-0.5 rounded w-fit border border-amber-200">
                Generated from simulation. Not an official warning.
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <MapPin className="w-2.5 h-2.5" /> {alert.district || "Statewide"}
              </span>
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Brain className="w-2.5 h-2.5" /> {((alert.confidence || 0.94) * 100).toFixed(1)}% AI confidence
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
            <div className={`px-5 pb-5 pt-0 border-t ${isStormActive ? "border-amber-200 bg-amber-50/50" : `${cfg.border} ${cfg.bg}`}`}>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rainfall</p>
                  <p className="text-sm font-bold text-slate-800">{alert.rainfall_mm ?? 385}mm/24h</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">AI Confidence</p>
                  <p className="text-sm font-bold text-slate-800">{((alert.confidence || 0.94) * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="mt-3 p-3 rounded-xl bg-white/60 border border-white">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Recommended Action</p>
                <p className="text-xs text-slate-700 font-medium">{alert.suggested_response || "Evacuate low-lying zones immediately."}</p>
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
  const { alerts: wsAlerts, alertStatus, requestSnapshot } = useFloodData();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationsEnabled(Notification.permission === "granted");
    }
  }, []);

  const requestNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === "granted");
    }
  };

  // When a new critical alert comes in, trigger notification
  useEffect(() => {
    if (notificationsEnabled && wsAlerts.length > 0) {
      const latest = wsAlerts[0];
      if (latest.level === "Critical") {
        new Notification("FloodSense Critical Alert", {
          body: latest.message,
          icon: "/favicon.ico",
        });
      }
    }
  }, [wsAlerts, notificationsEnabled]);

  const alerts = wsAlerts || [];
  const filtered = filterLevel === "all" ? alerts : alerts.filter(a => a.level === filterLevel);
  const critical = alerts.filter(a => a.level === "Critical" || a.severity === "Red").length;
  const warning = alerts.filter(a => a.level === "Warning" || a.severity === "Orange").length;

  // Generate timeline data from alerts
  const timelineData = [...alerts].slice(0, 15).map(a => ({
    time: new Date(a.created_at || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    level: a.level
  })).reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">Alert Center</h1>
          <p className="text-sm text-slate-500 mt-1">GDNN-generated alerts · Auto-dispatched from risk engine</p>
        </div>
        <div className="flex items-center gap-2">
          {notificationsEnabled ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
              <Bell className="w-3.5 h-3.5" /> Notifications On
            </div>
          ) : (
            <button onClick={requestNotifications} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-colors">
              <Bell className="w-3.5 h-3.5" /> Enable Notifications
            </button>
          )}
          <div className="relative">
            <div className={`w-2 h-2 rounded-full ${alertStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'} animate-ping absolute`} />
            <div className={`w-2 h-2 rounded-full ${alertStatus === 'connected' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </div>
          <span className="text-xs font-semibold text-slate-600">
            {alertStatus === 'connected' ? `${alerts.length} Active Alerts` : 'Connecting...'}
          </span>
          <button onClick={() => requestSnapshot()} className="ml-2 p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors">
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

      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-2">
          {["all", "Critical", "Warning", "Watch"].map(level => (
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
        
        {/* Timeline Visualization */}
        {timelineData.length > 0 && (
          <div className="hidden md:flex items-center gap-1 overflow-x-auto max-w-[50%] p-2 bg-slate-50 rounded-lg border border-slate-200">
            <Activity className="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" />
            {timelineData.map((t, i) => (
              <div 
                key={i} 
                title={`${t.time} - ${t.level}`}
                className={`w-4 h-6 rounded-sm flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity cursor-pointer ${
                  t.level === 'Critical' ? 'bg-red-500' : 
                  t.level === 'Warning' ? 'bg-amber-500' : 'bg-blue-400'
                }`} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Alert list */}
      {alertStatus === "connecting" && alerts.length === 0 ? (
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
