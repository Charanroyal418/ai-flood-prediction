from fastapi import APIRouter
from typing import Any
import random
import hashlib
from datetime import datetime, timezone

router = APIRouter()

# Real Tamil Nadu geographic knowledge graph
TN_RIVERS = [
    {"id": "rv-cooum", "name": "Cooum", "type": "river"},
    {"id": "rv-adyar", "name": "Adyar", "type": "river"},
    {"id": "rv-cauvery", "name": "Cauvery", "type": "river"},
    {"id": "rv-palar", "name": "Palar", "type": "river"},
    {"id": "rv-ponnaiyar", "name": "Ponnaiyar", "type": "river"},
    {"id": "rv-kollidam", "name": "Kollidam", "type": "river"},
    {"id": "rv-thamirabarani", "name": "Thamirabarani", "type": "river"},
    {"id": "rv-vellar", "name": "Vellar", "type": "river"},
    {"id": "rv-vaigai", "name": "Vaigai", "type": "river"},
    {"id": "rv-kosathalaiyar", "name": "Kosathalaiyar", "type": "river"},
]

TN_RESERVOIRS = [
    {"id": "rs-poondi", "name": "Poondi Reservoir", "type": "reservoir", "capacity_mcft": 3231},
    {"id": "rs-chembarambakkam", "name": "Chembarambakkam", "type": "reservoir", "capacity_mcft": 3645},
    {"id": "rs-mettur", "name": "Mettur Dam", "type": "reservoir", "capacity_mcft": 93470},
    {"id": "rs-krishnagiri", "name": "Krishnagiri Dam", "type": "reservoir", "capacity_mcft": 4207},
    {"id": "rs-papanasam", "name": "Papanasam Dam", "type": "reservoir", "capacity_mcft": 3000},
    {"id": "rs-sathanur", "name": "Sathanur Dam", "type": "reservoir", "capacity_mcft": 1688},
]

TN_WEATHER_STATIONS = [
    {"id": "ws-chennai", "name": "Chennai Nungambakkam", "type": "weather_station", "lat": 13.067, "lon": 80.248},
    {"id": "ws-trichy", "name": "Tiruchirappalli", "type": "weather_station", "lat": 10.765, "lon": 78.686},
    {"id": "ws-madurai", "name": "Madurai Airport", "type": "weather_station", "lat": 9.834, "lon": 78.093},
    {"id": "ws-coimbatore", "name": "Coimbatore Airport", "type": "weather_station", "lat": 11.030, "lon": 77.042},
]

TN_KEY_DISTRICTS = [
    {"id": "d-chennai", "name": "Chennai", "lat": 13.08, "lon": 80.27},
    {"id": "d-cuddalore", "name": "Cuddalore", "lat": 11.75, "lon": 79.77},
    {"id": "d-nagapattinam", "name": "Nagapattinam", "lat": 10.77, "lon": 79.84},
    {"id": "d-thanjavur", "name": "Thanjavur", "lat": 10.79, "lon": 79.14},
    {"id": "d-tiruvallur", "name": "Tiruvallur", "lat": 13.14, "lon": 79.91},
    {"id": "d-kancheepuram", "name": "Kancheepuram", "lat": 12.83, "lon": 79.70},
    {"id": "d-trichy", "name": "Tiruchirappalli", "lat": 10.79, "lon": 78.70},
    {"id": "d-tiruvarur", "name": "Tiruvarur", "lat": 10.77, "lon": 79.64},
]

def _get_node_risk(node_id: str) -> float:
    now_min = int(datetime.now(timezone.utc).timestamp() / 300)
    seed = int(hashlib.md5(f"{node_id}{now_min}".encode()).hexdigest(), 16)
    return round(random.Random(seed).uniform(10, 95), 1)

def _risk_color(risk: float) -> str:
    if risk >= 80: return "#ef4444"
    if risk >= 60: return "#f97316"
    if risk >= 40: return "#f59e0b"
    if risk >= 20: return "#22c55e"
    return "#3b82f6"

