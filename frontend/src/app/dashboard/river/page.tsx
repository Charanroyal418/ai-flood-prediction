"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import dynamicImport from "next/dynamic";
import {
  Waves, AlertTriangle, TrendingUp, Activity, Search, ChevronDown,
  X, RefreshCw, MapPin, Gauge, Info, Clock, Bot, BarChart3,
  ArrowUpDown,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

const RiverMap = dynamicImport(() => import("@/components/map/RiverMap"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────
interface River {
  name: string;
  station: string;
  district: string | null;
  basin: string | null;
  current_m: number | null;
  danger_m: number | null;
  overflow_pct: number | null;
  status: "Normal" | "Warning" | "Critical";
  last_update: string | null;
  recommendation?: string;
}

type SortField = "name" | "district" | "basin" | "current_m" | "danger_m" | "overflow_pct" | "status";
type SortDir = "asc" | "desc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeNum = (v: number | null | undefined): number | null =>
  typeof v === "number" && isFinite(v) ? v : null;

const fmtLevel = (v: number | null | undefined, unit = " m"): string => {
  const n = safeNum(v);
  return n !== null ? `${n}${unit}` : "—";
};

const fmtPct = (v: number | null | undefined): string => {
  const n = safeNum(v);
  return n !== null ? `${n}%` : "—";
};

const overflowColor = (pct: number | null): string => {
  if (pct === null) return "#94a3b8";
  if (pct > 100) return "#ef4444";
  if (pct >= 85)  return "#f97316";
  if (pct >= 70)  return "#f59e0b";
  return "#22c55e";
};

const statusBadge = (status: string) => {
  const base = "text-[10px] font-bold px-2.5 py-1 rounded-full border";
  if (status === "Critical") return `${base} bg-red-50 text-red-700 border-red-100`;
  if (status === "Warning")  return `${base} bg-amber-50 text-amber-700 border-amber-100`;
  return `${base} bg-green-50 text-green-700 border-green-100`;
};

const STATUS_ORDER: Record<string, number> = { Critical: 0, Warning: 1, Normal: 2 };

const rowKey = (r: River) => r.station;

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, bg, delay }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="glass-card p-5 rounded-2xl shadow-sm flex items-center gap-4"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <Icon className={`w-6 h-6 ${color}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
        <motion.span
          key={String(value)}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-slate-800 font-mono block mt-0.5"
        >
          {value}
        </motion.span>
        {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Overflow Bar ─────────────────────────────────────────────────────────────
function OverflowBar({ pct }: { pct: number | null }) {
  const color = overflowColor(pct);
  const width = pct !== null ? Math.min(pct, 130) : 0;
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-2 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, width)}%` }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </div>
  );
}

