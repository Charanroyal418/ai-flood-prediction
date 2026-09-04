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
  station: string;
  district: string | null;
  basin: string | null;
  current_m: number | null;
  danger_m: number | null;
  overflow_pct: number | null;
  status: "Normal" | "Warning" | "Critical";
  last_update?: string | null;
  recommendation?: string;
}

interface RiverMapProps {
  rivers: RiverData[];
  /** The station name of the selected river (unique key) */
  selectedRiver: string | null;
  onMarkerClick: (stationName: string) => void;
}

// Known river gauge station coordinates in Tamil Nadu
// Keyed by station name where known, otherwise by river name
const STATION_COORDS: Record<string, [number, number]> = {
  // Cauvery stations
  "Mettur Dam Station": [11.7878, 77.8014],
  "Kallanai": [10.8598, 78.8451],
  // Adyar
  "Chembarambakkam Outflow": [13.0117, 80.0793],
  "Saidapet Bridge": [13.0218, 80.2221],
  // Cooum
  "Napier Bridge Gauging Station": [13.0900, 80.2893],
  "Napier Bridge": [13.0900, 80.2893],
  // Palar
  "Vaniyambadi Gauge": [12.6905, 78.6127],
  "Chengalpattu": [12.6939, 79.9757],
  // Ponnaiyar
  "Sathanur Reservoir Gauge": [12.2253, 79.0747],
  // Vellar
  "Kollidam Outlet": [11.3764, 79.5429],
  "Sethiathope": [11.4926, 79.1220],
  // Vaigai
  "Vaigai Dam Gauging Station": [10.0104, 77.4768],
  "Madurai": [9.9252, 78.1198],
  // Thamirabarani
  "Papanasam Release Station": [8.9585, 77.3111],
  "Tirunelveli": [8.7139, 77.7567],
  // Bhavani
  "Bhavanisagar Inflow": [11.4459, 77.6846],
  // Kosasthalaiyar
  "Ennore": [13.2165, 80.3168],
  // Thenpennai
  "Cuddalore": [11.7480, 79.7714],
};

// Fallback by river name prefix for telemetry stations
const RIVER_COORDS: Record<string, [number, number]> = {
  "Cauvery River": [10.9299, 78.7771],
  "Adyar River": [13.0218, 80.2221],
  "Cooum River": [13.0900, 80.2893],
  "Palar River": [12.8285, 79.8945],
  "Ponnaiyar River": [11.9401, 79.4861],
  "Vellar River": [11.4926, 79.1220],
  "Vaigai River": [9.9252, 78.1198],
  "Thamirabarani River": [8.7139, 77.7567],
  "Bhavani River": [11.4459, 77.6846],
  "Kosasthalaiyar River": [13.2165, 80.3168],
  "Thenpennai River": [11.7480, 79.7714],
};

// Telemetry-station district coordinates
const DISTRICT_COORDS: Record<string, [number, number]> = {
  "Chennai": [13.0827, 80.2707],
  "Kancheepuram": [12.8364, 79.7036],
  "Kanchipuram": [12.8364, 79.7036],
  "Chengalpattu": [12.6939, 79.9757],
  "Thiruvallur": [13.1436, 79.9142],
  "Cuddalore": [11.7480, 79.7714],
  "Villupuram": [11.9401, 79.4861],
  "Kallakurichi": [11.7383, 78.9639],
  "Vellore": [12.9165, 79.1325],
  "Ranipet": [12.9274, 79.3333],
  "Tirupathur": [12.4934, 78.5661],
  "Tiruvannamalai": [12.2253, 79.0747],
  "Salem": [11.6643, 78.1460],
  "Namakkal": [11.2189, 78.1674],
  "Dharmapuri": [12.1211, 78.1582],
  "Krishnagiri": [12.5186, 78.2137],
  "Coimbatore": [11.0168, 76.9558],
  "Tiruppur": [11.1085, 77.3411],
  "Erode": [11.3424, 77.7281],
  "Nilgiris": [11.4166, 76.6946],
  "The Nilgiris": [11.4166, 76.6946],
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
  "Viluppuram": [11.9401, 79.4861],
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function getCoords(river: RiverData): [number, number] {
  // 1. Exact station name match
  if (STATION_COORDS[river.station]) return STATION_COORDS[river.station];

  // 2. River name match
  if (RIVER_COORDS[river.name]) return RIVER_COORDS[river.name];
  for (const key of Object.keys(RIVER_COORDS)) {
    if (
      river.name.toLowerCase().includes(key.toLowerCase().replace(" river", "")) ||
      key.toLowerCase().includes(river.name.toLowerCase().replace(" river", ""))
    ) {
      return RIVER_COORDS[key];
    }
  }

  // 3. District match
  if (river.district && DISTRICT_COORDS[river.district]) {
    // Slightly offset so multiple stations in same district don't stack exactly
    const base = DISTRICT_COORDS[river.district];
    const h = hashStr(river.station);
    const dlat = ((h % 100) - 50) / 5000;
    const dlon = ((h % 137) - 68) / 5000;
    return [base[0] + dlat, base[1] + dlon];
  }

  // 4. Deterministic fallback within TN bounds
  const h = hashStr(river.station);
  return [8.1 + ((h % 500) / 100), 76.9 + ((h % 400) / 100)];
}

const STATUS_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  Warning: "#f59e0b",
  Normal: "#22c55e",
};

