"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CloudLightning, Play, Square, Settings2, MapPin, Droplets,
  Wind, Waves, Clock, Activity, AlertTriangle, ChevronRight,
  TrendingUp, Shield, Zap, BarChart3, RefreshCw, Circle,
} from "lucide-react";
import { useFloodData } from "@/context/FloodDataContext";

// ─── Types ───────────────────────────────────────────────────────────────────
interface StormParams {
  active?: boolean;
  scenario: string;
  category: string;
  rainfall_mm: number;
  wind_speed_kmh: number;
  storm_surge_m: number;
  duration_minutes: number;
  target_districts: string[];
  landfall_lat: number;
  landfall_lon: number;
}

interface TimelineStep {
  t: number;     // seconds from start
  label: string;
  status: "pending" | "active" | "done";
  detail: string;
}

// Districts fetched dynamically from backend — see useQuery below
// No hardcoded district list: all data sourced from live API

const PRESET_SCENARIOS = [
  {
    name: "Cyclone Michaung",
    category: "Very Severe Cyclonic Storm",
    rainfall_mm: 180,
    wind_speed_kmh: 185,
    storm_surge_m: 2.5,
    landfall_lat: 13.08,
    landfall_lon: 80.27,
    districts: ["Chennai", "Thiruvallur", "Kancheepuram", "Cuddalore"],
    color: "#ef4444",
  },
  {
    name: "Cyclone Nivar",
    category: "Very Severe Cyclonic Storm",
    rainfall_mm: 140,
    wind_speed_kmh: 155,
    storm_surge_m: 1.8,
    landfall_lat: 11.94,
    landfall_lon: 79.82,
    districts: ["Cuddalore", "Villupuram", "Chennai"],
    color: "#f97316",
  },
  {
    name: "Cyclone Gaja",
    category: "Severe Cyclonic Storm",
    rainfall_mm: 120,
    wind_speed_kmh: 130,
    storm_surge_m: 1.5,
    landfall_lat: 10.78,
    landfall_lon: 79.83,
    districts: ["Nagapattinam", "Thanjavur", "Tiruvarur"],
    color: "#f59e0b",
  },
  {
    name: "Northeast Monsoon Flash",
    category: "Extreme Rainfall Event",
    rainfall_mm: 250,
    wind_speed_kmh: 40,
    storm_surge_m: 0.3,
    landfall_lat: 13.08,
    landfall_lon: 80.27,
    districts: ["Chennai", "Chengalpattu", "Kancheepuram"],
    color: "#6366f1",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function StormSimulationPage() {
  const queryClient = useQueryClient();
  const { mode, stormSimulationActive, districts: wsDistricts } = useFloodData();
  const isActive = stormSimulationActive || mode === "SIMULATION";

  const [params, setParams] = useState<StormParams>({
    scenario: "Cyclone Michaung",
    category: "Very Severe Cyclonic Storm",
    rainfall_mm: 180,
    wind_speed_kmh: 185,
    storm_surge_m: 2.5,
    duration_minutes: 30,
    target_districts: ["Chennai", "Thiruvallur", "Kancheepuram", "Cuddalore"],
    landfall_lat: 13.08,
    landfall_lon: 80.27,
  });

  const [elapsed, setElapsed] = useState(0);
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Fetch live dashboard data to show impact
  const { data: liveData, refetch: refetchLive } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => { const r = await api.get("/dashboard/live"); return r.data; },
    refetchInterval: isActive ? 8000 : 30000,
  });

  // Build district names from live data (WS first, then REST)
  const DISTRICTS: string[] = (
    wsDistricts.length > 0
      ? wsDistricts.map((d) => d.district_name)
      : (liveData?.districts ?? []).map((d: any) => d.name)
  ).sort();


  // Mutation to activate/deactivate storm
  const stormMutation = useMutation({
    mutationFn: async (body: Partial<StormParams> & { active: boolean }) => {
      const r = await api.post("/dashboard/simulate-storm", body);
      return r.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboardLive"] });
      queryClient.invalidateQueries({ queryKey: ["kgGraphData"] });
    },
  });

  // Build timeline steps dynamically from params
  const buildTimeline = (p: StormParams): TimelineStep[] => [
    { t: 0, label: "Storm system detected", status: "done", detail: `${p.category} forming over Bay of Bengal` },
    { t: 5, label: "Coastal warning issued", status: "done", detail: `Wind speed ${p.wind_speed_kmh} km/h · Storm surge ${p.storm_surge_m}m expected` },
    { t: 15, label: "Target districts notified", status: "done", detail: p.target_districts.slice(0, 3).join(", ") + (p.target_districts.length > 3 ? ` +${p.target_districts.length - 3} more` : "") },
    { t: 30, label: "Rainfall override injected", status: "pending", detail: `${p.rainfall_mm}mm/24h synthetic rainfall applied to ${p.target_districts.length} districts` },
    { t: 45, label: "GNN re-inference triggered", status: "pending", detail: "TemporalFloodGNN re-evaluating all 38 district risk scores" },
    { t: 60, label: "Knowledge Graph updated", status: "pending", detail: "Flood risk propagation edges recalculated via graph attention" },
    { t: 75, label: "High-risk alerts generated", status: "pending", detail: "Alert Engine broadcasting Critical/High alerts to EOC" },
    { t: 90, label: "Simulation complete", status: "pending", detail: `All ${p.target_districts.length} target districts processed` },
  ];

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        setTimelineSteps(
          buildTimeline(params).map((step) => ({
            ...step,
            status: sec >= step.t + 5 ? "done" : sec >= step.t ? "active" : "pending",
          }))
        );
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsed(0);
      setTimelineSteps(buildTimeline(params));
    }
    // Proper cleanup: always clear interval on unmount or dep change
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive]);

  useEffect(() => {
    setTimelineSteps(buildTimeline(params));
  }, [params]);

  const handlePreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setParams(p => ({
      ...p,
      scenario: preset.name,
      category: preset.category,
      rainfall_mm: preset.rainfall_mm,
      wind_speed_kmh: preset.wind_speed_kmh,
      storm_surge_m: preset.storm_surge_m,
      target_districts: preset.districts,
      landfall_lat: preset.landfall_lat,
      landfall_lon: preset.landfall_lon,
    }));
  };

  const handleActivate = () => {
    stormMutation.mutate({ ...params, active: true });
  };

  const handleStop = () => {
    stormMutation.mutate({ active: false, scenario: params.scenario, category: params.category,
      rainfall_mm: 0, wind_speed_kmh: 0, storm_surge_m: 0, duration_minutes: 5,
      target_districts: [], landfall_lat: 0, landfall_lon: 0 });
  };

  const toggleDistrict = (d: string) => {
    setParams(p => ({
      ...p,
      target_districts: p.target_districts.includes(d)
        ? p.target_districts.filter(x => x !== d)
        : [...p.target_districts, d],
    }));
  };

  const criticalCount = liveData?.districts?.filter((d: any) => d.risk_level === "Critical" || d.risk_level === "Severe").length ?? 0;
  const highCount = liveData?.districts?.filter((d: any) => d.risk_level === "High").length ?? 0;
  const avgRisk = liveData?.metrics?.avg_risk_score ?? 0;
  const simMeta = liveData?.storm_simulation ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-heading font-bold text-slate-800 flex items-center gap-2">
              <CloudLightning className="w-6 h-6 text-amber-500" />
              Storm Simulation Engine
            </h1>
            {isActive && (
              <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold uppercase tracking-wider animate-pulse">
                🟠 SIMULATION ACTIVE
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Inject synthetic extreme weather scenarios into the live GNN pipeline to test EOC response protocols.
          </p>
        </div>
        <button
          onClick={() => refetchLive()}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-xs font-semibold hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Sync Live Data
        </button>
      </div>

      {/* Impact Metrics (live) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Avg Risk Score", value: `${avgRisk.toFixed(1)}`, unit: "/100", icon: TrendingUp, color: "text-violet-700", bg: "bg-violet-50" },
          { label: "Critical Districts", value: criticalCount, unit: "", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-50" },
          { label: "High Risk Districts", value: highCount, unit: "", icon: Shield, color: "text-orange-700", bg: "bg-orange-50" },
          { label: isActive ? "Simulation Elapsed" : "Pipeline Latency", value: isActive ? `${elapsed}s` : `${liveData?.metrics?.gdnn_inference_ms ?? 0}ms`, unit: "", icon: Clock, color: "text-blue-700", bg: "bg-blue-50" },
        ].map(({ label, value, unit, icon: Icon, color, bg }) => (
          <motion.div key={label} whileHover={{ y: -2 }} className={`glass-card p-4`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${bg}`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-heading font-bold ${isActive ? "text-amber-600" : color}`}>
              {value}<span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>
            </p>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-5">

        {/* LEFT: Config Panel */}
        <div className="col-span-12 lg:col-span-4 space-y-4">

          {/* Preset Scenarios */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-heading font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" /> Preset Scenarios
            </h2>
            <div className="space-y-2">
              {PRESET_SCENARIOS.map(preset => (
                <button
                  key={preset.name}
                  onClick={() => handlePreset(preset)}
                  disabled={isActive}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-xs font-semibold ${
                    params.scenario === preset.name
                      ? "border-violet-300 bg-violet-50 text-violet-700"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.color }} />
                      <span>{preset.name}</span>
                    </div>
                    <span className="text-[10px] font-normal text-slate-400">{preset.rainfall_mm}mm · {preset.wind_speed_kmh}km/h</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 ml-4">{preset.category}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Parameters */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-heading font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-violet-500" /> Custom Parameters
            </h2>
            <div className="space-y-4">

              {/* Rainfall */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Droplets className="w-3 h-3 text-blue-500" /> Rainfall (24h)
                  </label>
                  <span className="text-[11px] font-mono font-bold text-blue-600">{params.rainfall_mm} mm</span>
                </div>
                <input
                  type="range" min={10} max={600} step={10}
                  value={params.rainfall_mm}
                  disabled={isActive}
                  onChange={e => setParams(p => ({ ...p, rainfall_mm: Number(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none bg-blue-100 accent-blue-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                  <span>Light 10mm</span><span>Extreme 600mm</span>
                </div>
              </div>

              {/* Wind Speed */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Wind className="w-3 h-3 text-cyan-500" /> Wind Speed
                  </label>
                  <span className="text-[11px] font-mono font-bold text-cyan-600">{params.wind_speed_kmh} km/h</span>
                </div>
                <input
                  type="range" min={20} max={350} step={5}
                  value={params.wind_speed_kmh}
                  disabled={isActive}
                  onChange={e => setParams(p => ({ ...p, wind_speed_kmh: Number(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none bg-cyan-100 accent-cyan-500 disabled:opacity-50"
                />
                <div className="flex justify-between text-[9px] text-slate-400 mt-1 font-mono">
                  <span>Calm 20km/h</span><span>Super 350km/h</span>
                </div>
              </div>

              {/* Storm Surge */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Waves className="w-3 h-3 text-teal-500" /> Storm Surge
                  </label>
                  <span className="text-[11px] font-mono font-bold text-teal-600">{params.storm_surge_m.toFixed(1)} m</span>
                </div>
                <input
                  type="range" min={0} max={10} step={0.1}
                  value={params.storm_surge_m}
                  disabled={isActive}
                  onChange={e => setParams(p => ({ ...p, storm_surge_m: Number(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none bg-teal-100 accent-teal-500 disabled:opacity-50"
                />
              </div>

              {/* Duration */}
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-purple-500" /> Duration
                  </label>
                  <span className="text-[11px] font-mono font-bold text-purple-600">{params.duration_minutes} min</span>
                </div>
                <input
                  type="range" min={5} max={120} step={5}
                  value={params.duration_minutes}
                  disabled={isActive}
                  onChange={e => setParams(p => ({ ...p, duration_minutes: Number(e.target.value) }))}
                  className="w-full h-2 rounded-lg appearance-none bg-purple-100 accent-purple-500 disabled:opacity-50"
                />
              </div>

            </div>
          </div>

          {/* Target Districts */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-heading font-bold text-slate-800 mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-red-500" /> Target Districts
              <span className="ml-auto text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">
                {params.target_districts.length} selected
              </span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {DISTRICTS.map(d => (
                <button
                  key={d}
                  onClick={() => toggleDistrict(d)}
                  disabled={isActive}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    params.target_districts.includes(d)
                      ? "bg-red-500 text-white border-red-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Simulation Control + Timeline */}
        <div className="col-span-12 lg:col-span-8 space-y-4">

          {/* Activation Panel */}
          <div className={`glass-card p-6 border-2 transition-all ${isActive ? "border-amber-400 bg-amber-50/30" : "border-slate-200"}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-heading font-bold text-slate-800">
                  {isActive ? `Simulating: ${simMeta.scenario || params.scenario}` : `Ready: ${params.scenario}`}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isActive
                    ? `${simMeta.category || params.category} · ${params.target_districts.length} districts targeted · Elapsed: ${elapsed}s`
                    : `${params.category} · ${params.rainfall_mm}mm rain · ${params.wind_speed_kmh}km/h winds · ${params.target_districts.length} districts`
                  }
                </p>
              </div>
              {isActive && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
                  <span className="text-xs font-bold text-amber-600 font-mono">LIVE SIM</span>
                </div>
              )}
            </div>

            {/* Parameter Summary */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "Rainfall", value: `${params.rainfall_mm}mm`, icon: Droplets, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Wind Speed", value: `${params.wind_speed_kmh}km/h`, icon: Wind, color: "text-cyan-600", bg: "bg-cyan-50" },
                { label: "Storm Surge", value: `${params.storm_surge_m.toFixed(1)}m`, icon: Waves, color: "text-teal-600", bg: "bg-teal-50" },
                { label: "Duration", value: `${params.duration_minutes}min`, icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`rounded-xl p-3 text-center ${bg}`}>
                  <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                  <p className={`text-sm font-heading font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Activate / Stop Button */}
            <div className="flex gap-3">
              {!isActive ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleActivate}
                  disabled={stormMutation.isPending || params.target_districts.length === 0}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg shadow-amber-200 hover:shadow-amber-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {stormMutation.isPending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Activating...</>
                  ) : (
                    <><Play className="w-4 h-4 fill-white" /> Launch Storm Simulation</>
                  )}
                </motion.button>
              ) : (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStop}
                  disabled={stormMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-slate-600 to-slate-800 text-white font-bold text-sm shadow-lg transition-all"
                >
                  {stormMutation.isPending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Stopping...</>
                  ) : (
                    <><Square className="w-4 h-4 fill-white" /> Stop Simulation & Restore Live Data</>
                  )}
                </motion.button>
              )}
            </div>

            {params.target_districts.length === 0 && !isActive && (
              <p className="text-[11px] text-red-500 mt-2 text-center font-semibold">Select at least one target district to activate simulation.</p>
            )}
          </div>

          {/* Animated Timeline */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-heading font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-500" /> Simulation Pipeline Timeline
              {isActive && (
                <span className="ml-auto text-[10px] font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  T+{elapsed}s
                </span>
              )}
            </h2>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-slate-100" />

              <div className="space-y-3">
                {(timelineSteps.length > 0 ? timelineSteps : buildTimeline(params)).map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`relative flex items-start gap-3 pl-9 transition-all ${
                      step.status === "active" ? "opacity-100" :
                      step.status === "done" ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    {/* Step dot */}
                    <div className={`absolute left-2.5 top-1.5 w-3 h-3 rounded-full border-2 transition-all ${
                      step.status === "done" ? "bg-emerald-500 border-emerald-400 shadow-sm shadow-emerald-200" :
                      step.status === "active" ? "bg-amber-400 border-amber-300 animate-pulse" :
                      "bg-white border-slate-300"
                    }`} />

                    <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className={`text-[12px] font-bold ${
                          step.status === "done" ? "text-emerald-700" :
                          step.status === "active" ? "text-amber-700" : "text-slate-500"
                        }`}>{step.label}</p>
                        <span className="text-[9px] font-mono text-slate-400">T+{step.t}s</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">{step.detail}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Impact: Top Affected Districts */}
          {isActive && liveData?.districts && (
            <div className="glass-card p-5">
              <h2 className="text-sm font-heading font-bold text-slate-800 mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-500" /> Live Impact — Top Affected Districts
                <span className="ml-auto text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">SIMULATED</span>
              </h2>
              <div className="space-y-2">
                {liveData.districts
                  .filter((d: any) => params.target_districts.includes(d.name))
                  .sort((a: any, b: any) => b.risk_score - a.risk_score)
                  .slice(0, 5)
                  .map((district: any, i: number) => (
                    <div key={district.name} className="flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 w-4 font-mono">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-[12px] font-semibold text-slate-700">{district.name}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white`}
                            style={{ backgroundColor: district.risk_color || "#ef4444" }}>
                            {district.risk_score.toFixed(1)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <motion.div
                            className="h-2 rounded-full"
                            style={{ backgroundColor: district.risk_color || "#ef4444" }}
                            initial={{ width: 0 }}
                            animate={{ width: `${district.risk_score}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
