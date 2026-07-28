import os
import math
import networkx as nx
import numpy as np
import torch
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.district import District
from app.models.weather import Weather, Rainfall
from app.models.river import RiverLevel
from app.models.terrain import DemTile
from app.models.history import WeatherHistory, PredictionHistory

# ─── Tamil Nadu District Geographic Coordinates ──────────────────────────────
# District id (1-38) → (lat, lon) for geographic layout mode
DISTRICT_COORDS: Dict[int, Tuple[float, float]] = {
    1:  (13.0827, 80.2707),  # Chennai
    2:  (13.3524, 80.2103),  # Thiruvallur
    3:  (12.8308, 80.0444),  # Kancheepuram
    4:  (12.6819, 79.9824),  # Chengalpattu
    5:  (12.9249, 79.1324),  # Vellore
    6:  (12.8417, 78.6567),  # Tirupattur
    7:  (12.2253, 78.1649),  # Krishnagiri
    8:  (11.6643, 78.1460),  # Dharmapuri
    9:  (11.6726, 78.1460),  # Salem
    10: (11.3410, 77.7172),  # Namakkal
    11: (11.0168, 76.9558),  # Erode
    12: (11.4916, 77.0168),  # Tiruppur
    13: (11.0183, 76.9558),  # Coimbatore
    14: (10.3673, 76.8554),  # Nilgiris
    15: (10.9254, 78.0098),  # Karur
    16: (10.7867, 78.7082),  # Tiruchirappalli
    17: (10.9601, 79.3845),  # Perambalur
    18: (11.3410, 79.6954),  # Ariyalur
    19: (11.2380, 79.0747),  # Kallakurichi
    20: (11.6643, 78.9286),  # Cuddalore
    21: (11.7480, 79.7714),  # Viluppuram
    22: (12.2390, 79.6715),  # Puducherry (proxy)
    23: (10.7867, 79.8400),  # Thanjavur
    24: (11.0510, 79.8516),  # Nagapattinam
    25: (10.9601, 79.5147),  # Tiruvarur
    26: (10.3673, 79.8516),  # Pudukkottai
    27: (9.9252,  78.1198),  # Dindigul
    28: (10.0527, 77.4977),  # Theni
    29: (10.4546, 78.6567),  # Sivaganga
    30: (10.1860, 78.9701),  # Madurai
    31: (9.5689,  78.0098),  # Virudhunagar
    32: (9.4980,  77.8880),  # Ramanathapuram
    33: (9.5689,  77.5000),  # Thoothukudi
    34: (8.7139,  77.7567),  # Tirunelveli
    35: (8.5241,  77.9399),  # Tenkasi
    36: (8.1838,  77.4344),  # Kanyakumari
    37: (10.4546, 78.8203),  # Mayiladuthurai
    38: (12.5204, 78.2147),  # Ranipet
}

# ─── Edge Type Metadata ───────────────────────────────────────────────────────
EDGE_TYPE_META: Dict[str, Dict] = {
    "river_flow":         {"color": "#3b82f6", "label": "River Flow",             "travel_time_base_min": 60,  "confidence_base": 0.90},
    "adjacency":          {"color": "#64748b", "label": "Border Adjacency",       "travel_time_base_min": 120, "confidence_base": 0.75},
    "reservoir_release":  {"color": "#06b6d4", "label": "Reservoir Release",      "travel_time_base_min": 90,  "confidence_base": 0.85},
    "watershed":          {"color": "#10b981", "label": "Watershed Basin",        "travel_time_base_min": 180, "confidence_base": 0.80},
    "elevation_dep":      {"color": "#f97316", "label": "Elevation Gradient",     "travel_time_base_min": 240, "confidence_base": 0.70},
    "historical_corr":    {"color": "#8b5cf6", "label": "Historical Correlation", "travel_time_base_min": 360, "confidence_base": 0.65},
    "rainfall_sim":       {"color": "#ec4899", "label": "Rainfall Similarity",    "travel_time_base_min": 480, "confidence_base": 0.60},
    "supplies":           {"color": "#14b8a6", "label": "Water Supply",           "travel_time_base_min": 120, "confidence_base": 0.80},
    "influences":         {"color": "#a78bfa", "label": "Hydrological Influence", "travel_time_base_min": 200, "confidence_base": 0.70},
    "located_in":         {"color": "#fbbf24", "label": "Located In",             "travel_time_base_min": 0,   "confidence_base": 0.95},
    "upstream_of":        {"color": "#60a5fa", "label": "Upstream Of",            "travel_time_base_min": 45,  "confidence_base": 0.90},
    "downstream_of":      {"color": "#fb923c", "label": "Downstream Of",          "travel_time_base_min": 45,  "confidence_base": 0.90},
}


