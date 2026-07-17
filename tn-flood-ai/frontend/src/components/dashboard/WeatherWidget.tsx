"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { Activity, Thermometer, CloudRain, Wind } from "lucide-react";

export default function WeatherWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await api.get("/dashboard/live");
      return res.data;
    },
    refetchInterval: 60000, // Refresh every 1 min
  });

  if (isLoading) {
    return <div className="h-48 rounded-xl bg-white animate-pulse border border-slate-200 shadow-sm"></div>;
  }

  // Use the most recent weather or default fallbacks
  const latestWeather = data?.weather?.[0] || { temperature: 32, humidity: 85, status: 'Heavy Rain' };
  const avgRainfall = data?.metrics?.avg_rainfall_24h_mm || 0;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
        <div className="flex items-center text-slate-500 mb-2 font-medium">
          <Thermometer className="w-5 h-5 mr-2 text-orange-500" />
          <span className="text-sm">Temperature</span>
        </div>
        <div className="text-4xl font-bold text-slate-900">{latestWeather.temperature}°C</div>
        <div className="text-xs text-slate-400 mt-2">State Average</div>
      </div>
      
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col justify-center">
        <div className="flex items-center text-slate-500 mb-2 font-medium">
          <CloudRain className="w-5 h-5 mr-2 text-blue-500" />
          <span className="text-sm">24h Rainfall</span>
        </div>
        <div className="text-4xl font-bold text-slate-900">{avgRainfall} mm</div>
        <div className="text-xs text-slate-400 mt-2">State Average</div>
      </div>
    </div>
  );
}
