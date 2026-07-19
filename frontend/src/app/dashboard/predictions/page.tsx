"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Brain, Cpu, Clock, Zap, Target, Database,
  Activity, CheckCircle, RefreshCw, GitBranch, Terminal, MapPin, 
  Layers, Filter, Server, Eye, AlertTriangle, Play, Pause, ChevronRight, Droplets
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageData {
  status: string;
  execution_ms: number;
  shape?: string;
  input_size?: string;
  output_size?: string;
  start_time?: string;
}

interface DistrictResult {
  district_id: number;
  district: string;
  risk_score: number;
  risk_level: string;
  confidence: number;
  rainfall_24h: number;
  river_influence: number;
  reservoir_storage: number;
  topology_influence: number;
  attention_score: number;
  inference_time_ms: number;
  shap_values: { feature: string; contribution: number }[];
  reasoning_chain: string[];
}

interface InferenceCycle {
  status?: string;
  cycle_id: number;
  timestamp: string;
  total_latency_ms: number;
  stages: Record<string, StageData>;
  districts: DistrictResult[];
  metrics: Record<string, any>;
  model_status: Record<string, any>;
  logs: { ts: string; message: string }[];
}

// ── Pipeline Stage Config ────────────────────────────────────────────────────

const GDNN_FLOW = [
  { id: "receive_live_telemetry", label: "Receive Live Telemetry" },
  { id: "weather_processing", label: "Weather Processing" },
  { id: "river_processing", label: "River Processing" },
  { id: "reservoir_processing", label: "Reservoir Processing" },
  { id: "terrain_processing", label: "Terrain Processing" },
  { id: "feature_engineering", label: "Feature Engineering" },
  { id: "knowledge_graph_update", label: "Knowledge Graph Update" },
  { id: "node_feature_matrix", label: "Node Feature Matrix" },
  { id: "node_embedding_generation", label: "Node Embedding Generation" },
  { id: "temporal_encoder", label: "Temporal Encoder (GRU)" },
  { id: "gat_layer_1", label: "Graph Attention Layer 1" },
  { id: "gat_layer_2", label: "Graph Attention Layer 2" },
  { id: "spatial_aggregation", label: "Spatial Aggregation" },
  { id: "temporal_aggregation", label: "Temporal Aggregation" },
  { id: "classification_head", label: "Classification Head" },
  { id: "flood_probability", label: "Flood Probability" },
  { id: "explainability", label: "Explainability" },
  { id: "alert_generation", label: "Alert Generation" },
];