class KnowledgeGraphBuilder:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.node_ids = []
        self._init_node_order()
        self.build_skeleton()

    def _init_node_order(self):
        self.node_ids = [f"d-{i}" for i in range(1, 39)]
        self.node_ids += [f"pop-{i}" for i in range(1, 39)]
        self.node_ids += [f"rv-{i}" for i in range(1, 10)]
        self.node_ids += [f"c-{i}" for i in range(1, 10)]
        self.node_ids += [f"rs-{i}" for i in range(1, 7)]
        self.node_ids += [f"dam-{i}" for i in range(1, 7)]
        self.node_ids += [f"ws-{i}" for i in range(1, 5)]
        self.node_ids += [f"rg-{i}" for i in range(1, 11)]
        self.node_ids += [f"sn-{i}" for i in range(1, 15)]
        self.node_ids += [f"db-{i}" for i in range(1, 4)]
        self.node_ids += [f"ez-{i}" for i in range(1, 6)]
        self.node_ids += [f"fe-{i}" for i in range(1, 6)]

    def build_skeleton(self):
        self.graph.clear()
        now_iso = datetime.now(timezone.utc).isoformat()
        for nid in self.node_ids:
            t = "district" if nid.startswith("d-") else \
                "population" if nid.startswith("pop-") else \
                "river" if nid.startswith("rv-") else \
                "catchment" if nid.startswith("c-") else \
                "reservoir" if nid.startswith("rs-") else \
                "dam" if nid.startswith("dam-") else \
                "weather_station" if nid.startswith("ws-") else \
                "rain_gauge" if nid.startswith("rg-") else \
                "sensor" if nid.startswith("sn-") else \
                "drainage_basin" if nid.startswith("db-") else \
                "elevation_zone" if nid.startswith("ez-") else "flood_event"

            # Set geographic coordinates for district nodes
            lat, lon = 0.0, 0.0
            if nid.startswith("d-"):
                try:
                    did = int(nid.split("-")[1])
                    lat, lon = DISTRICT_COORDS.get(did, (10.5, 78.5))
                except Exception:
                    lat, lon = 10.5, 78.5

            self.graph.add_node(nid, type=t, risk_score=15.0, elevation=20.0,
                                rainfall=0.0, river_level=0.0, lat=lat, lon=lon,
                                last_updated=now_iso)

        for i in range(1, 39):
            self.graph.add_edge(f"d-{i}", f"pop-{i}", weight=0.5, type="population_exposure",
                                relationship_type="population_exposure", confidence=0.95,
                                travel_time_min=0, last_updated=now_iso)
        for i in range(1, 10):
            self.graph.add_edge(f"c-{i}", f"rv-{i}", weight=0.5, type="watershed",
                                relationship_type="watershed", confidence=0.80,
                                travel_time_min=120, last_updated=now_iso)
        for i in range(1, 7):
            self.graph.add_edge(f"dam-{i}", f"rs-{i}", weight=0.5, type="reservoir_release",
                                relationship_type="reservoir_release", confidence=0.85,
                                travel_time_min=90, last_updated=now_iso)
        for i in range(1, 5):
            self.graph.add_edge(f"sn-{i}", f"ws-{i}", weight=0.5, type="sensor_feed",
                                relationship_type="sensor_feed", confidence=0.99,
                                travel_time_min=0, last_updated=now_iso)
        for i in range(5, 15):
            self.graph.add_edge(f"sn-{i}", f"rg-{i-4}", weight=0.5, type="sensor_feed",
                                relationship_type="sensor_feed", confidence=0.99,
                                travel_time_min=0, last_updated=now_iso)

        self.graph.add_edge("db-1", "rv-1", weight=0.5, type="watershed",
                            relationship_type="watershed", confidence=0.80,
                            travel_time_min=240, last_updated=now_iso)
        self.graph.add_edge("db-2", "rv-5", weight=0.5, type="watershed",
                            relationship_type="watershed", confidence=0.80,
                            travel_time_min=240, last_updated=now_iso)
        self.graph.add_edge("db-3", "rv-6", weight=0.5, type="watershed",
                            relationship_type="watershed", confidence=0.80,
                            travel_time_min=240, last_updated=now_iso)

    def update_graph_from_db(self, db: Session):
        from app.models.graph import GraphEdge
        districts = db.query(District).all()
        now_iso = datetime.now(timezone.utc).isoformat()

        # Load real edges from DB — remove stale district-to-district edges first
        edges_to_remove = [(u, v) for u, v in self.graph.edges()
                           if u.startswith("d-") and v.startswith("d-")]
        self.graph.remove_edges_from(edges_to_remove)

        db_edges = db.query(GraphEdge).all()
        for e in db_edges:
            edge_type = e.edge_type or "adjacency"
            meta = EDGE_TYPE_META.get(edge_type, EDGE_TYPE_META["adjacency"])
            # Travel time scales with inverse of weight (higher weight = faster propagation)
            travel_time = round(meta["travel_time_base_min"] / max(0.1, float(e.weight)))
            confidence = min(0.99, meta["confidence_base"] * float(e.weight) + 0.1)
            self.graph.add_edge(
                f"d-{e.source_id}", f"d-{e.target_id}",
                weight=float(e.weight),
                type=edge_type,
                relationship_type=edge_type,
                confidence=round(confidence, 2),
                travel_time_min=travel_time,
                last_updated=now_iso,
                source_name="",   # filled below
                target_name="",
            )

        # Build lookup maps (batch queries — avoid N+1)
        latest_weathers = db.query(Weather).order_by(Weather.recorded_at.desc()).limit(100).all()
        weather_map: Dict[int, Weather] = {}
        for w in latest_weathers:
            if w.district_id not in weather_map:
                weather_map[w.district_id] = w

        latest_rainfalls = db.query(Rainfall).order_by(Rainfall.recorded_at.desc()).limit(100).all()
        rainfall_map: Dict[int, Rainfall] = {}
        for r in latest_rainfalls:
            if r.district_id not in rainfall_map:
                rainfall_map[r.district_id] = r

        dem_map = {t.district_id: t for t in db.query(DemTile).all()}

        latest_preds = db.query(PredictionHistory).order_by(PredictionHistory.id.desc()).limit(100).all()
        pred_map: Dict[int, PredictionHistory] = {}
        for p in latest_preds:
            if p.district_id not in pred_map:
                pred_map[p.district_id] = p

        all_r_lvls = db.query(RiverLevel).order_by(RiverLevel.recorded_at.desc()).limit(200).all()
        river_map: Dict[int, RiverLevel] = {}
        for r in all_r_lvls:
            if r.district_id not in river_map:
                river_map[r.district_id] = r

        district_name_map: Dict[int, str] = {}

        for d in districts:
            node_id = f"d-{d.id}"
            pop_id = f"pop-{d.id}"
            district_name_map[d.id] = d.name

            w = weather_map.get(d.id)
            rf = rainfall_map.get(d.id)
            dem = dem_map.get(d.id)
            r_lvl = river_map.get(d.id)
            pred = pred_map.get(d.id)

            rain_mm = float(rf.mm_24h if rf else 0.0)
            river_ratio = float(r_lvl.current_level / r_lvl.danger_level
                                if r_lvl and r_lvl.danger_level > 0 else 0.15)
            telemetry_risk = min(95.0, max(10.0, rain_mm * 0.4 + river_ratio * 40.0))
            elev = float(dem.elevation if dem else 15.0)

            # Coordinates from seeded table
            lat, lon = DISTRICT_COORDS.get(d.id, (10.5, 78.5))

            self.graph.nodes[node_id].update({
                "label": d.name,
                "risk_score": telemetry_risk,
                "elevation": elev,
                "rainfall": rain_mm,
                "humidity": float(w.humidity if w else 70.0),
                "temperature": float(w.temperature if w else 28.0),
                "pressure": float(w.pressure if w else 1010.0),
                "population": int(d.population or 1000000),
                "lat": lat,
                "lon": lon,
                "community_idx": d.community_idx or 0,
                "river_name": r_lvl.river_name if r_lvl else "Unknown River",
                "river_level": float(r_lvl.current_level if r_lvl else 0.0),
                "river_danger_level": float(r_lvl.danger_level if r_lvl else 5.0),
                "river_ratio": round(river_ratio, 3),
                "last_updated": now_iso,
                "district_id": d.id,
            })
            self.graph.nodes[pop_id].update({
                "label": f"{d.name} Pop",
                "risk_score": float(telemetry_risk * 0.9),
                "population_count": int(d.population or 1000000),
                "vulnerability": 5.0,
            })

        # Patch edge source/target names
        for u, v, data in self.graph.edges(data=True):
            if u.startswith("d-") and v.startswith("d-"):
                try:
                    uid = int(u.split("-")[1])
                    vid = int(v.split("-")[1])
                    data["source_name"] = district_name_map.get(uid, u)
                    data["target_name"] = district_name_map.get(vid, v)
                    # Geographic distance for travel time refinement
                    if uid in DISTRICT_COORDS and vid in DISTRICT_COORDS:
                        la1, lo1 = DISTRICT_COORDS[uid]
                        la2, lo2 = DISTRICT_COORDS[vid]
                        dist_km = self._haversine_km(la1, lo1, la2, lo2)
                        base_tt = data.get("travel_time_min", 120)
                        # Adjust travel time by distance (avg river flow ~15 km/h)
                        data["travel_time_min"] = max(15, round(dist_km / 15 * 60))
                except Exception:
                    pass

        rivers = db.query(RiverLevel).all()
        for idx, r in enumerate(rivers):
            node_id = f"rv-{(idx % 9) + 1}"
            catch_id = f"c-{(idx % 9) + 1}"
            ratio = r.current_level / r.danger_level if r.danger_level > 0 else 0.0
            risk = float(ratio * 100.0)
            self.graph.nodes[node_id].update({
                "label": r.river_name,
                "current_level": r.current_level,
                "danger_level": r.danger_level,
                "risk_score": risk,
                "last_updated": now_iso,
            })
            self.graph.nodes[catch_id].update({
                "label": f"{r.river_name} Catchment",
                "risk_score": risk * 0.8,
                "area_km2": 5000 + (idx * 500),
            })

        try:
            from app.services.hydrology import HydrologyEngine
            hydro = HydrologyEngine(db)
            res_stats = hydro.get_reservoir_stats()
            for idx, stats in enumerate(res_stats):
                node_id = f"rs-{(idx % 6) + 1}"
                dam_id = f"dam-{(idx % 6) + 1}"
                risk = float(stats["fill_pct"])
                self.graph.nodes[node_id].update({
                    "label": stats["name"],
                    "risk_score": risk,
                    "inflow": stats["inflow_cusecs"],
                    "outflow": stats["outflow_cusecs"],
                    "last_updated": now_iso,
                })
                self.graph.nodes[dam_id].update({
                    "label": f"{stats['name']} Dam",
                    "risk_score": risk,
                    "structural_integrity": 100.0 - (risk * 0.1),
                })
        except Exception:
            pass

        high_risk_preds = db.query(PredictionHistory).filter(
            PredictionHistory.current_risk_score > 75
        ).order_by(PredictionHistory.id.desc()).limit(5).all()
        for idx, pred in enumerate(high_risk_preds):
            if idx < 5:
                fe_id = f"fe-{idx+1}"
                d_name = district_name_map.get(pred.district_id, "Unknown")
                self.graph.nodes[fe_id].update({
                    "label": f"{d_name} Flood",
                    "risk_score": float(pred.current_risk_score),
                    "recorded_at": str(pred.created_at),
                })
                self.graph.add_edge(fe_id, f"d-{pred.district_id}",
                                    weight=1.0, type="flood_event",
                                    relationship_type="flood_event",
                                    confidence=0.95, travel_time_min=0,
                                    last_updated=now_iso)

    def compute_louvain_communities(self) -> List[List[str]]:
        """Run Louvain community detection on district-only subgraph."""
        district_nodes = [n for n in self.node_ids if n.startswith("d-")]
        subg = self.graph.subgraph(district_nodes).to_undirected()
        try:
            communities = nx.community.louvain_communities(subg, seed=42)
            return [list(c) for c in communities]
        except AttributeError:
            # Fallback: greedy modularity for older NetworkX versions
            try:
                communities = nx.community.greedy_modularity_communities(subg)
                return [list(c) for c in communities]
            except Exception:
                # Last resort: use stored community_idx from DB
                comm_map: Dict[int, List[str]] = {}
                for nid in district_nodes:
                    idx = self.graph.nodes[nid].get("community_idx", 0)
                    comm_map.setdefault(idx, []).append(nid)
                return list(comm_map.values())

    def get_propagation_wave(self, source_node_id: str, max_hops: int = 6) -> List[Dict]:
        """
        BFS flood propagation from source_node_id.
        Returns ordered list of {node_id, hop, estimated_time_min, confidence, risk_score}.
        Uses real edge weights and travel_time_min from the graph.
        """
        if source_node_id not in self.graph:
            return []

        visited = {source_node_id}
        current_layer = [source_node_id]
        result = []
        cumulative_time = 0.0
        cumulative_conf = 1.0

        for hop in range(max_hops):
            next_layer = []
            layer_time = 0.0
            for node in current_layer:
                for _, neighbor, data in self.graph.out_edges(node, data=True):
                    if neighbor in visited:
                        continue
                    if not neighbor.startswith("d-"):
                        continue
                    visited.add(neighbor)
                    next_layer.append(neighbor)
                    tt = data.get("travel_time_min", 120)
                    layer_time = max(layer_time, tt)
                    edge_conf = data.get("confidence", 0.7)
                    attenuation = float(data.get("weight", 0.5))
                    result.append({
                        "node_id": neighbor,
                        "label": self.graph.nodes[neighbor].get("label", neighbor),
                        "hop": hop + 1,
                        "estimated_time_min": int(cumulative_time + tt),
                        "confidence": round(cumulative_conf * edge_conf * attenuation, 3),
                        "risk_score": float(self.graph.nodes[neighbor].get("risk_score", 15.0)),
                        "relationship_type": data.get("relationship_type", "flow"),
                    })

            if not next_layer:
                break
            cumulative_time += layer_time
            cumulative_conf *= 0.85   # confidence attenuates each hop
            current_layer = next_layer

        return result

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        phi1, phi2 = math.radians(lat1), math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlam = math.radians(lon2 - lon1)
        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def fetch_graph_snapshot(self, db: Session = None, seq_len: int = 3) -> Tuple[torch.Tensor, torch.Tensor]:
        num_nodes = len(self.node_ids)
        num_features = 12
        H = torch.zeros((num_nodes, seq_len, num_features))
        node_to_idx = {nid: i for i, nid in enumerate(self.node_ids)}

        if db:
            self.update_graph_from_db(db)

        for idx, nid in enumerate(self.node_ids):
            node = self.graph.nodes.get(nid, {})
            rain = float(node.get("rainfall", 0.0))
            risk = float(node.get("risk_score", 15.0))
            elev = float(node.get("elevation", 15.0))
            temp = float(node.get("temperature", 28.0))
            hum = float(node.get("humidity", 70.0))
            pres = float(node.get("pressure", 1010.0))
            pop = float(node.get("population", 1000000))
            norm_pres = (pres - 1000.0) / 50.0

            for t in range(seq_len):
                decay = 0.9 ** (seq_len - 1 - t)
                H[idx, t, :] = torch.tensor([
                    min(1.0, (rain / 100.0)) * decay,
                    min(1.0, max(0.0, risk / 100.0)) * decay,
                    min(1.0, max(0.0, hum / 100.0)),
                    min(1.0, max(0.0, norm_pres)),
                    min(1.0, max(0.0, temp / 40.0)),
                    min(1.0, max(0.0, elev / 100.0)),
                    (5.0 if elev < 20 else 15.0) / 30.0,
                    (80.0 if "Chennai" in str(node.get("label", "")) else 40.0) / 100.0,
                    (5.0 if risk > 50 else 1.0) / 10.0,
                    min(1.0, max(0.0, pop / 10000000.0)),
                    0.5,
                    float(t) / max(1.0, float(seq_len - 1)),
                ])

        sources, targets = [], []
        for u, v in self.graph.edges():
            if u in node_to_idx and v in node_to_idx:
                sources.append(node_to_idx[u])
                targets.append(node_to_idx[v])

        edge_index = torch.tensor([sources, targets], dtype=torch.long)
        return H, edge_index


kg_builder = KnowledgeGraphBuilder()
