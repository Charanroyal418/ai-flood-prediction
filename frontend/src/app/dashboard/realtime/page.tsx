"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  CloudLightning, Play, Square, Settings2, MapPin, Droplets,
  Wind, Waves, Clock, Activity, AlertTriangle, ChevronRight,
  TrendingUp, Shield, Zap, BarChart3, RefreshCw, Circle,
} from "lucide-react";
import { useFloodData } from "@/context/FloodDataContext";
import dynamicImport from "next/dynamic";

const FloodMap = dynamicImport(() => import("@/components/map/FloodMap"), { ssr: false, loading: () => <MapSkeleton /> });

function MapSkeleton() {
  return <div className="w-full h-full skeleton flex items-center justify-center"><span className="text-text-secondary text-sm font-medium">Loading Map Data...</span></div>;
}

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
    color: "var(--risk-severe)",
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
    color: "var(--risk-high)",
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
    color: "var(--risk-high)",
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

  const { data: liveData, refetch: refetchLive } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => { const r = await api.get("/dashboard/live"); return r.data; },
    refetchInterval: isActive ? 8000 : 30000,
  });

  const DISTRICTS: string[] = (
    wsDistricts.length > 0
      ? wsDistricts.map((d) => d.district_name)
      : (liveData?.districts ?? []).map((d: any) => d.name)
  ).sort();

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

  const buildTimeline = (p: StormParams): TimelineStep[] => [
    { t: 0, label: "Storm system detected", status: "done", detail: `${p.category} forming` },
    { t: 5, label: "Coastal warning issued", status: "done", detail: `Wind ${p.wind_speed_kmh} km/h` },
    { t: 15, label: "Target districts notified", status: "done", detail: `${p.target_districts.length} districts` },
    { t: 30, label: "Rainfall override injected", status: "pending", detail: `${p.rainfall_mm}mm/24h synthetic rainfall` },
    { t: 45, label: "GNN re-inference triggered", status: "pending", detail: "Re-evaluating 38 districts" },
    { t: 60, label: "Knowledge Graph updated", status: "pending", detail: "Edges recalculated" },
    { t: 75, label: "Alerts generated", status: "pending", detail: "Broadcasting to EOC" },
    { t: 90, label: "Simulation complete", status: "pending", detail: "Processed" },
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

  const handleActivate = () => { stormMutation.mutate({ ...params, active: true }); };
  const handleStop = () => {
    stormMutation.mutate({ active: false, scenario: params.scenario, category: params.category,
      rainfall_mm: 0, wind_speed_kmh: 0, storm_surge_m: 0, duration_minutes: 5,
      target_districts: [], landfall_lat: 0, landfall_lon: 0 });
  };
  const toggleDistrict = (d: string) => {
    setParams(p => ({ ...p, target_districts: p.target_districts.includes(d) ? p.target_districts.filter(x => x !== d) : [...p.target_districts, d] }));
  };

  const criticalCount = liveData?.districts?.filter((d: any) => d.risk_level === "Critical" || d.risk_level === "Severe").length ?? 0;
  const highCount = liveData?.districts?.filter((d: any) => d.risk_level === "High").length ?? 0;
  const avgRisk = liveData?.metrics?.avg_risk_score ?? 0;

  const mapData = wsDistricts.length > 0 
    ? wsDistricts.map((d: any) => ({
        ...(liveData?.districts?.find((x: any) => x.id === d.district_id) || {}),
        id: d.district_id, name: d.district_name, risk_score: d.risk_score, risk_level: d.risk_level, risk_color: d.risk_color,
      }))
    : liveData?.districts;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl text-text-primary flex items-center gap-2">
              <CloudLightning className="w-5 h-5 text-signal-500" />
              Storm Simulator
            </h1>
            {isActive && (
              <span className="risk-badge risk-badge-severe animate-pulse">
                SIMULATION ACTIVE
              </span>
            )}
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Inject synthetic extreme weather scenarios to test GNN pipeline
          </p>
        </div>
        <button onClick={() => refetchLive()} className="btn-secondary">
          <RefreshCw className="w-4 h-4" /> Sync
        </button>
      </div>

      {/* Main Layout: Full-bleed map + Side panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 h-[750px]">
        {/* LEFT/CENTER: Map */}
        <div className="xl:col-span-8 bg-paper-100 border border-line rounded-lg overflow-hidden flex flex-col relative h-full">
           <div className="absolute top-4 left-4 z-[1000] bg-paper-100/90 backdrop-blur-sm border border-line px-3 py-2 rounded shadow-card max-w-xs">
              <p className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-2">Metrics</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-text-secondary uppercase">Avg Risk</p>
                  <p className="font-mono font-bold text-text-primary">{(avgRisk ?? 0).toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-text-secondary uppercase">Critical</p>
                  <p className="font-mono font-bold text-risk-severe">{criticalCount}</p>
                </div>
              </div>
           </div>

           <div className="flex-1 w-full h-full">
             <FloodMap districts={mapData} />
           </div>
        </div>

        {/* RIGHT: Side Panel */}
        <div className="xl:col-span-4 flex flex-col gap-4 overflow-y-auto no-scrollbar">
          
          {/* Controls */}
          <div className={`bg-paper-100 border rounded-lg p-5 transition-colors ${isActive ? "border-risk-high" : "border-line"}`}>
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
                   {isActive ? "Simulation Active" : "Simulation Configuration"}
                </h2>
             </div>
             
             {/* Presets */}
             <div className="mb-4">
                <p className="text-[10px] text-text-secondary uppercase mb-2 font-medium">Presets</p>
                <div className="flex flex-col gap-2">
                  {PRESET_SCENARIOS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => handlePreset(preset)}
                      disabled={isActive}
                      className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
                        params.scenario === preset.name
                          ? "border-signal-500 bg-signal-100/10 text-signal-600"
                          : "border-line bg-paper-50 text-text-primary hover:bg-line/20"
                      } disabled:opacity-50`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">{preset.name}</span>
                        <span className="text-[10px] text-text-secondary font-mono">{preset.rainfall_mm}mm</span>
                      </div>
                    </button>
                  ))}
                </div>
             </div>

             {/* Parameters */}
             <div className="grid grid-cols-2 gap-3 mb-5">
               <div className="bg-paper-50 p-2 rounded border border-line">
                 <p className="text-[9px] text-text-secondary uppercase font-medium flex items-center gap-1"><Droplets className="w-3 h-3"/> Rain</p>
                 <p className="font-mono text-sm text-text-primary">{params.rainfall_mm} mm</p>
               </div>
               <div className="bg-paper-50 p-2 rounded border border-line">
                 <p className="text-[9px] text-text-secondary uppercase font-medium flex items-center gap-1"><Wind className="w-3 h-3"/> Wind</p>
                 <p className="font-mono text-sm text-text-primary">{params.wind_speed_kmh} km/h</p>
               </div>
               <div className="bg-paper-50 p-2 rounded border border-line">
                 <p className="text-[9px] text-text-secondary uppercase font-medium flex items-center gap-1"><Waves className="w-3 h-3"/> Surge</p>
                 <p className="font-mono text-sm text-text-primary">{(params?.storm_surge_m ?? 0).toFixed(1)} m</p>
               </div>
               <div className="bg-paper-50 p-2 rounded border border-line">
                 <p className="text-[9px] text-text-secondary uppercase font-medium flex items-center gap-1"><MapPin className="w-3 h-3"/> Target Nodes</p>
                 <p className="font-mono text-sm text-text-primary">{params.target_districts.length}</p>
               </div>
             </div>

             {/* Action Buttons */}
             <div className="flex gap-2">
               {!isActive ? (
                 <button
                   onClick={handleActivate}
                   disabled={stormMutation.isPending || params.target_districts.length === 0}
                   className="btn-primary w-full justify-center !bg-signal-600 hover:!bg-signal-700"
                 >
                   {stormMutation.isPending ? "Activating..." : "Execute Simulation"}
                 </button>
               ) : (
                 <button
                   onClick={handleStop}
                   disabled={stormMutation.isPending}
                   className="btn-primary w-full justify-center !bg-risk-severe hover:!bg-red-800"
                 >
                   {stormMutation.isPending ? "Stopping..." : "Halt & Restore"}
                 </button>
               )}
             </div>
          </div>

          {/* Timeline */}
          <div className="bg-paper-100 border border-line rounded-lg p-5 flex-1 flex flex-col">
            <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider mb-4 flex justify-between items-center">
              Execution Timeline
              {isActive && <span className="text-[10px] font-mono text-signal-500">T+{elapsed}s</span>}
            </h2>
            <div className="flex-1 overflow-y-auto no-scrollbar relative">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-line" />
              <div className="space-y-4">
                {(timelineSteps.length > 0 ? timelineSteps : buildTimeline(params)).map((step, i) => (
                  <div
                    key={i}
                    className={`relative flex items-start gap-4 pl-8 transition-opacity ${
                      step.status === "active" ? "opacity-100" :
                      step.status === "done" ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <div className={`absolute left-1.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 transition-all ${
                      step.status === "done" ? "bg-signal-500 border-signal-300" :
                      step.status === "active" ? "bg-risk-high border-risk-moderate animate-pulse" :
                      "bg-paper-100 border-line"
                    }`} />

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={`text-[11px] font-semibold ${
                          step.status === "done" ? "text-text-primary" :
                          step.status === "active" ? "text-risk-high" : "text-text-secondary"
                        }`}>{step.label}</p>
                        <span className="text-[9px] font-mono text-text-secondary">T+{step.t}s</span>
                      </div>
                      <p className="text-[10px] text-text-secondary leading-tight">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