export default function PredictionEnginePage() {
  const [flowStage, setFlowStage] = useState(-1);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictResult | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [forecastStep, setForecastStep] = useState(0);

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<InferenceCycle>({
    queryKey: ["inference-cycle"],
    queryFn: async () => {
      const res = await api.get("/predict/inference-cycle");
      return res.data;
    },
    refetchInterval: 30000,
  });

  // Flow animation orchestration
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
      }, 400); // animate through stages every 400ms

      if (!selectedDistrict && data.districts && data.districts.length > 0) {
        setSelectedDistrict(data.districts[0]);
      }

      return () => clearInterval(flowInterval);
    }
  }, [dataUpdatedAt, data]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  // Temporal animation
  useEffect(() => {
    const timer = setInterval(() => {
      setForecastStep(prev => (prev + 1) % 5);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-12 h-12 text-blue-500 animate-pulse" />
          <p className="text-sm font-semibold text-slate-400 font-mono">INITIALIZING GDNN KERNEL...</p>
        </div>
      </div>
    );
  }

  const s = data?.model_status || {};
  const m = data?.metrics || {};
  const d = selectedDistrict;

  const forecastLabels = ["Past 24h", "Current", "+6h Forecast", "+12h Forecast", "+24h Forecast"];
  const forecastMultipliers = [0.4, 1.0, 1.2, 1.5, 1.1]; // Mock evolution

  return (
    <div className="min-h-screen text-slate-200 font-sans p-4 xl:p-6 overflow-x-hidden">
      
      {/* ── TOP STATUS BAR ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3 mb-6">
        <div className="col-span-2 xl:col-span-3 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md flex items-center gap-3 shadow-md">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 border border-blue-500/50 flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Model</p>
            <p className="text-xs font-bold text-slate-800 truncate">{s.model_name}</p>
            <p className="text-[9px] text-slate-500 font-mono">{s.model_version}</p>
          </div>
        </div>
        
        <div className="col-span-2 xl:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md shadow-md">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Cpu className="w-3 h-3"/> Hardware</p>
          <p className="text-xs font-bold text-slate-700 font-mono truncate">{s.compute_device}</p>
        </div>

        <div className="col-span-2 xl:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md shadow-md">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Latency</p>
          <p className="text-sm font-bold text-green-600 font-mono">{s.pipeline_latency_ms} ms</p>
        </div>
        
        <div className="col-span-2 xl:col-span-3 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md grid grid-cols-2 gap-2 shadow-md">
          <div>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">API Status</p>
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> {s.api_status}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">KG Status</p>
            <p className="text-xs font-bold text-slate-700 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> {s.kg_status}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest">Dataset</p>
            <p className="text-[10px] font-mono text-slate-500">{s.training_dataset}</p>
          </div>
        </div>

        <div className="col-span-2 xl:col-span-2 bg-blue-600/10 border border-blue-500/30 rounded-xl p-3 backdrop-blur-md flex flex-col justify-center relative overflow-hidden shadow-md">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500/20">
            <motion.div className="h-full bg-blue-500" initial={{ width: "100%" }} animate={{ width: `${(countdown / 30) * 100}%` }} transition={{ duration: 1, ease: "linear" }} />
          </div>
          <p className="text-[10px] text-blue-600 uppercase tracking-widest font-bold mb-1">Next Cycle</p>
          <p className="text-xl font-bold text-slate-800 font-mono">{countdown}s</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* ── LEFT: PIPELINE EXECUTION ── */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          <div className="bg-white/80 border border-slate-200 rounded-2xl p-5 backdrop-blur-md flex-1 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-slate-800">
                <GitBranch className="w-4 h-4 text-purple-600" /> GDNN Pipeline
              </h2>
              <span className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">ID: {s.current_cycle_id}</span>
            </div>

            <div className="space-y-2 h-[750px] overflow-y-auto pr-2 scrollbar-hide">
              {GDNN_FLOW.map((step, i) => {
                const isActive = i === flowStage;
                const isCompleted = i < flowStage;
                const backendStage = data?.stages?.[step.id];

                return (
                  <div key={step.id} className="relative">
                    {/* Connection line */}
                    {i !== GDNN_FLOW.length - 1 && (
                      <div className={`absolute left-4 top-8 bottom-[-8px] w-px ${isCompleted ? 'bg-purple-500/50' : 'bg-slate-200'}`} />
                    )}
                    
                    <div className={`flex items-stretch gap-3 p-3 rounded-xl border transition-all duration-300 ${
                      isActive ? "bg-purple-50 border-purple-300 shadow-md" :
                      isCompleted ? "bg-white border-slate-100" : "bg-transparent border-transparent opacity-60"
                    }`}>
                      {/* Icon Indicator */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 z-10 transition-colors ${
                        isActive ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30" :
                        isCompleted ? "bg-slate-100 text-purple-500" : "bg-slate-100 text-slate-400"
                      }`}>
                        {isCompleted ? <CheckCircle className="w-4 h-4" /> : 
                         isActive ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                         <div className="w-2 h-2 rounded-full bg-slate-300" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <p className={`text-xs font-bold truncate ${isActive ? 'text-purple-900' : 'text-slate-700'}`}>{step.label}</p>
                          {(isCompleted || isActive) && backendStage?.execution_ms && (
                            <span className="text-[9px] font-mono text-green-600">{backendStage.execution_ms}ms</span>
                          )}
                        </div>
                        
                        {(isCompleted || isActive) && backendStage && (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {backendStage.shape && (
                              <div className="col-span-2 text-[9px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 truncate border border-slate-200">
                                Tensor: {backendStage.shape}
                              </div>
                            )}
                            {backendStage.input_size && (
                              <div className="text-[9px] font-mono text-slate-500 truncate">In: {backendStage.input_size}</div>
                            )}
                            {backendStage.output_size && (
                              <div className="text-[9px] font-mono text-slate-500 truncate">Out: {backendStage.output_size}</div>
                            )}
                          </div>
                        )}
                        
                        {isActive && (
                          <div className="h-0.5 w-full bg-slate-200 rounded-full mt-2 overflow-hidden">
                            <motion.div className="h-full bg-purple-500" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 0.4 }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── RIGHT: OUTPUT & EXPLAINABILITY ── */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          
          {/* Row 1: Live Model Output & Distric Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Live Model Output */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-slate-800">
                <Target className="w-4 h-4 text-blue-500" /> Live Model Output
              </h2>

              {d ? (
                <div className="relative z-10">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Target District</p>
                      <h3 className="text-2xl font-bold text-slate-800">{d.district}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Risk Level</p>
                      <div className={`px-3 py-1 rounded-lg text-xs font-bold shadow-sm ${
                        d.risk_level === 'High' ? 'bg-red-50 text-red-600 border border-red-200' :
                        d.risk_level === 'Medium' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                        'bg-green-50 text-green-600 border border-green-200'
                      }`}>
                        {d.risk_level.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Flood Prob</p>
                      <p className="text-lg font-mono font-bold text-slate-800">{d.risk_score}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Confidence</p>
                      <p className="text-lg font-mono font-bold text-blue-600">{d.confidence}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Inf Time</p>
                      <p className="text-lg font-mono font-bold text-green-600">{d.inference_time_ms}ms</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Rainfall</p>
                      <p className="text-sm font-mono font-bold text-slate-700">{d.rainfall_24h}mm</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">River Lvl</p>
                      <p className="text-sm font-mono font-bold text-slate-700">+{d.river_influence}m</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 shadow-sm">
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Attn Score</p>
                      <p className="text-sm font-mono font-bold text-purple-600">{d.attention_score}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm font-mono relative z-10">Waiting for inference...</div>
              )}
            </div>

            {/* Explainability Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col shadow-lg relative overflow-hidden">
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-slate-800">
                <Eye className="w-4 h-4 text-orange-500" /> Explainability
              </h2>
              
              {d ? (
                <div className="flex-1 flex flex-col gap-6 relative z-10">
                  {/* SHAP */}
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">SHAP Feature Contributions</p>
                    <div className="space-y-3">
                      {d.shap_values.slice(0,4).map((shap, i) => (
                        <div key={i} className="relative">
                          <div className="flex justify-between text-[10px] font-bold mb-1">
                            <span className="text-slate-600 truncate pr-2">{shap.feature}</span>
                            <span className={shap.contribution > 0 ? "text-red-500 font-mono" : "text-green-500 font-mono"}>
                              {shap.contribution > 0 ? "+" : ""}{shap.contribution}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex border border-slate-200">
                            {shap.contribution > 0 ? (
                              <>
                                <div className="w-1/2 bg-transparent"></div>
                                <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(shap.contribution * 2, 50)}%` }}></div>
                              </>
                            ) : (
                              <>
                                <div className="h-full bg-green-500 rounded-full ml-auto" style={{ width: `${Math.min(Math.abs(shap.contribution) * 2, 50)}%` }}></div>
                                <div className="w-1/2 bg-transparent"></div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reasoning Chain */}
                  <div className="flex-1 bg-slate-50 rounded-xl p-4 border border-slate-200 overflow-y-auto shadow-inner">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">Reasoning Chain</p>
                    <div className="space-y-2">
                      {d.reasoning_chain.map((reason, i) => (
                        <div key={i} className="flex flex-col">
                          <div className="text-[10px] text-blue-800 font-mono flex items-start gap-2">
                            <ChevronRight className="w-3 h-3 mt-0.5 text-blue-500 shrink-0" />
                            <span>{reason}</span>
                          </div>
                          {i < d.reasoning_chain.length - 1 && (
                            <div className="w-px h-3 bg-slate-300 ml-1.5 my-0.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                 <div className="h-48 flex items-center justify-center text-slate-500 text-sm font-mono relative z-10">Waiting for data...</div>
              )}
            </div>
          </div>

          {/* Row 2: Metrics & Temporal */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Live Pipeline Metrics */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg">
               <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-slate-800">
                <Activity className="w-4 h-4 text-green-500" /> Pipeline Metrics
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Nodes", val: m.nodes, clr: "text-slate-700" },
                  { label: "Edges", val: m.edges, clr: "text-slate-700" },
                  { label: "Features", val: m.features, clr: "text-slate-700" },
                  { label: "Sensors", val: m.active_sensors, clr: "text-blue-600" },
                  { label: "Embedding Dim", val: m.embedding_dimension, clr: "text-slate-700" },
                  { label: "Attn Heads", val: m.attention_heads, clr: "text-slate-700" },
                  { label: "Memory", val: m.memory_usage, clr: "text-orange-600" },
                  { label: "GPU", val: m.gpu_usage, clr: "text-orange-600" },
                  { label: "Throughput", val: m.prediction_throughput, clr: "text-green-600" },
                  { label: "Accuracy", val: m.model_accuracy, clr: "text-green-600" },
                ].map((metric, i) => (
                  <div key={i} className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">{metric.label}</span>
                    <span className={`text-xs font-bold font-mono ${metric.clr}`}>{metric.val || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Temporal Reasoning */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-40 h-40 bg-purple-100 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10">
                <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-2 text-slate-800">
                  <Clock className="w-4 h-4 text-purple-500" /> Temporal Forecasting
                </h2>
                <p className="text-[10px] text-slate-500 mb-6">GDNN evaluates sequential tensors to predict future states.</p>
              </div>

              <div className="flex-1 flex flex-col justify-center relative z-10">
                <div className="flex justify-between items-center mb-8 relative">
                   <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-slate-200 -z-10" />
                   {forecastLabels.map((lbl, i) => (
                     <div key={i} className="flex flex-col items-center gap-2">
                       <div className={`w-3 h-3 rounded-full border-2 transition-all duration-500 ${
                         i === forecastStep ? 'bg-purple-600 border-purple-300 scale-150 shadow-[0_0_10px_rgba(168,85,247,0.3)]' : 
                         i < forecastStep ? 'bg-purple-500 border-purple-400' : 'bg-white border-slate-300'
                       }`} />
                       <span className={`text-[9px] uppercase font-bold absolute -bottom-6 whitespace-nowrap transition-colors duration-500 ${
                         i === forecastStep ? 'text-purple-700' : 'text-slate-400'
                       }`}>{lbl}</span>
                     </div>
                   ))}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center mt-4 shadow-inner">
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Predicted Risk at {forecastLabels[forecastStep]}</p>
                   <p className="text-2xl font-mono font-bold text-slate-800 transition-all duration-500">
                     {d ? Math.min(100, Math.round(d.risk_score * forecastMultipliers[forecastStep])) : 0}%
                   </p>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Live Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 h-[220px] flex flex-col font-mono text-[10px] shadow-2xl">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-4 text-slate-300">
              <Terminal className="w-4 h-4 text-green-400" /> Live Execution Logs
            </h2>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 scrollbar-hide">
               <AnimatePresence>
                  {data?.logs?.map((log, i) => (
                    <motion.div 
                      key={i} 
                      initial={{ opacity: 0, x: -5 }} 
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 border-b border-slate-800 pb-1.5"
                    >
                      <span className="text-slate-500 shrink-0">[{log.ts}]</span>
                      <span className="text-green-400/90">{log.message}</span>
                    </motion.div>
                  ))}
               </AnimatePresence>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
