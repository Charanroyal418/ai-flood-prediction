"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useFloodData } from "@/context/FloodDataContext";
import {
  Brain, Droplets, AlertTriangle, Shield, Activity, MapPin, 
  CloudRain, Zap, Network, ChevronRight
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
        <div className="flex items-center gap-2 text-text-secondary text-xs uppercase tracking-wide font-medium">
          <Icon className="w-4 h-4" />
          <span>{title}</span>
        </div>
        {sparklineData && <Sparkline data={sparklineData} color={strokeColor} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-mono font-semibold text-text-primary">
          {typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : value}
        </span>
        {unit && <span className="text-sm font-mono text-text-secondary">{unit}</span>}
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
    <div className="flex flex-col gap-4">
      {/* ── Action Header ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl text-text-primary">Regional Overview</h1>
          <p className="text-xs text-text-secondary mt-1">Tamil Nadu State Disaster Management Authority</p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className={`btn-primary ${isStormActive ? '!bg-risk-severe hover:!bg-red-800' : ''}`}
        >
          <Zap className="w-4 h-4" />
          {isStormActive ? "HALT SIMULATION" : "RUN SIMULATION"}
        </button>
      </div>

      {/* ── Hero Status Readout ───────────────────────────────────────── */}
      <div className="bg-paper-100 border border-line rounded-lg p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-secondary font-medium mb-2">Current System State</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-4xl text-text-primary uppercase tracking-tight">
              {highestRiskLevel === "Critical" ? "CRITICAL RISK DETECTED" : highestRiskLevel === "High" ? "ELEVATED RISK" : "NOMINAL OPERATIONS"}
            </h2>
          </div>
        </div>
        <div className="flex gap-8">
          <div className="text-right">
            <p className="text-xs uppercase text-text-secondary mb-1">Statewide Avg Risk</p>
            <p className="text-2xl font-mono text-text-primary">{(metrics?.avg_risk_score ?? 0).toFixed(1) || "0.0"}<span className="text-sm text-text-secondary ml-1">/100</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase text-text-secondary mb-1">Active Alerts</p>
            <p className="text-2xl font-mono text-risk-severe">{metrics?.active_alerts_count || 0}</p>
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
        <div className="xl:col-span-2 bg-paper-100 border border-line rounded-lg overflow-hidden flex flex-col relative">
          <div className="absolute top-4 left-4 z-[1000] bg-paper-100/90 backdrop-blur-sm border border-line px-3 py-2 rounded-sm shadow-card">
            <p className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">Risk Legend</p>
            <div className="flex gap-3">
              {["Critical", "High", "Moderate", "Low"].map(level => (
                <div key={level} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${level === 'Critical' ? 'bg-risk-severe' : level === 'High' ? 'bg-risk-high' : level === 'Moderate' ? 'bg-risk-moderate' : 'bg-risk-low'}`} />
                  <span className="text-[10px] text-text-secondary font-mono">{level}</span>
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
          
          {/* Top Risks Table */}
          <div className="bg-paper-100 border border-line rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="p-3 border-b border-line flex justify-between items-center bg-paper-50">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Top Risk Nodes</h3>
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
                  {topDistricts.map((d: any) => (
                    <tr key={d.name}>
                      <td className="font-medium text-text-primary">{d.name}</td>
                      <td className="text-right font-mono text-text-primary">
                        {typeof d.risk_score === 'number' ? (d?.risk_score ?? 0).toFixed(1) : d.risk_score}
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
          <div className="bg-paper-100 border border-line rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
             <div className="p-3 border-b border-line flex justify-between items-center bg-paper-50">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">Active Alerts</h3>
              <a href="/dashboard/alerts" className="text-[10px] uppercase font-semibold text-signal-500 hover:underline">View All</a>
            </div>
            <div className="overflow-y-auto custom-scroll p-3 space-y-2">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">No active alerts — all nodes nominal.</div>
              ) : (
                alerts.map((alert: any) => (
                  <div key={alert.id} className="p-2 border border-line/50 rounded-sm bg-paper-50 hover:bg-line/20 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`risk-badge ${RISK_LEVELS[alert.level] || RISK_LEVELS.Safe}`}>{alert.district}</span>
                      <span className="text-[10px] font-mono text-text-secondary">
                        {new Date(alert.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </span>
                    </div>
                    <p className="text-xs text-text-primary">{alert.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