const overflowColor = (pct: number | null): string => {
  if (pct === null) return "#94a3b8";
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

const fmtLevel = (v: number | null | undefined, unit = " m"): string =>
  typeof v === "number" && isFinite(v) ? `${v}${unit}` : "—";

const fmtPct = (v: number | null | undefined): string =>
  typeof v === "number" && isFinite(v) ? `${v}%` : "—";

function FlyTo({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.flyTo(coords, 9, { animate: true, duration: 1.2 });
    }
  }, [coords, map]);
  return null;
}

const RIVER_MAP_KEY = "river-map-stable";

export default function RiverMap({ rivers, selectedRiver, onMarkerClick }: RiverMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const center: [number, number] = [10.8, 78.5];

  const riverWithCoords = rivers.map((r) => ({ ...r, coords: getCoords(r) }));
  const selectedCoords = selectedRiver
    ? riverWithCoords.find((r) => r.station === selectedRiver)?.coords ?? null
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
        .river-popup .leaflet-popup-content { margin: 0; width: 230px !important; }
        .river-popup .leaflet-popup-tip-container { display: none; }
        .river-popup .leaflet-popup-close-button { display: none; }
      ` }} />
      <MapContainer
        key={RIVER_MAP_KEY}
        center={center}
        zoom={7}
        scrollWheelZoom
        zoomControl={false}
        className="w-full h-full z-0"
        style={{ background: "#f8f9fe" }}
      >
        <ZoomControl position="bottomright" />
        <FlyTo coords={selectedCoords ?? null} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {riverWithCoords.map((river) => {
          const color = STATUS_COLOR[river.status] ?? "#22c55e";
          const isSelected = river.station === selectedRiver;
          const baseRadius = river.status === "Critical" ? 12 : river.status === "Warning" ? 9 : 7;
          const radius = isSelected ? baseRadius + 5 : baseRadius;
          const pct = river.overflow_pct ?? null;

          const lastUpdateStr = river.last_update
            ? new Date(river.last_update).toLocaleString([], {
                month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })
            : "—";

          return (
            <span key={river.station}>
              {/* Selection ring */}
              {isSelected && (
                <CircleMarker
                  center={river.coords}
                  radius={radius + 8}
                  pathOptions={{
                    fillColor: "none",
                    color: "#7c3aed",
                    weight: 2.5,
                    opacity: 0.85,
                    dashArray: "4 3",
                  }}
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
                eventHandlers={{ click: () => onMarkerClick(river.station) }}
              >
                {/* Hover tooltip for non-selected */}
                {!isSelected && (
                  <Tooltip className="river-tooltip" direction="top" offset={[0, -6]} sticky>
                    <div className="px-3 py-2 font-sans">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs font-bold text-slate-800">{river.name}</span>
                        <span className="text-[10px] font-semibold" style={{ color }}>
                          {river.status}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{river.station}</div>
                      <div className="text-[10px] text-slate-500">
                        {river.district || "—"} · {fmtPct(pct)} overflow
                      </div>
                    </div>
                  </Tooltip>
                )}

                {/* Premium popup for selected */}
                {isSelected && (
                  <Popup className="river-popup" closeButton={false} autoPan={false}>
                    <div className="w-[230px] font-sans">
                      {/* Header */}
                      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 leading-tight truncate">
                              {river.name}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                              {river.station}
                            </p>
                          </div>
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                            style={statusBadgeStyle(river.status)}
                          >
                            {river.status}
                          </span>
                        </div>
                      </div>
                      {/* Body */}
                      <div className="px-4 py-3 space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">District</span>
                          <span className="font-semibold text-slate-700">{river.district || "—"}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Basin</span>
                          <span className="font-semibold text-slate-700 text-right max-w-[130px] truncate">
                            {river.basin || "—"}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Current Level</span>
                          <span className="font-bold text-blue-700">{fmtLevel(river.current_m)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-400 font-medium">Danger Threshold</span>
                          <span className="font-bold text-red-600">{fmtLevel(river.danger_m)}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 font-medium">Overflow</span>
                          <span className="font-bold" style={{ color: overflowColor(pct) }}>
                            {fmtPct(pct)}
                          </span>
                        </div>
                        {/* Overflow mini-bar */}
                        {pct !== null && (
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, pct)}%`,
                                background: overflowColor(pct),
                              }}
                            />
                          </div>
                        )}
                        <div className="flex justify-between text-[10px] pt-1 border-t border-slate-100">
                          <span className="text-slate-400">Last telemetry</span>
                          <span className="text-slate-500 font-medium">{lastUpdateStr}</span>
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
        {[
          ["#22c55e", "Normal (0–70%)"],
          ["#f59e0b", "Warning (70–85%)"],
          ["#f97316", "High (85–100%)"],
          ["#ef4444", "Critical (>100%)"],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-slate-600">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
