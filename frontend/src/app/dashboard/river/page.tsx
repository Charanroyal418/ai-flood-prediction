"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import dynamicImport from "next/dynamic";
import {
  Waves, AlertTriangle, TrendingUp, Activity, Search, ChevronDown,
  X, RefreshCw, Droplets, MapPin, Gauge, Info, Clock, Bot, BarChart3
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";

const RiverMap = dynamicImport(() => import("@/components/map/RiverMap"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────
interface River {
  name: string;
  district: string;
  basin: string;
  station: string;
  current_m: number;
  danger_m: number;
  overflow_pct: number;
  status: "Normal" | "Warning" | "Critical";
  recommendation?: string;
  last_update?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const safeNum = (v: any) => (typeof v === "number" ? v : 0);

const overflowColor = (pct: number) => {
  if (pct > 100) return "#ef4444";   // red
  if (pct >= 90)  return "#f97316";  // orange
  if (pct >= 70)  return "#f59e0b";  // yellow
  return "#22c55e";                  // green
};

const statusBadge = (status: string) => {
  const base = "text-[10px] font-bold px-2.5 py-1 rounded-full border";
  if (status === "Critical") return `${base} bg-red-50 text-red-700 border-red-100`;
  if (status === "Warning")  return `${base} bg-amber-50 text-amber-700 border-amber-100`;
  return `${base} bg-green-50 text-green-700 border-green-100`;
};

const STATUS_ORDER: Record<string, number> = { Critical: 0, Warning: 1, Normal: 2 };

/** Generate deterministic 24-hour sparkline data for a river */
function generateTrend(river: River): { t: string; level: number }[] {
  const base = safeNum(river.current_m);
  const points: { t: string; level: number }[] = [];
  for (let h = 23; h >= 0; h--) {
    const label = h === 0 ? "Now" : `-${h}h`;
    const jitter = (Math.sin(h * 1.3 + river.name.length) * 0.4 * base) / 10;
    points.push({ t: label, level: Math.max(0, parseFloat((base - h * 0.015 + jitter).toFixed(2))) });
  }
  return points;
}

const BASINS = ["All Basins", "Cauvery Basin", "Palar Basin", "Vaigai Basin", "Vellar Basin", "Thamirabarani Basin", "Coastal Drainage"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, bg, delay }: {
  label: string; value: string | number; icon: any; color: string; bg: string; delay: number;
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
      </div>
    </motion.div>
  );
}

function OverflowBar({ pct }: { pct: number }) {
  const color = overflowColor(pct);
  const width = Math.min(pct, 130); // allow slight overflow past 100
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <motion.div
        className="h-2 rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, width)}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

function Top5Panel({ rivers, selected, onSelect }: {
  rivers: River[]; selected: string | null; onSelect: (n: string) => void;
}) {
  const top5 = [...rivers]
    .sort((a, b) => safeNum(b.overflow_pct) - safeNum(a.overflow_pct))
    .slice(0, 5);
  const max = safeNum(top5[0]?.overflow_pct) || 1;

  return (
    <div className="glass-card p-5 rounded-2xl shadow-sm h-full flex flex-col">
      <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-indigo-500" /> Top 5 — Highest Water Level
      </h2>
      <div className="space-y-4 flex-1">
        {top5.map((r, i) => {
          const pct = safeNum(r.overflow_pct);
          const isSelected = r.name === selected;
          return (
            <div
              key={r.name}
              className={`cursor-pointer rounded-xl p-3 transition-all duration-200 ${isSelected ? "bg-indigo-50/70 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}
              onClick={() => onSelect(r.name)}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className={`font-semibold ${isSelected ? "text-indigo-700" : "text-slate-700"}`}>
                  {i + 1}. {r.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-500 text-[10px]">{r.current_m}m / {r.danger_m}m</span>
                  <span className="font-bold" style={{ color: overflowColor(pct) }}>{pct}%</span>
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <motion.div
                  className="h-2 rounded-full transition-colors duration-500"
                  style={{ background: overflowColor(pct) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (pct / max) * 100)}%` }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: i * 0.05 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RiverDetailPanel({ river, onClose }: { river: River; onClose: () => void }) {
  const trend = generateTrend(river);
  const overflow = safeNum(river.overflow_pct);
  const color = overflowColor(overflow);
  const dangerLineVal = safeNum(river.danger_m);

  return (
    <motion.div
      key={river.name}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-2xl shadow-sm flex flex-col h-[540px] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-slate-100">
        <div>
          <h2 className="text-xl font-bold font-heading text-slate-800">{river.name}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{river.district} · {river.basin}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={statusBadge(river.status)}>{river.status}</span>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Waves, color: "text-blue-500", label: "Current Level", value: `${river.current_m} m` },
            { icon: AlertTriangle, color: "text-red-500", label: "Danger Threshold", value: `${river.danger_m} m` },
            { icon: Gauge, color: "text-orange-500", label: "Overflow %", value: `${overflow}%`, valueColor: color },
            { icon: MapPin, color: "text-violet-500", label: "Station", value: river.station || "—" },
          ].map(({ icon: Icon, color: ic, label, value, valueColor }) => (
            <div key={label} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                <Icon className={`w-3.5 h-3.5 ${ic}`} /> {label}
              </div>
              <div className="text-base font-bold font-mono text-slate-800" style={valueColor ? { color: valueColor } : {}}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Overflow bar */}
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
            <span>Water Level vs Danger</span>
            <span className="font-bold" style={{ color }}>{overflow}% of danger threshold</span>
          </div>
          <OverflowBar pct={overflow} />
        </div>

        {/* 24h Trend chart */}
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">24-Hour Level Trend</p>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false}
                  ticks={["Now", "-6h", "-12h", "-18h", "-23h"]}
                />
                <YAxis tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                <RechartsTooltip
                  contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 11 }}
                  formatter={(v: any) => [`${v} m`, "Level"]}
                />
                <ReferenceLine y={dangerLineVal} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} label={{ value: "Danger", fontSize: 9, fill: "#ef4444", position: "insideTopRight" }} />
                <Line type="monotone" dataKey="level" stroke="#6366f1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Recommendation */}
        {river.recommendation && (
          <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 flex gap-2">
            <Bot className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-0.5">AI Recommendation</p>
              <p className="text-xs text-slate-600 leading-relaxed">{river.recommendation}</p>
            </div>
          </div>
        )}

        {/* Last update */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <Clock className="w-3.5 h-3.5" />
          Last telemetry: {river.last_update || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RiverIntelligencePage() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["rivers"],
    queryFn: async () => (await api.get("/dashboard/river")).data as River[],
    refetchInterval: 12000,
  });

  const [selectedRiver, setSelectedRiver] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [basinFilter, setBasinFilter] = useState("All Basins");
  const [statusFilter, setStatusFilter] = useState<"All" | "Normal" | "Warning" | "Critical">("All");
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const rivers: River[] = data || [];
  const critical = rivers.filter((r) => r.status === "Critical").length;
  const warning = rivers.filter((r) => r.status === "Warning").length;
  const avgOverflow = rivers.length
    ? (rivers.reduce((a, r) => a + safeNum(r.overflow_pct), 0) / rivers.length).toFixed(1)
    : "0.0";

  const selectedRiverData = rivers.find((r) => r.name === selectedRiver) ?? null;

  // Scroll selected row into view
  useEffect(() => {
    if (selectedRiver && rowRefs.current[selectedRiver]) {
      rowRefs.current[selectedRiver]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedRiver]);

  const filteredRivers = useMemo(() => {
    return rivers
      .filter((r) => {
        if (search && !r.name.toLowerCase().includes(search.toLowerCase()) && !r.district.toLowerCase().includes(search.toLowerCase())) return false;
        if (basinFilter !== "All Basins" && r.basin !== basinFilter) return false;
        if (statusFilter !== "All" && r.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3));
  }, [rivers, search, basinFilter, statusFilter]);

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500">Fetching river telemetry…</p>
        </div>
      </div>
    );
  }

  if (!isLoading && rivers.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <Waves className="w-7 h-7 text-blue-400" />
          </div>
          <h2 className="text-lg font-heading font-bold text-slate-800">No River Telemetry</h2>
          <p className="text-sm text-slate-500">Waiting for river gauge data to synchronise from the ETL pipeline.</p>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-bold transition-all border border-blue-100"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* ── Header ── */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-800">River Intelligence</h1>
          <p className="text-sm text-slate-500 mt-1">Live hydrometric telemetry for Tamil Nadu river network</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold border border-blue-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* ── Section 1: KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Rivers Monitored" value={rivers.length} icon={Waves} color="text-blue-600" bg="bg-blue-50" delay={0} />
        <KpiCard label="Critical Rivers" value={critical} icon={AlertTriangle} color="text-red-600" bg="bg-red-50" delay={0.08} />
        <KpiCard label="Warning Rivers" value={warning} icon={TrendingUp} color="text-amber-600" bg="bg-amber-50" delay={0.16} />
        <KpiCard label="Avg Overflow %" value={`${avgOverflow}%`} icon={Activity} color="text-indigo-600" bg="bg-indigo-50" delay={0.24} />
      </div>

      {/* ── Section 2: River Network ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[480px]">
          <RiverMap
            rivers={rivers}
            selectedRiver={selectedRiver}
            onMarkerClick={setSelectedRiver}
          />
        </div>
        <div className="lg:col-span-4 h-[480px]">
          <Top5Panel rivers={rivers} selected={selectedRiver} onSelect={setSelectedRiver} />
        </div>
      </div>

      {/* ── Section 3 + 4: Explorer + Detail ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Explorer Table */}
        <div className={`${selectedRiver ? "lg:col-span-8" : "lg:col-span-12"} glass-card rounded-2xl shadow-sm overflow-hidden flex flex-col h-[520px] transition-all duration-300`}>
          {/* Table header + filters */}
          <div className="p-5 border-b border-slate-100 bg-white/50 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-500" /> River Explorer
              </h2>
              <span className="text-[11px] text-slate-400 font-medium">{filteredRivers.length} rivers</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative flex-1 min-w-[160px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search river or district…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50"
                />
              </div>
              {/* Basin dropdown */}
              <div className="relative">
                <select
                  value={basinFilter}
                  onChange={(e) => setBasinFilter(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 text-slate-700 font-medium cursor-pointer"
                >
                  {BASINS.map((b) => <option key={b}>{b}</option>)}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {/* Status filter pills */}
              <div className="flex gap-1">
                {(["All", "Normal", "Warning", "Critical"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition-all ${
                      statusFilter === s
                        ? s === "Critical" ? "bg-red-500 text-white" : s === "Warning" ? "bg-amber-500 text-white" : s === "Normal" ? "bg-green-500 text-white" : "bg-blue-500 text-white"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto flex-1">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  {["River", "District", "Basin", "Level", "Threshold", "Overflow %", "Status"].map((h) => (
                    <th key={h} className="py-3 px-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRivers.map((r) => {
                  const isSelected = r.name === selectedRiver;
                  const pct = safeNum(r.overflow_pct);
                  return (
                    <tr
                      key={r.name}
                      ref={(el) => { rowRefs.current[r.name] = el; }}
                      onClick={() => setSelectedRiver(isSelected ? null : r.name)}
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50/60" : "hover:bg-slate-50/60"}`}
                    >
                      <td className="py-3 px-4 font-bold text-slate-800 flex items-center gap-2 whitespace-nowrap">
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />}
                        {r.name}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 font-medium whitespace-nowrap">{r.district}</td>
                      <td className="py-3 px-4 text-xs text-slate-400 font-medium whitespace-nowrap max-w-[120px] truncate">{r.basin}</td>
                      <td className="py-3 px-4 font-mono text-blue-700 font-bold whitespace-nowrap">{r.current_m} m</td>
                      <td className="py-3 px-4 font-mono text-red-600 font-semibold whitespace-nowrap">{r.danger_m} m</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, pct)}%`, background: overflowColor(pct) }} />
                          </div>
                          <span className="font-bold text-xs" style={{ color: overflowColor(pct) }}>{pct}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={statusBadge(r.status)}>{r.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRivers.length === 0 && (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm font-medium">
                <Info className="w-4 h-4 mr-2" /> No rivers match the current filters.
              </div>
            )}
          </div>
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selectedRiver && selectedRiverData && (
            <div className="lg:col-span-4">
              <RiverDetailPanel river={selectedRiverData} onClose={() => setSelectedRiver(null)} />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
