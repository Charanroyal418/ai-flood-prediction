"use client";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GitBranch, Clock, BarChart3, AlertTriangle, X, ArrowRight, Droplets, Percent } from "lucide-react";

interface EdgeData {
  edge_id: string;
  source: string;
  target: string;
  source_label: string;
  target_label: string;
  relationship_type: string;
  relationship_label: string;
  color: string;
  weight: number;
  attention: number;
  influence: number;
  propagation_probability: number;
  confidence: number;
  travel_time_min: number;
  source_risk: number;
  target_risk: number;
  last_updated: string;
}

interface Props {
  edgeId: string | null;
  edgeData: EdgeData | null;
  loading: boolean;
  onClose: () => void;
}

const RELATION_DESCRIPTIONS: Record<string, string> = {
  river_flow: "Flood water flows downstream via connected river systems. High weight = fast propagation.",
  adjacency: "Geographic border sharing between districts allows surface runoff transfer.",
  reservoir_release: "Controlled or emergency dam/reservoir water discharge affecting downstream districts.",
  watershed: "Districts share the same watershed basin — rainfall in one affects river levels in another.",
  elevation_dep: "Elevation gradient causes water to flow from high to low terrain automatically.",
  historical_corr: "Historical flood data shows correlated flood events between these districts.",
  rainfall_sim: "Similar rainfall patterns historically observed — correlated meteorological conditions.",
  flow: "River flow connection between districts.",
};

export default function EdgeInspector({ edgeId, edgeData, loading, onClose }: Props) {
  if (!edgeId) return null;

  return (
    <AnimatePresence>
      <motion.div
        key={edgeId}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="h-full flex flex-col overflow-hidden bg-slate-900/95 border-l border-slate-700/50"
        style={{ width: 340, minWidth: 340 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${edgeData?.color}20`, border: `1px solid ${edgeData?.color}40` }}>
              <GitBranch className="w-4 h-4" style={{ color: edgeData?.color }} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">Edge Inspector</p>
              {edgeData && (
                <p className="text-xs font-bold text-white font-heading leading-tight">{edgeData.relationship_label}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading && (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && edgeData && (
            <>
              {/* Connection Flow */}
              <div className="rounded-xl bg-slate-800/60 border border-slate-700/40 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Connection</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg bg-slate-700/50 p-2.5 text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">SOURCE</p>
                    <p className="text-xs font-bold text-white leading-tight">{edgeData.source_label}</p>
                    <p className="text-[10px] font-mono text-orange-400 mt-1">{(Number(edgeData?.source_risk) || 0).toFixed(1)} risk</p>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <ArrowRight className="w-4 h-4" style={{ color: edgeData.color }} />
                    <div className="w-px h-4 rounded-full" style={{ backgroundColor: edgeData.color, opacity: 0.5 }} />
                  </div>
                  <div className="flex-1 rounded-lg bg-slate-700/50 p-2.5 text-center">
                    <p className="text-[9px] text-slate-400 mb-0.5">TARGET</p>
                    <p className="text-xs font-bold text-white leading-tight">{edgeData.target_label}</p>
                    <p className="text-[10px] font-mono text-rose-400 mt-1">{(Number(edgeData?.target_risk) || 0).toFixed(1)} risk</p>
                  </div>
                </div>
              </div>

              {/* Relationship Description */}
              <div className="rounded-xl p-3.5 border" style={{
                backgroundColor: `${edgeData.color}10`,
                borderColor: `${edgeData.color}30`,
              }}>
                <p className="text-[10px] font-bold mb-1" style={{ color: edgeData.color }}>
                  {edgeData.relationship_label}
                </p>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {RELATION_DESCRIPTIONS[edgeData.relationship_type] || "Graph relationship between districts."}
                </p>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "GAT Attention", val: `${(Number(edgeData?.attention ?? 0) * 100).toFixed(1)}%`, icon: BarChart3, color: "text-indigo-400" },
                  { label: "Influence Score", val: (Number(edgeData?.influence) || 0).toFixed(2), icon: AlertTriangle, color: "text-rose-400" },
                  { label: "Propagation Prob", val: `${(Number(edgeData?.propagation_probability ?? 0) * 100).toFixed(1)}%`, icon: Percent, color: "text-amber-400" },
                  { label: "Confidence", val: `${(Number(edgeData?.confidence ?? 0) * 100).toFixed(1)}%`, icon: BarChart3, color: "text-teal-400" },
                  { label: "Edge Type", val: edgeData?.type || "FLOWS_TO", icon: Activity, color: "text-violet-400" },
                  { label: "Edge Weight", val: (Number(edgeData?.weight) || 0).toFixed(3), icon: GitBranch, color: "text-purple-400" },
                ].map(({ label, val, icon: Icon, color }) => (
                  <div key={label} className="rounded-lg bg-slate-800/40 border border-slate-700/30 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`w-3 h-3 ${color}`} />
                      <span className="text-[9px] text-slate-400">{label}</span>
                    </div>
                    <span className={`text-sm font-bold font-mono ${color}`}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Attention + Influence bars */}
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-slate-400">GAT Attention Weight</span>
                    <span className="text-[10px] font-mono font-bold text-white">{(Number(edgeData?.attention ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${edgeData.attention * 100}%` }}
                      className="h-full rounded-full bg-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-slate-400">Propagation Probability</span>
                    <span className="text-[10px] font-mono font-bold text-white">{(Number(edgeData?.propagation_probability ?? 0) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${edgeData.propagation_probability * 100}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: edgeData.color }}
                    />
                  </div>
                </div>
              </div>

              {/* Flood travel explanation */}
              <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-3.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Flood Travel Estimate</p>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Droplets className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>
                    Flood water originating from <strong className="text-white">{edgeData.source_label}</strong> would
                    reach <strong className="text-white">{edgeData.target_label}</strong> in approximately{" "}
                    <strong className="text-cyan-400">~{edgeData.travel_time_min} minutes</strong> via{" "}
                    <strong style={{ color: edgeData.color }}>{edgeData.relationship_label}</strong>.
                  </span>
                </div>
              </div>

              <p className="text-[9px] text-slate-600 text-center pb-1">
                {edgeData.source} → {edgeData.target} · Updated {new Date(edgeData.last_updated).toLocaleTimeString("en-IN")}
              </p>
            </>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