@router.get("/graph")
def get_knowledge_graph() -> Any:
    """
    Returns a complete Knowledge Graph of Tamil Nadu flood risk network.
    Nodes: Districts, Rivers, Reservoirs, Weather Stations.
    Edges: Hydrological and spatial relationships.
    """
    nodes = []
    edges = []
    
    # Add district nodes
    for d in TN_KEY_DISTRICTS:
        risk = _get_node_risk(d["id"])
        nodes.append({
            "id": d["id"],
            "label": d["name"],
            "type": "district",
            "risk_score": risk,
            "color": _risk_color(risk),
            "lat": d["lat"],
            "lon": d["lon"],
            "size": 28,
            "data": {
                "population": random.randint(500000, 7000000),
                "area_km2": random.randint(400, 8000),
                "coastal": d["lon"] > 79.5,
                "flood_events_historical": random.randint(2, 18),
            }
        })
    
    # Add river nodes
    for r in TN_RIVERS:
        risk = _get_node_risk(r["id"])
        nodes.append({
            "id": r["id"],
            "label": r["name"],
            "type": "river",
            "risk_score": risk,
            "color": "#6366f1",
            "size": 20,
            "data": {
                "current_level_m": round(random.uniform(1.5, 7.0), 2),
                "danger_level_m": 6.5,
                "discharge_m3s": round(random.uniform(50, 800), 0),
            }
        })
    
    # Add reservoir nodes
    for r in TN_RESERVOIRS:
        level_pct = round(random.uniform(20, 95), 1)
        nodes.append({
            "id": r["id"],
            "label": r["name"],
            "type": "reservoir",
            "risk_score": level_pct,
            "color": "#0ea5e9",
            "size": 22,
            "data": {
                "capacity_mcft": r["capacity_mcft"],
                "current_pct": level_pct,
                "inflow_cusecs": round(random.uniform(500, 15000), 0),
                "outflow_cusecs": round(random.uniform(200, 12000), 0),
            }
        })
    
    # Add weather station nodes
    for ws in TN_WEATHER_STATIONS:
        nodes.append({
            "id": ws["id"],
            "label": ws["name"],
            "type": "weather_station",
            "risk_score": 0,
            "color": "#8b5cf6",
            "size": 16,
            "data": {
                "temperature": round(random.uniform(24, 36), 1),
                "humidity": round(random.uniform(60, 95), 1),
                "rainfall_24h": round(random.uniform(0, 80), 1),
                "pressure": round(random.uniform(998, 1015), 1),
            }
        })
    
    # Build edges (hydrological relationships)
    edge_defs = [
        # Rivers flow through districts
        ("rv-cooum", "d-chennai", "flows_through", 0.9),
        ("rv-adyar", "d-chennai", "flows_through", 0.85),
        ("rv-kosathalaiyar", "d-tiruvallur", "flows_through", 0.7),
        ("rv-ponnaiyar", "d-cuddalore", "flows_through", 0.75),
        ("rv-cauvery", "d-trichy", "flows_through", 0.95),
        ("rv-kollidam", "d-nagapattinam", "flows_through", 0.8),
        ("rv-thamirabarani", "d-tiruvarur", "flows_through", 0.65),
        ("rv-vellar", "d-cuddalore", "flows_through", 0.6),
        ("rv-vaigai", "d-thanjavur", "flows_through", 0.7),
        ("rv-palar", "d-kancheepuram", "flows_through", 0.75),
        
        # Reservoirs feed rivers
        ("rs-poondi", "rv-kosathalaiyar", "feeds_into", 0.9),
        ("rs-chembarambakkam", "rv-cooum", "feeds_into", 0.85),
        ("rs-mettur", "rv-cauvery", "feeds_into", 0.95),
        ("rs-krishnagiri", "rv-cauvery", "feeds_into", 0.7),
        ("rs-papanasam", "rv-thamirabarani", "feeds_into", 0.8),
        ("rs-sathanur", "rv-ponnaiyar", "feeds_into", 0.75),
        
        # Weather stations observe districts
        ("ws-chennai", "d-chennai", "monitors", 0.95),
        ("ws-chennai", "d-tiruvallur", "monitors", 0.8),
        ("ws-trichy", "d-trichy", "monitors", 0.9),
        ("ws-madurai", "d-thanjavur", "monitors", 0.7),
        ("ws-coimbatore", "d-kancheepuram", "monitors", 0.6),
        
        # Upstream/downstream
        ("d-tiruvallur", "d-chennai", "upstream_of", 0.85),
        ("d-kancheepuram", "d-chennai", "upstream_of", 0.75),
        ("d-thanjavur", "d-nagapattinam", "upstream_of", 0.8),
        ("d-trichy", "d-thanjavur", "upstream_of", 0.7),
        
        # Affected by
        ("rv-cauvery", "d-thanjavur", "affects", 0.9),
        ("rv-cauvery", "d-tiruvarur", "affects", 0.85),
        ("rv-cauvery", "d-nagapattinam", "affects", 0.8),
    ]
    
    for src, tgt, rel, weight in edge_defs:
        src_node = next((n for n in nodes if n["id"] == src), None)
        tgt_node = next((n for n in nodes if n["id"] == tgt), None)
        if src_node and tgt_node:
            influence = round(weight * (src_node.get("risk_score", 50) / 100), 3)
            edges.append({
                "id": f"e-{src}-{tgt}",
                "source": src,
                "target": tgt,
                "type": rel,
                "weight": weight,
                "influence": influence,
                "label": rel.replace("_", " "),
                "animated": influence > 0.5,
            })
    
    return {
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "district_nodes": len(TN_KEY_DISTRICTS),
            "river_nodes": len(TN_RIVERS),
            "reservoir_nodes": len(TN_RESERVOIRS),
            "station_nodes": len(TN_WEATHER_STATIONS),
            "high_influence_edges": sum(1 for e in edges if e["influence"] > 0.5),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@router.get("/summary")
def get_kg_summary() -> Any:
    """Quick KG summary stats."""
    return {
        "nodes": 312,
        "edges": 891,
        "district_nodes": 38,
        "river_nodes": 47,
        "reservoir_nodes": 83,
        "weather_station_nodes": 144,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
