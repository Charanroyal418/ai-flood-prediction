"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Popup, CircleMarker, GeoJSON } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import L from "leaflet";
const iconRetinaUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png";
const iconUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png";
const shadowUrl = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png";

export default function FloodMap() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
    });
  }, []);

  // Fetch live dashboard data (alerts, weather)
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboardLive"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/dashboard/live");
      return res.data;
    },
    refetchInterval: 10000, // Poll every 10 seconds for real-time feel
  });

  // Fetch district boundaries
  const { data: districtBounds } = useQuery({
    queryKey: ["districtBounds"],
    queryFn: async () => {
      const res = await axios.get("http://localhost:8000/api/v1/spatial/district-bounds");
      return res.data;
    },
    staleTime: 60 * 60 * 1000, // Rarely changes
  });

  if (!isMounted) return null;

  // Center of Tamil Nadu
  const position: [number, number] = [11.1271, 78.6569];

  // District geojson style
  const geoJsonStyle = (feature: any) => {
    // Check if district has an alert
    const hasAlert = dashboardData?.alerts?.some((a: any) => 
      a.message?.includes(feature.properties.name) || 
      a.district?.includes(feature.properties.name) ||
      feature.properties.name.includes("Chennai") // Mock for demo if needed
    );
    
    return {
      fillColor: hasAlert ? "#ef4444" : "#3b82f6",
      weight: 1,
      opacity: 1,
      color: "white",
      dashArray: "3",
      fillOpacity: hasAlert ? 0.4 : 0.1,
    };
  };

  return (
    <div className="h-full w-full rounded-xl overflow-hidden z-0">
      <MapContainer 
        center={position} 
        zoom={7} 
        scrollWheelZoom={true} 
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        
        {/* District Boundaries */}
        {districtBounds && (
          <GeoJSON 
            data={districtBounds} 
            style={geoJsonStyle}
            onEachFeature={(feature, layer) => {
              layer.bindTooltip(`${feature.properties.name} - Pop: ${(feature.properties.population / 1000000).toFixed(1)}M`, {
                sticky: true
              });
            }}
          />
        )}

        {/* Dynamically render active alerts */}
        {dashboardData?.alerts?.map((alert: any, idx: number) => {
          const coords: Record<string, [number, number]> = {
            "Chennai": [13.0827, 80.2707],
            "Cuddalore": [11.7480, 79.7714],
            "Kancheepuram": [12.8185, 79.6947],
            "Thoothukudi": [8.7642, 78.1348],
            "Tiruvallur": [13.1436, 79.9148],
          };
          
          const districtName = Object.keys(coords).find(k => 
            alert.message?.includes(k) || alert.district?.includes(k)
          ) || "Chennai";
          const pos = coords[districtName] || [13.0827, 80.2707];
          
          return (
            <CircleMarker 
              key={alert.id || idx}
              center={pos} 
              radius={25} 
              pathOptions={{ 
                color: alert.severity === 'Severe' ? 'red' : 'orange', 
                fillColor: alert.severity === 'Severe' ? '#ef4444' : '#f97316', 
                fillOpacity: 0.6,
                weight: 2
              }}
            >
              <Popup className="rounded-xl">
                <div className="text-slate-900 font-medium">
                  <div className="font-bold text-rose-600 mb-1 border-b pb-1">Emergency Alert</div>
                  <div>District: <span className="font-bold">{districtName}</span></div>
                  <div>{alert.message || alert.reason}</div>
                  <div className="text-xs text-slate-500 mt-2">Triggered by AI Engine</div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
