"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useFloodData } from "@/context/FloodDataContext";
import {
  Brain, Droplets, AlertTriangle, Shield, Activity, MapPin, 
  CloudRain, Zap, Network, ChevronRight, Info, ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import dynamicImport from "next/dynamic";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { safeFormat } from "@/lib/utils";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";

function AnimatedCounter({ value }: { value: number }) {
  const spring = useSpring(0, { bounce: 0, duration: 1500 });
  const display = useTransform(spring, (current) => {
    return value >= 1000 
      ? new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 1 }).format(current)
      : current.toLocaleString('en-US', { maximumFractionDigits: 1 });
  });

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{display}</motion.span>;
}

const FloodMap = dynamicImport(() => import("@/components/map/FloodMap"), { ssr: false, loading: () => <MapSkeleton /> });

function MapSkeleton() {
  return <div className="w-full h-full skeleton flex items-center justify-center"><span className="text-text-secondary text-sm font-medium">Loading Map Data...</span></div>;
}

const RISK_LEVELS: Record<string, string> = {
  Critical: "risk-badge-severe",
  High: "risk-badge-high",
  Moderate: "risk-badge-moderate",
  Low: "risk-badge-low",
  Safe: "risk-badge-safe",
};

const SkeletonRow = () => (
  <tr className="border-b border-line">
    <td colSpan={4} className="py-2 px-3">
      <div className="h-8 skeleton rounded-md w-full opacity-50" />
    </td>
  </tr>
);

const EmptyState = () => (
  <tr>
    <td colSpan={4} className="text-center py-6 text-text-secondary text-[15px] font-sans">
      No risk data available.
    </td>
  </tr>
);

const RiskRow = ({ rank, district: d, trend = 'flat' }: { rank: number; district: any; trend?: string }) => (
  <motion.tr 
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    className="hover:bg-[#F5F5FF] transition-colors duration-200 border-b border-line group"
  >
    <td className="py-3 px-3 text-[15px] font-medium text-slate-500 font-sans w-12 text-center">
      #{rank}
    </td>
    <td className="py-3 px-3 text-[15px] font-medium text-text-primary font-sans flex items-center gap-2">
      <MapPin className="w-4 h-4 text-slate-400" />
      {d.name}
    </td>
    <td className="py-3 px-3 text-right text-text-primary font-bold tabular-nums font-sans text-[15px]">
      <div className="flex items-center justify-end gap-1">
        {trend === 'up' ? <ArrowUpRight className="w-4 h-4 text-red-500" /> : trend === 'down' ? <ArrowDownRight className="w-4 h-4 text-emerald-500" /> : <Minus className="w-4 h-4 text-slate-300" />}
        {typeof d.risk_score === 'number' ? safeFormat(d.risk_score, 1, "0.0") : d.risk_score}
      </div>
    </td>
    <td className="py-3 px-3 text-right font-sans text-[15px]">
      <span className={`risk-badge ${RISK_LEVELS[d.risk_level] || RISK_LEVELS.Safe}`}>{d.risk_level}</span>
    </td>
  </motion.tr>
);

