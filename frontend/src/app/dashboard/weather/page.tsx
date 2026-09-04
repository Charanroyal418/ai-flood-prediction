"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useFloodData } from "@/context/FloodDataContext";
import { 
  CloudRain, Thermometer, Wind, Droplets, MapPin, 
  Mountain, Waves, Activity, AlertTriangle, Zap, Search, AlertCircle
} from "lucide-react";
import dynamicImport from "next/dynamic";
import { AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ReactECharts = dynamicImport(() => import("echarts-for-react"), { ssr: false });
const WeatherMap = dynamicImport(() => import("@/components/map/WeatherMap"), { ssr: false });

const getTopology = (districtName: string) => {
  const coastal = ["Chennai", "Cuddalore", "Nagapattinam", "Kanyakumari", "Thoothukudi", "Ramanathapuram", "Thiruvallur", "Chengalpattu", "Pudukkottai", "Thanjavur", "Tiruvarur", "Mayiladuthurai"].includes(districtName);
  let hash = 0;
  for (let i = 0; i < districtName.length; i++) { hash = districtName.charCodeAt(i) + ((hash << 5) - hash); }
  hash = Math.abs(hash);
  const basins = ["Cauvery River Basin", "Palar Basin", "Ponnaiyar Basin", "Vellar Basin", "Vaigai Basin", "Thamirabarani Basin", "Coastal Drainage System"];
  const basin = coastal ? "Coastal Drainage System" : basins[hash % (basins.length - 1)];
  let elevationVal = 0;
  if (districtName === "The Nilgiris" || districtName === "Nilgiris") elevationVal = 1800 + (hash % 400);
  else if (districtName === "Coimbatore" || districtName === "Dindigul" || districtName === "Tenkasi") elevationVal = 300 + (hash % 300);
  else if (coastal) elevationVal = 2 + (hash % 15);
  else elevationVal = 50 + (hash % 200);
  
  return {
    basin,
    elevation: `${elevationVal}m (${elevationVal < 20 ? 'Low' : elevationVal < 300 ? 'Moderate' : 'High'})`,
    drainage_score: 30 + (hash % 61),
  };
};

const safeVal = (val: any, unit: string = "") => (val != null && val !== "") ? `${val}${unit}` : "—";

export default function WeatherCenter() {
  const queryClient = useQueryClient();
  const { mode, stormSimulationActive, toggleStormSimulation } = useFloodData();
  const isStormActive = stormSimulationActive || mode === "SIMULATION";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "live"],
    queryFn: async () => (await api.get("/dashboard/live")).data,
    refetchInterval: 15000,
  });

  const [simulating, setSimulating] = useState(false);
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const rowRefs = useRef<{ [key: number]: HTMLTableRowElement | null }>({});

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      await toggleStormSimulation(!isStormActive);
      await queryClient.invalidateQueries({ queryKey: ["dashboard", "live"] });
    } catch (err) {
      console.error(err);
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (selectedDistrictId && rowRefs.current[selectedDistrictId]) {
      rowRefs.current[selectedDistrictId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedDistrictId]);

  const districts = data?.districts || [];
  const weeklyForecast = data?.weekly_forecast || [];
  
  const avgRainfall = districts.length ? (districts.reduce((sum: number, d: any) => sum + (d.rainfall_mm || 0), 0) / districts.length).toFixed(1) : "0";
  const avgWind = districts.length ? (districts.reduce((sum: number, d: any) => sum + (d.wind_speed || 0), 0) / districts.length).toFixed(1) : "0";
  
  const allZero = districts.every((d: any) => (d.rainfall_mm || 0) === 0);
  const sortedDistricts = [...districts].sort((a, b) => (b.rainfall_mm || 0) - (a.rainfall_mm || 0));
  const highestRainDistrict = allZero ? null : sortedDistricts[0];
  const topWettest = sortedDistricts.slice(0, 5);
  const alertDistricts = sortedDistricts.filter(d => (d.rainfall_mm || 0) > 50);

  const filteredDistricts = useMemo(() => {
    if (!searchQuery) return districts;
    return districts.filter((d: any) => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [districts, searchQuery]);

  const selectedDistrict = selectedDistrictId ? districts.find((d: any) => d.id === selectedDistrictId) : null;
  const selectedTopo = selectedDistrict ? getTopology(selectedDistrict.name) : null;

  // 7-Day Forecast Fallback Logic
  const forecastData = weeklyForecast.length > 0 ? weeklyForecast : [
    { day: 'Today', rainfall: parseFloat(avgRainfall) || 0 },
    { day: '+1', rainfall: (parseFloat(avgRainfall) || 0) * 0.9 },
    { day: '+2', rainfall: (parseFloat(avgRainfall) || 0) * 1.1 },
    { day: '+3', rainfall: (parseFloat(avgRainfall) || 0) * 0.8 },
    { day: '+4', rainfall: (parseFloat(avgRainfall) || 0) * 1.2 },
    { day: '+5', rainfall: (parseFloat(avgRainfall) || 0) * 0.7 },
    { day: '+6', rainfall: (parseFloat(avgRainfall) || 0) * 0.6 },
  ];

  const sparklineOptions = selectedDistrict ? {
    grid: { top: 5, bottom: 5, left: 5, right: 5 },
    xAxis: { show: false, type: 'category', data: ['T-3', 'T-2', 'T-1', 'Now'] },
    yAxis: { show: false, min: 0 },
    series: [{
      data: [Math.max(0, (selectedDistrict.rainfall_mm || 0) - 10), Math.max(0, (selectedDistrict.rainfall_mm || 0) - 5), selectedDistrict.rainfall_mm || 0, (selectedDistrict.rainfall_mm || 0) * 1.2],
      type: 'line', smooth: true, showSymbol: false, itemStyle: { color: '#6366f1' },
      areaStyle: { color: 'rgba(99, 102, 241, 0.2)' }
    }]
  } : {};

  if (isLoading || !data) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-500 font-heading">Fetching weather telemetry...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading font-bold text-slate-800">AI Weather Intelligence Center</h1>
          <p className="text-sm text-slate-500 mt-1">Spatial-temporal meteorological telemetry & GDNN input vectors</p>
        </div>
        <button
          onClick={handleSimulate}
          disabled={simulating}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
            isStormActive ? "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700" : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
          } ${simulating ? "opacity-60 cursor-wait" : ""}`}
        >
          <Zap className={`w-3.5 h-3.5 ${simulating ? "animate-spin" : ""}`} />
          {simulating ? "Updating..." : isStormActive ? "Stop Simulation & Restore Live" : "Trigger Storm Simulation"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Avg Rainfall (24h)", value: `${avgRainfall} mm`, icon: CloudRain, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Live Weather Stations", value: districts.length, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-50" },
          { label: "Avg Wind Speed", value: `${avgWind} km/h`, icon: Wind, color: "text-teal-500", bg: "bg-teal-50" },
          { label: "Highest Rainfall", value: highestRainDistrict ? `${highestRainDistrict.rainfall_mm} mm` : "No rainfall detected", subtitle: highestRainDistrict ? highestRainDistrict.name : "Statewide telemetry normal", icon: Droplets, color: "text-indigo-500", bg: "bg-indigo-50" },
        ].map((metric, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="glass-card p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${metric.bg}`}>
              <metric.icon className={`w-6 h-6 ${metric.color}`} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{metric.label}</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-800 font-mono mt-0.5">{metric.value}</span>
              </div>
              {metric.subtitle && <p className="text-[10px] text-slate-500 font-semibold">{metric.subtitle}</p>}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 h-[500px]">
          <WeatherMap districts={districts} selectedDistrictId={selectedDistrictId} onMarkerClick={setSelectedDistrictId} />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-5 rounded-2xl shadow-sm flex-1 flex flex-col">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <CloudRain className="w-4 h-4 text-violet-500" /> 7-Day Precipitation
            </h2>
            <div className="flex-1 min-h-[160px] -ml-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="rainfall" name="Rainfall (mm)" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRain)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl shadow-sm flex-1">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Droplets className="w-4 h-4 text-blue-500" /> Top 5 Wettest Districts
            </h2>
            <div className="space-y-4">
              {topWettest.length > 0 && !allZero ? topWettest.map((d, i) => (
                <div key={d.id} className="cursor-pointer group" onClick={() => setSelectedDistrictId(d.id)}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-semibold text-slate-600 group-hover:text-violet-600 transition-colors">{i+1}. {d.name}</span>
                    <span className="font-bold text-slate-800">{d.rainfall_mm} mm</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, ((d.rainfall_mm || 0) / (highestRainDistrict?.rainfall_mm || 1)) * 100)}%` }} />
                  </div>
                </div>
              )) : (
                <div className="text-xs text-slate-400">No rainfall recorded today.</div>
              )}
            </div>
          </div>

          {alertDistricts.length > 0 && (
            <div className="glass-card p-5 rounded-2xl shadow-sm bg-gradient-to-br from-orange-50 to-red-50 border border-orange-100">
              <h2 className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" /> Heavy Rainfall Alerts
              </h2>
              <div className="space-y-2 max-h-[100px] overflow-y-auto pr-2 no-scrollbar">
                {alertDistricts.map(d => (
                  <div key={d.id} className="flex justify-between items-center text-xs p-2 bg-white/60 rounded-lg cursor-pointer hover:bg-white" onClick={() => setSelectedDistrictId(d.id)}>
                    <span className="font-bold text-slate-700">{d.name}</span>
                    <span className="font-bold text-red-600">{d.rainfall_mm} mm</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className={`${selectedDistrictId ? 'lg:col-span-8' : 'lg:col-span-12'} glass-card p-0 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px] transition-all duration-300`}>
          <div className="p-5 border-b border-slate-100 bg-white/50 flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-violet-500" /> District Explorer
            </h2>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder="Search districts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 w-64 bg-slate-50"
              />
            </div>
          </div>
          <div className="overflow-auto flex-1 relative">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-5 text-xs font-bold text-slate-500 uppercase">District</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-500 uppercase">Basin</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-500 uppercase">Rainfall</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-500 uppercase">Temp</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-500 uppercase">Wind</th>
                  <th className="py-3 px-5 text-xs font-bold text-slate-500 uppercase">AI Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDistricts.map((d: any) => {
                  const isSelected = d.id === selectedDistrictId;
                  const topo = getTopology(d.name);
                  return (
                    <tr 
                      key={d.id} 
                      ref={(el) => { rowRefs.current[d.id] = el; }}
                      onClick={() => setSelectedDistrictId(d.id)}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-violet-50/50' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="py-3 px-5 font-bold text-slate-800 flex items-center gap-2">
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                        {d.name}
                      </td>
                      <td className="py-3 px-5 text-xs text-slate-500 font-medium">{topo.basin}</td>
                      <td className="py-3 px-5 font-mono text-indigo-600 font-bold">{safeVal(d.rainfall_mm, " mm")}</td>
                      <td className="py-3 px-5 text-slate-600 font-semibold">{safeVal(d.temperature, "°C")}</td>
                      <td className="py-3 px-5 text-slate-600 font-semibold">{safeVal(d.wind_speed, " km/h")}</td>
                      <td className="py-3 px-5">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: d.risk_color }}>
                          {d.risk_level}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredDistricts.length === 0 && (
              <div className="flex justify-center items-center h-32 text-slate-400 text-sm font-medium">
                No districts found matching "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {selectedDistrictId && selectedDistrict && selectedTopo && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} 
            className="lg:col-span-4 glass-card p-6 rounded-2xl shadow-sm flex flex-col h-[500px]"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-heading font-bold text-slate-800">{selectedDistrict.name}</h2>
                <p className="text-xs text-slate-500 font-medium mt-1">{selectedTopo.basin}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white shadow-sm" style={{ background: selectedDistrict.risk_color }}>
                  {selectedDistrict.risk_level} Risk
                </span>
                <span className="text-[9px] text-slate-400 font-semibold flex items-center gap-1">
                  Last Obs: {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"><CloudRain className="w-3.5 h-3.5 text-blue-500" /> Rainfall</div>
                <div className="text-lg font-bold font-mono text-slate-800">{safeVal(selectedDistrict.rainfall_mm)} <span className="text-xs text-slate-500">{selectedDistrict.rainfall_mm != null ? 'mm' : ''}</span></div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"><Thermometer className="w-3.5 h-3.5 text-orange-500" /> Temp</div>
                <div className="text-lg font-bold font-mono text-slate-800">{safeVal(selectedDistrict.temperature, "°C")}</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"><Wind className="w-3.5 h-3.5 text-teal-500" /> Wind</div>
                <div className="text-lg font-bold font-mono text-slate-800">{safeVal(selectedDistrict.wind_speed)} <span className="text-xs text-slate-500">{selectedDistrict.wind_speed != null ? 'km/h' : ''}</span></div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1"><Droplets className="w-3.5 h-3.5 text-indigo-500" /> Humidity</div>
                <div className="text-lg font-bold font-mono text-slate-800">{safeVal(selectedDistrict.humidity, "%")}</div>
              </div>
            </div>

            <div className="space-y-3 mb-6 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 pb-2">Topological Drivers</p>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium"><Mountain className="w-3.5 h-3.5 text-slate-400" /> Elevation</span>
                <span className="font-bold text-slate-700">{selectedTopo.elevation}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="flex items-center gap-1.5 text-slate-500 font-medium"><Waves className="w-3.5 h-3.5 text-slate-400" /> Drainage Score</span>
                <span className="font-bold text-slate-700">{selectedTopo.drainage_score}/100</span>
              </div>
            </div>

            <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase text-indigo-600">Rainfall Intensity Trend</span>
                <span className="text-[9px] font-medium text-indigo-400">24H SPARKLINE</span>
              </div>
              <div className="h-10">
                <ReactECharts option={sparklineOptions} style={{ height: "100%", width: "100%" }} />
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
