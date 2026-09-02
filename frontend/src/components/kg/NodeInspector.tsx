"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Droplets, Waves, Mountain, Users, Thermometer, Wind, X, Activity, Zap, TrendingUp, Navigation } from "lucide-react";
import { safeFormat } from "@/lib/utils";

interface ShapValue {
  label: string;
  feature: string;
  value: number;
  color: string;
  contribution_pct: number;
}

interface IncomingEdge {
  from_node: string;
  from_label: string;
  relationship_type: string;
  weight: number;
  attention: number;
  influence: number;
  travel_time_min: number;
  confidence: number;
}

interface NodeData {
  node_id: string;
  label: string;
  type: string;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  confidence: number;
  inference_mode: string;
  class_probabilities: Record<string, number>;
  telemetry: {
    rainfall_mm_24h: number;
    temperature_c: number;
    humidity_pct: number;
    pressure_hpa: number;
    river_name: string;
    river_level_m: number;
    river_danger_level_m: number;
    river_ratio_pct: number;
    elevation_m: number;
    population: number;
  };
  gnn_state: {
    embedding_vector: number[];
    embedding_norm: number;
    embedding_dim: number;
    incoming_influence: number;
  };
  shap_values: ShapValue[];
  incoming_edges: IncomingEdge[];
  outgoing_edges: any[];
  last_updated: string;
}

interface Props {
  nodeId: string | null;
  nodeData: NodeData | null;
  loading: boolean;
  onClose: () => void;
}

const RISK_COLORS: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-400 border-red-500/40",
  High: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  Moderate: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  Low: "bg-green-500/20 text-green-400 border-green-500/40",
  Safe: "bg-blue-500/20 text-blue-400 border-blue-500/40",
};

const RELATION_LABELS: Record<string, string> = {
  river_flow: "River Flow",
  adjacency: "Border",
  reservoir_release: "Reservoir",
  watershed: "Watershed",
  elevation_dep: "Elevation",
  historical_corr: "Historical",
  flow: "River Flow",
};

