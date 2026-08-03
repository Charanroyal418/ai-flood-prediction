"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl, LayersControl, LayerGroup, GeoJSON } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

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

const TN_COORDINATES: Record<string, [number, number]> = {
  "Chennai": [13.0827, 80.2707],
  "Kancheepuram": [12.8364, 79.7036],
  "Kanchipuram": [12.8364, 79.7036],
  "Chengalpattu": [12.6939, 79.9757],
  "Thiruvallur": [13.1436, 79.9142],
  "Tiruvallur": [13.1436, 79.9142],
  "Cuddalore": [11.7480, 79.7714],
  "Villupuram": [11.9401, 79.4861],
  "Viluppuram": [11.9401, 79.4861],
  "Kallakurichi": [11.7383, 78.9639],
  "Vellore": [12.9165, 79.1325],
  "Ranipet": [12.9274, 79.3333],
  "Tirupattur": [12.4934, 78.5661],
  "Tirupathur": [12.4934, 78.5661],
  "Tiruvannamalai": [12.2253, 79.0747],
  "Salem": [11.6643, 78.1460],
  "Namakkal": [11.2189, 78.1674],
  "Dharmapuri": [12.1211, 78.1582],
  "Krishnagiri": [12.5186, 78.2137],
  "Coimbatore": [11.0168, 76.9558],
  "Tiruppur": [11.1085, 77.3411],
  "Erode": [11.3424, 77.7281],
  "The Nilgiris": [11.4166, 76.6946],
  "Nilgiris": [11.4166, 76.6946],
  "Tiruchirappalli": [10.7905, 78.7047],
  "Karur": [10.9601, 78.0766],
  "Perambalur": [11.2332, 78.8821],
  "Ariyalur": [11.1399, 79.0736],
  "Thanjavur": [10.7870, 79.1378],
  "Tiruvarur": [10.7744, 79.6366],
  "Nagapattinam": [10.7672, 79.8449],
  "Mayiladuthurai": [11.1026, 79.6521],
  "Pudukkottai": [10.3797, 78.8205],
  "Madurai": [9.9252, 78.1198],
  "Theni": [10.0104, 77.4768],
  "Dindigul": [10.3673, 77.9803],
  "Ramanathapuram": [9.3639, 78.8320],
  "Sivaganga": [9.8433, 78.4809],
  "Virudhunagar": [9.5855, 77.9556],
  "Tirunelveli": [8.7139, 77.7567],
  "Tenkasi": [8.9585, 77.3111],
  "Thoothukudi": [8.7642, 78.1348],
  "Kanyakumari": [8.0883, 77.5385],
};

