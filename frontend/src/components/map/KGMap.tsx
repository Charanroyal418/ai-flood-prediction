"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, ZoomControl } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const RISK_COLORS: Record<string, string> = {
  Critical: "#ef4444",
  Warning: "#f59e0b",
  Watch: "#3b82f6",
  Safe: "#10b981",
};

// Simple Bezier Curve generator for edges
function getBezierCurvePoints(startLat: number, startLng: number, endLat: number, endLng: number, curvature: number = 0.2): [number, number][] {
  const midLat = (startLat + endLat) / 2;
  const midLng = (startLng + endLng) / 2;
  
  // Calculate perpendicular vector
  const dLat = endLat - startLat;
  const dLng = endLng - startLng;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  
  if (dist === 0) return [[startLat, startLng], [endLat, endLng]];
  
  // Perpendicular normalized vector
  const perpLat = -dLng / dist;
  const perpLng = dLat / dist;
  
  // Control point
  const cpLat = midLat + perpLat * dist * curvature;
  const cpLng = midLng + perpLng * dist * curvature;
  
  // Generate points along bezier curve
  const points: [number, number][] = [];
  const segments = 20;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const lat = mt * mt * startLat + 2 * mt * t * cpLat + t * t * endLat;
    const lng = mt * mt * startLng + 2 * mt * t * cpLng + t * t * endLng;
    points.push([lat, lng]);
  }
  return points;
}

export default function KGMap({ nodes, edges, showAllEdges, onNodeClick, activeNodeIds }: any) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const center: [number, number] = [10.8, 78.5]; // Center of Tamil Nadu

  const getRadius = (risk: number) => {
    if (risk >= 80) return 18;
    if (risk >= 60) return 15;
    if (risk >= 40) return 12;
    return 9;
  };

  // Only plot nodes with valid coordinates
  const mapNodes = nodes.filter((n: any) => n.lat && n.lon && n.lat !== 0 && n.lon !== 0 && n.type === 'district');
  const nodeMap = new Map(mapNodes.map((n: any) => [n.id, n]));

  // Draw edges connecting valid nodes
  const mapEdges = edges
    .filter((e: any) => showAllEdges || e.dynamicInfluence > 30 || e.attention > 0.6)
    .filter((e: any) => nodeMap.has(e.source) && nodeMap.has(e.target));

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
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
        />

        {mapEdges.map((edge: any) => {
          const source = nodeMap.get(edge.source);
          const target = nodeMap.get(edge.target);
          if (!source || !target) return null;
          
          const isHighInfluence = edge.dynamicInfluence > 20 || edge.attention > 0.4;
          const isActive = activeNodeIds && (activeNodeIds.includes(edge.source));
          const strokeColor = isActive ? "#8b5cf6" : (source.risk_score >= 75 ? RISK_COLORS.Critical : source.risk_score >= 50 ? RISK_COLORS.Warning : "#94a3b8");
          const strokeWidth = isActive ? 4 : isHighInfluence ? 2.5 : 1;
          const strokeOpacity = isActive ? 1 : isHighInfluence ? 0.7 : 0.3;

          if (isHighInfluence) {
            // Draw curved line for significant connections
            const curvePoints = getBezierCurvePoints(source.lat, source.lon, target.lat, target.lon, 0.2);
            return (
              <Polyline
                key={edge.id}
                positions={curvePoints}
                pathOptions={{
                  color: strokeColor,
                  weight: strokeWidth,
                  opacity: strokeOpacity,
                  dashArray: isActive ? "5, 10" : undefined,
                  className: isActive ? "animate-flow" : "",
                }}
              />
            );
          } else {
            // Draw straight line for minor adjacencies
            return (
              <Polyline
                key={edge.id}
                positions={[[source.lat, source.lon], [target.lat, target.lon]]}
                pathOptions={{
                  color: strokeColor,
                  weight: strokeWidth,
                  opacity: strokeOpacity,
                }}
              />
            );
          }
        })}

        {mapNodes.map((node: any) => (
          <CircleMarker
            key={node.id}
            center={[node.lat, node.lon]}
            radius={getRadius(node.risk_score)}
            pathOptions={{
              fillColor: node.communityColor || RISK_COLORS[node.status] || "#94a3b8",
              fillOpacity: node.propActive ? 0.9 : 0.6,
              color: RISK_COLORS[node.status] || "#94a3b8",
              weight: node.risk_score >= 75 ? 4 : 2,
              opacity: 1,
            }}
            eventHandlers={{ click: () => onNodeClick(node) }}
          >
            <Tooltip
              className="custom-district-tooltip"
              sticky
              direction="top"
              offset={[0, -8]}
            >
              <div className="min-w-[140px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-slate-800">{node.label}</span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                    style={{ background: RISK_COLORS[node.status] || "#94a3b8" }}
                  >
                    {node.status}
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Risk Score</span>
                    <span className="font-semibold text-slate-700">{node.risk_score.toFixed(1)}/100</span>
                  </div>
                  {node.data?.rainfall_24h !== undefined && (
                    <div className="flex justify-between text-[10px]">
                      <span className="text-slate-500">Rainfall</span>
                      <span className="font-semibold text-slate-700">{node.data.rainfall_24h}mm</span>
                    </div>
                  )}
                </div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