export default function NodeInspector({ nodeId, nodeData, loading, onClose }: Props) {
  if (!nodeId) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={nodeId}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="h-full flex flex-col overflow-hidden bg-slate-900/95 border-l border-slate-700/50"
        style={{ width: 360, minWidth: 360 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Brain className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Node Inspector</p>
              {nodeData && (
                <p className="text-sm font-bold text-white font-heading leading-tight">{nodeData.label}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && nodeData && (
            <>
              {/* Risk Score */}
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flood Risk Score</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RISK_COLORS[nodeData.risk_level] || RISK_COLORS.Safe}`}>
                    {nodeData.risk_level}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-4xl font-bold text-white">{safeFormat(nodeData.risk_score, 1, "0.0")}</span>
                  <span className="text-lg font-medium text-white/70">/100</span>
                  <span className="ml-auto text-xs text-slate-400">{safeFormat(nodeData.confidence * 100, 1, "0.0")}% confidence</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${nodeData.risk_score}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: nodeData.risk_color }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 font-mono">
                  {nodeData.inference_mode} inference · {nodeData.node_id}
                </p>
              </div>

              {/* Telemetry Grid */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Live Telemetry</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: Droplets, label: "Rainfall", val: `${nodeData.telemetry.rainfall_mm_24h} mm/24h`, color: "text-blue-400" },
                    { icon: Waves, label: "River Level", val: `${nodeData.telemetry.river_level_m}m / ${nodeData.telemetry.river_danger_level_m}m`, color: "text-cyan-400" },
                    { icon: Thermometer, label: "Temp", val: `${nodeData.telemetry.temperature_c}°C`, color: "text-amber-400" },
                    { icon: Wind, label: "Pressure", val: `${nodeData.telemetry.pressure_hpa}hPa`, color: "text-emerald-400" },
                    { icon: Users, label: "Population", val: `${safeFormat(nodeData.telemetry.population / 1e6, 2, "0.00")}M`, color: "text-purple-400" },
                    { icon: Navigation, label: "Elevation", val: `${nodeData.telemetry.elevation_m}m`, color: "text-indigo-400" },
                  ].map(({ icon: Icon, label, val, color }) => (
                    <div key={label} className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={`w-3 h-3 ${color}`} />
                        <span className="text-[10px] text-slate-400">{label}</span>
                      </div>
                      <span className="text-xs font-bold text-white font-mono">{val}</span>
                    </div>
                  ))}
                </div>
                {/* River ratio bar */}
                <div className="mt-2 rounded-lg bg-slate-800/40 border border-slate-700/30 p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-400 font-mono">River Level vs Danger</span>
                    <span className="text-[10px] font-bold text-white">{safeFormat(nodeData.telemetry.river_ratio_pct, 1, "0.0")}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, nodeData.telemetry.river_ratio_pct)}%` }}
                      className={`h-full rounded-full ${nodeData.telemetry.river_ratio_pct > 80 ? "bg-red-500" : nodeData.telemetry.river_ratio_pct > 60 ? "bg-orange-500" : "bg-blue-500"}`}
                    />
                  </div>
                </div>
              </div>

              {/* GNN State */}
              <div className="rounded-xl bg-indigo-900/20 border border-indigo-700/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">GNN State</p>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-[10px] text-slate-400 font-mono mb-1">Embedding Norm</p>
                    <p className="text-sm font-bold text-white font-mono">{safeFormat(nodeData.gnn_state.embedding_norm, 3, "0.000")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-mono mb-1">Incoming Influence</p>
                    <p className="text-sm font-bold text-indigo-300 font-mono">{safeFormat(nodeData.gnn_state.incoming_influence, 3, "0.000")}</p>
                  </div>
                </div>
                {/* Embedding vector mini visualization */}
                <div>
                  <p className="text-[10px] text-slate-500 mb-1">Embedding Vector (first 16 dims)</p>
                  <div className="flex gap-0.5 h-8 items-end">
                    {nodeData.gnn_state.embedding_vector.slice(0, 16).map((v, i) => {
                      const h = Math.abs(v);
                      const pct = Math.min(1, h / (nodeData.gnn_state.embedding_norm || 1)) * 100;
                      return (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(8, pct)}%` }}
                          transition={{ delay: i * 0.02 }}
                          className={`flex-1 rounded-sm ${v >= 0 ? "bg-indigo-500/70" : "bg-rose-500/70"}`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SHAP Explainability */}
              {nodeData.shap_values.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Why This Risk? (SHAP)</p>
                  </div>
                  <div className="space-y-2">
                    {nodeData.shap_values.slice(0, 6).map((sv, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase">{sv.feature}</span>
                          <span className="text-[10px] font-mono font-bold text-white">{safeFormat(sv.contribution_pct, 1, "0.0")}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${sv.contribution_pct}%` }}
                            transition={{ delay: i * 0.1 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: sv.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Incoming Influence */}
              {nodeData.incoming_edges.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Incoming Influence</p>
                  </div>
                  <div className="space-y-2">
                    {nodeData.incoming_edges.slice(0, 5).map((edge, i) => (
                      <div key={i} className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-rose-400">+{safeFormat(edge.influence, 1, "0.0")} risk</span>
                          <span className="text-[10px] font-mono text-slate-400">via {edge.relationship_type.replace('_', ' ')}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[9px] text-slate-500 font-mono border-t border-slate-700/50 pt-1">
                          <span>{edge.travel_time_min}min lag</span>
                          <span>{safeFormat(edge.confidence * 100, 1, "0.0")}% conf</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk class breakdown */}
              {Object.keys(nodeData.class_probabilities).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">GNN Class Probabilities</p>
                  <div className="space-y-1.5">
                    {Object.entries(nodeData.class_probabilities).map(([cls, prob]) => (
                      <div key={cls}>
                        <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0" key={cls}>
                          <span className="text-[10px] font-mono font-bold text-white">{cls}</span>
                          <span className="text-[10px] font-mono text-slate-400">{safeFormat(prob * 100, 1, "0.0")}%</span>
                        </div>
                        <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${prob * 100}%` }}
                            className="h-full rounded-full bg-indigo-500/60"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[9px] text-slate-600 text-center pb-2">
                Last updated {new Date(nodeData.last_updated).toLocaleTimeString("en-IN")}
              </p>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
