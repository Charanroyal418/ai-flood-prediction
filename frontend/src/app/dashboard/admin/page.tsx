"use client";

/**
 * Admin Panel
 * ============
 * System administration dashboard for FloodSense AI.
 * Requires Admin role.
 */
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Brain, RefreshCw, Database, Activity, Users, Shield,
  ChevronDown, ChevronUp, CheckCircle, AlertTriangle, Clock,
  Play, BarChart3, Server, LogIn, Cpu, HardDrive, Zap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PipelineStatus {
  pipeline: {
    status: string;
    inference_mode: string;
    model_loaded: boolean;
    last_inference_at: string | null;
    last_inference_ms: number | null;
    last_weather_at: string | null;
    last_prediction_at: string | null;
  };
  database: {
    districts: number;
    predictions_total: number;
    weather_records_total: number;
    kg_events_total: number;
  };
  etl: { running: boolean; last_run: string | null; result: any };
  gnn_training: {
    running: boolean; last_run: string | null;
    result: any; progress: any;
  };
}

interface ModelMetrics {
  accuracy: number;
  best_val_loss: number;
  best_epoch: number;
  total_epochs_trained: number;
  per_class_accuracy: Record<string, number>;
  model_params: number;
  training_time_s: number;
  trained_at: string;
  architecture: string;
  inference_mode: string;
  model_loaded: boolean;
}

// ── Helper Components ─────────────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
      ok
        ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50"
        : "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800/50"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-green-500" : "bg-red-500"}`} />
      {label}
    </span>
  );
}

