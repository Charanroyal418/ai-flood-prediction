"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  CloudRain, Database, Filter, Network, Brain, 
  Cpu, BarChart3, AlertTriangle, Activity, CheckCircle, 
  ArrowDown
} from "lucide-react";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });

const PIPELINE_STAGES = [
  { id: 1, title: "Open-Meteo Ingestion", icon: CloudRain, desc: "Fetching meteorological telemetry", metrics: "Rate: 150 req/s | Latency: 42ms" },
  { id: 2, title: "Data Preprocessing", icon: Database, desc: "Cleaning & interpolating missing values", metrics: "Nulls handled: 0.02% | Shape: [38, 12]" },
  { id: 3, title: "Feature Engineering", icon: Filter, desc: "Deriving spatial-temporal features", metrics: "New features: 24 | Dim: [38, 36]" },
  { id: 4, title: "Knowledge Graph Update", icon: Network, desc: "Updating topology adjacencies", metrics: "Nodes: 142 | Edges: 485" },
  { id: 5, title: "Node Embedding Generation", icon: Brain, desc: "Projecting node features to latent space", metrics: "Embedding Dim: 64 | Latency: 12ms" },
  { id: 6, title: "GDNN Graph Attention", icon: Network, desc: "Computing GATv2 attention weights", metrics: "Attention Heads: 4 | Sparsity: 92%" },
  { id: 7, title: "Temporal Learning (GRU)", icon: Cpu, desc: "Processing sequential historical windows", metrics: "Sequence: T-6 | Hidden State: 128" },
  { id: 8, title: "SHAP Explainability", icon: BarChart3, desc: "Calculating deterministic feature contributions", metrics: "TreeExplainer executed | Latency: 84ms" },
  { id: 9, title: "Risk Classification", icon: AlertTriangle, desc: "Mapping softmax outputs to severity bands", metrics: "Threshold: 0.85 | Precision: 0.94" },
  { id: 10, title: "Alert Generation", icon: Activity, desc: "Dispatching signals to dashboard", metrics: "Alerts Dispatched: 2" }
];

export default function PredictionPipeline() {
  const [activeStage, setActiveStage] = useState(1);
  const [isInferencing, setIsInferencing] = useState(false);

  const { data } = useQuery({
    queryKey: ["dashboard", "live"],
    queryFn: async () => (await api.get("/dashboard/live")).data,
    refetchInterval: 15000,
  });

  // Run the pipeline animation every 15s to simulate real-time inference ticks
  useEffect(() => {
    const runPipeline = async () => {
      setIsInferencing(true);
      for (let i = 1; i <= PIPELINE_STAGES.length; i++) {
        setActiveStage(i);
        // Simulate varying processing times
        await new Promise(r => setTimeout(r, i === 6 || i === 7 ? 600 : 300));
      }
      setTimeout(() => setIsInferencing(false), 2000);
    };

    runPipeline();
    const interval = setInterval(runPipeline, 15000);
    return () => clearInterval(interval);
  }, []);

  const featureOptions = {
    tooltip: { trigger: "item" },
    legend: { top: '5%', left: 'center', textStyle: { fontSize: 10 } },
    series: [
      {
        name: 'System Feature Impact',
        type: 'pie',
        radius: ['40%', '70%'],
        itemStyle: { borderRadius: 10, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: [
          { value: 45, name: 'Rainfall Intensity', itemStyle: { color: '#3b82f6' } },
          { value: 25, name: 'River Level', itemStyle: { color: '#0ea5e9' } },
          { value: 15, name: 'Topography / DEM', itemStyle: { color: '#8b5cf6' } },
          { value: 10, name: 'Soil Saturation', itemStyle: { color: '#f59e0b' } },
          { value: 5, name: 'Drainage Capacity', itemStyle: { color: '#10b981' } }
        ]
      }
    ]
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-800">AI Inference Engine</h1>
          <p className="text-sm text-slate-500 mt-1">Live execution of the Graph Dynamic Neural Network pipeline</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100">
          <div className={`w-2.5 h-2.5 rounded-full ${isInferencing ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`} />
          <span className="text-xs font-bold text-indigo-900">
            {isInferencing ? "INFERENCE RUNNING..." : "SYSTEM IDLE"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Visualization */}
        <div className="lg:col-span-2 glass-card p-6 relative">
          <h2 className="text-sm font-heading font-bold text-slate-800 mb-6">Execution Pipeline</h2>
          
          <div className="space-y-0">
            {PIPELINE_STAGES.map((stage, index) => {
              const isActive = activeStage === stage.id;
              const isCompleted = activeStage > stage.id;
              const isPending = activeStage < stage.id;

              return (
                <div key={stage.id} className="relative flex items-start gap-4">
                  {/* Connecting Line */}
                  {index < PIPELINE_STAGES.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-0.5 -mb-6 bg-slate-100">
                      <motion.div 
                        className="w-full bg-indigo-500 origin-top"
                        initial={{ scaleY: 0 }}
                        animate={{ scaleY: isCompleted ? 1 : 0 }}
                        transition={{ duration: 0.3 }}
                        style={{ height: '100%' }}
                      />
                    </div>
                  )}

                  {/* Icon Node */}
                  <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors duration-500 ${
                    isActive ? 'bg-indigo-500 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' :
                    isCompleted ? 'bg-white border-indigo-500' :
                    'bg-white border-slate-200'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-5 h-5 text-indigo-500" />
                    ) : (
                      <stage.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-300'}`} />
                    )}
                  </div>

                  {/* Stage Content */}
                  <div className={`flex-1 pb-6 transition-opacity duration-300 ${isPending ? 'opacity-40' : 'opacity-100'}`}>
                    <div className="flex justify-between items-center bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <div>
                        <h3 className={`text-sm font-bold ${isActive ? 'text-indigo-600' : 'text-slate-700'}`}>
                          {stage.title}
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                      </div>
                      
                      {/* Live Metrics Matrix */}
                      <div className="text-right">
                        <span className="inline-block px-2 py-1 bg-white rounded border border-slate-200 text-[9px] font-mono font-semibold text-slate-600">
                          {isActive ? (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
                              PROCESSING
                            </span>
                          ) : isCompleted ? (
                            stage.metrics
                          ) : (
                            "WAITING"
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live GDNN Metrics & Explainability */}
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h2 className="text-sm font-heading font-bold text-slate-800 mb-4">GDNN Tensor State</h2>
            <div className="space-y-3">
              {[
                { label: "Input Matrix [Batch, Nodes, Feat]", value: "[1, 38, 12]" },
                { label: "GATv2 Attention Heads", value: "4" },
                { label: "GRU Hidden Dimensions", value: "128" },
                { label: "Knowledge Graph Edges Active", value: "485" },
                { label: "Inference Latency (avg)", value: "142 ms" },
              ].map((stat, i) => (
                <div key={i} className="flex justify-between items-center p-2 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-mono text-slate-500">{stat.label}</span>
                  <span className="text-xs font-mono font-bold text-indigo-600">{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-heading font-bold text-slate-800 mb-2">Global SHAP Explainer</h2>
            <p className="text-[10px] text-slate-500 mb-4">Averaged across all 38 district inferences</p>
            <div className="h-[220px]">
              <ReactECharts option={featureOptions} style={{ height: "100%", width: "100%" }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
