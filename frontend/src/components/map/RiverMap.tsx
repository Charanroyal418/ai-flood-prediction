"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip,
  Popup,
  ZoomControl,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export interface RiverData {
  name: string;
  district: string;
  basin: string;
  station: string;
  current_m: number;
  danger_m: number;
  overflow_pct: number;
  status: "Normal" | "Warning" | "Critical";
  lat?: number;
  lon?: number;
  last_update?: string;
}

interface RiverMapProps {
  rivers: RiverData[];
  selectedRiver: string | null;
  onMarkerClick: (riverName: string) => void;
}

// Known river gauge station coordinates in Tamil Nadu
const RIVER_COORDS: Record<string, [number, number]> = {
  // Cauvery & tributaries
  "Cauvery": [10.9299, 78.7771],
  "Kaveri": [10.9299, 78.7771],
  "Bhavani": [11.4459, 77.6846],
  "Noyyal": [11.0168, 76.9558],
  "Amaravathi": [10.5983, 77.4644],
  "Kollidam": [11.3764, 79.5429],
  // Palar basin
  "Palar": [12.8285, 79.8945],
  "Ponnaiyar": [11.9401, 79.4861],
  // Vellar
  "Vellar": [11.4926, 79.1220],
  // Vaigai
  "Vaigai": [9.9252, 78.1198],
  "Gundar": [9.3639, 78.8320],
  // Thamirabarani
  "Thamirabarani": [8.7139, 77.7567],
  "Tamiraparani": [8.7139, 77.7567],
  // Coastal
  "Cheyyar": [12.6500, 79.5500],
  "Kallar": [11.4200, 76.7500],
  "Moyar": [11.5800, 76.7200],
  "Kodayar": [8.6000, 77.4000],
  "Servalar": [8.7000, 77.5000],
  "Chittar": [8.4500, 77.5000],
  "Pambar": [10.3200, 77.5500],
  "Rishikulya": [10.9500, 77.2000],
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function getCoords(river: RiverData): [number, number] {
  const name = river.name;
  // Exact match
  if (RIVER_COORDS[name]) return RIVER_COORDS[name];
  // Partial match
  for (const key of Object.keys(RIVER_COORDS)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return RIVER_COORDS[key];
    }
  }
  // Deterministic fallback within TN bounds
  const h = hash(name);
  const lat = 8.1 + ((h % 500) / 100);   // 8.1 – 13.1
  const lon = 76.9 + ((h % 400) / 100);  // 76.9 – 80.9
  return [lat, lon];
}

const STATUS_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  Warning: "#f59e0b",
  Normal: "#22c55e",
};

const overflowColor = (pct: number) => {
  if (pct > 100) return "#ef4444";
  if (pct >= 85)  return "#f97316";
  if (pct >= 70)  return "#f59e0b";
  return "#22c55e";
};

