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
  Droplets, Mountain, Gauge, Radio, MapPin, Info, Microchip, Target, ArrowRight, Terminal
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import ReactFlow, { Background, Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface StageData {
  status: string;
  execution_ms: number;
  shape?: string;
  [key: string]: any;
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
  cycle_id: number;
  timestamp: string;
  total_latency_ms: number;
  stages: Record<string, StageData>;
  districts: DistrictResult[];
  model_status: any;
  logs: { ts: string; message: string }[];
}

// ── Pipeline Stage Config ────────────────────────────────────────────────────

const GDNN_STAGES = [
  { id: "telemetry_fetch", label: "Open-Meteo API", icon: CloudRain },
  { id: "river_fetch", label: "River Telemetry", icon: Waves },
  { id: "reservoir_fetch", label: "Reservoir Intel", icon: Droplets },
  { id: "terrain_fetch", label: "Terrain DEM", icon: Mountain },
  { id: "feature_prep", label: "Feature Engine", icon: Filter },
  { id: "kg_snapshot", label: "Knowledge Graph", icon: Network },
  { id: "node_embedding", label: "Node Embeddings", icon: Layers },
  { id: "gnn_inference", label: "GDNN Forward Pass", icon: Brain },
];

const GDNN_FLOW = [
  { id: "input_features", label: "Input Features", icon: Database },
  { id: "graph_construction", label: "Graph Construction", icon: Network },
  { id: "node_embeddings", label: "Node Embeddings", icon: Layers },
  { id: "temporal_encoder", label: "Temporal Encoder (GRU)", icon: Clock },
  { id: "gat_layer_1", label: "Graph Attention Layer 1", icon: Eye },
  { id: "gat_layer_2", label: "Graph Attention Layer 2", icon: Eye },
  { id: "spatial_agg", label: "Spatial Aggregation", icon: MapPin },
  { id: "temporal_agg", label: "Temporal Aggregation", icon: RefreshCw },
  { id: "pooling", label: "Global Pooling", icon: Filter },
  { id: "classification_head", label: "Classification Head", icon: Brain },
  { id: "explainability", label: "Explainability (SHAP)", icon: Activity },
];


// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PredictionEnginePage() {
  const [activeStage, setActiveStage] = useState(-1);
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
    if (data) {
      // Reset animations
      setActiveStage(-1);
      setFlowStage(-1);
      setCountdown(30);

      // Sequence 1: Data Preparation Pipeline
      const prepInterval = setInterval(() => {
        setActiveStage(prev => {
          if (prev >= GDNN_STAGES.length - 1) {
            clearInterval(prepInterval);
            return prev;
          }
          return prev + 1;
        });
      }, 200); // Fast sequence for prep

      // Sequence 2: Deep Learning Flow (starts after prep)
      setTimeout(() => {
        const flowInterval = setInterval(() => {
          setFlowStage(prev => {
            if (prev >= GDNN_FLOW.length - 1) {
              clearInterval(flowInterval);
              return prev;
            }
            return prev + 1;
          });
        }, 150);
      }, GDNN_STAGES.length * 200 + 500);

      return () => {
        clearInterval(prepInterval);
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

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Brain className="w-10 h-10 text-violet-500 animate-pulse" />
          <p className="text-sm font-semibold text-slate-600 font-heading">Initializing Prediction Engine...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="bg-white border border-slate-200 p-10 flex flex-col items-center text-center max-w-lg rounded-3xl shadow-xl">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 font-heading mb-2">Backend Unavailable</h2>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            The inference engine could not reach the backend. The GDNN process might be offline.
          </p>
          <button 
            onClick={() => refetch()}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const status = data.model_status;
  const districts = data.districts || [];
  
  // ReactFlow Mock Data for Animated KG
  const initialNodes = [
    { id: '1', position: { x: 150, y: 50 }, data: { label: 'Weather Stn 1' }, className: 'bg-blue-100 border-blue-300 text-[9px] font-bold py-1 px-2 rounded-lg' },
    { id: '2', position: { x: 50, y: 150 }, data: { label: 'Reservoir A' }, className: 'bg-cyan-100 border-cyan-300 text-[9px] font-bold py-1 px-2 rounded-lg' },
    { id: '3', position: { x: 250, y: 150 }, data: { label: 'River Gauge' }, className: 'bg-indigo-100 border-indigo-300 text-[9px] font-bold py-1 px-2 rounded-lg' },
    { id: '4', position: { x: 150, y: 250 }, data: { label: 'Chennai District' }, className: 'bg-red-100 border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] text-[10px] font-bold py-1.5 px-3 rounded-xl text-red-900' },
  ];
  const initialEdges = [
    { id: 'e1-4', source: '1', target: '4', animated: true, style: { stroke: '#818cf8', strokeWidth: 2 } },
    { id: 'e2-4', source: '2', target: '4', animated: true, style: { stroke: '#06b6d4', strokeWidth: 3 } },
    { id: 'e3-4', source: '3', target: '4', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } },
  ];


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
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{status.model_name} • {status.model_version}</span>
              </div>
              <span className="text-slate-300">|</span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Cycle #{data.cycle_id}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white border border-slate-200/60 px-4 py-2 rounded-xl flex flex-col items-end shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Hardware</span>
            <span className="text-xs font-bold text-slate-700 font-mono flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-slate-400"/> {status.compute_device}</span>
          </div>
          <div className="bg-white border border-slate-200/60 px-4 py-2 rounded-xl flex flex-col items-end shadow-sm">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Pipeline Latency</span>
            <span className="text-xs font-bold text-violet-600 font-mono flex items-center gap-1.5"><Zap className="w-3.5 h-3.5"/> {status.pipeline_latency_ms}ms</span>
          </div>
          <div className="bg-slate-900 px-4 py-2 rounded-xl flex flex-col items-end border border-slate-800 shadow-lg">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Next Inference</span>
            <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-violet-400"/> {countdown}s</span>
          </div>
        </div>
      </div>

      {/* ROW 2: INGESTION, GRAPH, STATS */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Telemetry Ingestion */}
        <div className="col-span-12 xl:col-span-3 bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 flex flex-col h-[320px] shadow-sm">
          <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-blue-500" /> Live Telemetry
          </h3>
          <div className="flex-1 overflow-hidden relative">
            <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white to-transparent z-10"></div>
            <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white to-transparent z-10"></div>
            <div className="space-y-2 overflow-y-auto h-full pr-2 font-mono scrollbar-hide">
              {data.logs.slice(0, 15).map((log, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  key={i} className="flex items-start gap-2 text-[10px]"
                >
                  <span className="text-blue-500 font-bold shrink-0">{log.ts}</span>
                  <span className="text-slate-600 leading-tight">{log.message}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Dynamic Knowledge Graph */}
        <div className="col-span-12 xl:col-span-6 bg-slate-50/50 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-1 relative overflow-hidden h-[320px] shadow-sm">
          <div className="absolute top-4 left-4 z-10 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/60 flex items-center gap-2 shadow-sm">
            <Network className="w-3.5 h-3.5 text-violet-600" />
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest font-heading">Graph Attention Dynamics</span>
          </div>
          <ReactFlow nodes={initialNodes} edges={initialEdges} fitView attributionPosition="bottom-right">
            <Background color="#cbd5e1" gap={16} size={1} />
          </ReactFlow>
        </div>

        {/* Model Stats */}
        <div className="col-span-12 xl:col-span-3 bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 flex flex-col h-[320px] justify-between shadow-sm">
          <div>
            <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-green-500" /> Runtime Statistics
            </h3>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500">Nodes Processed</span>
                <span className="text-xs font-bold text-slate-800 font-mono">{data.stages.graph_construction?.nodes || 0}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500">Active Edges</span>
                <span className="text-xs font-bold text-slate-800 font-mono">{data.stages.graph_construction?.edges || 0}</span>
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-500">Total Inferences</span>
                <span className="text-xs font-bold text-slate-800 font-mono">{status.total_inference_count.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex justify-between items-end">
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Architecture</p>
                <p className="text-[11px] font-bold text-violet-600">{status.architecture}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <Layers className="w-4 h-4 text-violet-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: PIPELINE, DISTRICTS, EXPLAINABILITY */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* GDNN Execution Pipeline */}
        <div className="col-span-12 xl:col-span-3 bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 h-[500px] flex flex-col shadow-sm">
          <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-4 shrink-0">
            <Microchip className="w-4 h-4 text-indigo-500" /> GDNN Execution Flow
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide relative">
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-slate-100 -z-10"></div>
            <div className="space-y-0 pb-4">
              {GDNN_FLOW.map((step, i) => {
                const isActive = i === flowStage;
                const isCompleted = i < flowStage;
                const Icon = step.icon;
                const backendStage = data.stages[step.id];

                return (
                  <div key={step.id} className="relative pl-10 py-3 group">
                    <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                      isActive ? "bg-violet-100 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.3)]" : 
                      isCompleted ? "bg-slate-800 border-slate-800" : "bg-white border-slate-200"
                    }`}>
                      {isCompleted ? <CheckCircle className="w-3.5 h-3.5 text-white" /> : 
                       <Icon className={`w-3.5 h-3.5 ${isActive ? "text-violet-600" : "text-slate-400"}`} />}
                    </div>
                    
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-bold transition-colors ${isActive ? "text-violet-700" : isCompleted ? "text-slate-700" : "text-slate-400"}`}>
                        {step.label}
                      </span>
                      
                      <AnimatePresence>
                        {(isActive || isCompleted) && backendStage && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex items-center gap-3 mt-1.5 overflow-hidden">
                            <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                              {backendStage.execution_ms}ms
                            </span>
                            {backendStage.shape && (
                              <span className="text-[9px] font-mono font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                                {backendStage.shape}
                              </span>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live District Predictions */}
        <div className="col-span-12 xl:col-span-5 bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 h-[500px] flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" /> Live District Predictions
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
                      ? "bg-violet-50/50 border-violet-300 shadow-[0_4px_20px_-4px_rgba(139,92,246,0.15)]" 
                      : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
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
                      <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">Rain 24h</p>
                        <p className="text-[10px] font-bold text-slate-700 font-mono">{d.rainfall_24h}mm</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">River Lvl</p>
                        <p className="text-[10px] font-bold text-slate-700 font-mono">+{d.river_influence}m</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-1.5 text-center">
                        <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">KG Impact</p>
                        <p className="text-[10px] font-bold text-violet-600 font-mono">{d.kg_contribution}%</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-1.5 text-center flex items-center justify-center">
                        {d.trend === "up" ? <TrendingUp className="w-4 h-4 text-red-500" /> : 
                         d.trend === "down" ? <TrendingDown className="w-4 h-4 text-green-500" /> : 
                         <ArrowRight className="w-4 h-4 text-slate-400" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {flowStage < GDNN_FLOW.length - 2 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 space-y-3 z-20 bg-white/50 backdrop-blur-[2px] rounded-2xl">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest font-mono">Running Inference Pass...</p>
              </div>
            )}
          </div>
        </div>

        {/* Explainability Panel */}
        <div className="col-span-12 xl:col-span-4 bg-gradient-to-b from-white to-slate-50/50 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 h-[500px] flex flex-col shadow-sm">
          <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-4 shrink-0">
            <Eye className="w-4 h-4 text-pink-500" /> AI Explainability
          </h3>
          
          {!selectedDistrict ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
              <Info className="w-8 h-8 text-slate-400 mb-3" />
              <p className="text-xs font-medium text-slate-500">Select a district to view<br/>SHAP values and attention paths.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto pr-1 space-y-5 scrollbar-hide animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 font-heading">{selectedDistrict.district}</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Diagnostic Report</p>
                </div>
                <div className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: selectedDistrict.risk_color }}>
                  {selectedDistrict.risk_level}
                </div>
              </div>

              {/* SHAP Chart (Bar visualizer) */}
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

              {/* Top Reasons */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> Core Drivers</p>
                <ul className="space-y-1.5">
                  {selectedDistrict.top_reasons.map((r, i) => (
                    <li key={i} className="text-[11px] font-medium text-slate-700 bg-white border border-slate-100 p-2 rounded-xl shadow-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0"></span> {r}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Attention Paths */}
              <div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Network className="w-3 h-3"/> Graph Attention Flows</p>
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
      </div>

      {/* ROW 4: CHARTS & TEMPORAL */}
      <div className="grid grid-cols-12 gap-4">
        
        {/* Terminal Live Logs */}
        <div className="col-span-12 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 h-[240px] flex flex-col shadow-xl">
          <h3 className="text-xs font-heading font-bold text-slate-100 flex items-center gap-2 mb-4 shrink-0">
            <Terminal className="w-4 h-4 text-green-400" /> Live Execution Logs
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 font-mono text-[10px] scrollbar-hide">
            <AnimatePresence>
              {data.logs.map((log, i) => (
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

        {/* Latency Chart */}
        <div className="col-span-12 xl:col-span-4 bg-white/70 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-5 h-[240px] flex flex-col shadow-sm">
          <h3 className="text-xs font-heading font-bold text-slate-800 flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-500" /> Pipeline Latency Trend
          </h3>
          <div className="flex-1 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{ time: 'T-5', ms: 140 }, { time: 'T-4', ms: 135 }, { time: 'T-3', ms: 155 }, { time: 'T-2', ms: 142 }, { time: 'T-1', ms: 138 }, { time: 'Now', ms: data.total_latency_ms }]}>
                <defs>
                  <linearGradient id="colorMs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: '11px' }} />
                <Area type="monotone" dataKey="ms" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorMs)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Temporal Reasoning */}
        <div className="col-span-12 xl:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 h-[240px] flex flex-col justify-between text-white shadow-xl relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl pointer-events-none"></div>
           <div>
            <h3 className="text-xs font-heading font-bold text-white flex items-center gap-2 mb-2 relative z-10">
              <Clock className="w-4 h-4 text-violet-400" /> Temporal Reasoning
            </h3>
            <p className="text-[10px] text-slate-400 mb-6 relative z-10">GDNN is currently generating forward-looking states using the temporal GRU block.</p>
           </div>
           
           <div className="relative z-10 space-y-4">
             <div className="flex justify-between text-[10px] font-bold text-slate-300 font-mono">
               <span>T-24h</span>
               <span className="text-violet-400">Current (T0)</span>
               <span>T+24h</span>
             </div>
             <input type="range" min="-24" max="24" defaultValue="0" className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500" />
             <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-colors backdrop-blur-sm border border-white/5">
               Replay Sequence
             </button>
           </div>
        </div>
      </div>

    </div>
  );
}
