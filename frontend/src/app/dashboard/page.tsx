"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useFloodData } from "@/context/FloodDataContext";
import {
  Brain, Droplets, AlertTriangle, Shield, Activity, MapPin, 
  CloudRain, Zap, Network, ChevronRight, Info
} from "lucide-react";
import dynamicImport from "next/dynamic";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

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

// --- Utilities ---
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((val, i) => ({ val, i }));
  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <Area type="monotone" dataKey="val" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1.5} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function MetricCard({ title, value, unit, icon: Icon, sparklineData, colorToken }: any) {
  // Use CSS variable mapping for Recharts stroke
  const strokeColor = colorToken ? `var(--${colorToken})` : "var(--signal-500)";
  
  return (
    <div className="metric-card flex flex-col justify-between h-24">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5 text-[#9AA1B2] text-[10px] uppercase tracking-widest font-bold">
          <Icon strokeWidth={1.5} className="w-[18px] h-[18px]" />
          <span>{title}</span>
        </div>
        {sparklineData && <Sparkline data={sparklineData} color={strokeColor} />}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-bold tabular-nums text-text-primary">
          {typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : (value || (
            <span className="text-slate-300">-</span>
          ))}
        </span>
        {unit && <span className="text-xs text-text-secondary font-medium">{unit}</span>}
      </div>
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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await api.get("/dashboard/live");
      return res.data;
    },
    refetchInterval: 15_000,
    staleTime: 0,
  });

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

  const events = data?.events || [];
  const isStormActive = stormSimulationActive || Boolean(data?.metrics?.storm_simulation_active);
  const highestRiskLevel = criticalCount > 0 ? "Critical" : highCount > 0 ? "High" : "Moderate";

  const [simulating, setSimulating] = useState(false);
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
          <h1 className="text-xl text-text-primary">Regional Overview</h1>
          <p className="text-xs text-text-secondary mt-1">Tamil Nadu State Disaster Management Authority</p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className={`btn-primary shadow-md hover:shadow-lg transition-all ${isStormActive ? '!bg-risk-severe hover:!bg-red-800' : ''}`}
        >
          <Zap className="w-4 h-4" />
          {isStormActive ? "HALT SIMULATION" : "RUN SIMULATION"}
        </button>
      </div>

      {/* ── Hero Status Readout ───────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-white to-[#EEF0F9] border border-[#EEF0F9] border-l-4 border-l-indigo-600 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-[0_8px_24px_rgba(79,70,229,0.06)]">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#9AA1B2] font-bold mb-2">Current System State</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-4xl text-text-primary tracking-tight font-bold">
              {highestRiskLevel === "Critical" ? "Critical Risk Detected" : highestRiskLevel === "High" ? "Elevated Risk" : "Nominal Operations"}
            </h2>
          </div>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-[#9AA1B2] font-bold mb-1">Statewide Avg Risk</p>
            <p className="text-3xl text-text-primary font-bold tabular-nums">{(Number(metrics?.avg_risk_score) || 0).toFixed(1) || "0.0"}<span className="text-sm text-text-secondary ml-1">/100</span></p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-[#9AA1B2] font-bold mb-1">Active Alerts</p>
            <p className="text-3xl text-risk-severe font-bold tabular-nums">{metrics?.active_alerts_count || 0}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {isLoading ? (
          Array.from({length: 7}).map((_, i) => <div key={i} className="h-24 skeleton" />)
        ) : (
          <>
            <MetricCard title="Rainfall (24h)" value={metrics?.avg_rainfall_24h_mm} unit="mm" icon={CloudRain} sparklineData={[12, 14, 25, 45, 30, metrics?.avg_rainfall_24h_mm || 0]} colorToken="signal-500" />
            <MetricCard title="Critical Nodes" value={metrics?.critical_districts} icon={MapPin} sparklineData={[0, 0, 0, 0, 0, metrics?.critical_districts || 0]} colorToken="risk-severe" />
            <MetricCard title="High Risk Nodes" value={metrics?.high_risk_districts} icon={AlertTriangle} sparklineData={[0, 0, 0, 0, 0, metrics?.high_risk_districts || 0]} colorToken="risk-high" />
            <MetricCard title="GDNN Latency" value={modelMeta?.latency_ms ?? metrics?.gdnn_inference_ms ?? "-"} unit="ms" icon={Brain} sparklineData={[0, 0, 0, 0, 0, modelMeta?.latency_ms ?? 0]} colorToken="signal-500" />
            <MetricCard title="Graph Nodes" value={modelMeta?.node_count ?? "-"} icon={Network} />
            <MetricCard title="Graph Edges" value={modelMeta?.edge_count ?? "-"} icon={Network} />
            <MetricCard title="Attn Heads" value={modelMeta?.attention_heads ?? "-"} icon={Brain} />
          </>
        )}
      </div>

      {/* ── Main Layout: Map + Side Panel ─────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-[600px]">
        {/* Map */}
        <div className="xl:col-span-2 bg-paper-100 border border-[#EEF0F9] rounded-2xl overflow-hidden flex flex-col relative shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
          <div className="absolute top-4 left-4 z-[1000] bg-white/60 backdrop-blur-md border border-white/40 px-4 py-3 rounded-xl shadow-lg">
            <p className="text-[10px] uppercase tracking-widest font-bold text-[#9AA1B2] mb-3">Risk Legend</p>
            <div className="flex gap-3">
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
          <div className="premium-card bg-white border border-[#EEF0F9] rounded-2xl p-4 flex flex-col flex-1 shadow-[0_4px_12px_rgba(79,70,229,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase tracking-widest text-[#9AA1B2] font-bold">Top Risk Nodes</h3>
            </div>
            <div className="overflow-y-auto custom-scroll p-0">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th className="text-right">Risk Score</th>
                    <th className="text-right">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {topDistricts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-6 text-text-secondary text-xs">No risk data available.</td>
                    </tr>
                  ) : topDistricts.map((d: any) => (
                    <tr key={d.name}>
                      <td className="font-medium text-text-primary">{d.name}</td>
                      <td className="text-right text-text-primary font-bold tabular-nums">
                        {typeof d.risk_score === 'number' ? (Number(d?.risk_score) || 0).toFixed(1) : d.risk_score}
                      </td>
                      <td className="text-right">
                        <span className={`risk-badge ${RISK_LEVELS[d.risk_level] || RISK_LEVELS.Safe}`}>{d.risk_level}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Alerts Feed */}
          <div className="premium-card bg-white border border-[#EEF0F9] rounded-2xl p-4 flex flex-col h-[280px] shadow-[0_4px_12px_rgba(79,70,229,0.03)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase tracking-widest text-[#9AA1B2] font-bold">Active Alerts</h3>
              <a href="/dashboard/alerts" className="text-[10px] font-bold text-signal-500 hover:underline">View All</a>
            </div>
            <div className="overflow-y-auto custom-scroll p-3 space-y-2">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">No active alerts — all nodes nominal.</div>
              ) : (
                alerts.map((alert: any) => {
                  const isSevere = alert.level === 'Critical' || alert.level === 'Severe';
                  const isHigh = alert.level === 'High';
                  const borderColor = isSevere ? 'border-l-[#DC2626]' : isHigh ? 'border-l-[#EA580C]' : 'border-l-[#CA8A04]';
                  return (
                  <div key={alert.id} className={`p-3 border-y border-r border-[#EEF0F9] border-l-4 ${borderColor} rounded-r-lg bg-white shadow-sm hover:bg-slate-50 transition-colors`}>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`risk-badge ${RISK_LEVELS[alert.level] || RISK_LEVELS.Safe}`}>{alert.district}</span>
                      <span className="text-[10px] text-[#9AA1B2] font-medium">
                        {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-text-primary leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
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
