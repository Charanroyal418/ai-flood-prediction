"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useFloodData } from "@/context/FloodDataContext";
import {
  Brain, Droplets, AlertTriangle, Shield, Activity, ArrowRight,
  TrendingUp, MapPin, Clock, Zap, Network, BarChart3, ChevronRight,
  CloudRain, Waves, RefreshCw, Circle, Wifi, WifiOff,
} from "lucide-react";
import dynamicImport from "next/dynamic";

const FloodMap = dynamicImport(() => import("@/components/map/FloodMap"), { ssr: false, loading: () => <MapSkeleton /> });

function MapSkeleton() {
  return <div className="w-full h-full rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 animate-pulse flex items-center justify-center"><span className="text-slate-400 text-sm font-medium">Loading Spatial Canvas...</span></div>;
}

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Low: "#22c55e",
  Safe: "#3b82f6",
};

const RISK_BG: Record<string, string> = {
  Critical: "bg-red-50 text-red-700 border-red-100",
  High: "bg-orange-50 text-orange-700 border-orange-100",
  Moderate: "bg-amber-50 text-amber-700 border-amber-100",
  Low: "bg-green-50 text-green-700 border-green-100",
  Safe: "bg-blue-50 text-blue-700 border-blue-100",
};

function AnimatedNumber({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    let start = prev.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(start + (end - start) * eased);
      if (progress < 1) requestAnimationFrame(animate);
      else prev.current = end;
    };
    requestAnimationFrame(animate);
  }, [value]);

  return <>{displayed.toFixed(decimals)}</>;
}

function MetricCard({ title, value, unit, icon: Icon, color, bg, change }: any) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className="glass-card p-5"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        {change !== undefined && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${change >= 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
            {change >= 0 ? "+" : ""}{change}%
          </span>
        )}
      </div>
      <p className="text-2xl font-heading font-bold text-slate-800">
        <AnimatedNumber value={typeof value === "number" ? value : 0} decimals={typeof value === "number" && value % 1 !== 0 ? 1 : 0} />
        {unit && <span className="text-sm text-slate-400 font-normal ml-1">{unit}</span>}
      </p>
      <p className="text-xs text-slate-500 font-medium mt-1">{title}</p>
    </motion.div>
  );
}

