"use client";

import React, { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import {
  Brain, Cpu, Zap, Target,
  CheckCircle, GitBranch, Terminal, MapPin,
  Eye, ChevronRight, ChevronDown, ChevronUp, Search, BarChart2, AlertTriangle, Network,
  Activity, Sliders, ShieldAlert, RefreshCw, Layers
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Types ────────────────────────────────────────────────────────────────────

interface DistrictResult {
  district_id: number;
  district: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  confidence: number;
  rainfall_24h: number;
  river_level_m?: number;
  river_danger_m?: number;
  reservoir_storage: number;
  elevation?: number;
  historical_similarity?: number;
  attention_score: number;
  inference_time_ms: number;
  inference_cycle?: number;
  model_version?: string;
  shap_values: { feature: string; contribution: number }[];
  reasoning_chain: string[];
  forecast_horizons?: {
    now: number;
    "1h": number;
    "3h": number;
    "6h": number;
    "12h": number;
    "24h": number;
  };
}

const GDNN_FLOW = [
  { id: "telemetry", label: "Telemetry" },
  { id: "weather", label: "Weather" },
  { id: "river", label: "River" },
  { id: "features", label: "Features" },
  { id: "kg", label: "KG Sync" },
  { id: "temporal", label: "Temporal" },
  { id: "attention", label: "Attention" },
  { id: "probability", label: "Risk Prob" },
  { id: "shap", label: "SHAP" },
  { id: "alerts", label: "Alerts" },
];

const RISK_LEVELS: Record<string, string> = {
  Critical: "risk-badge-severe",
  High: "risk-badge-high",
  Moderate: "risk-badge-moderate",
  Low: "risk-badge-low",
  Safe: "risk-badge-safe",
};

// ── Risk glow & accent by level ──────────────────────────────────────────────
const RISK_GLOW: Record<string, string> = {
  Critical: "rgba(248,113,113,0.15)",
  High:     "rgba(251,146,60,0.15)",
  Moderate: "rgba(251,191,36,0.15)",
  Low:      "rgba(16,185,129,0.15)",
  Safe:     "rgba(148,163,184,0.1)",
};

const RISK_ACCENT: Record<string, string> = {
  Critical: "var(--risk-severe)",
  High:     "var(--risk-high)",
  Moderate: "var(--risk-moderate)",
  Low:      "var(--risk-low)",
  Safe:     "var(--text-secondary)",
};

// ── Circular Gauge Component ───────────────────────────────────────────────────────
function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 36;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ filter: `drop-shadow(0 4px 8px ${color}40)` }}>
        <svg width="90" height="90" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
          <circle 
            cx={cx} 
            cy={cy} 
            r={r} 
            fill="none" 
            stroke={color} 
            strokeWidth="8" 
            strokeLinecap="round" 
            strokeDasharray={circumference} 
            strokeDashoffset={offset} 
            className="transition-all duration-1000 ease-out" 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-text-primary tabular-nums">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-[11px] uppercase tracking-wider font-semibold text-text-secondary">{label}</span>
    </div>
  );
}

// ── Mini Metric Row ───────────────────────────────────────────────────────────
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0">
      <span className="text-[11px] uppercase tracking-widest font-semibold text-text-secondary">{label}</span>
      <span className="text-sm font-bold text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