const statusBadgeStyle = (status: string) => {
  if (status === "Critical") return { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
  if (status === "Warning")  return { background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" };
  return { background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" };
};

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 9, { animate: true, duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

const RIVER_MAP_KEY = Math.random().toString(36).substring(7);

export default function RiverMap({ rivers, selectedRiver, onMarkerClick }: RiverMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const center: [number, number] = [10.8, 78.5];

  const riverWithCoords = rivers.map((r) => ({ ...r, coords: getCoords(r) }));
  const selectedCoords = selectedRiver
    ? riverWithCoords.find((r) => r.name === selectedRiver)?.coords ?? null
    : null;

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0">
      <style dangerouslySetInnerHTML={{ __html: `
        .leaflet-interactive { transition: fill 0.4s ease, stroke 0.4s ease; }
        .leaflet-control-zoom a {
          width: 30px !important; height: 30px !important; line-height: 30px !important;
          background: rgba(255,255,255,0.95) !important; color: #475569 !important;
          border: 1px solid rgba(226,232,240,0.8) !important; transition: all 0.2s;
        }
        .leaflet-control-zoom a:hover { color: #6366f1 !important; }
        .river-tooltip { background: white !important; border: none !important; box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important; border-radius: 8px !important; padding: 0 !important; }
        .river-tooltip::before { display: none !important; }
        .river-popup .leaflet-popup-content-wrapper { background: white; border: none; border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.14); padding: 0; }
        .river-popup .leaflet-popup-content { margin: 0; }
        .river-popup .leaflet-popup-tip-container { display: none; }
        .river-popup .leaflet-popup-close-button { display: none; }
      ` }} />
      <MapContainer key={RIVER_MAP_KEY} center={center} zoom={7} scrollWheelZoom zoomControl={false} className="w-full h-full z-0" style={{ background: "#f8f9fe" }}>
        <ZoomControl position="bottomright" />
        <FlyTo coords={selectedCoords ?? null} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {riverWithCoords.map((river) => {
          const color = STATUS_COLOR[river.status] ?? "#22c55e";
          const isSelected = river.name === selectedRiver;
          const baseRadius = river.status === "Critical" ? 12 : river.status === "Warning" ? 9 : 7;
          const radius = isSelected ? baseRadius + 5 : baseRadius;
          const pct = river.overflow_pct ?? 0;
          const lastUpdate = river.last_update ||
            new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
          return (
            <span key={river.name}>
              {/* Selection ring */}
              {isSelected && (
                <CircleMarker
                  center={river.coords}
                  radius={radius + 8}
                  pathOptions={{ fillColor: "none", color: "#7c3aed", weight: 2.5, opacity: 0.85, dashArray: "4 3" }}
                />
              )}

              <CircleMarker
                center={river.coords}
                radius={radius}
                pathOptions={{
                  fillColor: color,
                  fillOpacity: isSelected ? 1 : 0.85,
                  color: "#fff",
                  weight: isSelected ? 2.5 : 1.5,
                }}
                eventHandlers={{ click: () => onMarkerClick(river.name) }}
              >
                {/* Hover tooltip for unselected */}
                {!isSelected && (
                  <Tooltip className="river-tooltip" direction="top" offset={[0, -6]} sticky>
                    <div className="px-3 py-2 font-sans">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs font-bold text-slate-800">{river.name}</span>
                        <span className="text-[10px] font-semibold" style={{ color }}>{river.status}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{river.district} · {pct}% overflow</div>
                    </div>
                  </Tooltip>
                )}

                {/* Premium popup for selected */}
                {isSelected && (
                  <Popup className="river-popup" closeButton={false} autoPan={false}>
                    <div className="w-[220px] font-sans">
                      {/* Popup header */}
                      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-bold text-slate-800 leading-tight">{river.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{river.district}</p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                            style={statusBadgeStyle(river.status)}
                          >
                            {river.status}
                          </span>
                        </div>
                      </div>
                      {/* Popup body */}
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Basin</span>
                          <span className="font-semibold text-slate-700 text-right max-w-[120px] truncate">{river.basin}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Current Level</span>
                          <span className="font-bold text-blue-700">{river.current_m} m</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Danger Threshold</span>
                          <span className="font-bold text-red-600">{river.danger_m} m</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Overflow</span>
                          <span className="font-bold" style={{ color: overflowColor(pct) }}>{pct}%</span>
                        </div>
                        {/* Overflow mini-bar */}
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, pct)}%`, background: overflowColor(pct) }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] pt-1 border-t border-slate-100">
                          <span className="text-slate-400">Last telemetry</span>
                          <span className="text-slate-500 font-medium">{lastUpdate}</span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                )}
              </CircleMarker>
            </span>
          );
        })}
      </MapContainer>
      {/* Legend */}
      <div className="absolute bottom-10 left-3 z-[400] bg-white/90 backdrop-blur-sm rounded-xl p-2.5 shadow-md border border-slate-100 text-[10px] font-semibold space-y-1.5">
        {[["#22c55e", "Normal"], ["#f59e0b", "Warning"], ["#ef4444", "Critical"]].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