function LiveEventFeed({ events }: { events: any[] }) {
  const [visible, setVisible] = useState<any[]>([]);

  useEffect(() => {
    if (!events?.length) return;
    setVisible(events.slice(0, 6));
  }, [events]);

  const iconMap: Record<string, any> = {
    sensor_update: Droplets,
    model_inference: Brain,
    alert_generated: AlertTriangle,
    data_sync: RefreshCw,
    kg_update: Network,
  };

  const colorMap: Record<string, string> = {
    sensor_update: "text-blue-500 bg-blue-50",
    model_inference: "text-violet-500 bg-violet-50",
    alert_generated: "text-red-500 bg-red-50",
    data_sync: "text-green-500 bg-green-50",
    kg_update: "text-indigo-500 bg-indigo-50",
  };

  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
      <AnimatePresence>
        {visible.map((event, i) => {
          const Icon = iconMap[event.type] || Activity;
          const colors = colorMap[event.type] || "text-slate-500 bg-slate-50";
          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-start gap-3 p-3 rounded-xl bg-slate-50/60 hover:bg-white border border-slate-100/60 transition-colors"
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${colors}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{event.message}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">{event.district}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${RISK_BG[event.risk_level] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
                    {event.risk_level}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 flex-shrink-0">
                {new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function PipelineStatus() {
  const steps = [
    { label: "Telemetry", sub: "38 districts", done: true, icon: Droplets },
    { label: "Feature Eng.", sub: "12 features", done: true, icon: BarChart3 },
    { label: "KG Build", sub: "312 nodes", done: true, icon: Network },
    { label: "GDNN", sub: "GAT+GRU", done: true, icon: Brain },
    { label: "Explainability", sub: "SHAP active", done: true, icon: Zap },
    { label: "Alert Gen.", sub: "Engine live", active: true, icon: AlertTriangle },
  ];

  return (
    <div className="flex items-center gap-0 overflow-x-auto no-scrollbar">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className="flex flex-col items-center gap-1.5 px-3"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
              step.active
                ? "bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200 animate-pulse"
                : step.done
                ? "bg-gradient-to-br from-violet-500 to-indigo-600"
                : "bg-slate-100"
            }`}>
              <step.icon className={`w-4 h-4 ${step.done || step.active ? "text-white" : "text-slate-400"}`} />
            </div>
            <div className="text-center">
              <p className={`text-[11px] font-bold leading-none ${step.active ? "text-violet-700" : step.done ? "text-slate-700" : "text-slate-400"}`}>{step.label}</p>
              <p className="text-[9px] text-slate-400 mt-0.5">{step.sub}</p>
            </div>
          </motion.div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 flex-shrink-0 ${step.done ? "bg-violet-300" : "bg-slate-200"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CommandCenter() {
  const queryClient = useQueryClient();

  // ─── Primary: WebSocket real-time data ───────────────────────────
  const {
    districts: wsDistricts,
    alerts: wsAlerts,
    modelMeta,
    lastUpdated,
    dashboardStatus,
    criticalCount,
    highCount,
    triggerPipeline,
  } = useFloodData();

  // ─── Fallback: REST API for initial load ─────────────────────────
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await api.get("/dashboard/live");
      return res.data;
    },
    // Only poll when WS is not connected
    refetchInterval: dashboardStatus === "connected" ? false : 30_000,
  });

  // Supabase Realtime subscription (kept for redundancy)
  useEffect(() => {
    const channel1 = supabase
      .channel('dashboard_predictions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'prediction_history' }, () => {
        if (dashboardStatus !== "connected") {
          queryClient.invalidateQueries({ queryKey: ["dashboardLive"] });
        }
      })
      .subscribe();

    const channel2 = supabase
      .channel('dashboard_alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts' }, () => {
        if (dashboardStatus !== "connected") {
          queryClient.invalidateQueries({ queryKey: ["dashboardLive"] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [dashboardStatus]);

  // ─── Data source: prefer WebSocket, fall back to REST ────────────
  // If WS has pushed data, use it; otherwise use REST
  const hasWsData = wsDistricts.length > 0;
  const metrics = hasWsData
    ? {
        avg_risk_score: wsDistricts.reduce((s, d) => s + d.risk_score, 0) / (wsDistricts.length || 1),
        active_alerts_count: wsAlerts.length,
        critical_districts: criticalCount,
        high_risk_districts: highCount,
        avg_rainfall_24h_mm: wsDistricts.reduce((s, d) => s + (d.rainfall_mm || 0), 0) / (wsDistricts.length || 1),
        gdnn_inference_ms: modelMeta?.inference_time_ms ?? 0,
        model_confidence: wsDistricts.reduce((s, d) => s + (d.confidence || 0), 0) / (wsDistricts.length || 1),
        kg_nodes: modelMeta?.node_count ?? 0,
      }
    : data?.metrics;

  const topDistricts = hasWsData
    ? [...wsDistricts]
        .sort((a, b) => b.risk_score - a.risk_score)
        .slice(0, 5)
        .map(d => ({ name: d.district_name, risk_score: Math.round(d.risk_score), risk_level: d.risk_level, risk_color: d.risk_color }))
    : (data?.top_risk_districts || []);

  const alerts = hasWsData
    ? wsAlerts.slice(0, 3).map(a => ({ ...a, district: `District #${a.district_id}` }))
    : (data?.alerts || []);

  const events = data?.events || [];

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const [simulating, setSimulating] = useState(false);
  const handleSimulate = async () => {
    setSimulating(true);
    try {
      // Try WebSocket trigger first (faster)
      if (dashboardStatus === "connected") {
        triggerPipeline(true);
        setTimeout(() => setSimulating(false), 3000);
      } else {
        await api.post("/dashboard/simulate-storm");
        queryClient.invalidateQueries({ queryKey: ["dashboardLive"] });
        setSimulating(false);
      }
    } catch (err) {
      console.error(err);
      setSimulating(false);
    }
  };

  // Live indicator: show WS status
  const isLive = dashboardStatus === "connected";
  const liveTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : (dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800">Command Center</h1>
          <p className="text-sm text-slate-500 mt-1">Tamil Nadu Flood Intelligence · Real-time GDNN monitoring</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all bg-gradient-to-r from-red-500 to-orange-600 hover:from-red-600 hover:to-orange-700 shadow-md flex items-center gap-1.5 ${
              simulating ? "opacity-60 cursor-wait" : ""
            }`}
          >
            <Zap className={`w-3.5 h-3.5 ${simulating ? "animate-bounce" : ""}`} />
            {simulating ? "Simulating..." : "Simulate Storm"}
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="relative w-2 h-2">
              {isLive ? (
                <>
                  <div className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
                  <div className="relative w-2 h-2 rounded-full bg-green-500" />
                </>
              ) : (
                <div className="relative w-2 h-2 rounded-full bg-yellow-400" />
              )}
            </div>
            <span className="font-medium">
              {isLive ? "Live WS" : "Polling"} · {liveTime}
            </span>
          </div>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {isLoading ? (
          Array.from({length: 6}).map((_, i) => (
            <div key={i} className="glass-card p-5 h-28 skeleton" />
          ))
        ) : (
          <>
            <MetricCard title="Avg Risk Score" value={metrics?.avg_risk_score ?? 0} unit="/100" icon={Shield} color="text-violet-600" bg="bg-violet-50" />
            <MetricCard title="Active Alerts" value={metrics?.active_alerts_count ?? 0} icon={AlertTriangle} color="text-red-500" bg="bg-red-50" change={12} />
            <MetricCard title="Critical Districts" value={metrics?.critical_districts ?? 0} icon={MapPin} color="text-orange-500" bg="bg-orange-50" />
            <MetricCard title="High Risk Districts" value={metrics?.high_risk_districts ?? 0} icon={TrendingUp} color="text-amber-500" bg="bg-amber-50" />
            <MetricCard title="Avg Rainfall" value={metrics?.avg_rainfall_24h_mm ?? 0} unit="mm" icon={CloudRain} color="text-blue-500" bg="bg-blue-50" />
            <MetricCard title="GDNN Latency" value={metrics?.gdnn_inference_ms ?? 0} unit="ms" icon={Brain} color="text-indigo-500" bg="bg-indigo-50" />
          </>
        )}
      </div>

      {/* Main Grid: Map + Right Panel */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map - takes 2/3 */}
        <div className="xl:col-span-2">
          <div className="glass-card p-4 h-[480px]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-heading font-bold text-slate-800">Flood Risk Map</h2>
                <p className="text-[11px] text-slate-400">District-level prediction overlay · 38 districts</p>
              </div>
              <div className="flex gap-2">
                {["Critical", "High", "Moderate", "Low"].map(level => (
                  <div key={level} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: RISK_COLORS[level] }} />
                    <span className="text-[10px] text-slate-500">{level}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[400px] rounded-xl overflow-hidden">
              <FloodMap districts={hasWsData
                ? wsDistricts.map(d => ({ name: d.district_name, risk_score: d.risk_score, risk_level: d.risk_level, risk_color: d.risk_color, lat: 0, lon: 0 }))
                : data?.districts
              } />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Top Risk Districts */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-heading font-bold text-slate-800">Top Risk Districts</h2>
              <a href="/dashboard/district" className="text-[11px] font-semibold text-violet-600 flex items-center gap-0.5 hover:underline">
                View all <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({length: 5}).map((_, i) => <div key={i} className="h-11 skeleton rounded-xl" />)
              ) : (
                topDistricts.slice(0, 5).map((d: any, i: number) => (
                  <motion.div
                    key={d.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                  >
                    <span className="text-xs font-bold text-slate-400 w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{d.name}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1 mt-1">
                        <motion.div
                          className="h-1 rounded-full"
                          style={{ background: d.risk_color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${d.risk_score}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                        />
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${RISK_BG[d.risk_level]}`}>
                      {d.risk_score}
                    </span>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="glass-card p-5 flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-heading font-bold text-slate-800">Active Alerts</h2>
              <a href="/dashboard/alerts" className="text-[11px] font-semibold text-violet-600 flex items-center gap-0.5 hover:underline">
                Alert Center <ChevronRight className="w-3 h-3" />
              </a>
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Shield className="w-8 h-8 text-green-400 mb-2" />
                <p className="text-xs font-semibold text-slate-600">All Clear</p>
                <p className="text-[10px] text-slate-400 mt-0.5">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 3).map((alert: any, i: number) => (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.1 }}
                    className={`p-3 rounded-xl border ${
                      alert.level === "Critical"
                        ? "bg-red-50 border-red-100"
                        : "bg-orange-50 border-orange-100"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${alert.level === "Critical" ? "text-red-500" : "text-orange-500"}`} />
                      <div className="min-w-0">
                        <p className={`text-[11px] font-bold ${alert.level === "Critical" ? "text-red-700" : "text-orange-700"}`}>
                          {alert.level} · {alert.district}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-2">{alert.message}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GDNN Pipeline */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-heading font-bold text-slate-800">GDNN Inference Pipeline</h2>
              <p className="text-[11px] text-slate-400">Knowledge Graph → Temporal GNN → Risk Classification</p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2.5 py-1 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Active
            </div>
          </div>
          <PipelineStatus />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Model", value: modelMeta?.inference_mode ?? (metrics?.inference_mode || "GDNN v2.1") },
              { label: "Confidence", value: `${((metrics?.model_confidence ?? 0.924) * 100).toFixed(1)}%` },
              { label: "KG Nodes", value: modelMeta?.node_count ?? metrics?.kg_nodes ?? 312 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 rounded-xl bg-violet-50/60 border border-violet-100">
                <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-sm font-heading font-bold text-violet-800 mt-1">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Live Event Stream */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-heading font-bold text-slate-800">Realtime Event Stream</h2>
              <p className="text-[11px] text-slate-400">Live telemetry and AI inference events</p>
            </div>
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-ping absolute" />
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
          </div>
          <LiveEventFeed events={events} />
        </div>
      </div>
    </div>
  );
}