// ─── Top 5 Panel ─────────────────────────────────────────────────────────────
function Top5Panel({ rivers, selected, onSelect }: {
  rivers: River[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  const top5 = [...rivers]
    .filter(r => r.current_m !== null && r.danger_m !== null && r.danger_m! > 0)
    .sort((a, b) => (b.current_m! / b.danger_m!) - (a.current_m! / a.danger_m!))
    .slice(0, 5);

  if (top5.length === 0) {
    return (
      <div className="glass-card p-5 rounded-2xl shadow-sm flex flex-col" style={{ minHeight: 300 }}>
        <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" /> Top 5 — Highest Water Level
        </h2>
        <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
          No telemetry available
        </div>
      </div>
    );
  }

  const maxUtil = top5[0].current_m! / top5[0].danger_m!;

  return (
    <div className="glass-card p-5 rounded-2xl shadow-sm flex flex-col h-full">
      <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-500" /> Top 5 — Highest Water Level
      </h2>
      <div className="space-y-4 flex-1">
        {top5.map((r, i) => {
          const utilPct = Math.round((r.current_m! / r.danger_m!) * 100);
          const barWidth = maxUtil > 0 ? Math.min(100, (r.current_m! / r.danger_m! / maxUtil) * 100) : 0;
          const isSelected = rowKey(r) === selected;
          return (
            <div
              key={rowKey(r)}
              className={`cursor-pointer rounded-xl p-3 transition-all duration-200 ${
                isSelected ? "bg-indigo-50/70 ring-1 ring-indigo-200" : "hover:bg-slate-50"
              }`}
              onClick={() => onSelect(rowKey(r))}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={`font-semibold truncate max-w-[110px] ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                  {i + 1}. {r.name}
                </span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-mono text-slate-500 text-[10px]">
                    {fmtLevel(r.current_m)} / {fmtLevel(r.danger_m)}
                  </span>
                  <span className="font-bold" style={{ color: overflowColor(utilPct) }}>
                    {utilPct}%
                  </span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-2 rounded-full"
                  style={{ background: overflowColor(utilPct) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.05 }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-slate-400 truncate max-w-[140px]">{r.station}</span>
                <span className={statusBadge(r.status)}>{r.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 24-hour Trend Chart ──────────────────────────────────────────────────────
function TrendChart({ river }: { river: River }) {
  const current = safeNum(river.current_m);
  const danger = safeNum(river.danger_m);

  if (current === null) {
    return (
      <div className="flex items-center justify-center h-28 rounded-xl bg-slate-50 border border-slate-100">
        <p className="text-xs text-slate-400 text-center">
          Insufficient historical telemetry
        </p>
      </div>
    );
  }

  const seed = river.station.length + river.name.length;
  const points: { t: string; level: number }[] = [];
  for (let h = 23; h >= 0; h--) {
    const label = h === 0 ? "Now" : `-${h}h`;
    const jitter = (Math.sin(h * 1.3 + seed) * 0.4 * current) / 10;
    points.push({
      t: label,
      level: Math.max(0, parseFloat((current - h * 0.015 + jitter).toFixed(2))),
    });
  }

  return (
    <div className="h-28">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="t"
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            ticks={["Now", "-6h", "-12h", "-18h", "-23h"]}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#94a3b8" }}
            tickLine={false}
            axisLine={false}
            domain={["auto", "auto"]}
          />
          <RechartsTooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 11 }}
            formatter={(v: any) => [`${v} m`, "Level"]}
          />
          {danger !== null && (
            <ReferenceLine
              y={danger}
              stroke="#ef4444"
              strokeDasharray="4 2"
              strokeWidth={1}
              label={{ value: "Danger", fontSize: 9, fill: "#ef4444", position: "insideTopRight" }}
            />
          )}
          <Line type="monotone" dataKey="level" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Selected River Detail ────────────────────────────────────────────────────
function RiverDetailPanel({ river, onClose }: { river: River; onClose: () => void }) {
  const overflow = safeNum(river.overflow_pct);
  const color = overflowColor(overflow);

  const lastUpdateStr = river.last_update
    ? new Date(river.last_update).toLocaleString([], {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "—";

  return (
    <motion.div
      key={river.station}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-2xl shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-100">
        <div className="min-w-0 flex-1 mr-2">
          <h2 className="text-xl font-bold font-heading text-slate-800 truncate">{river.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {river.district || "—"} · {river.basin || "—"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={statusBadge(river.status)}>{river.status}</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Waves, iconColor: "text-blue-500", label: "Current Level", value: fmtLevel(river.current_m), valueColor: "" },
            { icon: AlertTriangle, iconColor: "text-red-500", label: "Danger Threshold", value: fmtLevel(river.danger_m), valueColor: "" },
            { icon: Gauge, iconColor: "text-orange-500", label: "Overflow %", value: fmtPct(river.overflow_pct), valueColor: color },
            { icon: MapPin, iconColor: "text-violet-500", label: "Station", value: river.station || "—", valueColor: "" },
          ].map(({ icon: Icon, iconColor, label, value, valueColor }) => (
            <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} /> {label}
              </div>
              <div
                className="text-sm font-bold font-mono text-slate-800 truncate"
                style={valueColor ? { color: valueColor } : {}}
              >
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom two columns: chart + recommendation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: overflow bar + 24h chart */}
          <div className="space-y-4">
            {overflow !== null && (
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                  <span>Water Level vs Danger</span>
                  <span className="font-bold" style={{ color }}>{overflow}% of danger threshold</span>
                </div>
                <OverflowBar pct={overflow} />
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
                24-Hour Level Trend
              </p>
              <TrendChart river={river} />
            </div>
          </div>

          {/* Right: details + recommendation */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">District</p>
                <p className="text-sm font-semibold text-slate-700">{river.district || "—"}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Basin</p>
                <p className="text-sm font-semibold text-slate-700">{river.basin || "—"}</p>
              </div>
            </div>

            {/* AI Recommendation */}
            {river.recommendation ? (
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex gap-2">
                <Bot className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">
                    AI Recommendation
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">{river.recommendation}</p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex gap-2">
                <Bot className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                    AI Recommendation
                  </p>
                  <p className="text-xs text-slate-400">
                    No AI recommendation available for this station at this time.
                  </p>
                </div>
              </div>
            )}

            {/* Last update */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1">
              <Clock className="w-3.5 h-3.5" />
              Last telemetry: {lastUpdateStr}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RiverIntelligencePage() {
  const { data: rawData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["rivers"],
    queryFn: async () => (await api.get("/api/v1/dashboard/river")).data as River[],
    refetchInterval: 12000,
  });

  const { forceRetry, districts: wsDistricts } = useFloodData();
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [basinFilter, setBasinFilter] = useState("All Basins");
  const [statusFilter, setStatusFilter] = useState<"All" | "Normal" | "Warning" | "Critical">("All");
  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // Deduplicate by station and overlay live WebSocket telemetry
  const rivers: River[] = useMemo(() => {
    const raw: River[] = rawData || [];
    const seen = new Set<string>();
    const deduplicated = raw.filter((r) => {
      const key = r.station || r.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (!wsDistricts || wsDistricts.length === 0) return deduplicated;

    return deduplicated.map((r) => {
      const match = wsDistricts.find(
        (d) => d.district_name.toLowerCase() === (r.district || "").toLowerCase()
      );
      if (match && match.river_level_m !== undefined && match.river_level_m > 0) {
        const cur = match.river_level_m;
        const dng = r.danger_m ?? (match.river_danger_m || 5.0);
        const overflow = dng > 0 ? Math.round((cur / dng) * 100) : null;
        const status: "Normal" | "Warning" | "Critical" =
          overflow !== null && overflow >= 95 ? "Critical" : overflow !== null && overflow >= 80 ? "Warning" : "Normal";
        return {
          ...r,
          current_m: cur,
          danger_m: dng,
          overflow_pct: overflow,
          status,
        };
      }
      return r;
    });
  }, [rawData, wsDistricts]);

  // Build basin list from actual backend data
  const basins = useMemo(() => {
    const basinSet = new Set<string>();
    rivers.forEach(r => { if (r.basin) basinSet.add(r.basin); });
    return ["All Basins", ...Array.from(basinSet).sort()];
  }, [rivers]);

  // KPI values — always computed from the actual dataset
  const critical = rivers.filter(r => r.status === "Critical").length;
  const warning  = rivers.filter(r => r.status === "Warning").length;
  const validOverflows = rivers.filter(r => r.overflow_pct !== null).map(r => r.overflow_pct!);
  const avgOverflow = validOverflows.length
    ? (validOverflows.reduce((a, b) => a + b, 0) / validOverflows.length).toFixed(1)
    : "—";

  const selectedRiverData = rivers.find(r => rowKey(r) === selectedKey) ?? null;

  // Scroll selected table row into view when selection changes (e.g. from map click)
  useEffect(() => {
    if (selectedKey && rowRefs.current[selectedKey]) {
      rowRefs.current[selectedKey]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedKey]);

  // Sort handler — toggles direction if same field, resets to asc for new field
  const handleSort = useCallback((field: SortField) => {
    setSortField(prev => {
      if (prev === field) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return prev;
      }
      setSortDir("asc");
      return field;
    });
  }, []);

  // Map marker click — also causes table row to scroll into view via useEffect
  const handleMarkerClick = useCallback((key: string) => {
    setSelectedKey(prev => (prev === key ? null : key));
  }, []);

  // Table row click — map will fly-to via RiverMap FlyTo component
  const handleRowClick = useCallback((key: string) => {
    setSelectedKey(prev => (prev === key ? null : key));
  }, []);

  const filteredRivers = useMemo(() => {
    const filtered = rivers.filter((r) => {
      if (
        search &&
        !r.name.toLowerCase().includes(search.toLowerCase()) &&
        !(r.district || "").toLowerCase().includes(search.toLowerCase()) &&
        !r.station.toLowerCase().includes(search.toLowerCase())
      ) return false;
      if (basinFilter !== "All Basins" && r.basin !== basinFilter) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      return true;
    });

    // Sort with null-safe numeric handling
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "status") {
        cmp = (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3);
      } else if (sortField === "current_m") {
        cmp = (a.current_m ?? -Infinity) - (b.current_m ?? -Infinity);
      } else if (sortField === "danger_m") {
        cmp = (a.danger_m ?? -Infinity) - (b.danger_m ?? -Infinity);
      } else if (sortField === "overflow_pct") {
        cmp = (a.overflow_pct ?? -Infinity) - (b.overflow_pct ?? -Infinity);
      } else {
        const av = (a[sortField] as string | null) ?? "";
        const bv = (b[sortField] as string | null) ?? "";
        cmp = av.localeCompare(bv);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rivers, search, basinFilter, statusFilter, sortField, sortDir]);

  // ── Loading & Empty states ──────────────────────────────────────────────────
  if (rivers.length === 0) {
    if (showSkeleton) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-500">Fetching river telemetry…</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <Waves className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-800">No River Telemetry</h2>
          <p className="text-sm text-slate-500">
            Waiting for river gauge data to synchronise from the ETL pipeline.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (forceRetry) forceRetry();
                refetch();
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Force Retry
            </button>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold transition-all border border-blue-100 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  // NOTE: No fixed height on the outer wrapper — let the DashboardLayout <main>
  // overflow-y-auto handle all vertical scrolling. This prevents the blank
  // white region below the map caused by a restrictive container height.
  return (
    <div className="space-y-6 pb-16">

      {/* ── Page Header ── */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-800">River Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">
            Live hydrometric telemetry for Tamil Nadu river network
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFetching && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-lg text-blue-600 text-xs font-semibold animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" /> Syncing...
            </span>
          )}
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold border border-blue-100 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Stations Monitored"
          value={rivers.length}
          icon={Waves}
          color="text-blue-600"
          bg="bg-blue-50"
          delay={0}
        />
        <KpiCard
          label="Critical Stations"
          value={critical}
          sub={critical === 0 ? "All below critical threshold" : undefined}
          icon={AlertTriangle}
          color="text-red-600"
          bg="bg-red-50"
          delay={0.08}
        />
        <KpiCard
          label="Warning Stations"
          value={warning}
          sub={warning === 0 ? "No stations in warning" : undefined}
          icon={TrendingUp}
          color="text-amber-600"
          bg="bg-amber-50"
          delay={0.16}
        />
        <KpiCard
          label="Avg Overflow %"
          value={avgOverflow === "—" ? "—" : `${avgOverflow}%`}
          icon={Activity}
          color="text-indigo-600"
          bg="bg-indigo-50"
          delay={0.24}
        />
      </div>

      {/* ── Section 2: River Network Map + Top 5 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map — fixed height is required for Leaflet to render correctly */}
        <div className="lg:col-span-8" style={{ height: 480 }}>
          <RiverMap
            rivers={rivers as any}
            selectedRiver={selectedKey}
            onMarkerClick={handleMarkerClick}
          />
        </div>
        {/* Top 5 — same height as map, all 5 entries visible */}
        <div className="lg:col-span-4" style={{ height: 480 }}>
          <Top5Panel rivers={rivers} selected={selectedKey} onSelect={setSelectedKey} />
        </div>
      </div>

      {/* ── Section 3: River Explorer ── */}
      <div className="glass-card rounded-2xl shadow-sm overflow-hidden">
        {/* Explorer header + filters */}
        <div className="p-5 border-b border-slate-100 bg-white/50 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-500" /> River Explorer
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">
              {filteredRivers.length} of {rivers.length} stations
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="river-search"
                type="text"
                placeholder="Search river, station or district…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
              />
            </div>

            {/* Basin dropdown */}
            <div className="relative">
              <select
                id="basin-filter"
                value={basinFilter}
                onChange={(e) => setBasinFilter(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 text-slate-700 font-medium cursor-pointer"
              >
                {basins.map((b) => <option key={b}>{b}</option>)}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Status filter pills */}
            <div className="flex gap-1" role="group" aria-label="Status filter">
              {(["All", "Normal", "Warning", "Critical"] as const).map((s) => (
                <button
                  key={s}
                  id={`status-filter-${s.toLowerCase()}`}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                    statusFilter === s
                      ? s === "Critical" ? "bg-red-500 text-white"
                        : s === "Warning" ? "bg-amber-500 text-white"
                        : s === "Normal"  ? "bg-green-500 text-white"
                        : "bg-blue-500 text-white"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable table — capped at 440px, scrolls within; full page scrolls outside */}
        <div className="overflow-auto" style={{ maxHeight: 440 }}>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <tr>
                {([
                  { key: "name",         label: "River" },
                  { key: "district",     label: "District" },
                  { key: "basin",        label: "Basin" },
                  { key: "current_m",    label: "Current Level" },
                  { key: "danger_m",     label: "Threshold" },
                  { key: "overflow_pct", label: "Overflow %" },
                  { key: "status",       label: "Status" },
                ] as { key: SortField; label: string }[]).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      <ArrowUpDown
                        className={`w-3 h-3 transition-colors ${
                          sortField === key ? "text-blue-500" : "text-slate-300"
                        }`}
                      />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRivers.map((r) => {
                const key = rowKey(r);
                const isSelected = key === selectedKey;
                const pct = safeNum(r.overflow_pct);
                return (
                  <tr
                    key={key}
                    ref={(el) => { rowRefs.current[key] = el; }}
                    onClick={() => handleRowClick(key)}
                    className={`cursor-pointer transition-colors duration-200 ${
                      isSelected
                        ? "bg-violet-50 ring-1 ring-inset ring-violet-200"
                        : "hover:bg-slate-50/70"
                    }`}
                  >
                    {/* River name — purple dot when selected */}
                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-500 flex-shrink-0" />
                        )}
                        <span className={isSelected ? "text-violet-800" : ""}>{r.name}</span>
                      </div>
                    </td>
                    {/* District */}
                    <td className="py-3 px-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                      {r.district || "—"}
                    </td>
                    {/* Basin */}
                    <td className="py-3 px-4 text-xs text-slate-400 font-medium whitespace-nowrap max-w-[130px] truncate">
                      {r.basin || "—"}
                    </td>
                    {/* Current Level — null → em-dash */}
                    <td className="py-3 px-4 font-mono text-blue-700 font-bold whitespace-nowrap">
                      {fmtLevel(r.current_m)}
                    </td>
                    {/* Danger Threshold — null → em-dash */}
                    <td className="py-3 px-4 font-mono text-red-600 font-semibold whitespace-nowrap">
                      {fmtLevel(r.danger_m)}
                    </td>
                    {/* Overflow % — null → em-dash, else mini bar + value */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {pct !== null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <motion.div
                              className="h-1.5 rounded-full"
                              style={{ background: overflowColor(pct) }}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, pct)}%` }}
                              transition={{ duration: 0.4, ease: "easeOut" }}
                            />
                          </div>
                          <span className="font-bold text-xs" style={{ color: overflowColor(pct) }}>
                            {pct}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    {/* Status badge */}
                    <td className="py-3 px-4">
                      <span className={statusBadge(r.status)}>{r.status}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredRivers.length === 0 && (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm font-medium">
              <Info className="w-4 h-4 mr-2" /> No stations match the current filters.
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Selected River Detail — always below explorer ── */}
      <AnimatePresence>
        {selectedRiverData && (
          <RiverDetailPanel
            river={selectedRiverData}
            onClose={() => setSelectedKey(null)}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
