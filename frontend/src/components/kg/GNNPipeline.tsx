"use client";
import React from "react";
import { motion } from "framer-motion";
import { Brain, Cpu, ArrowDown, CheckCircle, AlertCircle } from "lucide-react";

interface PipelineLayer {
  layer: string;
  dim: number;
  description: string;
}

interface GNNPipelineData {
  inference_mode: string;
  is_trained: boolean;
  architecture: PipelineLayer[];
  gnn_latency_ms: number;
  tsne_latency_ms: number;
  total_latency_ms: number;
  nodes_processed: number;
  edges_processed: number;
}

interface Props {
  pipeline: GNNPipelineData | null;
  activeNodeId?: string | null;
  isLoading?: boolean;
}

const LAYER_COLORS = [
  { bg: "bg-slate-700/40", border: "border-slate-600/40", text: "text-slate-300", accent: "#64748b" },
  { bg: "bg-blue-900/30", border: "border-blue-600/40", text: "text-blue-300", accent: "#3b82f6" },
  { bg: "bg-indigo-900/30", border: "border-indigo-600/40", text: "text-indigo-300", accent: "#6366f1" },
  { bg: "bg-violet-900/30", border: "border-violet-600/40", text: "text-violet-300", accent: "#8b5cf6" },
  { bg: "bg-rose-900/30", border: "border-rose-600/40", text: "text-rose-300", accent: "#f43f5e" },
];

export default function GNNPipeline({ pipeline, activeNodeId, isLoading }: Props) {
  if (!pipeline) {
    return (
      <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300 font-heading">GNN Pipeline</span>
        </div>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-slate-700/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-slate-800/40 border border-slate-700/30 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold text-slate-300 font-heading">Temporal GNN Pipeline</span>
        </div>
        <div className="flex items-center gap-1.5">
          {pipeline.is_trained ? (
            <CheckCircle className="w-3 h-3 text-green-400" />
          ) : (
            <AlertCircle className="w-3 h-3 text-amber-400" />
          )}
          <span className="text-[9px] font-mono text-slate-400">
            {pipeline.is_trained ? "Trained GNN" : "Physics Fallback"}
          </span>
        </div>
      </div>

      {/* Architecture layers */}
      <div className="space-y-1.5 mb-3">
        {pipeline.architecture.map((layer, idx) => {
          const colors = LAYER_COLORS[idx % LAYER_COLORS.length];
          const isActive = activeNodeId && idx > 0; // simulate layer activation
          return (
            <React.Fragment key={layer.layer}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.08 }}
                className={`relative rounded-lg border p-2.5 ${colors.bg} ${colors.border} ${isActive ? "ring-1 ring-current/20" : ""}`}
              >
                {/* Active pulse indicator */}
                {isActive && (
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full animate-ping absolute"
                      style={{ backgroundColor: colors.accent, opacity: 0.6 }} />
                    <span className="w-1.5 h-1.5 rounded-full relative"
                      style={{ backgroundColor: colors.accent }} />
                  </span>
                )}
                <div className="flex items-center gap-2 pr-6">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
                    style={{ backgroundColor: `${colors.accent}20`, color: colors.accent }}>
                    {layer.dim > 100 ? `${layer.dim / 32}×` : layer.dim}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold ${colors.text} leading-tight truncate`}>{layer.layer}</p>
                    <p className="text-[9px] text-slate-500 leading-tight truncate">{layer.description.slice(0, 55)}…</p>
                  </div>
                </div>
              </motion.div>
              {idx < pipeline.architecture.length - 1 && (
                <div className="flex justify-center">
                  <ArrowDown className="w-3 h-3 text-slate-600" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Latency metrics */}
      <div className="grid grid-cols-3 gap-1.5 border-t border-slate-700/40 pt-3">
        {[
          { label: "GNN", val: `${pipeline.gnn_latency_ms}ms` },
          { label: "t-SNE", val: `${pipeline.tsne_latency_ms}ms` },
          { label: "Total", val: `${pipeline.total_latency_ms}ms` },
        ].map(({ label, val }) => (
          <div key={label} className="text-center">
            <p className="text-[10px] font-mono font-bold text-white">{val}</p>
            <p className="text-[9px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-slate-600 mt-1.5">
        <span>{pipeline.nodes_processed} nodes · {pipeline.edges_processed} edges</span>
        <span className="font-mono">{pipeline.inference_mode}</span>
      </div>
    </div>
  );
}