export default function FloodMap({ districts = [] }: FloodMapProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<District | null>(null);
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const router = useRouter();

  useEffect(() => { 
    setMounted(true); 
    api.get("/spatial/district-bounds")
       .then(res => setGeoJsonData(res.data))
       .catch(err => console.error("Failed to load map bounds:", err));
  }, []);
  if (!mounted) return null;

  const center: [number, number] = [10.8, 78.5];

  const getRadius = (risk: number) => {
    if (risk >= 80) return 18;
    if (risk >= 60) return 15;
    if (risk >= 40) return 12;
    return 9;
  };

  // Pre-process districts to ensure they have valid coordinates (or use fallback)
  const validDistricts = (districts || [])
    .map((d) => {
      let lat = d.lat;
      let lon = d.lon;

      // If coordinate is invalid, lookup in fallback table
      if (!lat || !lon || lat === 0 || lon === 0) {
        const fallback = TN_COORDINATES[d.name];
        if (fallback) {
          lat = fallback[0];
          lon = fallback[1];
        }
      }

      return { ...d, lat, lon };
    })
    // Filter out any that still don't have valid coordinates to prevent Leaflet crash
    .filter((d) => typeof d.lat === "number" && typeof d.lon === "number" && !isNaN(d.lat) && !isNaN(d.lon));

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={7}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
        style={{ background: "#f8f9fe", height: "100%", width: "100%" }}
      >
        <ZoomControl position="bottomright" />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Light Map">
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite">
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>

          {geoJsonData && (
            <LayersControl.Overlay checked name="District Boundaries">
              <GeoJSON 
                data={geoJsonData} 
                style={{
                  color: "#94a3b8", // slate-400
                  weight: 1,
                  opacity: 0.6,
                  fillOpacity: 0.05,
                  fillColor: "#e2e8f0"
                }}
              />
            </LayersControl.Overlay>
          )}

          <LayersControl.Overlay checked name="District Risk Sensors">
            <LayerGroup>
              {validDistricts.map((district) => {
                const markerColor = getRiskColor(district.risk_score, district.risk_level);
                const isCritical = district.risk_score >= 80 || district.risk_level === "Critical";
                return (
                  <LayerGroup key={district.id}>
                    {/* Animated pulse ring for critical districts */}
                    {isCritical && (
                      <CircleMarker
                        center={[district.lat, district.lon]}
                        radius={getRadius(district.risk_score) + 8}
                        pathOptions={{
                          fillColor: markerColor,
                          fillOpacity: 0.15,
                          color: markerColor,
                          weight: 1,
                          opacity: 0.5,
                          className: "animate-ping"
                        }}
                      />
                    )}
                    <CircleMarker
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
                              {isCritical ? "Critical" : district.risk_level}
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
                              style={{ background: markerColor }}
                            >
                              {district.risk_level}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {[
                              { label: "Risk Score", value: `${district.risk_score}/100` },
                              { label: "AI Confidence", value: `${((district?.ai_confidence ?? 0) * 100).toFixed(1)}%` },
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
                              <span className="font-semibold">{((district?.flood_probability ?? 0) * 100).toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className="h-1.5 rounded-full transition-all"
                                style={{
                                  width: `${district.flood_probability * 100}%`,
                                  background: markerColor,
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
                  </LayerGroup>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
          
          <LayersControl.Overlay name="Relief Shelters">
            <LayerGroup>
              {validDistricts.filter(d => d.risk_score >= 40).map((district, i) => (
                <CircleMarker
                  key={`shelter-${district.id}-${i}`}
                  center={[district.lat + 0.05, district.lon - 0.05]}
                  radius={5}
                  pathOptions={{
                    fillColor: "#0ea5e9", // sky-500
                    fillOpacity: 1,
                    color: "#ffffff",
                    weight: 2,
                  }}
                >
                  <Tooltip direction="top">
                    <span className="text-xs font-bold text-sky-700">{district.name} Main Relief Camp</span>
                    <br/>
                    <span className="text-[10px] text-slate-500">Capacity: 1,500 | Current: {Math.floor(district.risk_score * 12)}</span>
                  </Tooltip>
                </CircleMarker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name="Risk Polygons (Simulated)">
            <LayerGroup>
              {validDistricts.map((district, i) => (
                <CircleMarker
                  key={`riskpoly-${district.id}-${i}`}
                  center={[district.lat, district.lon]}
                  radius={45}
                  pathOptions={{
                    fillColor: getRiskColor(district.risk_score, district.risk_level),
                    fillOpacity: 0.1,
                    color: getRiskColor(district.risk_score, district.risk_level),
                    weight: 1,
                    dashArray: "4 4",
                    className: district.risk_score >= 60 ? "animate-pulse" : "",
                  }}
                />
              ))}
            </LayerGroup>
          </LayersControl.Overlay>
          
          <LayersControl.Overlay name="Live Weather Overlays">
            <LayerGroup>
              {validDistricts.filter(d => d.rainfall_mm > 0).map((district, i) => (
                <CircleMarker
                  key={`weather-${district.id}-${i}`}
                  center={[district.lat + 0.02, district.lon + 0.02]}
                  radius={Math.max(8, Math.min(25, district.rainfall_mm * 1.5))}
                  pathOptions={{
                    fillColor: "#3b82f6",
                    fillOpacity: 0.3,
                    color: "#2563eb",
                    weight: 1,
                  }}
                >
                  <Tooltip direction="center" permanent className="bg-transparent border-0 text-blue-900 font-bold shadow-none text-[10px]">
                    {district.rainfall_mm}mm
                  </Tooltip>
                </CircleMarker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          <LayersControl.Overlay name="River Network & Reservoirs">
            <LayerGroup>
              {validDistricts.filter(d => d.river_level_m > 0).map((district, i) => {
                const dangerRatio = district.river_level_m / Math.max(1, district.river_danger_m);
                const riverColor = dangerRatio >= 0.9 ? "#ef4444" : dangerRatio >= 0.7 ? "#f59e0b" : "#0ea5e9";
                return (
                  <CircleMarker
                    key={`river-${district.id}-${i}`}
                    center={[district.lat - 0.03, district.lon + 0.03]}
                    radius={6}
                    pathOptions={{
                      fillColor: riverColor,
                      fillOpacity: 1,
                      color: "#ffffff",
                      weight: 2,
                    }}
                  >
                    <Tooltip direction="right">
                      <span className="text-xs font-bold" style={{ color: riverColor }}>River Level: {district.river_level_m}m</span>
                      <br/>
                      <span className="text-[10px] text-slate-500">Danger Mark: {district.river_danger_m}m</span>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        </LayersControl>
      </MapContainer>
    </div>
  );
}
