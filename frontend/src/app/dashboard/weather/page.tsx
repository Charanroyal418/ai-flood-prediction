"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { 
  CloudRain, Thermometer, Wind, Droplets, MapPin, 
  Mountain, Waves, Activity, AlertTriangle 
} from "lucide-react";
import dynamicImport from "next/dynamic";
const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });

// Helper to determine spatial topology
const getTopology = (districtName: string) => {
  const coastal = ["Chennai", "Cuddalore", "Nagapattinam", "Kanyakumari", "Thoothukudi"].includes(districtName);
  return {
    basin: coastal ? "Coastal Drainage System" : "Cauvery / Palar Basin",
    elevation: coastal ? "0-15m (Low)" : "100-300m (Moderate)",
    drainage_score: coastal ? 35 : 75, // Out of 100
  };
};

function WeatherIntelligenceCard({ district, index }: { district: any; index: number }) {
  const topo = getTopology(district.name);
  const isHeavyRain = district.rainfall_mm > 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -2, scale: 1.01 }}
      className="glass-card p-5 relative overflow-hidden"
    >
      {/* Background Warning Gradient if Heavy Rain */}
      {isHeavyRain && (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
      )}
      
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-heading font-bold text-slate-800">{district.name}</h3>
          <p className="text-xs text-slate-500 font-medium tracking-wide">
            {topo.basin}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold font-mono text-indigo-600">{district.rainfall_mm}</span>
          <span className="text-xs text-slate-500 ml-1">mm/24h</span>
        </div>
      </div>

      {/* Weather Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-bold text-slate-700">{district.temperature}°C</span>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-bold text-slate-700">{district.humidity}%</span>
        </div>
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex items-center gap-2">
          <Wind className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-bold text-slate-700">12km/h</span>
        </div>
      </div>

      {/* Spatial / Topological Metrics for GDNN */}
      <div className="pt-3 border-t border-slate-100 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-2">GDNN Spatial Inputs</p>
        
        <div className="flex justify-between items-center text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-600">
            <Mountain className="w-3.5 h-3.5 text-slate-400" /> Elevation (DEM)
          </span>
          <span className="font-bold text-slate-800">{topo.elevation}</span>
        </div>
        
        <div className="flex justify-between items-center text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-600">
            <Waves className="w-3.5 h-3.5 text-slate-400" /> Drainage Score
          </span>
          <span className="flex items-center gap-2">
            <span className="font-bold text-slate-800">{topo.drainage_score}/100</span>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full">
              <div 
                className={`h-full rounded-full ${topo.drainage_score < 40 ? 'bg-red-400' : 'bg-green-400'}`} 
                style={{ width: `${topo.drainage_score}%` }} 
              />
            </div>
          </span>
        </div>
      </div>

      {/* Risk Output */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
        <span className="text-[10px] font-semibold text-slate-500">AI Risk Prediction</span>
        <span className="text-[10px] font-bold px-2 py-1 rounded text-white" style={{ background: district.risk_color }}>
          {district.risk_level} Risk
        </span>
      </div>
    </motion.div>
  );
}

export default function WeatherCenter() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "live"],
    queryFn: async () => (await api.get("/dashboard/live")).data,
    refetchInterval: 15000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }

  const districts = data.districts || [];
  
  // ECharts Trend
  const trendOptions = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], boundaryGap: false },
    yAxis: { type: 'value', name: 'Rainfall (mm)' },
    series: [
      {
        name: 'State Average',
        type: 'line',
        smooth: true,
        data: [12, 15, 40, 85, 42, 10, 5],
        itemStyle: { color: '#6366f1' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#6366f1' }, { offset: 1, color: 'rgba(99,102,241,0)' }]
          }
        }
      }
    ]
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-800">AI Weather Intelligence Center</h1>
          <p className="text-sm text-slate-500 mt-1">Spatial-temporal meteorological telemetry & GDNN input vectors</p>
        </div>
      </div>

      {/* Global State Trend */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-heading font-bold text-slate-800 mb-4 flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-indigo-500" /> 7-Day Precipitation Forecast
        </h2>
        <div className="h-[250px]">
          <ReactECharts option={trendOptions} style={{ height: "100%", width: "100%" }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {districts.map((district: any, index: number) => (
          <WeatherIntelligenceCard key={district.id} district={district} index={index} />
        ))}
      </div>
    </div>
  );
}