// ── Stat Card Component ───────────────────────────────────────────────────────
function StatCard({ icon: Icon, title, value, subtitle, accent = false, children, extraIcon }: any) {
  return (
    <div className="bg-paper-100 rounded-xl p-3 sm:p-4 shadow-sm border border-line flex items-center gap-3 sm:gap-4 relative overflow-hidden group min-w-0">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 ${accent ? 'bg-signal-100 text-signal-600' : 'bg-paper-50 text-text-secondary border border-line'}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <p className="text-[9px] text-text-secondary uppercase tracking-wider font-bold truncate">
            {title}
          </p>
          {extraIcon}
        </div>
        {children ? children : (
          <div className="flex flex-col">
            <p className="text-xs xl:text-sm font-bold text-text-primary leading-tight tracking-tight break-words">{value}</p>
            {subtitle && <p className="text-[9px] text-text-secondary truncate mt-0.5">{subtitle}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PredictionEnginePage() {
  const queryClient = useQueryClient();
  const [flowStage, setFlowStage] = useState(-1);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [showLogs, setShowLogs] = useState(true);
  const [showTemporal, setShowTemporal] = useState(true);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [stoppingSim, setStoppingSim] = useState(false);

  const { pipelineData: contextData, refetchPipeline } = useFloodData();
  const data = contextData ? {
    ...contextData,
    districts: contextData.districts || contextData.stages?.gdnn_output?.district_ranking || []
  } : null;
  const isLoading = !data;
  const isError = data?.status === "error"; 
  const dataUpdatedAt = contextData?.timestamp || 0;
  
  const [telemetryWaitTime, setTelemetryWaitTime] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (data?.status === "waiting_for_telemetry") {
      interval = setInterval(() => {
        setTelemetryWaitTime(prev => prev + 1);
      }, 1000);
    } else {
      setTelemetryWaitTime(0);
    }
    return () => clearInterval(interval);
  }, [data?.status]);

  useEffect(() => {
    if (data && data.status !== "waiting_for_telemetry") {
      setFlowStage(-1);
      setCountdown(30);
      const flowInterval = setInterval(() => {
        setFlowStage(prev => {
          if (prev >= GDNN_FLOW.length - 1) {
            clearInterval(flowInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 400);

      if (!selectedDistrictId && data.districts && data.districts.length > 0) {
        setSelectedDistrictId(data.districts[0].district_id);
      }
      return () => clearInterval(flowInterval);
    }
  }, [dataUpdatedAt, data]);

  useEffect(() => {
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStopSimulation = async () => {
    try {
      setStoppingSim(true);
      await api.post("/dashboard/simulate-storm?active=false");
      await refetchPipeline();
      queryClient.invalidateQueries({ queryKey: ["dashboard", "live"] });
    } catch (err) {} finally {
      setStoppingSim(false);
    }
  };

  const { districts: wsDistricts, stormSimulationActive, mode } = useFloodData();
  const hasWsData = wsDistricts && wsDistricts.length > 0;
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  if (!data || data.status === "waiting_for_telemetry" || data.status === "error" || !data.districts || data.districts.length === 0) {
    if (hasWsData) {
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Activity className="w-8 h-8 text-signal-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-text-primary">
              Computing Prediction Pipeline
            </h2>
            <p className="text-xs text-text-secondary max-w-sm">
              Live telemetry is active. Waiting for the GDNN cycle to complete. {telemetryWaitTime > 0 ? `(${telemetryWaitTime}s)` : ""}
            </p>
            {telemetryWaitTime > 15 && (
               <div className="mt-4 flex gap-3">
                 <button onClick={() => refetchPipeline()} className="btn-primary bg-signal-500 hover:bg-signal-600">
                    <RefreshCw className="w-4 h-4" /> Force Retry
                 </button>
               </div>
            )}
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertTriangle className={`w-8 h-8 ${isError ? 'text-risk-severe' : 'text-signal-500'}`} />
          <h2 className="text-sm font-bold text-text-primary">
            {isError ? "Engine Offline" : "Waiting for Telemetry"}
          </h2>
          <p className="text-xs text-text-secondary max-w-sm">
            {data?.message || "Pipeline is currently waiting for initial data ingestion."}
          </p>
          <button onClick={() => refetchPipeline()} className="btn-primary">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Pipeline
          </button>
        </div>
      </div>
    );
  }

  const s = data?.model_status || {};
  const breakdown = data?.latency_breakdown || {};
  const totalLatencySum = Object.values(breakdown).reduce((a: any, b: any) => Number(a || 0) + Number(b || 0), 0);
  const filteredDistricts = data?.districts?.filter((d: any) => 
    d.district.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  const selectedDistrict = data?.districts?.find((d: any) => d.district_id === selectedDistrictId) || data?.districts?.[0];
  const d: DistrictResult = selectedDistrict;

  const chartData = d?.forecast_horizons ? [
    { name: "Now", risk: d.forecast_horizons.now },
    { name: "+6h", risk: d.forecast_horizons["6h"] },
    { name: "+12h", risk: d.forecast_horizons["12h"] },
    { name: "+24h", risk: d.forecast_horizons["24h"] },
  ] : [];

  // SHAP sorted descending by absolute contribution
  const sortedShap = d?.shap_values
    ? [...d.shap_values].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    : [];
  const totalShap = sortedShap.reduce((sum, e) => sum + Math.abs(e.contribution), 0);

  const confidencePct = Number(
    ((d?.confidence ?? 0) <= 1.0 ? (d?.confidence ?? 0) * 100 : (d?.confidence ?? 0))
  );
  const riskLevel = d?.risk_level || "Safe";
  const riskGlow = RISK_GLOW[riskLevel] || RISK_GLOW.Safe;
  const riskAccent = RISK_ACCENT[riskLevel] || RISK_ACCENT.Safe;

  // Format SHAP names
  const formatName = (str: string) => {
    if (!str) return "Unknown Feature";
    if (str === "rainfall_24h") return "Rainfall (24h)";
    if (str === "river_level_m") return "River Level";
    if (str === "reservoir_storage") return "Reservoir %";
    if (str === "historical_similarity") return "Hist. Match";
    if (str === "elevation") return "Elevation";
    return str.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div className="flex flex-col gap-6 p-2">
      {/* ── HEADER ACTION STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Prediction Engine</h1>
            {isStormActive ? (
              <span className="risk-badge risk-badge-severe !py-1 !px-3 !text-[11px] shadow-sm">SIMULATION ACTIVE</span>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-risk-low/10 text-risk-low rounded-full border border-risk-low/20 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-low opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-risk-low"></span>
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase">Live Telemetry</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-signal-100/50 text-signal-600 rounded-full border border-signal-500/20 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-signal-500" />
              <span className="text-[10px] font-bold tracking-widest uppercase">System: Nominal</span>
            </div>
          </div>
          <p className="text-sm text-text-secondary mt-1.5 font-medium">Knowledge Graph & Graph Dynamic Neural Network (GDNN v2)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDiagnostics(true)} className="btn-secondary shadow-sm hover:shadow-md transition-shadow">
            <Sliders className="w-4 h-4" /> Diagnostics
          </button>
          {isStormActive && (
            <button onClick={handleStopSimulation} disabled={stoppingSim} className="btn-primary !bg-risk-severe hover:!bg-red-800 shadow-sm hover:shadow-md transition-shadow">
              <ShieldAlert className="w-4 h-4" />
              {stoppingSim ? "Restoring..." : "Stop Simulation"}
            </button>
          )}
        </div>
      </div>

      {/* ── TOP STATUS BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <StatCard icon={Brain} title="Model" value={s.model_name || "GDNN v2 (GAT+GRU)"} subtitle="Architecture" />
        <StatCard icon={Cpu} title="Engine" value={s.compute_device || "CPU"} subtitle="Compute Target" />
        <StatCard 
          icon={Zap} 
          title="Total Latency" 
          value={`${data?.total_latency_ms || Number(totalLatencySum || 0).toFixed(1)} ms`} 
          subtitle="End-to-end processing" 
          extraIcon={<span className="w-2 h-2 rounded-full bg-signal-500 animate-pulse" />} 
        />
        <StatCard icon={Network} title="Graph Config" extraIcon={<GitBranch className="w-3 h-3 text-text-secondary/50"/>}>
          <div className="grid grid-cols-3 gap-1 mt-0.5">
            <div className="flex flex-col">
              <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Nodes</span>
              <span className="text-xs font-bold text-text-primary tabular-nums">{s.node_count ?? 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Edges</span>
              <span className="text-xs font-bold text-text-primary tabular-nums">{s.edge_count ?? 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-text-secondary uppercase font-bold tracking-wider">Heads</span>
              <span className="text-xs font-bold text-text-primary tabular-nums">{s.attention_heads ?? 4}</span>
            </div>
          </div>
        </StatCard>
        <StatCard icon={Activity} title="Next Cycle" accent>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-line/50">
            <div className="h-full bg-signal-500" style={{ width: `${(countdown / 30) * 100}%`, transition: 'width 1s linear' }} />
          </div>
          <div className="flex flex-col">
            <p className="text-sm lg:text-base font-bold text-text-primary truncate leading-tight tracking-tight tabular-nums">{countdown}s</p>
            <p className="text-[9px] text-text-secondary truncate mt-0.5">Until inference</p>
          </div>
        </StatCard>
      </div>
      
      {/* ── PIPELINE STATUS STRIP ── */}
      <div className="bg-paper-100 border border-line rounded-2xl p-6 shadow-sm overflow-hidden flex flex-col gap-4">
        <div className="text-[11px] font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Layers className="w-4 h-4 text-signal-500" /> Pipeline Flow
        </div>
        <div className="relative flex items-center justify-between w-full mt-2">
          {/* Background connecting line */}
          <div className="absolute left-6 right-6 top-3 h-[2px] bg-line/50 -translate-y-1/2 z-0" />
          
          {/* Active connecting line */}
          <div 
            className="absolute left-6 top-3 h-[2px] bg-signal-400 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out" 
            style={{ width: `calc(${Math.max(0, flowStage) / (GDNN_FLOW.length - 1) * 100}% - 48px)` }} 
          />
          
          {GDNN_FLOW.map((step, i) => {
            const isActive = i === flowStage;
            const isCompleted = i < flowStage;
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-3 bg-paper-100 px-2 sm:px-4">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border-2 ${
                  isActive
                    ? "border-signal-500 bg-signal-100 text-signal-600 shadow-[0_0_0_4px_var(--signal-100)]"
                    : isCompleted
                    ? "border-signal-400 bg-signal-50 text-signal-600"
                    : "border-line bg-paper-50 text-text-secondary"
                }`}>
                  {isCompleted ? <CheckCircle className="w-3 h-3" /> : (i + 1)}
                </div>
                <span className={`text-[9px] uppercase tracking-widest font-bold hidden md:block transition-colors ${
                  isActive ? 'text-signal-600' : isCompleted ? 'text-text-primary' : 'text-text-secondary'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        
        {/* ── LEFT: DISTRICT SELECTOR ── */}
        <div className="xl:col-span-3">
          <div className="bg-paper-100 border border-line rounded-2xl flex flex-col overflow-hidden shadow-sm relative h-full">
            <div className="p-6 border-b border-line bg-paper-50 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-primary">
                  <MapPin className="w-4 h-4 text-signal-500" /> Regional Risk Profiles
                </h2>
                <span className="text-[10px] font-semibold text-text-secondary bg-line/50 px-2 py-0.5 rounded-full">
                  {data?.districts?.length || 0} regions
                </span>
              </div>
              <div className="relative shadow-inner rounded-lg">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-secondary" />
                <input 
                  type="text" 
                  placeholder="Search district..." 
                  className="w-full bg-paper-100 border border-line rounded-lg pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 shadow-sm transition-shadow"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scroll relative pb-4 bg-paper-100">
              {(() => {
                const elevated = filteredDistricts.filter((d: any) => d.risk_level === "Critical" || d.risk_level === "High");
                const moderate = filteredDistricts.filter((d: any) => d.risk_level === "Moderate");
                const safe = filteredDistricts.filter((d: any) => d.risk_level === "Low" || d.risk_level === "Safe");
                
                const renderGroup = (title: string, list: any[]) => {
                  if (list.length === 0) return null;
                  return (
                    <div className="mb-2">
                      <div className="sticky top-0 bg-paper-100/90 backdrop-blur-md z-10 px-4 py-2 border-y border-line/50 mb-1 flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">{title}</span>
                        <span className="text-[9px] font-bold text-text-secondary bg-paper-50 px-1.5 rounded border border-line/50">{list.length}</span>
                      </div>
                      <div className="flex flex-col px-2 gap-1">
                        {list.map((dist: any, idx: number) => {
                          const isSelected = selectedDistrictId === dist.district_id;
                          const color = RISK_ACCENT[dist.risk_level] || RISK_ACCENT.Safe;
                          return (
                            <div 
                              key={dist.district_id} 
                              onClick={() => setSelectedDistrictId(dist.district_id)}
                              className={`grid grid-cols-[16px_1fr_auto] items-center gap-3 p-2.5 mx-2 rounded-lg cursor-pointer transition-all border ${
                                isSelected 
                                  ? 'bg-paper-50 border-line shadow-sm' 
                                  : 'border-transparent hover:bg-paper-50/80'
                              } ${idx % 2 === 0 && !isSelected ? 'bg-paper-50/30' : ''}`}
                            >
                              <div className="w-2 h-2 rounded-full shadow-sm justify-self-center" style={{ backgroundColor: color }} />
                              <span className={`font-semibold text-xs truncate ${isSelected ? 'text-signal-600' : 'text-text-primary'}`}>{dist.district}</span>
                              <span className={`risk-badge !px-2 !py-0.5 !text-[9px] ${RISK_LEVELS[dist.risk_level] || RISK_LEVELS.Safe}`}>{dist.risk_level}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {renderGroup("Critical & High", elevated)}
                    {renderGroup("Moderate", moderate)}
                    {renderGroup("Low & Safe", safe)}
                    {filteredDistricts.length === 0 && (
                      <div className="p-6 text-center text-xs text-text-secondary">No districts found</div>
                    )}
                  </>
                );
              })()}
            </div>
            
            {/* Bottom Fade Mask */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-paper-100 to-transparent pointer-events-none rounded-b-2xl" />
          </div>
        </div>

        {/* ── RIGHT: OUTPUT & EXPLAINABILITY ── */}
        <div className="xl:col-span-9 flex flex-col gap-6 pb-6">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* ══ HERO: GDNN Risk Assessment ═══════════════════════════════════════ */}
            {d ? (
              <div
                className="bg-paper-100 rounded-2xl p-6 relative overflow-hidden border border-line flex flex-col shadow-sm"
                style={{ 
                  boxShadow: `0 10px 30px -10px rgba(0,0,0,0.1), inset 0 0 100px ${riskGlow}`,
                }}
              >
                {/* Subtle colored glow blob */}
                <div
                  className="absolute -top-20 -right-20 w-64 h-64 rounded-full blur-[80px] pointer-events-none"
                  style={{ background: riskGlow, opacity: 0.8 }}
                />

                <div className="relative z-10 flex-1 flex flex-col">
                  {/* Header */}
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-primary">
                      <Target className="w-4 h-4 text-signal-500" /> GDNN Risk Assessment
                    </h2>
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest bg-paper-50 px-2 py-1 rounded-md border border-line shadow-sm">
                      Cycle #{d?.inference_cycle || 1}
                    </span>
                  </div>

                  {/* District name + big risk badge */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold mb-1.5">Target District</p>
                      <h3 className="text-4xl font-black text-text-primary leading-tight tracking-tight">{d.district}</h3>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1.5">
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Risk Level</p>
                      {/* Big prominent badge */}
                      <div
                        className={`risk-badge text-lg px-5 py-2.5 rounded-lg font-bold tracking-widest shadow-sm ${RISK_LEVELS[d.risk_level] || RISK_LEVELS.Safe}`}
                      >
                        {d.risk_level.toUpperCase()}
                      </div>
                      <span className="text-2xl font-black tabular-nums tracking-tight mt-1" style={{ color: riskAccent }}>
                        {Number(d.risk_score ?? 0).toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  {/* Circular Gauges: Flood Prob + Confidence */}
                  <div className="flex items-center justify-around py-6 mb-6 border-y border-line/60 bg-paper-50/30 rounded-xl">
                    <CircularGauge
                      value={Number(d.risk_score ?? 0)}
                      label="Flood Probability"
                      color={riskAccent}
                    />
                    <div className="w-px h-20 bg-line" />
                    <CircularGauge
                      value={confidencePct}
                      label="Model Confidence"
                      color="var(--signal-500)"
                    />
                  </div>

                  {/* Secondary metrics: 2-column mini-grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 mb-6">
                    <div>
                      <MiniMetric label="Rainfall 24H" value={`${Number(d.rainfall_24h ?? 0).toFixed(1)} mm`} />
                      <MiniMetric label="River Level" value={`${d.river_level_m || 1.2} m`} />
                      <MiniMetric label="Reservoir" value={`${d.reservoir_storage || 68.5}%`} />
                    </div>
                    <div>
                      <MiniMetric label="Elevation" value={`${d.elevation || 15.0} m`} />
                      <MiniMetric label="Hist. Match" value={`${d.historical_similarity || 88.5}%`} />
                      <MiniMetric label="Attn. Score" value={`${Number(d.attention_score || 0.88).toFixed(3)}`} />
                    </div>
                  </div>

                  {/* Reasoning chain */}
                  <div className="p-4 bg-signal-100/30 rounded-xl border border-signal-500/20 text-sm text-text-primary leading-relaxed shadow-inner mt-auto">
                    <span className="font-bold text-signal-600 mr-1">Reasoning:</span>
                    {d.reasoning_chain?.[0] || `Rainfall (${d.rainfall_24h || 0}mm) and river discharge drive risk.`}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-paper-100 border border-line rounded-2xl p-6 h-64 flex items-center justify-center text-text-secondary text-sm shadow-sm">
                Select a district…
              </div>
            )}

            {/* ══ SHAP Feature Attribution ════════════════════════════════════════ */}
            <div className="bg-paper-100 border border-line rounded-2xl p-6 flex flex-col shadow-sm">
              <h2 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-text-primary">
                <Eye className="w-4 h-4 text-signal-500" /> SHAP Feature Attribution
              </h2>
              {d && sortedShap.length > 0 ? (
                <div className="flex-1 flex flex-col justify-between gap-4">
                  <div className="flex flex-col gap-3 relative">
                    {sortedShap.slice(0, 5).map((entry, i) => {
                      const pctLabel = totalShap > 0 ? ((Math.abs(entry.contribution) / totalShap) * 100) : 0;
                      const isPositive = (entry.contribution ?? 0) >= 0;
                      const barColor = isPositive ? 'var(--risk-severe)' : 'var(--risk-low)';
                      return (
                        <div key={i} className="flex items-center gap-3 group bg-paper-50/50 p-2.5 rounded-lg border border-line/50 hover:bg-paper-50 hover:border-line transition-all">
                          <span className="text-[11px] font-bold text-text-secondary w-28 shrink-0 truncate group-hover:text-text-primary transition-colors">{formatName(entry.feature)}</span>
                          <div className="flex-1 h-2 bg-line/40 rounded-full overflow-hidden relative">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out absolute left-0 top-0"
                              style={{ width: `${pctLabel}%`, background: barColor }}
                            />
                          </div>
                          <span className="text-[11px] font-bold tabular-nums w-12 text-right" style={{ color: barColor }}>
                            {pctLabel.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-4 border-t border-line/60 flex items-center justify-between text-[11px] text-text-secondary font-medium">
                    <span>Top 5 drivers shown</span>
                    <button className="text-signal-600 font-bold hover:underline flex items-center gap-1">
                      View all features <ChevronRight className="w-3 h-3"/>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
                  {d ? "No SHAP data available" : "Select a district…"}
                </div>
              )}
            </div>
          </div>

          {/* ══ Temporal Forecasting Chart ══════════════════════════════════ */}
          <div className="bg-paper-100 border border-line rounded-2xl shadow-sm transition-all flex flex-col overflow-hidden">
            <button
              onClick={() => setShowTemporal(!showTemporal)}
              className="w-full flex items-center justify-between p-6 focus:outline-none hover:bg-paper-50 transition-colors group shrink-0"
            >
              <h2 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-primary group-hover:text-signal-600 transition-colors">
                <BarChart2 className="w-4 h-4 text-signal-500" /> Temporal Risk Projection
              </h2>
              <div className="p-1 rounded-full bg-paper-50 group-hover:bg-line transition-colors">
                {showTemporal ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
              </div>
            </button>
            {showTemporal && (
              <div className="px-6 pb-6 h-[280px] border-t border-line/50 flex-1">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--signal-500)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--risk-low)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)', fontWeight: 600 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--paper-100)', borderColor: 'var(--line)', borderRadius: '8px', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="risk" stroke="var(--signal-500)" strokeWidth={3} fillOpacity={1} fill="url(#colorRisk)" activeDot={{ r: 6, fill: 'var(--signal-600)', stroke: 'white', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex-1 h-full flex items-center justify-center text-text-secondary text-sm">
                    No temporal projection data available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ Collapsible Logs ════════════════════════════════════════════ */}
          <div className="bg-paper-100 border border-line rounded-2xl shadow-sm transition-all flex flex-col overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between p-6 focus:outline-none hover:bg-paper-50 transition-colors group shrink-0"
            >
              <h2 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 text-text-secondary group-hover:text-text-primary transition-colors">
                <Terminal className="w-4 h-4 text-signal-500" /> Execution Logs
              </h2>
              <div className="p-1 rounded-full bg-paper-50 group-hover:bg-line transition-colors">
                {showLogs ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
              </div>
            </button>
            {showLogs && (
              <div className="h-[280px] flex flex-col border-t border-line/50 bg-[#FAFAFA] rounded-b-2xl">
                <div className="flex-1 overflow-y-auto custom-scroll">
                  {data?.logs?.map((log: any, i: number) => {
                    const isError = log.message.toLowerCase().includes('error') || log.level === 'ERROR';
                    const isWarn = log.message.toLowerCase().includes('warn') || log.level === 'WARN';
                    const accent = isError ? 'border-risk-severe' : isWarn ? 'border-risk-moderate' : 'border-signal-400';
                    const bg = i % 2 === 0 ? 'bg-paper-100' : 'bg-paper-50/50';
                    
                    return (
                      <div key={i} className={`flex items-start gap-3 p-3 px-6 border-l-[3px] ${accent} ${bg} border-b border-line/30 last:border-b-0`}>
                        <span className="shrink-0 text-text-secondary/60 font-mono text-[10px] mt-[3px]">[{log.ts}]</span>
                        <span className={`font-mono text-[11px] leading-relaxed ${isError ? 'text-risk-severe font-bold' : isWarn ? 'text-risk-moderate font-bold' : 'text-text-primary'}`}>{log.message}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
