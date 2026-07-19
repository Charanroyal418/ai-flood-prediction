"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CloudRain, Waves, Database, Filter, Network, Brain, Cpu,
  BarChart3, AlertTriangle, Activity, CheckCircle, Shield,
  ArrowDown, ArrowUp, Clock, RefreshCw, Zap, Eye, X,
  ChevronRight, Play, Layers, GitBranch, TrendingUp,
  TrendingDown, Server, Wifi, HardDrive, Timer,
  Droplets, Mountain, Gauge, Radio, MapPin,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageData {
  status: string;
  execution_ms: number;
  [key: string]: any;
}

interface InferenceCycle {
  cycle_id: number;
  timestamp: string;
  total_latency_ms: number;
  stages: Record<string, StageData>;
  model_status: {
    model_name: string;
    model_version: string;
    architecture: string;
    training_date: string;
    dataset_version: string;
    inference_mode: string;
    model_loaded: boolean;
    compute_device: string;
    total_inference_count: number;
    current_cycle_id: number;
    last_inference: string;
    pipeline_latency_ms: number;
    gnn_latency_ms: number;
    backend_status: string;
    database_status: string;
  };
  logs: { ts: string; message: string }[];
}

interface DistrictResult {
  district_id: number;
  district: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  inference_mode: string;
}

