"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CloudRain, Waves, Database, Filter, Network, Brain, Cpu,
  BarChart3, AlertTriangle, Activity, CheckCircle, Shield,
  ArrowDown, ArrowUp, Clock, RefreshCw, Zap, Eye, X,
  ChevronRight, Play, Layers, GitBranch, TrendingUp,
  TrendingDown, Server, Wifi, HardDrive, Timer,
  Droplets, Mountain, Gauge, Radio, MapPin, Info, Microchip, Target, Terminal
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageData {
  status: string;
  execution_ms: number;
  shape?: string;
  nodes?: number;
  edges?: number;
}

interface DistrictResult {
  district_id: number;
  district: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  confidence: number;
  trend: string;
  rainfall_24h: number;
  river_influence: number;
  kg_contribution: number;
  attention_score: number;
  shap_values: any[];
  top_reasons: string[];
  attention_paths: string[];
}

interface InferenceCycle {
  status?: string;
  cycle_id: number;
  timestamp: string;
  total_latency_ms: number;
  stages: Record<string, StageData>;
  districts: DistrictResult[];
  graph_data?: {
    nodes: any[];
    edges: any[];
  };
  model_status: any;
  logs: { ts: string; message: string }[];
}

// ── Pipeline Stage Config ────────────────────────────────────────────────────