function MetricStat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-bold font-heading gradient-text">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = "" }: {
  title: string;
  icon: any;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-6 ${className}`}
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
          <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400" />
        </div>
        <h2 className="font-heading font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {children}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const router = useRouter();
  const qc = useQueryClient();
  const { accessToken, isAdmin, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const [gnnSnapshots, setGnnSnapshots] = useState(150);
  const [logsOpen, setLogsOpen] = useState(false);

  // Execute admin endpoints ONLY when user is an admin with a valid token
  const canQueryAdmin = Boolean(!authLoading && isAuthenticated && isAdmin && accessToken);

  const handle401 = useCallback(() => {
    logout();
    if (typeof window !== "undefined") {
      router.replace("/login");
    }
  }, [logout, router]);

  // If auth has loaded and user is not admin or unauthenticated, redirect to login
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin || !accessToken)) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, isAdmin, accessToken, router]);

  // Fetch pipeline status
  const { data: status, isLoading: statusLoading } = useQuery<PipelineStatus | null>({
    queryKey: ["adminPipelineStatus"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/v1/admin/pipeline/status");
        if (res?.status === 401 || (res as any)?.isUnauthorized) return null;
        return res?.data ?? null;
      } catch (err: any) {
        if (err?.response?.status === 401) return null;
        return null;
      }
    },
    enabled: canQueryAdmin,
    retry: false,
    throwOnError: false,
    refetchInterval: (query) => (canQueryAdmin && !query.state.error ? 5000 : false),
  });

  // Fetch model metrics
  const { data: metrics } = useQuery<ModelMetrics | null>({
    queryKey: ["adminModelMetrics"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/v1/admin/ml/metrics");
        if (res?.status === 401 || (res as any)?.isUnauthorized) return null;
        return res?.data ?? null;
      } catch (err: any) {
        if (err?.response?.status === 401) return null;
        return null;
      }
    },
    enabled: canQueryAdmin,
    retry: false,
    throwOnError: false,
  });

  // Fetch logs
  const { data: logsData } = useQuery({
    queryKey: ["adminLogs"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/v1/admin/logs?limit=30");
        if (res?.status === 401 || (res as any)?.isUnauthorized) return null;
        return res?.data ?? null;
      } catch (err: any) {
        if (err?.response?.status === 401) return null;
        return null;
      }
    },
    enabled: Boolean(canQueryAdmin && logsOpen),
    retry: false,
    throwOnError: false,
  });

  // GNN training status poll
  const { data: gnnStatus } = useQuery({
    queryKey: ["gnnTrainStatus"],
    queryFn: async () => {
      try {
        const res = await api.get("/api/v1/admin/ml/retrain-gnn/status");
        if (res?.status === 401 || (res as any)?.isUnauthorized) return null;
        return res?.data ?? null;
      } catch (err: any) {
        if (err?.response?.status === 401) return null;
        return null;
      }
    },
    enabled: canQueryAdmin,
    retry: false,
    throwOnError: false,
    refetchInterval: (query) => (canQueryAdmin && !query.state.error ? 3000 : false),
  });

  // Mutations
  const triggerETL = useMutation({
    mutationFn: () => api.post("/api/v1/admin/etl/run"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminPipelineStatus"] }),
  });

  const triggerGNN = useMutation({
    mutationFn: () => api.post(`/api/v1/admin/ml/retrain-gnn?n_snapshots=${gnnSnapshots}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gnnTrainStatus"] });
      qc.invalidateQueries({ queryKey: ["adminModelMetrics"] });
    },
  });

  const resetCaches = useMutation({
    mutationFn: () => api.post("/api/v1/admin/pipeline/reset"),
    onSuccess: () => qc.invalidateQueries(),
  });

  const isTraining = gnnStatus?.running || gnnStatus?.progress?.stage === "training";
  const trainingPct = gnnStatus?.progress?.pct ?? 0;

  if (authLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-violet-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin || !accessToken) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="glass-card max-w-md p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-900 dark:text-white">Admin Access Required</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You must be logged in with an administrator account to access this panel. Redirecting to login...
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="btn-primary text-xs py-2 px-4 mx-auto inline-flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" /> Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">
            Administration Panel
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            System control, model training, and pipeline management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
            status?.pipeline.status === "running"
              ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800/50"
              : "bg-slate-50 text-slate-600 border-slate-200"
          }`}>
            <span className="w-2 h-2 rounded-full bg-green-500 status-dot-online" />
            Platform Online
          </span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Districts", value: status?.database.districts ?? "—",
            icon: Database, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20"
          },
          {
            label: "Predictions", value: status?.database.predictions_total?.toLocaleString() ?? "—",
            icon: Brain, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-900/20"
          },
          {
            label: "Weather Records", value: status?.database.weather_records_total?.toLocaleString() ?? "—",
            icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20"
          },
          {
            label: "KG Events", value: status?.database.kg_events_total?.toLocaleString() ?? "—",
            icon: Zap, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20"
          },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold font-heading text-slate-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Status */}
        <SectionCard title="Pipeline Status" icon={Activity}>
          {statusLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="skeleton h-8 rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-600 dark:text-slate-400">Inference Mode</span>
                <StatusBadge ok={!!status?.pipeline.model_loaded} label={status?.pipeline.inference_mode ?? "Unknown"} />
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-600 dark:text-slate-400">Last Inference</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {status?.pipeline.last_inference_at
                    ? new Date(status.pipeline.last_inference_at).toLocaleTimeString()
                    : "Never"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-600 dark:text-slate-400">Inference Time</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {status?.pipeline.last_inference_ms
                    ? `${(Number(status.pipeline.last_inference_ms) || 0).toFixed(1)} ms`
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-sm text-slate-600 dark:text-slate-400">Last Weather ETL</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {status?.pipeline.last_weather_at
                    ? new Date(status.pipeline.last_weather_at).toLocaleTimeString()
                    : "Never"}
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => triggerETL.mutate()}
                  disabled={status?.etl.running || triggerETL.isPending}
                  className="btn-secondary text-xs py-2 px-3 flex-1 disabled:opacity-50"
                  id="btn-trigger-etl"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${status?.etl.running ? "animate-spin" : ""}`} />
                  {status?.etl.running ? "Running..." : "Run ETL"}
                </button>
                <button
                  onClick={() => resetCaches.mutate()}
                  disabled={resetCaches.isPending}
                  className="btn-secondary text-xs py-2 px-3 flex-1 disabled:opacity-50"
                  id="btn-reset-caches"
                >
                  <Zap className="w-3.5 h-3.5" />
                  Reset Caches
                </button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* GNN Training */}
        <SectionCard title="GNN Model Training" icon={Brain}>
          <div className="space-y-4">
            {/* Training Progress Bar */}
            {isTraining && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>{gnnStatus?.progress?.message || "Training..."}</span>
                  <span className="font-semibold">{trainingPct}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                    animate={{ width: `${trainingPct}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            )}

            {/* Last Training Result */}
            {gnnStatus?.result?.status === "success" && !isTraining && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800/50">
                <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="text-xs text-green-800 dark:text-green-300">
                  Training complete. Accuracy: <strong>{(Number(gnnStatus.result.metrics?.accuracy ?? 0) * 100).toFixed(1)}%</strong>
                </div>
              </div>
            )}
            {gnnStatus?.result?.status === "error" && !isTraining && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-800/50">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                <div className="text-xs text-red-800 dark:text-red-300">
                  Training failed: {gnnStatus.result.error}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Training Snapshots: <strong className="text-slate-800 dark:text-slate-200">{gnnSnapshots}</strong>
                </label>
                <input
                  type="range"
                  min={50} max={500} step={25}
                  value={gnnSnapshots}
                  onChange={(e) => setGnnSnapshots(Number(e.target.value))}
                  className="w-full accent-violet-500"
                  id="input-gnn-snapshots"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>50 (fast)</span><span>500 (thorough)</span>
                </div>
              </div>

              <button
                onClick={() => triggerGNN.mutate()}
                disabled={isTraining || triggerGNN.isPending}
                className="btn-primary w-full text-sm disabled:opacity-50"
                id="btn-retrain-gnn"
              >
                <Brain className={`w-4 h-4 ${isTraining ? "animate-pulse" : ""}`} />
                {isTraining ? `Training... ${trainingPct}%` : "Retrain GAT+GRU Model"}
              </button>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              Architecture: GRU(32) → GAT(4-head,64) → GAT(1-head,32) → Linear(5)
            </p>
          </div>
        </SectionCard>
      </div>

      {/* Model Metrics */}
      {metrics && (
        <SectionCard title="Current Model Performance" icon={BarChart3}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
            <MetricStat
              label="Test Accuracy"
              value={`${(Number(metrics.accuracy ?? 0) * 100).toFixed(1)}%`}
            />
            <MetricStat
              label="Best Val Loss"
              value={typeof metrics.best_val_loss === 'number' ? metrics.best_val_loss.toFixed(4) : "—"}
              sub={`Epoch ${metrics.best_epoch}`}
            />
            <MetricStat
              label="Model Parameters"
              value={metrics.model_params?.toLocaleString() ?? "—"}
            />
            <MetricStat
              label="Training Time"
              value={`${metrics.training_time_s}s`}
            />
          </div>

          {metrics.per_class_accuracy && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Per-Class Accuracy
              </p>
              {Object.entries(metrics.per_class_accuracy).map(([cls, acc]) => (
                <div key={cls} className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 dark:text-slate-400 w-20">{cls}</span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${(acc as number) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 w-10 text-right">
                    {(Number(acc) * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              <strong>Architecture:</strong> {metrics.architecture}
              {" · "}
              <strong>Trained:</strong> {metrics.trained_at ? new Date(metrics.trained_at).toLocaleDateString() : "N/A"}
              {" · "}
              <strong>Mode:</strong> {metrics.inference_mode}
            </p>
          </div>
        </SectionCard>
      )}

      {/* System Logs */}
      <SectionCard title="System Logs" icon={Server}>
        <button
          onClick={() => setLogsOpen(!logsOpen)}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors w-full"
          id="btn-toggle-logs"
        >
          {logsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {logsOpen ? "Hide" : "Show"} scheduler logs (last 30 entries)
        </button>

        {logsOpen && logsData && (
          <div className="mt-4 rounded-xl bg-slate-950 p-4 font-code text-xs space-y-1 max-h-80 overflow-y-auto custom-scroll">
            {logsData.map((log: any) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="text-slate-500 whitespace-nowrap">
                  {log.created_at ? new Date(log.created_at).toLocaleTimeString() : "—"}
                </span>
                <span className={`font-semibold whitespace-nowrap ${
                  log.event === "STARTED" || log.event === "SUCCESS" ? "text-green-400" :
                  log.event === "ERROR" ? "text-red-400" :
                  log.event === "STOPPED" ? "text-amber-400" : "text-slate-400"
                }`}>{log.event}</span>
                <span className="text-slate-300">{log.message}</span>
              </div>
            ))}
            {logsData.length === 0 && (
              <span className="text-slate-500">No logs found.</span>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