// ── Pipeline Stage Config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { key: "weather_ingestion", title: "Open-Meteo API", icon: CloudRain, color: "from-sky-400 to-blue-500", bg: "bg-sky-50", border: "border-sky-200", text: "text-sky-700" },
  { key: "river_telemetry", title: "River Telemetry", icon: Waves, color: "from-blue-400 to-indigo-500", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
  { key: "reservoir_intelligence", title: "Reservoir Intel", icon: Droplets, color: "from-cyan-400 to-teal-500", bg: "bg-cyan-50", border: "border-cyan-200", text: "text-cyan-700" },
  { key: "terrain_processing", title: "Terrain DEM", icon: Mountain, color: "from-emerald-400 to-green-500", bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700" },
  { key: "feature_engineering", title: "Feature Engine", icon: Filter, color: "from-amber-400 to-orange-500", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700" },
  { key: "kg_construction", title: "Knowledge Graph", icon: Network, color: "from-violet-400 to-purple-500", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  { key: "node_embedding", title: "Node Embedding", icon: Brain, color: "from-purple-400 to-fuchsia-500", bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-700" },
  { key: "gat_attention", title: "GAT Attention", icon: Eye, color: "from-fuchsia-400 to-pink-500", bg: "bg-fuchsia-50", border: "border-fuchsia-200", text: "text-fuchsia-700" },
  { key: "temporal_encoder", title: "Temporal GRU", icon: Timer, color: "from-pink-400 to-rose-500", bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700" },
  { key: "gdnn_output", title: "GDNN Output", icon: Zap, color: "from-rose-400 to-red-500", bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700" },
  { key: "shap_explainability", title: "SHAP Explain", icon: BarChart3, color: "from-indigo-400 to-violet-500", bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-700" },
];

// ── GDNN Flow Stages ─────────────────────────────────────────────────────────

const GDNN_FLOW = [
  { label: "Graph Input", shape: null, key: "feature_engineering" },
  { label: "Node Embeddings", shape: null, key: "node_embedding" },
  { label: "Temporal Encoder (GRU)", shape: null, key: "temporal_encoder" },
  { label: "Graph Attention (GAT)", shape: null, key: "gat_attention" },
  { label: "Spatial Aggregation", shape: null, key: "gat_attention" },
  { label: "Temporal Aggregation", shape: null, key: "temporal_encoder" },
  { label: "Global Pooling", shape: null, key: "gdnn_output" },
  { label: "Classification Head", shape: null, key: "gdnn_output" },
  { label: "Flood Probability", shape: null, key: "gdnn_output" },
  { label: "Uncertainty Estimation", shape: null, key: "gdnn_output" },
  { label: "Explainability (SHAP)", shape: null, key: "shap_explainability" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function riskBadge(level: string) {
  const map: Record<string, string> = {
    Severe: "bg-red-100 text-red-700 border-red-200",
    High: "bg-orange-100 text-orange-700 border-orange-200",
    Moderate: "bg-amber-100 text-amber-700 border-amber-200",
    Low: "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Very Low": "bg-sky-100 text-sky-700 border-sky-200",
  };
  return map[level] || "bg-slate-100 text-slate-600 border-slate-200";
}

function MetricBox({ label, value, mono = true }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="bg-white/60 rounded-xl border border-slate-100 p-2.5 text-center">
      <p className={`text-[13px] font-bold text-slate-800 ${mono ? "font-mono" : "font-heading"}`}>
        {value ?? <span className="text-slate-300 text-[10px]">Waiting for telemetry...</span>}
      </p>
      <p className="text-[8px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function GDNNInferenceEngine() {
  const [animatingStage, setAnimatingStage] = useState(-1);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictResult | null>(null);
  const [showLogs, setShowLogs] = useState(true);
  const [countdown, setCountdown] = useState(30);
  const logRef = useRef<HTMLDivElement>(null);

  // Fetch inference cycle
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<InferenceCycle>({
    queryKey: ["inference-cycle"],
    queryFn: async () => {
      const res = await api.get("/predict/inference-cycle");
      return res.data;
    },
    refetchInterval: 30000,
    staleTime: 25000,
    retry: 2,
    retryDelay: 3000,
  });

  // Countdown timer
  useEffect(() => {
    if (!dataUpdatedAt) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - dataUpdatedAt) / 1000);
      setCountdown(Math.max(0, 30 - elapsed));
    }, 1000);
    return () => clearInterval(interval);
  }, [dataUpdatedAt]);

  // Stage animation sequence
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const animate = async () => {
      for (let i = 0; i < PIPELINE_STAGES.length; i++) {
        if (cancelled) break;
        setAnimatingStage(i);
        const stageData = data.stages[PIPELINE_STAGES[i].key];
        const delay = stageData ? Math.min(400, Math.max(120, stageData.execution_ms / 3)) : 200;
        await new Promise((r) => setTimeout(r, delay));
      }
      if (!cancelled) setAnimatingStage(PIPELINE_STAGES.length);
    };
    animate();
    return () => { cancelled = true; };
  }, [data]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [data?.logs]);

  const stages = data?.stages || {};
  const modelStatus = data?.model_status;
  const gdnnOutput = stages.gdnn_output;
  const shapData = stages.shap_explainability;
  const districtRanking: DistrictResult[] = gdnnOutput?.district_ranking || [];

  // Get SHAP for selected district
  const getDistrictShap = useCallback(
    (districtId: number) => {
      if (!shapData?.district_shap) return [];
      return shapData.district_shap[districtId] || [];
    },
    [shapData]
  );

  // ── Stage metric extraction ─────────────────────────────────────────────

  function getStageSummary(key: string): string {
    const s = stages[key];
    if (!s) return "Waiting for telemetry...";
    switch (key) {
      case "weather_ingestion":
        return `${s.stations_count} stations · ${s.api_latency_ms}ms API · ${s.aggregates?.total_rainfall_mm ?? 0}mm total`;
      case "river_telemetry":
        return `${s.sensor_count} rivers · ${s.critical_rivers?.length ?? 0} critical`;
      case "reservoir_intelligence":
        return `${s.reservoir_count} dams · ${s.reservoirs?.filter((r: any) => r.spillway_status === "ACTIVE").length ?? 0} spillways active`;
      case "terrain_processing":
        return `${s.tiles_processed} DEM tiles · ${s.elevation_range?.min_m ?? 0}–${s.elevation_range?.max_m ?? 0}m`;
      case "feature_engineering":
        return `Tensor [${s.tensor_shape?.join(", ") ?? "?"}] · ${s.feature_count ?? 0} features`;
      case "kg_construction":
        return `${s.total_nodes ?? 0} nodes · ${s.total_edges ?? 0} edges · ρ=${s.density ?? 0}`;
      case "node_embedding":
        return `dim=${s.embedding_dim ?? 0} · adj=[2, ${s.adjacency_shape?.[1] ?? 0}] · ${s.compute_device ?? "cpu"}`;
      case "gat_attention":
        return `${s.attention_stats?.num_heads ?? 0} heads · sparsity=${s.attention_stats?.sparsity ?? 0}%`;
      case "temporal_encoder":
        return `GRU h=${s.hidden_state_size ?? 0} · seq=${s.sequence_length ?? 0}`;
      case "gdnn_output":
        return `Prob=${s.statewide_flood_probability ?? 0}% · σ=${s.prediction_uncertainty ?? 0}`;
      case "shap_explainability":
        return `${s.global_shap?.length ?? 0} features · top: ${s.global_shap?.[0]?.feature ?? "—"}`;
      default:
        return "";
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-5 pb-20 min-h-screen">
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-800 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-200">
              <Zap className="w-5 h-5 text-white" />
            </div>
            GDNN Inference Engine
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live execution of Graph Dynamic Neural Network · Cycle #{data?.cycle_id ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Next inference countdown */}
          <div className="flex items-center gap-1.5 px-3 py-2 bg-white/80 backdrop-blur border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Next: {countdown}s
          </div>
          {/* Status indicator */}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold ${
            isLoading ? "bg-indigo-50 border-indigo-200 text-indigo-700" :
            isError ? "bg-red-50 border-red-200 text-red-700" :
            "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isLoading ? "bg-indigo-500 animate-pulse" :
              isError ? "bg-red-500" :
              "bg-emerald-500"
            }`} />
            {isLoading ? "INFERENCE RUNNING..." : isError ? "BACKEND UNAVAILABLE" : "INFERENCE COMPLETE"}
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-violet-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Force Cycle
          </button>
        </div>
      </div>

      {/* ── PIPELINE EXECUTION STRIP ──────────────────────────────────── */}
      <div className="glass-card p-4 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-max">
          {PIPELINE_STAGES.map((stage, idx) => {
            const stageData = stages[stage.key];
            const isActive = animatingStage === idx;
            const isCompleted = animatingStage > idx;
            const isPending = animatingStage < idx;

            return (
              <div key={stage.key} className="flex items-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.04, type: "spring", stiffness: 300 }}
                  className={`relative rounded-2xl border p-3 min-w-[140px] max-w-[160px] transition-all duration-300 ${
                    isActive
                      ? `${stage.bg} ${stage.border} shadow-lg ring-2 ring-offset-1 ring-violet-300`
                      : isCompleted
                      ? `bg-white/80 border-emerald-200 shadow-sm`
                      : `bg-white/40 border-slate-100 opacity-50`
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        isActive
                          ? `bg-gradient-to-br ${stage.color} shadow-sm`
                          : isCompleted
                          ? "bg-emerald-500"
                          : "bg-slate-200"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : isActive ? (
                        <stage.icon className="w-4 h-4 text-white animate-pulse" />
                      ) : (
                        <stage.icon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[10px] font-bold truncate ${isActive ? stage.text : isCompleted ? "text-emerald-700" : "text-slate-400"}`}>
                        {stage.title}
                      </p>
                    </div>
                  </div>
                  {isCompleted && stageData ? (
                    <p className="text-[8px] font-mono text-slate-500 leading-tight truncate">
                      {stageData.execution_ms}ms
                    </p>
                  ) : isActive ? (
                    <p className="text-[8px] font-mono text-violet-500 animate-pulse">Processing...</p>
                  ) : (
                    <p className="text-[8px] font-mono text-slate-300">Waiting...</p>
                  )}
                </motion.div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <div className="flex items-center px-0.5">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: isCompleted ? 1 : 0 }}
                      className="w-4 h-0.5 bg-gradient-to-r from-emerald-400 to-emerald-300 origin-left"
                    />
                    <ChevronRight className={`w-3 h-3 ${isCompleted ? "text-emerald-400" : "text-slate-200"}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── MAIN CONTENT GRID ─────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-5">

        {/* ════════ LEFT: GDNN FLOW + STAGE DETAILS ════════ */}
        <div className="col-span-12 lg:col-span-4 space-y-4">

          {/* GDNN Execution Flow */}
          <div className="glass-card p-4">
            <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
              <GitBranch className="w-3.5 h-3.5 text-violet-500" /> GDNN Execution Flow
            </h2>
            <div className="space-y-0">
              {GDNN_FLOW.map((step, idx) => {
                const stageData = stages[step.key];
                const done = stageData?.status === "completed";
                const isRunning = animatingStage >= 0 && PIPELINE_STAGES.findIndex(s => s.key === step.key) === animatingStage;
                return (
                  <div key={idx}>
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg transition-all ${
                        isRunning ? "bg-violet-50 border border-violet-200" : done ? "bg-white/60" : "opacity-40"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${
                        done ? "bg-emerald-100 text-emerald-600" :
                        isRunning ? "bg-violet-500 text-white animate-pulse" :
                        "bg-slate-100 text-slate-400"
                      }`}>
                        {done ? "✓" : idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] font-semibold truncate ${isRunning ? "text-violet-700" : done ? "text-slate-700" : "text-slate-400"}`}>
                          {step.label}
                        </p>
                      </div>
                      {done && stageData && (
                        <span className="text-[8px] font-mono text-slate-400">{stageData.execution_ms}ms</span>
                      )}
                    </motion.div>
                    {idx < GDNN_FLOW.length - 1 && (
                      <div className="flex items-center ml-4">
                        <div className={`w-0.5 h-2 ${done ? "bg-emerald-300" : "bg-slate-100"}`} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* KG Construction Stats */}
          {stages.kg_construction && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                <Network className="w-3.5 h-3.5 text-purple-500" /> Knowledge Graph
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <MetricBox label="Nodes" value={stages.kg_construction.total_nodes} />
                <MetricBox label="Edges" value={stages.kg_construction.total_edges} />
                <MetricBox label="Density" value={stages.kg_construction.density} />
                <MetricBox label="Avg Degree" value={stages.kg_construction.avg_degree} />
                <MetricBox label="Clustering" value={stages.kg_construction.clustering_coefficient} />
                <MetricBox label="Communities" value={stages.kg_construction.community_count} />
              </div>
              {stages.kg_construction.node_type_distribution && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(stages.kg_construction.node_type_distribution).map(([type, count]) => (
                    <span key={type} className="text-[8px] font-mono font-semibold bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md text-slate-500">
                      {type}: {String(count)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* GAT Attention */}
          {stages.gat_attention && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                <Eye className="w-3.5 h-3.5 text-fuchsia-500" /> GAT Attention Weights
              </h2>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <MetricBox label="Heads" value={stages.gat_attention.attention_stats?.num_heads ?? "—"} />
                <MetricBox label="Sparsity" value={`${stages.gat_attention.attention_stats?.sparsity ?? 0}%`} />
                <MetricBox label="Mean α" value={stages.gat_attention.attention_stats?.mean_alpha ?? "—"} />
                <MetricBox label="Max α" value={stages.gat_attention.attention_stats?.max_alpha ?? "—"} />
              </div>
              {stages.gat_attention.top_influential_edges?.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 font-mono">Top Influential Edges</p>
                  <div className="space-y-1">
                    {stages.gat_attention.top_influential_edges.map((e: any, i: number) => (
                      <div key={i} className="flex items-center justify-between bg-white/60 border border-slate-100 rounded-lg px-2.5 py-1.5">
                        <span className="text-[9px] font-semibold text-slate-600 truncate max-w-[120px]">
                          {e.source} → {e.target}
                        </span>
                        <span className="text-[9px] font-bold font-mono text-fuchsia-600">
                          α={e.attention}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════ CENTER: MODEL OUTPUT + SHAP ════════ */}
        <div className="col-span-12 lg:col-span-5 space-y-4">

          {/* Statewide Prediction Card */}
          {gdnnOutput && (
            <div className="glass-card p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-50/30 via-transparent to-indigo-50/20" />
              <div className="relative">
                <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 mb-4">
                  <Shield className="w-3.5 h-3.5 text-violet-500" /> Statewide Flood Assessment
                </h2>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white/70 rounded-2xl border border-slate-100 p-3 text-center">
                    <p className="text-2xl font-heading font-bold text-slate-800">
                      {gdnnOutput.statewide_flood_probability ?? "—"}
                      <span className="text-sm text-slate-400">%</span>
                    </p>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Flood Probability</p>
                  </div>
                  <div className="bg-white/70 rounded-2xl border border-slate-100 p-3 text-center">
                    <p className="text-2xl font-heading font-bold text-slate-800">
                      ±{gdnnOutput.prediction_uncertainty ?? "—"}
                    </p>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Uncertainty (σ)</p>
                  </div>
                  <div className="bg-white/70 rounded-2xl border border-slate-100 p-3 text-center">
                    <p className="text-2xl font-heading font-bold text-slate-800">
                      {gdnnOutput.model_confidence ? (gdnnOutput.model_confidence * 100).toFixed(1) : "—"}
                      <span className="text-sm text-slate-400">%</span>
                    </p>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase mt-0.5">Model Confidence</p>
                  </div>
                </div>

                {/* Risk Distribution */}
                {gdnnOutput.risk_distribution && (
                  <div className="flex items-center gap-1 h-3 rounded-full overflow-hidden mb-4">
                    {[
                      { key: "severe", color: "bg-red-500", label: "Severe" },
                      { key: "high", color: "bg-orange-500", label: "High" },
                      { key: "moderate", color: "bg-amber-400", label: "Moderate" },
                      { key: "low", color: "bg-emerald-400", label: "Low" },
                      { key: "very_low", color: "bg-sky-400", label: "V.Low" },
                    ].map((r) => {
                      const count = gdnnOutput.risk_distribution[r.key] || 0;
                      const total = districtRanking.length || 1;
                      return count > 0 ? (
                        <motion.div
                          key={r.key}
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / total) * 100}%` }}
                          transition={{ duration: 0.6 }}
                          className={`${r.color} h-full relative group cursor-pointer`}
                          title={`${r.label}: ${count}`}
                        />
                      ) : null;
                    })}
                  </div>
                )}

                {/* Highest / Lowest Risk */}
                <div className="grid grid-cols-2 gap-3">
                  {gdnnOutput.highest_risk && (
                    <div className="bg-red-50/60 rounded-xl border border-red-100 p-3 cursor-pointer hover:bg-red-50 transition-colors"
                      onClick={() => setSelectedDistrict(gdnnOutput.highest_risk)}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingUp className="w-3 h-3 text-red-500" />
                        <span className="text-[9px] font-bold text-red-500 uppercase">Highest Risk</span>
                      </div>
                      <p className="text-sm font-heading font-bold text-slate-800">{gdnnOutput.highest_risk.district}</p>
                      <p className="text-[10px] font-mono font-bold text-red-600">{gdnnOutput.highest_risk.risk_score}/100</p>
                    </div>
                  )}
                  {gdnnOutput.lowest_risk && (
                    <div className="bg-emerald-50/60 rounded-xl border border-emerald-100 p-3 cursor-pointer hover:bg-emerald-50 transition-colors"
                      onClick={() => setSelectedDistrict(gdnnOutput.lowest_risk)}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <TrendingDown className="w-3 h-3 text-emerald-500" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase">Lowest Risk</span>
                      </div>
                      <p className="text-sm font-heading font-bold text-slate-800">{gdnnOutput.lowest_risk.district}</p>
                      <p className="text-[10px] font-mono font-bold text-emerald-600">{gdnnOutput.lowest_risk.risk_score}/100</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SHAP Explainability */}
          {shapData && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-amber-500" /> Global SHAP Feature Attribution
              </h2>
              {/* Horizontal bar chart */}
              <div className="space-y-1.5 mb-4">
                {(shapData.global_shap || []).slice(0, 8).map((s: any, i: number) => {
                  const maxVal = Math.max(...(shapData.global_shap || []).map((x: any) => Math.abs(x.mean_contribution_pct)));
                  const width = maxVal > 0 ? (Math.abs(s.mean_contribution_pct) / maxVal) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[9px] font-semibold text-slate-500 w-24 text-right truncate">
                        {s.feature}
                      </span>
                      <div className="flex-1 h-4 bg-slate-50 rounded-full overflow-hidden relative border border-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                          className={`h-full rounded-full ${s.is_positive ? "bg-gradient-to-r from-rose-300 to-red-400" : "bg-gradient-to-r from-emerald-300 to-green-400"}`}
                        />
                      </div>
                      <span className={`text-[9px] font-mono font-bold w-10 text-right ${s.is_positive ? "text-red-500" : "text-emerald-500"}`}>
                        {s.is_positive ? "+" : ""}{s.mean_contribution_pct}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Force Plot */}
              {shapData.force_plot && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-2 font-mono">Force Plot: Baseline → Prediction</p>
                  <div className="bg-white/60 rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center gap-1 text-[9px] font-mono">
                      <span className="font-bold text-slate-600">Base: {shapData.force_plot.baseline}</span>
                      {(shapData.force_plot.features || []).slice(0, 5).map((f: any, i: number) => (
                        <span key={i} className="flex items-center gap-0.5">
                          <ArrowDown className="w-2.5 h-2.5 text-slate-300" />
                          <span className={`font-bold ${f.contribution >= 0 ? "text-red-500" : "text-emerald-500"}`}>
                            {f.contribution >= 0 ? "+" : ""}{f.contribution}
                          </span>
                        </span>
                      ))}
                      <ArrowDown className="w-2.5 h-2.5 text-slate-300" />
                      <span className="font-bold text-violet-600">= {shapData.force_plot.prediction}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* District Ranking Table */}
          {districtRanking.length > 0 && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                <MapPin className="w-3.5 h-3.5 text-blue-500" /> District Risk Ranking
              </h2>
              <div className="max-h-[340px] overflow-y-auto space-y-1 pr-1 no-scrollbar">
                {districtRanking.map((d, i) => (
                  <motion.div
                    key={d.district_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedDistrict(d)}
                    className="flex items-center gap-2.5 bg-white/60 hover:bg-white border border-slate-100 rounded-xl px-3 py-2 cursor-pointer transition-all hover:shadow-sm group"
                  >
                    <span className="text-[9px] font-bold text-slate-400 w-5 text-center font-mono">
                      #{i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 truncate group-hover:text-violet-700 transition-colors">
                        {d.district}
                      </p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${riskBadge(d.risk_level)}`}>
                      {d.risk_level}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-700 w-10 text-right">
                      {d.risk_score}
                    </span>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-violet-400 transition-colors" />
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ════════ RIGHT: STATUS + LOGS + TENSOR INFO ════════ */}
        <div className="col-span-12 lg:col-span-3 space-y-4">

          {/* Model Status */}
          {modelStatus && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                <Server className="w-3.5 h-3.5 text-indigo-500" /> Model Status
              </h2>
              <div className="space-y-2">
                {[
                  { label: "Model", value: modelStatus.model_name, icon: Brain },
                  { label: "Version", value: modelStatus.model_version, icon: Layers },
                  { label: "Inference Mode", value: modelStatus.inference_mode, icon: Cpu },
                  { label: "Compute Device", value: modelStatus.compute_device.toUpperCase(), icon: HardDrive },
                  { label: "Training Date", value: modelStatus.training_date, icon: Clock },
                  { label: "Dataset", value: modelStatus.dataset_version, icon: Database },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <item.icon className="w-3 h-3 text-slate-400" />
                    <span className="text-slate-500 font-medium flex-1">{item.label}</span>
                    <span className="font-mono font-bold text-slate-700 truncate max-w-[100px]">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Status indicators */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-1.5">
                {[
                  { label: "Backend", status: modelStatus.backend_status === "online" },
                  { label: "Database", status: modelStatus.database_status === "connected" },
                  { label: "GNN Model", status: modelStatus.model_loaded },
                  { label: "API", status: true },
                ].map((s, i) => (
                  <div key={i} className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-semibold ${
                    s.status ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${s.status ? "bg-emerald-500" : "bg-red-500"}`} />
                    {s.label}
                  </div>
                ))}
              </div>

              {/* Inference stats */}
              <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2">
                <MetricBox label="Total Inferences" value={modelStatus.total_inference_count} />
                <MetricBox label="Pipeline Latency" value={`${modelStatus.pipeline_latency_ms}ms`} />
                <MetricBox label="GNN Latency" value={`${modelStatus.gnn_latency_ms}ms`} />
                <MetricBox label="Cycle ID" value={`#${modelStatus.current_cycle_id}`} />
              </div>
            </div>
          )}

          {/* Tensor State */}
          {stages.feature_engineering && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2 mb-3">
                <Cpu className="w-3.5 h-3.5 text-amber-500" /> Tensor State
              </h2>
              <div className="space-y-1.5">
                {[
                  { label: "Input [N, T, F]", value: `[${stages.feature_engineering.tensor_shape?.join(", ") ?? "—"}]` },
                  { label: "Adjacency [2, E]", value: `[2, ${stages.node_embedding?.adjacency_shape?.[1] ?? "—"}]` },
                  { label: "Embedding [N, D]", value: `[${stages.feature_engineering?.node_count ?? "—"}, ${stages.node_embedding?.embedding_dim ?? "—"}]` },
                  { label: "GRU Hidden", value: `${stages.temporal_encoder?.hidden_state_size ?? "—"}` },
                  { label: "Attention Heads", value: `${stages.gat_attention?.attention_stats?.num_heads ?? "—"}` },
                  { label: "Output Classes", value: "5" },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-white/60 rounded-lg border border-slate-100">
                    <span className="text-[9px] font-mono text-slate-500">{item.label}</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-600">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Real-Time Logs */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-3">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-500" /> Inference Logs
              </h2>
              <button onClick={() => setShowLogs(!showLogs)} className="text-[9px] text-slate-400 hover:text-slate-600 font-semibold">
                {showLogs ? "Hide" : "Show"}
              </button>
            </div>
            {showLogs && (
              <div ref={logRef} className="max-h-[260px] overflow-y-auto space-y-0.5 no-scrollbar font-mono">
                {data?.logs ? (
                  data.logs.map((log, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex gap-2 py-0.5"
                    >
                      <span className="text-[9px] text-slate-400 font-bold shrink-0">{log.ts}</span>
                      <span className={`text-[9px] ${
                        log.message.includes("error") || log.message.includes("Error")
                          ? "text-red-500"
                          : log.message.includes("Weather") || log.message.includes("Open-Meteo")
                          ? "text-sky-600"
                          : log.message.includes("Knowledge") || log.message.includes("KG")
                          ? "text-purple-600"
                          : log.message.includes("GNN") || log.message.includes("GDNN") || log.message.includes("GAT")
                          ? "text-indigo-600"
                          : log.message.includes("SHAP")
                          ? "text-amber-600"
                          : log.message.includes("complete") || log.message.includes("Complete")
                          ? "text-emerald-600"
                          : "text-slate-600"
                      }`}>
                        {log.message}
                      </span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-[9px] text-slate-400">Waiting for telemetry...</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STAGE DETAIL CARDS (Weather, River, Reservoir) ─────────── */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weather Summary */}
          {stages.weather_ingestion && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                <CloudRain className="w-3.5 h-3.5 text-sky-500" /> Weather Telemetry
              </h2>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <MetricBox label="Total Rain" value={`${stages.weather_ingestion.aggregates?.total_rainfall_mm ?? 0}mm`} />
                <MetricBox label="Avg Temp" value={`${stages.weather_ingestion.aggregates?.avg_temperature_c ?? 0}°C`} />
                <MetricBox label="Avg Humidity" value={`${stages.weather_ingestion.aggregates?.avg_humidity_pct ?? 0}%`} />
              </div>
              {stages.weather_ingestion.top_rainfall?.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mb-1 font-mono">Top Rainfall</p>
                  {stages.weather_ingestion.top_rainfall.slice(0, 3).map((w: any, i: number) => (
                    <div key={i} className="flex justify-between text-[9px] py-0.5">
                      <span className="text-slate-600 font-medium">{w.district}</span>
                      <span className="font-mono font-bold text-sky-600">{w.rainfall_mm}mm</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* River Summary */}
          {stages.river_telemetry && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                <Waves className="w-3.5 h-3.5 text-blue-500" /> River Levels
              </h2>
              <div className="space-y-1.5">
                {(stages.river_telemetry.rivers || []).slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[9px]">
                    <span className="text-slate-600 font-medium flex-1 truncate">{r.river}</span>
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.flow_ratio > 0.8 ? "bg-red-400" : r.flow_ratio > 0.5 ? "bg-amber-400" : "bg-emerald-400"}`}
                        style={{ width: `${Math.min(100, r.flow_ratio * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-700 w-12 text-right">{r.current_level_m}m</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reservoir Summary */}
          {stages.reservoir_intelligence && (
            <div className="glass-card p-4">
              <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 mb-3">
                <Gauge className="w-3.5 h-3.5 text-cyan-500" /> Reservoirs
              </h2>
              <div className="space-y-1.5">
                {(stages.reservoir_intelligence.reservoirs || []).slice(0, 5).map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[9px]">
                    <span className="text-slate-600 font-medium flex-1 truncate">{r.name}</span>
                    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${r.storage_pct > 90 ? "bg-red-400" : r.storage_pct > 70 ? "bg-amber-400" : "bg-cyan-400"}`}
                        style={{ width: `${r.storage_pct}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-700 w-10 text-right">{r.storage_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LATENCY BREAKDOWN BAR ─────────────────────────────────────── */}
      {data && (
        <div className="glass-card p-4">
          <h2 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-1.5 mb-3">
            <Timer className="w-3.5 h-3.5 text-rose-500" /> Latency Breakdown — {data.total_latency_ms}ms total
          </h2>
          <div className="flex items-center gap-0.5 h-6 rounded-lg overflow-hidden">
            {PIPELINE_STAGES.map((stage) => {
              const stageData = stages[stage.key];
              if (!stageData) return null;
              const pct = (stageData.execution_ms / data.total_latency_ms) * 100;
              if (pct < 0.5) return null;
              return (
                <motion.div
                  key={stage.key}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.5 }}
                  className={`h-full bg-gradient-to-r ${stage.color} relative group cursor-pointer`}
                  title={`${stage.title}: ${stageData.execution_ms}ms`}
                >
                  {pct > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[7px] text-white font-bold truncate px-1">
                      {stage.title.split(" ")[0]}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOADING / ERROR STATE ─────────────────────────────────────── */}
      {!data && !isLoading && !isError && (
        <div className="glass-card p-12 text-center">
          <p className="text-slate-400 text-sm">Waiting for telemetry...</p>
        </div>
      )}

      {isLoading && !data && (
        <div className="glass-card p-12 flex flex-col items-center gap-4">
          <div className="w-14 h-14 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-600 font-heading">Executing GDNN Inference Cycle...</p>
          <p className="text-xs text-slate-400">Running full pipeline: Weather → KG → GAT → GRU → SHAP. This may take 10-60s on first load.</p>
        </div>
      )}

      {isError && !data && (
        <div className="glass-card p-12 flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <p className="text-sm font-heading font-bold text-slate-800">Backend Unavailable</p>
          <p className="text-xs text-slate-500 text-center max-w-sm">
            The inference engine could not reach the backend. The Render free-tier server may be waking up from a cold start.
          </p>
          <button onClick={() => refetch()} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold shadow-md">
            <RefreshCw className="w-4 h-4 inline mr-1.5" /> Retry
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* DISTRICT DRILL-DOWN MODAL */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedDistrict && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-end justify-center"
            onClick={() => setSelectedDistrict(null)}
          >
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-white/95 backdrop-blur-xl rounded-t-3xl shadow-2xl p-6 max-h-[70vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-5">
                <div>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-md border ${riskBadge(selectedDistrict.risk_level)}`}>
                    {selectedDistrict.risk_level} Risk
                  </span>
                  <h3 className="text-xl font-heading font-bold text-slate-800 mt-2">{selectedDistrict.district}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">District-level GDNN inference explainability</p>
                </div>
                <button onClick={() => setSelectedDistrict(null)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-5">
                {/* Metrics */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">Prediction Metrics</p>
                  <div className="space-y-2">
                    <MetricBox label="Flood Probability" value={`${selectedDistrict.risk_score}%`} />
                    <MetricBox label="Confidence" value={`${(selectedDistrict.confidence * 100).toFixed(1)}%`} />
                    <MetricBox label="Risk Class" value={selectedDistrict.risk_level} mono={false} />
                    <MetricBox label="Inference Mode" value={selectedDistrict.inference_mode} mono={false} />
                  </div>

                  {/* Class probabilities */}
                  {selectedDistrict.class_probabilities && (
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase font-mono mb-1.5">Class Distribution</p>
                      {Object.entries(selectedDistrict.class_probabilities).map(([cls, prob]) => (
                        <div key={cls} className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] text-slate-500 w-16 text-right">{cls}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${Number(prob) * 100}%` }} />
                          </div>
                          <span className="text-[9px] font-mono font-bold text-slate-600 w-10">{(Number(prob) * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SHAP values for this district */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">SHAP Feature Attribution</p>
                  <div className="space-y-1.5">
                    {getDistrictShap(selectedDistrict.district_id).length > 0 ? (
                      getDistrictShap(selectedDistrict.district_id).map((sv: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sv.color || "#6366f1" }} />
                          <span className="text-[9px] font-semibold text-slate-600 flex-1">{sv.label || sv.feature}</span>
                          <span className="text-[9px] font-mono font-bold text-violet-600">
                            {sv.contribution_pct ? `${sv.contribution_pct}%` : `${(sv.value * 100).toFixed(1)}%`}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[9px] text-slate-400">Waiting for telemetry...</p>
                    )}
                  </div>
                </div>

                {/* Reasoning Chain */}
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">Reasoning Chain</p>
                  <div className="space-y-0">
                    {(() => {
                      // Build reasoning chain from actual SHAP features
                      const shap = getDistrictShap(selectedDistrict.district_id);
                      const chain = shap.length > 0
                        ? shap.slice(0, 5).map((s: any) => ({
                            label: s.label || s.feature || "Unknown",
                            impact: s.contribution_pct ? `+${s.contribution_pct}%` : `${(s.value * 100).toFixed(1)}%`,
                          }))
                        : [
                            { label: "Rainfall Analysis", impact: "→" },
                            { label: "River Level Check", impact: "→" },
                            { label: "Reservoir Status", impact: "→" },
                            { label: "Terrain Vulnerability", impact: "→" },
                          ];
                      chain.push({
                        label: `${selectedDistrict.risk_level} Flood Probability`,
                        impact: `${selectedDistrict.risk_score}%`,
                      });
                      return chain.map((step: any, i: number) => (
                        <div key={i}>
                          <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                              i === chain.length - 1
                                ? "bg-violet-50 border border-violet-200"
                                : "bg-white/60 border border-slate-100"
                            }`}
                          >
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[8px] font-bold ${
                              i === chain.length - 1 ? "bg-violet-500 text-white" : "bg-slate-100 text-slate-500"
                            }`}>
                              {i + 1}
                            </div>
                            <span className={`text-[9px] font-semibold flex-1 ${
                              i === chain.length - 1 ? "text-violet-700" : "text-slate-600"
                            }`}>
                              {step.label}
                            </span>
                            <span className={`text-[9px] font-mono font-bold ${
                              i === chain.length - 1 ? "text-violet-600" : "text-slate-400"
                            }`}>
                              {step.impact}
                            </span>
                          </motion.div>
                          {i < chain.length - 1 && (
                            <div className="flex items-center ml-5">
                              <div className="w-0.5 h-2 bg-slate-200" />
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
