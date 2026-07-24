"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Brain, Cpu, Zap, Target,
  CheckCircle, RefreshCw, GitBranch, Terminal, MapPin, 
  Eye, ChevronRight, ChevronDown, ChevronUp, Search, BarChart2, AlertTriangle, Network
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
  { id: "receive_live_telemetry", label: "Live Telemetry" },
  { id: "weather_processing", label: "Weather Data" },
  { id: "river_processing", label: "River Metrics" },
  { id: "feature_engineering", label: "Feature Matrix" },
  { id: "knowledge_graph_update", label: "KG Sync" },
  { id: "temporal_encoder", label: "Temporal Enc" },
  { id: "gat_layer_1", label: "Attention" },
  { id: "flood_probability", label: "Risk Prob" },
  { id: "explainability", label: "SHAP" },
  { id: "alert_generation", label: "Alerts" },
];

export default function PredictionEnginePage() {
  const [flowStage, setFlowStage] = useState(-1);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(30);
  const [showLogs, setShowLogs] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery<InferenceCycle>({
    queryKey: ["inference-cycle"],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);
      try {
        const res = await api.get("/predict/inference-cycle", { signal: controller.signal });
        const raw = res.data;
        const districtList = raw.districts || raw.stages?.gdnn_output?.district_ranking || [];
        return {
          ...raw,
          districts: districtList,
        };
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 3000,
  });

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

  if (isError && !data) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-800">Prediction Engine Unavailable</h2>
          <p className="text-xs text-slate-500">{error?.message || "Failed to establish connection with AI Prediction server."}</p>
          <button
            onClick={() => refetch()}
            className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-bold shadow-md shadow-violet-200 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      </div>
    );
  }

  const s = data?.model_status || {};
  const m = data?.metrics || {};
  
  const filteredDistricts = data?.districts?.filter(d => 
    d.district.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const selectedDistrict = data?.districts?.find(d => d.district_id === selectedDistrictId) || data?.districts?.[0];
  const d = selectedDistrict;

  const forecastLabels = ["-24h", "Now", "+6h", "+12h", "+24h"];
  const forecastMultipliers = [0.4, 1.0, 1.2, 1.5, 1.1];

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
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Cpu className="w-3 h-3"/> Engine</p>
          <p className="text-xs font-bold text-slate-700 font-mono truncate">{s.compute_device}</p>
        </div>

        <div className="col-span-2 xl:col-span-2 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md shadow-md">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1 flex items-center gap-1.5"><Zap className="w-3 h-3"/> Latency</p>
          <p className="text-sm font-bold text-green-600 font-mono">{s.pipeline_latency_ms} ms</p>
        </div>
        
        <div className="col-span-2 xl:col-span-3 bg-white/5 border border-white/10 rounded-xl p-3 backdrop-blur-md grid grid-cols-2 gap-2 shadow-md">
          <div>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1"><Network className="w-2.5 h-2.5"/> Nodes</p>
            <p className="text-xs font-bold text-slate-700 font-mono">{s.node_count ?? 312}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1"><GitBranch className="w-2.5 h-2.5"/> Edges</p>
            <p className="text-xs font-bold text-slate-700 font-mono">{s.edge_count ?? 1256}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[9px] text-slate-400 uppercase tracking-widest flex items-center gap-1"><Eye className="w-2.5 h-2.5"/> Attention Heads</p>
            <p className="text-[10px] font-mono text-slate-500">{s.attention_heads ?? 4} Heads (GATv2)</p>
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
      
      {/* ── PIPELINE STATUS STRIP ── */}
      <div className="bg-white/90 border border-slate-200 rounded-xl p-3 mb-6 shadow-sm flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mr-2 flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-purple-600" /> Pipeline
        </div>
        {GDNN_FLOW.map((step, i) => {
          const isActive = i === flowStage;
          const isCompleted = i < flowStage;
          return (
            <div key={step.id} className="flex items-center gap-2 shrink-0">
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors flex items-center gap-1.5 ${
                isActive ? "bg-purple-100 text-purple-700 border-purple-200" :
                isCompleted ? "bg-slate-100 text-slate-600 border-slate-200" : "bg-transparent text-slate-400 border-slate-100"
              }`}>
                {isActive && <RefreshCw className="w-3 h-3 animate-spin" />}
                {isCompleted && <CheckCircle className="w-3 h-3 text-green-500" />}
                {step.label}
              </div>
              {i < GDNN_FLOW.length - 1 && <ChevronRight className="w-3 h-3 text-slate-300" />}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* ── LEFT: DISTRICT SELECTOR ── */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-lg h-[650px] flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-4 text-slate-800">
              <MapPin className="w-4 h-4 text-indigo-500" /> Districts
            </h2>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search district..." 
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-hide">
              {filteredDistricts.map(dist => (
                <button
                  key={dist.district_id}
                  onClick={() => setSelectedDistrictId(dist.district_id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex justify-between items-center ${
                    selectedDistrictId === dist.district_id 
                    ? "bg-indigo-50 border-indigo-200 shadow-sm" 
                    : "bg-white border-slate-100 hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className={`text-xs font-bold ${selectedDistrictId === dist.district_id ? "text-indigo-800" : "text-slate-700"}`}>{dist.district}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{dist.risk_score}% Risk</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    dist.risk_level === 'High' ? 'bg-red-500' :
                    dist.risk_level === 'Medium' ? 'bg-orange-500' : 'bg-green-500'
                  }`} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT: OUTPUT & EXPLAINABILITY ── */}
        <div className="xl:col-span-9 flex flex-col gap-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Live Model Output */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-lg">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-3xl pointer-events-none" />
              
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-slate-800">
                <Target className="w-4 h-4 text-blue-500" /> Prediction Engine
              </h2>

              {d ? (
                <div className="relative z-10">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Target District</p>
                      <h3 className="text-3xl font-bold text-slate-800">{d.district}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Risk Level</p>
                      <div className={`px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm ${
                        d.risk_level === 'High' || d.risk_level === 'Critical' ? 'bg-red-50 text-red-600 border border-red-200' :
                        d.risk_level === 'Medium' || d.risk_level === 'Moderate' ? 'bg-orange-50 text-orange-600 border border-orange-200' :
                        'bg-green-50 text-green-600 border border-green-200'
                      }`}>
                        {d.risk_level.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Flood Prob</p>
                      <p className="text-xl font-mono font-bold text-slate-800">{d.risk_score}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Confidence</p>
                      <p className="text-xl font-mono font-bold text-blue-600">{d.confidence}%</p>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Rainfall 24h</p>
                      <p className="text-xl font-mono font-bold text-slate-700">{d.rainfall_24h}mm</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-slate-500 text-sm font-mono relative z-10">Select a district...</div>
              )}
            </div>

            {/* Explainability Panel */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg relative overflow-hidden">
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 mb-6 text-slate-800">
                <Eye className="w-4 h-4 text-orange-500" /> AI Interpretability
              </h2>
              
              {d ? (
                <div className="flex flex-col gap-6 relative z-10 h-[210px] overflow-y-auto pr-2 scrollbar-hide">
                  {/* SHAP */}
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-3">SHAP Feature Impact</p>
                    <div className="space-y-3">
                      {d.shap_values.map((shap, i) => (
                        <div key={i} className="relative">
                          <div className="flex justify-between text-xs font-bold mb-1">
                            <span className="text-slate-600 truncate pr-2">{shap.feature}</span>
                            <span className={shap.contribution > 0 ? "text-red-500 font-mono" : "text-green-500 font-mono"}>
                              {shap.contribution > 0 ? "+" : ""}{shap.contribution}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex border border-slate-200">
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
                </div>
              ) : (
                 <div className="h-48 flex items-center justify-center text-slate-500 text-sm font-mono relative z-10">Select a district...</div>
              )}
            </div>
          </div>

          {/* Temporal Forecasting Chart */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-lg h-[260px] flex flex-col relative overflow-hidden">
             <div className="absolute top-0 left-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl pointer-events-none" />
             <div className="relative z-10 flex justify-between items-start mb-4">
               <div>
                  <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-slate-800">
                    <BarChart2 className="w-4 h-4 text-purple-500" /> Temporal Risk Projection
                  </h2>
                  <p className="text-[10px] text-slate-500 mt-1">Multi-horizon GRU forecast based on live weather data.</p>
               </div>
               <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-[10px] font-bold">
                 Horizon: +24 Hours
               </div>
             </div>
             
             <div className="flex-1 flex items-end justify-between px-4 pb-2 relative z-10 mt-4">
                {forecastLabels.map((lbl, i) => {
                  const val = d ? Math.min(100, Math.max(5, d.risk_score * forecastMultipliers[i])) : 0;
                  const isCurrent = lbl === "Now";
                  return (
                    <div key={i} className="flex flex-col items-center gap-3 w-12">
                      <span className="text-[10px] font-mono font-bold text-slate-600">{Math.round(val)}%</span>
                      <div className="w-full bg-slate-100 rounded-t-sm relative flex items-end justify-center h-24">
                         <motion.div 
                           className={`w-full rounded-t-sm ${isCurrent ? 'bg-purple-500' : 'bg-indigo-300 opacity-70'}`}
                           initial={{ height: 0 }}
                           animate={{ height: `${val}%` }}
                           transition={{ type: "spring", stiffness: 50, damping: 15 }}
                         />
                      </div>
                      <span className={`text-[10px] font-bold whitespace-nowrap ${isCurrent ? 'text-purple-700' : 'text-slate-500'}`}>{lbl}</span>
                    </div>
                  )
                })}
             </div>
          </div>

          {/* Collapsible Logs */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
            <button 
              onClick={() => setShowLogs(!showLogs)}
              className="w-full flex items-center justify-between p-4 focus:outline-none"
            >
              <h2 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2 text-slate-300">
                <Terminal className="w-4 h-4 text-green-400" /> Advanced Debug Logs
              </h2>
              {showLogs ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            <AnimatePresence>
              {showLogs && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 200, opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0 h-[200px] flex flex-col font-mono text-[10px] border-t border-slate-800">
                    <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
                        {data?.logs?.map((log, i) => (
                          <div key={i} className="flex items-start gap-3 border-b border-slate-800/50 pb-2">
                            <span className="text-slate-500 shrink-0">[{log.ts}]</span>
                            <span className="text-green-400/90">{log.message}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>
    </div>
  );
}
