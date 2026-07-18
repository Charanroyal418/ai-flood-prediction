/**
 * LiveConnectionBadge
 * --------------------
 * Visual indicator showing WebSocket connection status.
 * Displayed in the dashboard header/navbar.
 *
 * States:
 * - connected: pulsing green dot + "Live" label
 * - connecting: spinning yellow dot + "Connecting..."
 * - disconnected: grey dot + "Offline"
 * - error: red dot + "Error"
 */

"use client";

import { useFloodData } from "@/context/FloodDataContext";
import { WsConnectionStatus } from "@/lib/useWebSocket";

const STATUS_CONFIG: Record<
  WsConnectionStatus,
  { label: string; dotClass: string; textClass: string; pulse: boolean }
> = {
  connected: {
    label: "Live",
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-400",
    pulse: true,
  },
  connecting: {
    label: "Connecting...",
    dotClass: "bg-yellow-500",
    textClass: "text-yellow-400",
    pulse: false,
  },
  disconnected: {
    label: "Offline",
    dotClass: "bg-slate-500",
    textClass: "text-slate-400",
    pulse: false,
  },
  error: {
    label: "Error",
    dotClass: "bg-red-500",
    textClass: "text-red-400",
    pulse: false,
  },
};

interface LiveConnectionBadgeProps {
  channel?: "dashboard" | "kg";
  className?: string;
}

export function LiveConnectionBadge({
  channel = "dashboard",
  className = "",
}: LiveConnectionBadgeProps) {
  const { dashboardStatus, kgStatus, lastUpdated } = useFloodData();

  const status = channel === "kg" ? kgStatus : dashboardStatus;
  const config = STATUS_CONFIG[status];

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 backdrop-blur-sm ${className}`}
    >
      {/* Status dot */}
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dotClass} opacity-75`}
          />
        )}
        <span
          className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dotClass}`}
        />
      </span>

      {/* Label */}
      <span className={`text-xs font-medium ${config.textClass}`}>
        {config.label}
      </span>

      {/* Last update time */}
      {formattedTime && status === "connected" && (
        <span className="text-xs text-slate-500 hidden sm:block">
          {formattedTime}
        </span>
      )}
    </div>
  );
}

/**
 * PipelineStatusBar
 * ------------------
 * Full-width status bar showing pipeline tick metadata.
 * Shown below the navbar on the dashboard.
 */
export function PipelineStatusBar() {
  const { modelMeta, lastUpdated, criticalCount, dashboardStatus } =
    useFloodData();

  if (dashboardStatus !== "connected") return null;

  return (
    <div className="w-full flex items-center justify-between px-6 py-1.5 bg-slate-900/80 border-b border-slate-800/50 text-xs text-slate-400">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-600">Mode:</span>
          <span className="text-violet-400 font-medium">
            {modelMeta?.inference_mode ?? "Loading..."}
          </span>
        </span>
        {modelMeta && (
          <>
            <span className="text-slate-600">|</span>
            <span>
              <span className="text-slate-600">Nodes: </span>
              <span className="text-cyan-400">{modelMeta.node_count}</span>
            </span>
            <span className="text-slate-600">|</span>
            <span>
              <span className="text-slate-600">Latency: </span>
              <span className="text-green-400">{modelMeta.latency_ms?.toFixed(0)}ms</span>
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {criticalCount > 0 && (
          <span className="text-red-400 font-medium animate-pulse">
            ⚠ {criticalCount} district{criticalCount > 1 ? "s" : ""} at Severe/High risk
          </span>
        )}
        {lastUpdated && (
          <span>
            <span className="text-slate-600">Updated: </span>
            <span>
              {new Date(lastUpdated).toLocaleTimeString("en-IN")}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
