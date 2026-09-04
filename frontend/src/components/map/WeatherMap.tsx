"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, ZoomControl, LayersControl, LayerGroup, GeoJSON, useMap } from "react-leaflet";
import MarkerClusterGroup from 'react-leaflet-cluster';
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { safeFormat } from "@/lib/utils";

// Fix default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface District {
  id: number;
  name: string;
  lat: number;
  lon: number;
  rainfall_mm: number;
  humidity: number;
  temperature: number;
  wind_speed?: number;
  risk_level: string;
}

interface WeatherMapProps {
  districts?: District[];
  onMarkerClick?: (districtId: number) => void;
  selectedDistrictId?: number | null;
}

const getRainfallColor = (rainfall: number) => {
  if (rainfall >= 100) return "#ef4444"; // Red = Extreme
  if (rainfall >= 50) return "#f97316";  // Orange = Heavy
  if (rainfall >= 20) return "#facc15";  // Yellow = Moderate
  return "#22c55e";                      // Green = Low
};

const getRainfallLabel = (rainfall: number) => {
  if (rainfall >= 100) return "Extreme";
  if (rainfall >= 50) return "Heavy";
  if (rainfall >= 20) return "Moderate";
  return "Low";
};

// Fallback coordinates for TN districts
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

function FlyToDistrict({ selected }: { selected: District | null }) {
  const map = useMap();
  useEffect(() => {
    if (selected && selected.lat && selected.lon) {
      map.flyTo([selected.lat, selected.lon], 9, {
        animate: true,
        duration: 1.5
      });
    }
  }, [selected, map]);
  return null;
}

export default function WeatherMap({ districts = [], onMarkerClick, selectedDistrictId }: WeatherMapProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<District | null>(null);
  
  useEffect(() => {
    if (selectedDistrictId && validDistricts.length > 0) {
      const dist = validDistricts.find(d => d.id === selectedDistrictId);
      if (dist) setSelected(dist);
    }
  }, [selectedDistrictId, districts]);

  useEffect(() => { 
    setMounted(true); 
  }, []);
  
  if (!mounted) return null;

  const center: [number, number] = [10.8, 78.5];

  const getRadius = (rainfall: number) => {
    if (rainfall >= 100) return 18;
    if (rainfall >= 50) return 15;
    if (rainfall >= 20) return 12;
    return 9;
  };

  const validDistricts = (districts || [])
    .map((d) => {
      let lat = d.lat;
      let lon = d.lon;
      if (!lat || !lon || lat === 0 || lon === 0) {
        const fallback = TN_COORDINATES[d.name];
        if (fallback) {
          lat = fallback[0];
          lon = fallback[1];
        }
      }
      return { ...d, lat, lon };
    })
    .filter((d) => typeof d.lat === "number" && typeof d.lon === "number" && !isNaN(d.lat) && !isNaN(d.lon));

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm z-0">
      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-control-zoom a {
            width: 32px !important;
            height: 32px !important;
            line-height: 32px !important;
            opacity: 0.8;
            backdrop-filter: blur(8px);
            background: rgba(255, 255, 255, 0.9) !important;
            transition: all 0.3s ease;
            color: #475569 !important;
            border: 1px solid rgba(226, 232, 240, 0.8) !important;
        }
        .leaflet-control-zoom a:hover {
            background: #ffffff !important;
            color: #8b5cf6 !important;
        }
      `}} />
      <MapContainer
        center={center}
        zoom={7}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
        style={{ background: "#f8f9fe" }}
      >
        <ZoomControl position="bottomright" />
        <FlyToDistrict selected={selected} />
        
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40}
          spiderfyOnMaxZoom={true}
        >
          {validDistricts.map((district) => {
            const markerColor = getRainfallColor(district.rainfall_mm || 0);
            const isSelected = district.id === selectedDistrictId || district.id === selected?.id;
            
            return (
              <LayerGroup key={district.id}>
                {isSelected && (
                  <CircleMarker
                    center={[district.lat, district.lon]}
                    radius={getRadius(district.rainfall_mm || 0) + 8}
                    pathOptions={{
                      fillColor: "none",
                      color: "#8b5cf6", // violet-500
                      weight: 3,
                      opacity: 0.9,
                      className: "animate-pulse shadow-lg"
                    }}
                  />
                )}
                
                <CircleMarker
                  center={[district.lat, district.lon]}
                  radius={getRadius(district.rainfall_mm || 0)}
                  pathOptions={{
                    fillColor: markerColor,
                    fillOpacity: 0.9,
                    color: "#ffffff",
                    weight: 2,
                    opacity: 1,
                    className: "cursor-pointer"
                  }}
                  eventHandlers={{ 
                    click: () => {
                      setSelected(district);
                      if (onMarkerClick) {
                        onMarkerClick(district.id);
                      }
                    } 
                  }}
                >
                  <Tooltip
                    className="custom-district-tooltip border-0 shadow-lg !rounded-xl !p-0"
                    sticky={!isSelected}
                    permanent={isSelected}
                    direction="top"
                    offset={[0, -8]}
                  >
                    <div className="min-w-[160px] p-3 font-sans">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-bold text-slate-800">{district.name}</span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: markerColor }}
                        >
                          {getRainfallLabel(district.rainfall_mm || 0)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Rainfall</span>
                          <span className="font-bold text-slate-700">{district.rainfall_mm != null ? `${district.rainfall_mm}mm` : '—'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">Temperature</span>
                          <span className="font-bold text-slate-700">{district.temperature != null ? `${district.temperature}°C` : '—'}</span>
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              </LayerGroup>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