const GDNN_FLOW = [
  { id: "input_features", label: "Open-Meteo", icon: CloudRain },
  { id: "graph_construction", label: "Knowledge Graph", icon: Network },
  { id: "node_embeddings", label: "Node Embeddings", icon: Layers },
  { id: "gat_layer_1", label: "GAT Layer 1", icon: Eye },
  { id: "gat_layer_2", label: "GAT Layer 2", icon: Eye },
  { id: "temporal_encoder", label: "Temporal GRU", icon: Clock },
  { id: "spatial_agg", label: "Spatial Agg", icon: MapPin },
  { id: "temporal_agg", label: "Temporal Agg", icon: RefreshCw },
  { id: "pooling", label: "Global Pooling", icon: Filter },
  { id: "classification_head", label: "Classification", icon: Brain },
  { id: "explainability", label: "SHAP Explain", icon: Activity },
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PredictionEnginePage() {
  const [flowStage, setFlowStage] = useState(-1);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictResult | null>(null);
  
  // Timer for next inference cycle (simulated 30s polling)
  const [countdown, setCountdown] = useState(30);

  // TanStack Query to fetch the live inference cycle from backend
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<InferenceCycle>({
    queryKey: ["inference-cycle"],
    queryFn: async () => {
      const res = await api.get("/predict/inference-cycle");
      return res.data;
    },
    refetchInterval: 30000, // refresh every 30s
  });

  // Orchestrate the sequential lighting up of stages when new data arrives
  useEffect(() => {
    if (data && data.status !== "waiting_for_telemetry") {
      setFlowStage(-1);
      setCountdown(30);

      // Deep Learning Flow Sequence
      const flowInterval = setInterval(() => {
        setFlowStage(prev => {
          if (prev >= GDNN_FLOW.length - 1) {
            clearInterval(flowInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 250);

      return () => {
        clearInterval(flowInterval);
      };
    }
  }, [dataUpdatedAt, data]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Build Real Graph Nodes
  const { reactFlowNodes, reactFlowEdges } = useMemo(() => {
    if (!data || !data.graph_data) return { reactFlowNodes: [], reactFlowEdges: [] };
    
    // Process backend nodes into ReactFlow format
    const nodes = data.graph_data.nodes.map((n, i) => {
      // Procedural layout for the circular visual graph
      const radius = n.type === 'district' ? 80 : 150;
      const angle = (i / data.graph_data!.nodes.length) * 2 * Math.PI;
      const x = 200 + radius * Math.cos(angle);
      const y = 200 + radius * Math.sin(angle);
      
      let colorClass = "bg-slate-100 border-slate-300 text-slate-700";
      if (n.type === 'district') colorClass = "bg-violet-100 border-violet-400 text-violet-800 shadow-[0_0_10px_rgba(139,92,246,0.3)]";
      if (n.type === 'river' || n.type === 'rain_gauge') colorClass = "bg-blue-100 border-blue-400 text-blue-800";
      
      return {
        id: n.id,
        position: { x, y },
        data: { label: n.label },
        className: `${colorClass} text-[9px] font-bold py-1.5 px-3 rounded-xl whitespace-nowrap`,
      };
    });

    const edges = data.graph_data.edges.map((e, i) => {
      // Map attention weights to thickness and color
      const attention = e.attention || 0.5;
      const strokeWidth = Math.max(1, attention * 5);
      
      let strokeColor = "#94a3b8"; // low attention (blue-ish slate)
      if (attention > 0.8) strokeColor = "#ef4444"; // critical (red)
      else if (attention > 0.6) strokeColor = "#f97316"; // high (orange)
      else if (attention > 0.4) strokeColor = "#f59e0b"; // medium (yellow)

      return {
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        animated: true,
        style: { stroke: strokeColor, strokeWidth },
      };
    });

    return { reactFlowNodes: nodes, reactFlowEdges: edges };
  }, [data]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-10 h-10 text-violet-500 animate-pulse" />
          <p className="text-sm font-semibold text-slate-600 font-heading">Connecting to GDNN Core...</p>
        </div>
      </div>
    );
  }

  if (isError || (data && data.status === "waiting_for_telemetry")) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="bg-white border border-slate-200 p-10 flex flex-col items-center text-center max-w-lg rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <Radio className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 font-heading mb-2">Waiting for Live Inference</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            The AI Prediction Engine is waiting for the first batch of telemetry data to build the Knowledge Graph and begin the Graph Dynamic Neural Network sequence.
          </p>
          <button 
            onClick={() => refetch()}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Force Polling
          </button>
        </div>
      </div>
    );
  }

  const status = data?.model_status;
  const districts = data?.districts || [];

  return (
    <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4 pb-20">
      
      {/* ROW 1: HEADER & STATUS */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white/70 backdrop-blur-xl border border-slate-200/60 p-4 rounded-3xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-black text-slate-800 tracking-tight flex items-center gap-2">
              GDNN Inference Engine
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{status?.model_name} • {status?.model_version}</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Cycle #{data?.cycle_id}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-slate-200/60 px-4 py-2 rounded-xl flex flex-col items-end shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Hardware</span>
            <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-400"/> {status?.compute_device}</span>
          </div>
          <div className="bg-white border border-slate-200/60 px-4 py-2 rounded-xl flex flex-col items-end shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Pipeline Latency</span>
            <span className="text-xs font-bold text-violet-600 font-mono flex items-center gap-1.5"><Zap className="w-3.5 h-3.5"/> {status?.pipeline_latency_ms}ms</span>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl flex flex-col items-end border border-slate-800 shadow-lg">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Next Inference</span>
            <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-violet-400"/> {countdown}s</span>
          </div>
        </div>
      </div>

      {/* ROW 2: HORIZONTAL ANIMATED PIPELINE */}
      <div className="bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 shadow-sm overflow-hidden">
        <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-6">
          <GitBranch className="w-4 h-4 text-indigo-500" /> Live Execution Pipeline
        </h3>
        <div className="flex items-center overflow-x-auto pb-4 scrollbar-hide w-full justify-between min-w-max px-4">
          {GDNN_FLOW.map((step, i) => {
            const isActive = i === flowStage;
            const isCompleted = i < flowStage;
            const Icon = step.icon;
            const backendStage = data?.stages?.[step.id];

            return (
              <div key={step.id} className="flex items-center shrink-0">
                <div className="flex flex-col items-center gap-3 w-28 relative group">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border-2 z-10 ${
                    isActive ? "bg-violet-600 border-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.6)] scale-110" : 
                    isCompleted ? "bg-slate-800 border-slate-800 text-white scale-100" : "bg-slate-50 border-slate-200 text-slate-400 scale-100"
                  }`}>
                    {isCompleted ? <CheckCircle className="w-5 h-5 text-white" /> : 
                     <Icon className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />}
                  </div>
                  
                  <div className="text-center flex flex-col items-center">
                    <span className={`text-[10px] font-bold transition-colors ${isActive ? "text-violet-700" : isCompleted ? "text-slate-800" : "text-slate-400"}`}>
                      {step.label}
                    </span>
                    <div className="h-4 mt-1">
                      <AnimatePresence mode="wait">
                        {(isActive || isCompleted) && backendStage && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center">
                            <span className="text-[9px] font-mono font-bold text-green-500">
                              {backendStage.execution_ms}ms
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Tensor Shape Tooltip */}
                  {(isActive || isCompleted) && backendStage?.shape && (
                    <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] font-mono font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-20">
                      Tensor: {backendStage.shape}
                    </div>
                  )}
                </div>
                
                {/* Arrow Connector */}
                {i < GDNN_FLOW.length - 1 && (
                  <div className="w-8 mx-1 flex items-center relative -top-6">
                    <div className={`h-[2px] w-full transition-colors duration-500 ${isCompleted ? 'bg-violet-500' : 'bg-slate-200'}`}></div>
                    <ChevronRight className={`absolute -right-2 w-4 h-4 transition-colors duration-500 ${isCompleted ? 'text-violet-500' : 'text-slate-300'}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ROW 3: KNOWLEDGE GRAPH & DISTRICTS */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Dynamic Knowledge Graph (Centerpiece) */}
        <div className="col-span-12 xl:col-span-8 bg-slate-50/80 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-1 relative overflow-hidden h-[500px] shadow-inner">
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-200 flex items-center gap-3 shadow-sm">
            <Network className="w-4 h-4 text-violet-600" />
            <div>
              <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest font-heading">Live Graph Attention</p>
              <p className="text-[9px] text-slate-500 font-mono">Nodes: {data?.stages?.graph_construction?.nodes || 0} | Edges: {data?.stages?.graph_construction?.edges || 0}</p>
            </div>
          </div>
          
          <ReactFlow nodes={reactFlowNodes} edges={reactFlowEdges} fitView attributionPosition="bottom-right" minZoom={0.5} maxZoom={2}>
            <Background color="#cbd5e1" gap={16} size={1} />
            <Controls className="bg-white border-slate-200 shadow-md" />
          </ReactFlow>

          {flowStage > -1 && flowStage < 3 && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-50/40 backdrop-blur-sm transition-opacity">
              <div className="bg-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-violet-600 rounded-full animate-spin"></div>
                <span className="text-xs font-bold text-slate-700 font-mono tracking-widest uppercase">Propagating Messages...</span>
              </div>
            </div>
          )}
        </div>

        {/* Live District Predictions */}
        <div className="col-span-12 xl:col-span-4 bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 h-[500px] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Live Risk Assessment
            </h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-lg font-mono">Sorted by Risk</span>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-hide relative">
            <AnimatePresence mode="popLayout">
              {districts.map((d, i) => {
                if (flowStage < GDNN_FLOW.length - 2) return null; // hide until inference finishes
                
                return (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                    key={d.district_id} 
                    onClick={() => setSelectedDistrict(d)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      selectedDistrict?.district_id === d.district_id 
                      ? "bg-violet-50/80 border-violet-400 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.2)]" 
                      : "bg-white border-slate-100 hover:border-violet-200 hover:bg-slate-50/50 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.risk_color }}></div>
                        <span className="text-xs font-bold text-slate-800 font-heading">{d.district}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Risk</span>
                          <span className="text-xs font-bold font-mono" style={{ color: d.risk_color }}>{d.risk_score}%</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase">Conf</span>
                          <span className="text-xs font-bold text-slate-600 font-mono">{d.confidence}%</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2">
                      <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-1.5 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">Rain 24h</p>
                        <p className="text-[10px] font-bold text-slate-700 font-mono">{d.rainfall_24h}mm</p>
                      </div>
                      <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-1.5 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">River</p>
                        <p className="text-[10px] font-bold text-slate-700 font-mono">+{d.river_influence}m</p>
                      </div>
                      <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-1.5 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">KG Attn</p>
                        <p className="text-[10px] font-bold text-violet-600 font-mono">{d.attention_score}</p>
                      </div>
                      <div className="bg-slate-50/80 border border-slate-100 rounded-lg p-1.5 text-center flex items-center justify-center">
                        {d.trend === "up" ? <TrendingUp className="w-4 h-4 text-red-500" /> : 
                         d.trend === "down" ? <TrendingDown className="w-4 h-4 text-green-500" /> : 
                         <ChevronRight className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {flowStage < GDNN_FLOW.length - 2 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-3 z-20 bg-white/60 backdrop-blur-[2px] rounded-2xl">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest font-mono">Waiting for Classification...</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ROW 4: EXPLAINABILITY, LOGS & TEMPORAL */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Explainability Panel */}
        <div className="col-span-12 xl:col-span-4 bg-gradient-to-b from-white to-slate-50/50 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 h-[320px] flex flex-col shadow-sm">
          <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-4 shrink-0">
            <Eye className="w-4 h-4 text-pink-500" /> AI Explainability
          </h3>
          
          {!selectedDistrict ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
              <Info className="w-8 h-8 text-slate-400 mb-3" />
              <p className="text-xs font-medium text-slate-500">Select a district to view<br/>SHAP values and attention paths.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-hide animate-in fade-in duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-heading">{selectedDistrict.district}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Diagnostic Report</p>
                </div>
                <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow-sm" style={{ background: selectedDistrict.risk_color }}>
                  {selectedDistrict.risk_level}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Activity className="w-3 h-3"/> Feature Importance (SHAP)</p>
                <div className="space-y-2.5">
                  {selectedDistrict.shap_values.map((shap, i) => (
                    <div key={i} className="relative">
                      <div className="flex justify-between text-[10px] font-bold mb-1">
                        <span className="text-slate-600">{shap.feature}</span>
                        <span className={shap.contribution > 0 ? "text-red-500 font-mono" : "text-green-500 font-mono"}>
                          {shap.contribution > 0 ? "+" : ""}{shap.contribution}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden flex">
                        {shap.contribution > 0 ? (
                          <>
                            <div className="w-1/2 bg-transparent"></div>
                            <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(shap.contribution * 2, 50)}%` }}></div>
                          </>
                        ) : (
                          <>
                            <div className="h-full bg-green-400 rounded-full ml-auto" style={{ width: `${Math.min(Math.abs(shap.contribution) * 2, 50)}%` }}></div>
                            <div className="w-1/2 bg-transparent"></div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Network className="w-3 h-3"/> Top Attention Paths</p>
                <div className="bg-slate-800 rounded-xl p-3 space-y-2">
                  {selectedDistrict.attention_paths.map((p, i) => (
                    <div key={i} className="text-[10px] font-mono text-violet-200 font-medium break-all leading-tight">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Terminal Live Logs */}
        <div className="col-span-12 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 h-[320px] flex flex-col shadow-xl">
          <h3 className="text-xs font-heading font-bold text-slate-100 flex items-center gap-2 mb-4 shrink-0">
            <Terminal className="w-4 h-4 text-green-400" /> Live Execution Logs
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[10px] scrollbar-hide">
            <AnimatePresence>
              {data?.logs.map((log, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -5 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3"
                >
                  <span className="text-slate-500 shrink-0">[{log.ts}]</span>
                  <span className="text-green-400/90 break-words">{log.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Temporal Reasoning Scrubber */}
        <div className="col-span-12 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 h-[320px] flex flex-col justify-between text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl pointer-events-none"></div>
           <div>
            <h3 className="text-xs font-heading font-bold text-white flex items-center gap-2 mb-2 relative z-10">
              <Clock className="w-4 h-4 text-violet-400" /> Temporal GRU Reasoning
            </h3>
            <p className="text-[10px] text-slate-400 mb-6 relative z-10">GDNN is evaluating a 14-day sequence tensor to capture historical flood momentum across spatial nodes.</p>
           </div>
           
           <div className="relative z-10 space-y-6">
             <div className="flex justify-between text-[10px] font-bold text-slate-300 font-mono">
               <span>T-14 Days</span>
               <span className="text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded">Current (T0)</span>
               <span>T+24 Hrs</span>
             </div>
             
             <div className="relative pt-2 pb-2">
                <input type="range" min="-14" max="1" defaultValue="0" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500 relative z-10" />
                <div className="absolute inset-0 top-1/2 -translate-y-1/2 w-full flex justify-between px-1 pointer-events-none">
                    {[...Array(16)].map((_, i) => (
                        <div key={i} className="w-[1px] h-2 bg-slate-600"></div>
                    ))}
                </div>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                     <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">Embedding Norm</p>
                     <p className="text-xs font-mono font-bold text-indigo-300">12.4082</p>
                 </div>
                 <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                     <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">Sequence Shape</p>
                     <p className="text-xs font-mono font-bold text-indigo-300">{data?.stages?.temporal_encoder?.shape || "[38, 14, 32]"}</p>
                 </div>
             </div>
             
             <button className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors shadow-lg">
               Replay Sequence
             </button>
           </div>
        </div>
      </div>

    </div>
  );
}
