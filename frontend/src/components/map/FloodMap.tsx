"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl, LayersControl, LayerGroup, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Moderate: "#f59e0b",
  Low: "#22c55e",
  Safe: "#3b82f6",
};

interface District {
  id: number;
  name: string;
  lat: number;
  lon: number;
  risk_score: number;
  risk_level: string;
  risk_color: string;
  rainfall_mm: number;
  humidity: number;
  temperature: number;
  river_level_m: number;
  river_danger_m: number;
  population: number;
  flood_probability: number;
  ai_confidence: number;
  coastal?: boolean;
}

interface FloodMapProps {
  districts?: District[];
}

const getRiskColor = (score: number, level?: string) => {
  if (score >= 80 || level === "Critical" || level === "Severe") return "#ef4444";
  if (score >= 60 || level === "High") return "#f97316";
  if (score >= 40 || level === "Moderate") return "#f59e0b";
  if (score >= 20 || level === "Low") return "#22c55e";
  return "#3b82f6";
};

export default function FloodMap({ districts = [] }: FloodMapProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<District | null>(null);
  const router = useRouter();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const center: [number, number] = [10.8, 78.5];

  const getRadius = (risk: number) => {
    if (risk >= 80) return 18;
    if (risk >= 60) return 15;
    if (risk >= 40) return 12;
    return 9;
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={7}
        scrollWheelZoom={true}
        className="w-full h-full"
        zoomControl={false}
        style={{ background: "#f8f9fe" }}
      >
        <ZoomControl position="bottomright" />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Light Map">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="District Risk Sensors (Heatmap)">
            <LayerGroup>
        {districts.map((district) => {
          const markerColor = getRiskColor(district.risk_score, district.risk_level);
          return (
          <CircleMarker
            key={district.id}
            center={[district.lat, district.lon]}
            radius={getRadius(district.risk_score)}
            pathOptions={{
              fillColor: markerColor,
              fillOpacity: 0.8,
              color: markerColor,
              weight: 2,
              opacity: 1,
            }}
            eventHandlers={{ click: () => setSelected(district) }}
          >
            <Tooltip
              className="custom-district-tooltip"
              sticky
              direction="top"
              offset={[0, -8]}
            >
              <div className="min-w-[140px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-800">{district.name}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: markerColor }}
                  >
                    {district.risk_score >= 80 ? "Critical" : district.risk_level}
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Risk Score</span>
                    <span className="font-semibold text-slate-700">{district.risk_score}/100</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Rainfall</span>
                    <span className="font-semibold text-slate-700">{district.rainfall_mm}mm</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Humidity</span>
                    <span className="font-semibold text-slate-700">{district.humidity}%</span>
                  </div>
                </div>
              </div>
            </Tooltip>

            <Popup className="premium-popup" maxWidth={280}>
              <div className="p-1 font-sans">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-heading font-bold text-slate-800 text-base">{district.name}</span>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white"
                    style={{ background: district.risk_color }}
                  >
                    {district.risk_level}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {[
                    { label: "Risk Score", value: `${district.risk_score}/100` },
                    { label: "AI Confidence", value: `${(district.ai_confidence * 100).toFixed(0)}%` },
                    { label: "Rainfall 24h", value: `${district.rainfall_mm}mm` },
                    { label: "Humidity", value: `${district.humidity}%` },
                    { label: "River Level", value: `${district.river_level_m}m` },
                    { label: "Temperature", value: `${district.temperature}°C` },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-2">
                      <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wide">{label}</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Flood probability bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Flood Probability</span>
                    <span className="font-semibold">{(district.flood_probability * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${district.flood_probability * 100}%`,
                        background: district.risk_color,
                      }}
                    />
                  </div>
                </div>

                <p className="text-[9px] text-slate-400">
                  Population: {district.population?.toLocaleString("en-IN")} · {district.coastal ? "Coastal" : "Inland"}
                </p>
                <button 
                  onClick={() => router.push(`/dashboard/district/${district.id}`)}
                  className="mt-3 w-full py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-violet-600 transition-colors"
                >
                  View Full Analytics
                </button>
              </div>
            </Popup>
          </CircleMarker>
        );
        })}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>

      {/* Floating legend */}
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-xl border border-slate-100 shadow-lg p-3 z-[400]">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Risk Level</p>
        {Object.entries(RISK_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-[10px] text-slate-600 font-medium">{level}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
