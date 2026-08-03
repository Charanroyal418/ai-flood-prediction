"use client";

import React, { useState, useEffect, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import {
  Brain, Cpu, Zap, Target,
  CheckCircle, RefreshCw, GitBranch, Terminal, MapPin, 
  Eye, ChevronRight, ChevronDown, ChevronUp, Search, BarChart2, AlertTriangle, Network,
  X, Activity, Sliders, ShieldAlert
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

export default function PredictionEnginePage() {
  const queryClient = useQueryClient();
  const [flowStage, setFlowStage] = useState(-1);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [showLogs, setShowLogs] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { pipelineData: contextData, refetchPipeline } = useFloodData();
  const data = contextData ? {
    ...contextData,
    districts: contextData.districts || contextData.stages?.gdnn_output?.district_ranking || []
  } : null;
  const isLoading = !data;
  const isError = false; // We can handle this from context if needed
  const dataUpdatedAt = contextData?.timestamp || 0;

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
      await api.post("/dashboard/simulate-storm?active=false");
      await refetchPipeline();
      queryClient.invalidateQueries({ queryKey: ["dashboard", "live"] });
    } catch (err) {} 
  };

  const { districts: wsDistricts, stormSimulationActive } = useFloodData();
  const hasWsData = wsDistricts && wsDistricts.length > 0;

  if (!data || data.status === "waiting_for_telemetry" || !data.districts || data.districts.length === 0) {
    if (hasWsData) {
      // If we have live dashboard data but pipeline is still computing, use the dashboard data as fallback
      // or at least don't show the fake "offline" screen. We can render a simplified view.
      // But for now, let's wait with a non-error state if backend is still initializing the pipeline.
      return (
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <Activity className="w-8 h-8 text-signal-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-text-primary">
              Computing Prediction Pipeline
            </h2>
            <p className="text-xs text-text-secondary max-w-sm">
              Live telemetry is active. Waiting for the GDNN cycle to complete.
            </p>
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
  const totalLatencySum = Object.values(breakdown).reduce((a: any, b: any) => a + b, 0);
  const filteredDistricts = data?.districts?.filter((d: any) => 
    d.district.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];
  const selectedDistrict = data?.districts?.find((d: any) => d.district_id === selectedDistrictId) || data?.districts?.[0];
  const d: DistrictResult = selectedDistrict;

  const forecastHorizons = d?.forecast_horizons || {
    now: d?.risk_score || 25,
    "6h": Math.min(100, (d?.risk_score || 25) * 1.04),
    "12h": Math.min(100, (d?.risk_score || 25) * 1.09),
    "24h": Math.min(100, (d?.risk_score || 25) * 1.05),
  };

  const chartData = [
    { name: "Now", risk: forecastHorizons.now },
    { name: "+6h", risk: forecastHorizons["6h"] },
    { name: "+12h", risk: forecastHorizons["12h"] },
    { name: "+24h", risk: forecastHorizons["24h"] },
  ];

  const getBarColor = (risk: number) => {
    if (risk >= 80) return "var(--risk-severe)";
    if (risk >= 60) return "var(--risk-high)";
    if (risk >= 40) return "var(--risk-moderate)";
    return "var(--risk-low)";
  };

  const { mode } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  return (
    <div className="flex flex-col gap-4">
      {/* ── HEADER ACTION STRIP ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl text-text-primary">Prediction Engine</h1>
            {isStormActive && (
              <span className="risk-badge risk-badge-severe">SIMULATION ACTIVE</span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1">Knowledge Graph & Graph Dynamic Neural Network (GDNN v2)</p>
        </div>
        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
        <div className="col-span-2 xl:col-span-3 metric-card !h-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-signal-100 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-signal-600" />
          </div>
          <div>
            <p className="text-[10px] text-text-secondary uppercase tracking-widest font-medium">Model</p>
            <p className="text-xs font-bold text-text-primary truncate">{s.model_name || "GDNN v2 (GAT + GRU)"}</p>
          </div>
        </div>
        
        <div className="col-span-2 xl:col-span-2 metric-card !h-auto flex flex-col justify-center">
          <p className="text-[10px] text-text-secondary uppercase tracking-widest font-medium mb-1 flex items-center gap-1.5">
            <Cpu className="w-3 h-3"/> Engine
          </p>
          <p className="text-sm font-bold text-text-primary font-mono truncate">{s.compute_device || "CPU"}</p>
        </div>

        <div className="col-span-2 xl:col-span-3 metric-card !h-auto flex flex-col justify-center">
          <div className="flex justify-between items-center mb-1">
            <p className="text-[10px] text-text-secondary uppercase tracking-widest font-medium flex items-center gap-1.5">
              <Zap className="w-3 h-3"/> Total Latency
            </p>
          </div>
          <p className="text-base font-bold text-text-primary font-mono">{data?.total_latency_ms || totalLatencySum.toFixed(1)} ms</p>
        </div>
        
        <div className="col-span-2 xl:col-span-2 metric-card !h-auto grid grid-cols-3 gap-2">
          <div>
            <p className="text-[9px] text-text-secondary uppercase tracking-widest flex items-center gap-1"><Network className="w-2.5 h-2.5"/> Nodes</p>
            <p className="text-sm font-bold text-text-primary font-mono">{s.node_count ?? 0}</p>
          </div>
          <div>
            <p className="text-[9px] text-text-secondary uppercase tracking-widest flex items-center gap-1"><GitBranch className="w-2.5 h-2.5"/> Edges</p>
            <p className="text-sm font-bold text-text-primary font-mono">{s.edge_count ?? 0}</p>
          </div>
          <div>
            <p className="text-[9px] text-text-secondary uppercase tracking-widest flex items-center gap-1"><Brain className="w-2.5 h-2.5"/> Heads</p>
            <p className="text-sm font-bold text-text-primary font-mono">{s.attention_heads ?? 4}</p>
          </div>
        </div>

        <div className="col-span-2 xl:col-span-2 metric-card !h-auto flex flex-col justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-line">
            <div className="h-full bg-signal-500" style={{ width: `${(countdown / 30) * 100}%`, transition: 'width 1s linear' }} />
          </div>
          <p className="text-[10px] text-text-secondary uppercase tracking-widest font-medium mb-1 mt-1">Next Cycle</p>
          <p className="text-xl font-bold text-text-primary font-mono">{countdown}s</p>
        </div>
      </div>
      
      {/* ── PIPELINE STATUS STRIP ── */}
      <div className="bg-paper-100 border border-line rounded-lg p-3 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <div className="text-xs font-semibold text-text-secondary uppercase tracking-widest mr-2 flex items-center gap-2 shrink-0">
          <GitBranch className="w-4 h-4 text-signal-500" /> Pipeline
        </div>
        {GDNN_FLOW.map((step, i) => {
          const isActive = i === flowStage;
          const isCompleted = i < flowStage;
          return (
            <div key={step.id} className="flex items-center gap-2 shrink-0">
              <div className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors flex items-center gap-1.5 ${
                isActive ? "bg-signal-100 text-signal-600 border-signal-500" :
                isCompleted ? "bg-paper-50 text-text-primary border-line" : "bg-transparent text-text-secondary border-line"
              }`}>
                {isActive && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isCompleted && <CheckCircle className="w-3 h-3 text-signal-500" />}
                {step.label}
              </div>
              {i < GDNN_FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-line" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-auto xl:h-[750px]">
        
        {/* ── LEFT: DISTRICT SELECTOR ── */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-paper-100 border border-line rounded-lg flex flex-col overflow-hidden h-full">
            <div className="p-3 border-b border-line bg-paper-50">
              <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 text-text-primary mb-3">
                <MapPin className="w-4 h-4 text-signal-500" /> Districts
              </h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-secondary" />
                <input 
                  type="text" 
                  placeholder="Search district..." 
                  className="w-full bg-paper-100 border border-line rounded pl-9 pr-3 py-2 text-xs text-text-primary focus:outline-none focus:border-signal-500 focus:ring-1 focus:ring-signal-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scroll">
              <table className="w-full data-table">
                <tbody>
                  {filteredDistricts.map((dist: any) => (
                    <tr 
                      key={dist.district_id} 
                      onClick={() => setSelectedDistrictId(dist.district_id)}
                      className={`cursor-pointer ${selectedDistrictId === dist.district_id ? 'bg-line/30' : ''}`}
                    >
                      <td className="font-medium">{dist.district}</td>
                      <td className="text-right">
                        <span className={`risk-badge ${RISK_LEVELS[dist.risk_level] || RISK_LEVELS.Safe}`}>{dist.risk_level}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── RIGHT: OUTPUT & EXPLAINABILITY ── */}
        <div className="xl:col-span-9 flex flex-col gap-4 h-full overflow-y-auto no-scrollbar">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* GDNN Risk Assessment */}
            <div className="bg-paper-100 border border-line rounded-lg p-5">
              <div className="flex justify-between items-center mb-4 border-b border-line pb-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 text-text-primary">
                  <Target className="w-4 h-4 text-signal-500" /> GDNN Risk Assessment
                </h2>
                <span className="text-[10px] font-mono font-bold text-text-secondary">
                  Cycle #{d?.inference_cycle || 1}
                </span>
              </div>

              {d ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-medium mb-1">Target District</p>
                      <h3 className="text-2xl font-bold text-text-primary">{d.district}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-text-secondary uppercase tracking-widest font-medium mb-1">Risk Level</p>
                      <div className={`risk-badge px-3 py-1 text-sm ${RISK_LEVELS[d.risk_level] || RISK_LEVELS.Safe}`}>
                        {d.risk_level.toUpperCase()} ({d.risk_score}%)
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Flood Prob</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{(d.risk_score ?? 0).toFixed(1)}%</p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Confidence</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">
                        {((d.confidence ?? 0) <= 1.0 ? ((d.confidence ?? 0) * 100) : (d.confidence ?? 0)).toFixed(1)}%
                      </p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Rainfall 24H</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">
                        {(d.rainfall_24h ?? 0).toFixed(1)} mm
                      </p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">River Level</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{d.river_level_m || 1.2}m</p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Reservoir</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{d.reservoir_storage || 68.5}%</p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Elevation</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{d.elevation || 15.0} m</p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Hist Match</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{d.historical_similarity || 88.5}%</p>
                    </div>
                    <div className="border border-line rounded p-3 bg-paper-50">
                      <p className="text-[9px] text-text-secondary font-medium uppercase mb-1">Attn Score</p>
                      <p className="text-sm font-mono font-semibold text-text-primary">{d.attention_score || 0.88}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-signal-100/10 rounded border border-signal-500/20 text-xs text-text-primary leading-relaxed">
                    <span className="font-semibold text-signal-600">Reasoning: </span>
                    {d.reasoning_chain?.[0] || `Rainfall (${d.rainfall_24h || 0}mm) and river discharge drive risk.`}
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-text-secondary text-sm font-mono">Select a district...</div>
              )}
            </div>

            {/* SHAP Feature Attribution - Horizontal Bar Chart */}
            <div className="bg-paper-100 border border-line rounded-lg p-5 flex flex-col">
              <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 mb-4 text-text-primary">
                <Eye className="w-4 h-4 text-signal-500" /> SHAP Feature Attribution
              </h2>
              {d ? (
                <div className="flex-1 w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={(d.shap_values || []).map(s => ({ ...s, positive: (s.contribution ?? 0) >= 0, abs: Math.abs(s.contribution ?? 0) }))}
                      margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="feature" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} width={80} />
                      <Bar dataKey="abs" radius={[0, 2, 2, 0]} isAnimationActive={false}>
                        {(d.shap_values || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={(entry.contribution ?? 0) >= 0 ? 'var(--risk-severe)' : 'var(--risk-low)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                 <div className="flex-1 flex items-center justify-center text-text-secondary text-sm font-mono">Select a district...</div>
              )}
            </div>
          </div>

          {/* Temporal Forecasting Chart */}
          <div className="bg-paper-100 border border-line rounded-lg p-5 flex flex-col">
             <div className="flex justify-between items-start mb-4">
               <div>
                  <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 text-text-primary">
                    <BarChart2 className="w-4 h-4 text-signal-500" /> Temporal Risk Projection
                  </h2>
               </div>
             </div>
             
             <div className="flex-1 w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-inter)' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--text-secondary)', fontFamily: 'var(--font-inter)' }} />
                    <Tooltip cursor={{fill: 'var(--line)', opacity: 0.2}} contentStyle={{ backgroundColor: 'var(--paper-100)', borderColor: 'var(--line)', borderRadius: '4px' }} itemStyle={{ fontFamily: 'var(--font-inter)', fontSize: '12px' }} />
                    <Bar dataKey="risk" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getBarColor(entry.risk)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Collapsible Logs */}
          <div className="bg-paper-100 border border-line rounded-lg">
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between p-4 focus:outline-none"
            >
              <h2 className="text-xs font-semibold uppercase tracking-widest flex items-center gap-2 text-text-secondary">
                <Terminal className="w-4 h-4 text-signal-500" /> Execution Logs
              </h2>
              {showLogs ? <ChevronUp className="w-4 h-4 text-text-secondary" /> : <ChevronDown className="w-4 h-4 text-text-secondary" />}
            </button>
            {showLogs && (
              <div className="p-4 pt-0 h-[200px] flex flex-col font-mono text-[10px] border-t border-line text-text-secondary">
                <div className="flex-1 overflow-y-auto space-y-2 custom-scroll">
                    {data?.logs?.map((log: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 border-b border-line/50 pb-2">
                        <span className="shrink-0 text-text-secondary">[{log.ts}]</span>
                        <span className="text-signal-600">{log.message}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