// --- Utilities ---
function MetricCard({ title, value, unit, icon: Icon, sparklineData, bgClass, colorClass, sparklineColor }: any) {
  return (
    <div className="bg-white/60 backdrop-blur-md shadow-[0_4px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_24px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 rounded-[16px] p-5 flex flex-col justify-between h-32 relative overflow-hidden group">
      <div className="flex justify-between items-start z-10">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 ${bgClass} ${colorClass}`}>
            <Icon strokeWidth={2.5} className="w-5 h-5" />
          </div>
          <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500 font-sans">{title}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-4 z-10">
        <span className="text-[44px] font-bold tracking-tight text-slate-800 font-sans leading-none tabular-nums">
          {typeof value === 'number' ? <AnimatedCounter value={value} /> : (value || <span className="text-slate-300">-</span>)}
        </span>
        {unit && <span className="text-[16px] font-medium text-slate-500 font-sans mb-1">{unit}</span>}
      </div>
      {sparklineData && (
        <div className="absolute -bottom-2 -right-2 w-32 h-16 opacity-40 z-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData.map((val: number, i: number) => ({ val, i }))}>
              <Area type="monotone" dataKey="val" stroke={sparklineColor} fill={sparklineColor} fillOpacity={0.2} strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function CommandCenter() {
  const queryClient = useQueryClient();
  const {
    districts: wsDistricts,
    alerts: wsAlerts,
    modelMeta,
    lastUpdated,
    dashboardStatus,
    criticalCount,
    highCount,
    stormSimulationActive,
    toggleStormSimulation,
  } = useFloodData();

  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await api.get("/api/v1/dashboard/live");
      return res.data;
    },
    refetchInterval: stormSimulationActive ? 3000 : 15000,
    staleTime: 0,
  });

  // ── All state declarations FIRST (no TDZ in minified output) ─────────────
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const [trends, setTrends] = useState<Record<string, 'up'|'down'|'flat'>>({});
  const [simulating, setSimulating] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const prevScoresRef = useRef<Record<string, number>>({});

  // ── Derived values (no hooks, safe to compute inline) ──────────────────────
  const hasWsData = wsDistricts.length > 0;

  const metrics = hasWsData
    ? {
        avg_risk_score: wsDistricts.reduce((s, d) => s + d.risk_score, 0) / (wsDistricts.length || 1),
        active_alerts_count: wsAlerts.length,
        critical_districts: criticalCount,
        high_risk_districts: highCount,
        avg_rainfall_24h_mm: wsDistricts.reduce((s, d) => s + (d.rainfall_mm || 0), 0) / (wsDistricts.length || 1),
        gdnn_inference_ms: modelMeta?.inference_time_ms ?? data?.metrics?.gdnn_inference_ms ?? 0,
      }
    : data?.metrics;

  const topDistricts = hasWsData
    ? [...wsDistricts].sort((a, b) => b.risk_score - a.risk_score).slice(0, 5)
    : (data?.top_risk_districts || []);

  const alerts = hasWsData
    ? wsAlerts.slice(0, 10).map(a => ({
        ...a,
        district: (a as any).district || wsDistricts.find(d => d.district_id === a.district_id)?.district_name || `District #${a.district_id}`
      }))
    : (data?.alerts || []);

  const isStormActive = stormSimulationActive || Boolean(data?.metrics?.storm_simulation_active);
  const highestRiskLevel = criticalCount > 0 ? "Critical" : highCount > 0 ? "High" : "Moderate";

  // ── Effects (all state/derived values used in deps are declared above) ──────
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!hasWsData && isLoading) {
      timer = setTimeout(() => setIsSlowLoading(true), 5000);
    } else {
      setIsSlowLoading(false);
    }
    return () => clearTimeout(timer);
  }, [hasWsData, isLoading]);

  useEffect(() => {
    setTrends(prev => {
      const next = { ...prev };
      topDistricts.forEach((d: any) => {
        const id = d.id || d.name;
        const old = prevScoresRef.current[id];
        if (old) {
          if (d.risk_score > old) next[id] = 'up';
          else if (d.risk_score < old) next[id] = 'down';
          else next[id] = 'flat';
        } else {
          next[id] = 'flat';
        }
        prevScoresRef.current[id] = d.risk_score;
      });
      return next;
    });
  }, [topDistricts]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await toggleStormSimulation(!isStormActive);
      await queryClient.invalidateQueries({ queryKey: ["dashboardLive"] });
      await refetch();
    } catch (err) {} finally {
      setSimulating(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4`}>
      {/* ── Action Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary font-sans">Regional Overview</h1>
          <p className="text-xs text-text-secondary mt-1">Tamil Nadu State Disaster Management Authority</p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className={`btn-primary shadow-sm hover:shadow hover:bg-signal-900 transition-all duration-200 ${isStormActive ? '!bg-risk-severe hover:!bg-red-800' : ''}`}
        >
          <Zap strokeWidth={1.5} className="w-[18px] h-[18px]" />
          {isStormActive ? "HALT SIMULATION" : "RUN SIMULATION"}
        </button>
      </div>

      {/* ── Hero Status Readout ───────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-white to-indigo-50/50 border border-[#EEF0F9] border-l-[6px] border-l-signal-600 rounded-[16px] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_8px_24px_rgba(79,70,229,0.04)]">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#9AA1B2] mb-2 font-sans">Current System State</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-[48px] font-bold font-sans text-text-primary tracking-tight">
              {highestRiskLevel === "Critical" ? "Critical Risk Detected" : highestRiskLevel === "High" ? "Elevated Risk" : "Nominal Operations"}
            </h2>
          </div>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#9AA1B2] mb-1 font-sans">Statewide Avg Risk</p>
            <p className="text-[44px] text-text-primary font-bold tabular-nums font-sans">{safeFormat(metrics?.avg_risk_score, 1, "0.0")}<span className="text-sm text-text-secondary ml-1">/100</span></p>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#9AA1B2] mb-1 font-sans">Active Alerts</p>
            <p className="text-[44px] text-risk-severe font-bold tabular-nums font-sans">{metrics?.active_alerts_count || 0}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {isLoading && !hasWsData ? (
          isSlowLoading ? (
            <div className="col-span-full h-24 flex items-center justify-center bg-indigo-50/50 border border-indigo-100 rounded-[16px]">
              <div className="text-center flex flex-col items-center">
                <p className="text-sm font-semibold text-indigo-600 flex items-center gap-2">
                  <Activity className="w-4 h-4 animate-pulse" /> Waking up backend... this may take up to 60 seconds on the free tier.
                </p>
              </div>
            </div>
          ) : (
            Array.from({length: 7}).map((_, i) => <div key={i} className="h-24 skeleton rounded-[16px]" />)
          )
        ) : isError && !hasWsData ? (
          <div className="col-span-full h-24 flex items-center justify-center bg-red-50/50 border border-red-100 rounded-[16px]">
            <div className="text-center flex flex-col items-center">
              <p className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> Connection Failed
              </p>
              <button onClick={() => refetch()} className="text-xs px-4 py-1.5 bg-white border border-red-200 text-red-700 rounded-md shadow-sm hover:bg-red-50 transition-colors">
                Retry Now
              </button>
            </div>
          </div>
        ) : (
          <>
            <MetricCard title="Rainfall (24h)" value={metrics?.avg_rainfall_24h_mm ?? 0} unit="mm" icon={CloudRain} sparklineData={[12, 14, 25, 45, 30, metrics?.avg_rainfall_24h_mm || 0]} bgClass="bg-purple-100" colorClass="text-purple-600" sparklineColor="#9333ea" />
            <MetricCard title="Critical Nodes" value={metrics?.critical_districts ?? 0} icon={MapPin} sparklineData={[0, 0, 0, 0, 0, metrics?.critical_districts || 0]} bgClass="bg-red-100" colorClass="text-red-600" sparklineColor="#dc2626" />
            <MetricCard title="High Risk Nodes" value={metrics?.high_risk_districts ?? 0} icon={AlertTriangle} sparklineData={[0, 0, 0, 0, 0, metrics?.high_risk_districts || 0]} bgClass="bg-orange-100" colorClass="text-orange-600" sparklineColor="#ea580c" />
            <MetricCard title="GDNN Latency" value={modelMeta?.latency_ms ?? metrics?.gdnn_inference_ms ?? 0} unit="ms" icon={Brain} sparklineData={[0, 0, 0, 0, 0, modelMeta?.latency_ms ?? 0]} bgClass="bg-indigo-100" colorClass="text-indigo-600" sparklineColor="#4f46e5" />
            <MetricCard title="Graph Nodes" value={modelMeta?.node_count ?? 0} icon={Network} bgClass="bg-violet-100" colorClass="text-violet-600" />
            <MetricCard title="Graph Edges" value={modelMeta?.edge_count ?? 0} icon={Network} bgClass="bg-violet-100" colorClass="text-violet-600" />
            <MetricCard title="Attn Heads" value={modelMeta?.attention_heads ?? 0} icon={Brain} bgClass="bg-violet-100" colorClass="text-violet-600" />
          </>
        )}
      </div>

      {/* ── Main Layout: Map + Side Panel ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-[600px]">
        {/* Map */}
        <div className="xl:col-span-2 glass-card overflow-hidden flex flex-col relative">
          <div className="absolute top-4 left-4 z-[1000] bg-white/80 backdrop-blur-md border border-white/60 px-5 py-4 rounded-[16px] shadow-[0_4px_12px_rgba(0,0,0,0.06)]">
            <p className="text-[10px] uppercase tracking-[0.05em] font-bold text-[#9AA1B2] mb-3">Risk Legend</p>
            <div className="flex gap-4">
              {["Critical", "High", "Moderate", "Low"].map(level => (
                <div key={level} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${level === 'Critical' ? 'bg-risk-severe' : level === 'High' ? 'bg-risk-high' : level === 'Moderate' ? 'bg-risk-moderate' : 'bg-risk-low'}`} />
                  <span className="text-[10px] text-text-secondary">{level}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <FloodMap districts={hasWsData && data?.districts
                ? wsDistricts.map((d: any) => ({
                    ...(data.districts.find((x: any) => x.id === d.district_id) || {}),
                    id: d.district_id, name: d.district_name, risk_score: d.risk_score, risk_level: d.risk_level, risk_color: d.risk_color,
                  }))
                : data?.districts
              } 
            />
          </div>
        </div>

        {/* Side Panel: Alerts & Top Risks */}
        <div className="flex flex-col gap-4 overflow-hidden">
          
          {/* High Risk Targets */}
          <div className="glass-card p-4 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase tracking-[0.05em] text-[#9AA1B2] font-bold">Top Risk Nodes</h3>
            </div>
            <div className="overflow-y-auto no-scrollbar p-0">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="font-sans text-[12px]">Rank</th>
                    <th className="font-sans text-[12px]">District</th>
                    <th className="text-right font-sans text-[12px]">Risk Score</th>
                    <th className="text-right font-sans text-[12px]">Level</th>
                  </tr>
                </thead>
                <tbody className="relative">
                  <AnimatePresence>
                    {(() => {
                      const rows = (topDistricts ?? []).filter((d: any) => d.name && d.name.trim() !== '').slice(0, 5);
                      return isLoading && !hasWsData ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <SkeletonRow key={`skeleton-${i}`} />
                        ))
                      ) : rows.length > 0 ? (
                        rows.map((district: any, index: number) => (
                          <RiskRow
                            key={district.id || district.name}
                            rank={index + 1}
                            district={district}
                            trend={trends[district.id || district.name]}
                          />
                        ))
                      ) : (
                        <EmptyState />
                      );
                    })()}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Alerts Feed */}
          <div className="glass-card p-4 flex flex-col h-[280px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase tracking-[0.05em] text-[#9AA1B2] font-bold">Active Alerts</h3>
              <a href="/dashboard/alerts" className="text-[10px] font-bold text-signal-500 hover:text-signal-900 hover:underline transition-colors duration-200">View All</a>
            </div>
            <div className="overflow-y-auto no-scrollbar p-3 space-y-2">
              {isError && !hasWsData ? (
                <div className="text-center py-6 text-red-500 text-xs font-semibold">Failed to load alerts.</div>
              ) : alerts.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">No active alerts — all nodes nominal.</div>
              ) : (
                alerts.map((alert: any) => {
                  const isSevere = alert.level === 'Critical' || alert.level === 'Severe';
                  const isHigh = alert.level === 'High';
                  const borderColor = isSevere ? 'border-l-[#DC2626]' : isHigh ? 'border-l-[#EA580C]' : 'border-l-[#CA8A04]';
                  const bgChip = isSevere ? 'bg-red-100 text-red-700' : isHigh ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700';
                  
                  return (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={alert.id} 
                      className={`relative p-4 border border-[#EEF0F9] border-l-4 ${borderColor} rounded-r-xl bg-white shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300`}
                    >
                      {/* Pulse animation for active severe alerts */}
                      {isSevere && (
                        <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping opacity-75" />
                      )}
                      {isSevere && (
                        <div className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-red-500" />
                      )}
                      
                      <div className="flex justify-between items-start mb-3">
                        <span className={`text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full font-sans ${bgChip}`}>
                          {alert.district}
                        </span>
                        <span className="text-[12px] text-slate-500 font-medium font-sans mt-0.5">
                          {new Date(alert.created_at || alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-start gap-2">
                          <Activity strokeWidth={2} className={`w-[16px] h-[16px] mt-0.5 flex-shrink-0 ${isSevere ? 'text-red-500' : isHigh ? 'text-orange-500' : 'text-yellow-500'}`} />
                          <p className="text-[15px] font-medium text-slate-800 leading-snug font-sans">{alert.message}</p>
                        </div>
                        
                        {(alert.river_level_m || alert.river_danger_m) && (
                          <div className="flex items-center gap-3 ml-6 mt-1 text-[13px] font-sans">
                             <div className="flex items-center gap-1 text-slate-600">
                               <Droplets className="w-3.5 h-3.5 text-blue-500" />
                               <span>Level: <strong>{alert.river_level_m ?? 'N/A'}m</strong></span>
                             </div>
                             <div className="flex items-center gap-1 text-slate-500">
                               <span>Danger: {alert.river_danger_m ?? 'N/A'}m</span>
                             </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
