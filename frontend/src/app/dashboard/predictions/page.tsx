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
  shap_values: { feature?: string; label?: string; contribution: number }[];
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

function CircularGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 36;
  const cx = 50;
  const cy = 50;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="90" height="90" viewBox="0 0 100 100" className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line)" strokeWidth="6" opacity="0.4" />
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
            style={{ filter: `drop-shadow(0 2px 6px ${color}40)` }} 
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-heading font-extrabold text-text-primary tabular-nums tracking-wide">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs uppercase tracking-widest font-bold text-text-secondary">{label}</span>
    </div>
  );
}

// ── Mini Metric Row ───────────────────────────────────────────────────────────
function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-line last:border-0">
      <span className="text-xs uppercase tracking-widest font-semibold text-text-secondary">{label}</span>
      <span className="text-base font-bold text-text-primary tabular-nums">{value}</span>
    </div>
  );
}

function StatCard({ icon: Icon, title, value, subtitle, accent = false, children, extraIcon }: any) {
  // Map title to a custom pastel color combo
  const getColors = (t: string) => {
    if (t === 'Model') return 'bg-purple-100 text-purple-600';
    if (t === 'Engine') return 'bg-blue-100 text-blue-600';
    if (t === 'Total Latency') return 'bg-amber-100 text-amber-600';
    if (t === 'Graph Config') return 'bg-emerald-100 text-emerald-600';
    return 'bg-indigo-100 text-indigo-600';
  };
  const colorClass = getColors(title);

  return (
    <div className="bg-paper-100 rounded-3xl p-6 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)] border border-[rgba(99,102,241,0.1)] flex items-center gap-4 relative overflow-hidden group min-w-0 transition-all duration-300 hover:-translate-y-1">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${colorClass}`}>
        <Icon className="w-7 h-7" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center justify-between gap-1 mb-1">
          <p className="text-[11px] text-text-secondary uppercase tracking-widest font-bold truncate">
            {title}
          </p>
          {extraIcon}
        </div>
        {children ? children : (
          <div className="flex flex-col">
            <p className="text-lg xl:text-xl font-heading font-extrabold text-text-primary leading-tight tracking-wide break-words">{value}</p>
            <p className="text-xs text-text-secondary truncate mt-1">{subtitle}</p>
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
    <div className="flex flex-col gap-8 p-4 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        .font-heading { font-family: 'Nunito', sans-serif !important; }
        .font-sans { font-family: 'Nunito', sans-serif !important; }
      `}</style>
      {/* ── HEADER ACTION STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-heading font-extrabold text-text-primary tracking-tight">Prediction Engine</h1>
            {isStormActive ? (
              <span className="risk-badge risk-badge-severe !py-1 !px-3 !text-[11px] shadow-sm rounded-full">SIMULATION ACTIVE</span>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-bold tracking-widest uppercase">Live Telemetry</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-soft" />
              <span className="text-[10px] font-bold tracking-widest uppercase">System: Nominal</span>
            </div>
          </div>
          <p className="text-sm text-text-secondary mt-1.5 font-medium">Knowledge Graph & Graph Dynamic Neural Network (GDNN v2)</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowDiagnostics(true)} className="btn-secondary">
            <Sliders className="w-4 h-4" /> Diagnostics
          </button>
          {isStormActive && (
            <button onClick={handleStopSimulation} disabled={stoppingSim} className="btn-primary !bg-risk-severe hover:!bg-red-800">
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
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Nodes</span>
              <span className="text-sm font-bold text-text-primary tabular-nums">{s.node_count ?? 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Edges</span>
              <span className="text-sm font-bold text-text-primary tabular-nums">{s.edge_count ?? 0}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Heads</span>
              <span className="text-sm font-bold text-text-primary tabular-nums">{s.attention_heads ?? 4}</span>
            </div>
          </div>
        </StatCard>
        <StatCard icon={Activity} title="Next Cycle" accent>
          <div className="absolute bottom-0 left-0 w-full h-1.5 bg-paper-50 rounded-b-full">
            <div className="h-full bg-signal-400 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" style={{ width: `${(countdown / 30) * 100}%`, transition: 'width 1s linear' }} />
          </div>
          <div className="flex flex-col">
            <p className="text-xl lg:text-2xl font-heading font-extrabold text-text-primary truncate leading-tight tracking-wide tabular-nums">{countdown}s</p>
            <p className="text-xs text-text-secondary truncate mt-1">Until inference</p>
          </div>
        </StatCard>
      </div>
      
      {/* ── PIPELINE STATUS STRIP ── */}
      <div className="bg-paper-100 border border-[rgba(99,102,241,0.1)] rounded-3xl p-8 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)] hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col gap-4 relative">
        <div className="text-sm font-bold text-text-primary uppercase tracking-widest flex items-center gap-2">
          <Layers className="w-4 h-4 text-signal-500" /> Pipeline Flow
        </div>
        <div className="relative flex items-center justify-between w-full mt-2">
          {/* Background connecting line */}
          <div className="absolute left-8 right-8 top-5 h-[4px] bg-paper-50 -translate-y-1/2 z-0 rounded-full" />
          
          {/* Active connecting line */}
          <div 
            className="absolute left-8 top-5 h-[4px] bg-signal-300 -translate-y-1/2 z-0 transition-all duration-500 ease-in-out rounded-full shadow-sm" 
            style={{ width: `calc(${Math.max(0, flowStage) / (GDNN_FLOW.length - 1) * 100}% - 64px)` }} 
          />
          
          {GDNN_FLOW.map((step, i) => {
            const isActive = i === flowStage;
            const isCompleted = i < flowStage;
            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-3 bg-paper-100 px-2 sm:px-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-heading font-extrabold transition-all border-[4px] ${
                  isActive
                    ? "border-signal-200 bg-signal-100 text-signal-600 shadow-[0_4px_12px_rgba(99,102,241,0.2)] scale-110"
                    : isCompleted
                    ? "border-transparent bg-signal-100 text-signal-500"
                    : "border-transparent bg-paper-50 text-text-secondary/60"
                }`}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : (i + 1)}
                </div>
                <span className={`text-xs uppercase tracking-widest font-bold hidden md:block transition-colors mt-1 ${
                  isActive ? 'text-signal-600' : isCompleted ? 'text-text-primary' : 'text-text-secondary/60'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* ── LEFT: DISTRICT SELECTOR ── */}
        <div className="xl:col-span-3 h-[900px]">
          <div className="bg-paper-100 border border-line rounded-3xl flex flex-col overflow-hidden shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)] hover:-translate-y-1 transition-all duration-300 relative h-full">
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
                  className="w-full bg-paper-100 border border-line rounded-full pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500 shadow-sm transition-shadow"
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
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{title}</span>
                        <span className="text-[10px] font-bold text-text-secondary bg-paper-50 px-2 rounded-full border border-line/50">{list.length}</span>
                      </div>
                      <div className="flex flex-col px-2 gap-1.5">
                        {list.map((dist: any, idx: number) => {
                          const isSelected = selectedDistrictId === dist.district_id;
                          const color = RISK_ACCENT[dist.risk_level] || RISK_ACCENT.Safe;
                          const isLow = dist.risk_level === "Low" || dist.risk_level === "Safe";
                          return (
                            <div 
                              key={dist.district_id} 
                              onClick={() => setSelectedDistrictId(dist.district_id)}
                              className={`grid grid-cols-[16px_1fr_auto] items-center gap-3 p-3 mx-2 rounded-[12px] cursor-pointer transition-all border ${
                                isSelected 
                                  ? 'bg-signal-50 border-[rgba(99,102,241,0.2)] shadow-sm' 
                                  : 'border-transparent hover:bg-signal-50/50'
                              }`}
                            >
                              <div className="w-2.5 h-2.5 rounded-full shadow-sm justify-self-center" style={{ backgroundColor: color }} />
                                <span className={`font-bold text-base truncate ${isSelected ? 'text-signal-700' : 'text-text-primary'}`}>{dist.district}</span>
                              <span className={`risk-badge !px-4 !py-1.5 !text-[11px] !rounded-full font-bold ${isLow ? '!bg-[#ECFDF5] !text-[#059669]' : RISK_LEVELS[dist.risk_level]}`}>{dist.risk_level}</span>
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
                className="bg-paper-100 rounded-[32px] p-8 relative overflow-hidden border border-line flex flex-col shadow-[0_12px_32px_rgba(99,102,241,0.08)] hover:shadow-[0_20px_48px_rgba(99,102,241,0.15)] hover:-translate-y-1 transition-all duration-300"
                style={{ 
                  background: `linear-gradient(135deg, var(--paper-100) 0%, color-mix(in srgb, ${riskAccent} 10%, transparent) 100%)`,
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
                    <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-text-primary">
                      <Target className="w-4 h-4 text-signal-500" /> GDNN Risk Assessment
                    </h2>
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-widest bg-paper-50 px-3 py-1 rounded-md border border-line shadow-sm">
                      Cycle #{d?.inference_cycle || 1}
                    </span>
                  </div>

                  {/* District name + big risk badge */}
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10 flex-wrap">
                    <div className="flex-1 min-w-0 pr-4">
                      <p className="text-xs text-text-secondary uppercase tracking-widest font-bold mb-2">Target District</p>
                      <h3 className="text-4xl lg:text-5xl font-black text-text-primary leading-tight tracking-tight break-words">{d.district}</h3>
                    </div>
                    <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">Risk Level</p>
                      {/* Big prominent badge */}
                      <div
                        className={`risk-badge text-sm px-5 py-2 rounded-full font-heading font-bold tracking-widest shadow-sm ${d.risk_level === "Low" || d.risk_level === "Safe" ? "!bg-[#ECFDF5] !text-[#059669]" : RISK_LEVELS[d.risk_level] || RISK_LEVELS.Safe}`}
                      >
                        {d.risk_level.toUpperCase()}
                      </div>
                      <span className="text-3xl font-black tabular-nums tracking-tight mt-1" style={{ color: riskAccent }}>
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
                  <div className="p-4 bg-signal-50 rounded-[16px] border border-signal-100/50 text-sm text-text-primary leading-relaxed mt-auto flex gap-3 shadow-[0_2px_8px_rgba(99,102,241,0.04)]">
                    <div className="shrink-0 mt-0.5"><Zap className="w-4 h-4 text-signal-500" /></div>
                    <div>
                      <span className="font-bold text-signal-600 mr-1">Reasoning:</span>
                      {d.reasoning_chain?.[0] || `Rainfall (${d.rainfall_24h || 0}mm) and river discharge drive risk.`}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-paper-100 border border-line rounded-2xl p-6 h-64 flex items-center justify-center text-text-secondary text-sm shadow-sm">
                Select a district…
              </div>
            )}

            {/* ══ SHAP Feature Attribution ════════════════════════════════════════ */}
            <div className="bg-paper-100 border border-line rounded-3xl p-8 flex flex-col hover:-translate-y-1 transition-all duration-300 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)]">
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-text-primary">
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
                          <span className="text-sm font-bold text-text-secondary w-36 shrink-0 truncate group-hover:text-text-primary transition-colors">{formatName(entry.feature || (entry as any).label)}</span>
                          <div className="flex-1 h-4 bg-paper-50 rounded-full overflow-hidden relative shadow-inner border border-line/50">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out absolute left-0 top-0 shadow-sm"
                              style={{ 
                                width: `${pctLabel}%`, 
                                background: isPositive ? 'linear-gradient(90deg, #F43F5E, #FB923C)' : 'linear-gradient(90deg, #10B981, #2DD4BF)'
                              }}
                            />
                          </div>
                          <span className="text-sm font-bold tabular-nums w-12 text-right" style={{ color: barColor }}>
                            {pctLabel.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-auto pt-6">
                    <div className="bg-signal-50/50 rounded-2xl p-4 border border-signal-100/50 flex flex-col gap-2 mb-4">
                      <p className="text-sm text-text-primary font-semibold">Rainfall and river level are the dominant risk drivers this cycle.</p>
                      <div className="flex items-center gap-4 text-xs text-text-secondary">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 shadow-sm"></span> Positive driver</div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-sm"></span> Mitigating factor</div>
                      </div>
                    </div>
                    <div className="border-t border-line/60 pt-4 flex items-center justify-between text-xs text-text-secondary font-bold">
                      <span>Top 5 drivers shown</span>
                      <button className="text-signal-600 font-extrabold hover:underline flex items-center gap-1 transition-all hover:translate-x-1">
                        View all features <ChevronRight className="w-4 h-4"/>
                      </button>
                    </div>
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
          <div className="bg-paper-100 border border-line rounded-3xl hover:-translate-y-1 transition-all duration-300 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)] flex flex-col overflow-hidden">
            <button
              onClick={() => setShowTemporal(!showTemporal)}
              className="w-full flex items-center justify-between p-8 focus:outline-none hover:bg-paper-50 transition-colors group shrink-0"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-text-primary group-hover:text-signal-600 transition-colors">
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
                  <div className="flex-1 h-full flex flex-col items-center justify-center text-text-secondary text-sm gap-3">
                    <div className="w-12 h-12 rounded-full bg-paper-50 flex items-center justify-center">
                      <BarChart2 className="w-5 h-5 text-text-secondary/50" />
                    </div>
                    <p className="font-semibold text-text-secondary/70">No temporal projection data available</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ══ Collapsible Logs ════════════════════════════════════════════ */}
          <div className="bg-paper-100 border border-line rounded-3xl hover:-translate-y-1 transition-all duration-300 shadow-[0_8px_24px_rgba(99,102,241,0.06)] hover:shadow-[0_12px_32px_rgba(99,102,241,0.12)] flex flex-col overflow-hidden">
            <button
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between p-8 focus:outline-none hover:bg-paper-50 transition-colors group shrink-0"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-text-secondary group-hover:text-text-primary transition-colors">
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
                        <span className="shrink-0 text-text-secondary/60 font-mono text-xs mt-[3px]">[{log.ts}]</span>
                        <span className={`font-mono text-sm leading-relaxed ${isError ? 'text-risk-severe font-bold' : isWarn ? 'text-risk-moderate font-bold' : 'text-text-primary'}`}>{log.message}</span>
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
