import os
import networkx as nx
import numpy as np
import torch
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.models.district import District
from app.models.weather import Weather, Rainfall
from app.models.river import RiverLevel
from app.models.terrain import DemTile
from app.models.history import WeatherHistory, PredictionHistory

GRAPH_EDGES = [
    ("ws-1", "d-3"), ("ws-1", "d-33"), ("ws-2", "d-29"), ("ws-2", "d-1"),
    ("ws-3", "d-14"), ("ws-3", "d-24"), ("ws-4", "d-4"), ("ws-4", "d-18"),
    ("rg-1", "d-23"), ("rg-2", "d-5"), ("rg-3", "d-16"), ("rg-4", "d-30"),
    ("rg-5", "d-18"), ("rg-6", "d-11"), ("rg-7", "d-24"), ("rg-8", "d-8"),
    ("rg-9", "d-28"), ("rg-10", "d-10"),
    ("rv-1", "d-6"), ("rv-1", "d-23"), ("rv-1", "d-8"), ("rv-1", "d-17"),
    ("rv-1", "d-12"), ("rv-1", "d-29"), ("rv-1", "d-26"), ("rv-1", "d-15"),
    ("rv-2", "d-10"), ("rv-2", "d-2"), ("rv-2", "d-3"),
    ("rv-3", "d-33"), ("rv-3", "d-10"), ("rv-3", "d-3"),
    ("rv-4", "d-36"), ("rv-4", "d-22"), ("rv-4", "d-10"), ("rv-4", "d-2"),
    ("rv-5", "d-27"), ("rv-5", "d-7"), ("rv-5", "d-14"), ("rv-5", "d-24"), ("rv-5", "d-21"),
    ("rv-6", "d-25"), ("rv-6", "d-30"), ("rv-6", "d-28"),
    ("rv-7", "d-13"), ("rv-7", "d-6"), ("rv-7", "d-34"), ("rv-7", "d-37"), ("rv-7", "d-5"),
    ("rv-8", "d-23"), ("rv-8", "d-19"), ("rv-8", "d-1"), ("rv-8", "d-5"),
    ("rv-9", "d-18"), ("rv-9", "d-4"), ("rv-9", "d-8"),
    ("rs-1", "rv-1"), ("rs-2", "rv-2"), ("rs-3", "rv-3"),
    ("rs-4", "rv-7"), ("rs-5", "rv-5"), ("rs-6", "rv-6"),
    ("ez-1", "d-3"), ("ez-1", "d-16"), ("ez-1", "d-35"),
    ("ez-2", "d-5"), ("ez-2", "d-2"), ("ez-2", "d-28"),
    ("d-18", "d-4"), ("d-4", "d-8"), ("d-13", "d-6"), ("d-6", "d-23"),
    ("d-23", "d-29"), ("d-29", "d-26"), ("d-26", "d-16"), ("d-26", "d-35"),
    ("d-33", "d-3"), ("d-10", "d-3"), ("d-27", "d-14"), ("d-14", "d-24"),
    ("d-24", "d-21"), ("d-30", "d-28")
]

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
            self.graph.add_node(nid, type=t, risk_score=15.0, elevation=20.0, rainfall=0.0, river_level=0.0)
            
        for u, v in GRAPH_EDGES:
            self.graph.add_edge(u, v, weight=0.5)

        for i in range(1, 39): self.graph.add_edge(f"d-{i}", f"pop-{i}", weight=0.5)
        for i in range(1, 10): self.graph.add_edge(f"c-{i}", f"rv-{i}", weight=0.5)
        for i in range(1, 7): self.graph.add_edge(f"dam-{i}", f"rs-{i}", weight=0.5)
        for i in range(1, 5): self.graph.add_edge(f"sn-{i}", f"ws-{i}", weight=0.5)
        for i in range(5, 15): self.graph.add_edge(f"sn-{i}", f"rg-{i-4}", weight=0.5)
        
        self.graph.add_edge("db-1", "rv-1", weight=0.5)
        self.graph.add_edge("db-2", "rv-5", weight=0.5)
        self.graph.add_edge("db-3", "rv-6", weight=0.5)

    def update_graph_from_db(self, db: Session):
        districts = db.query(District).all()

        # --- Batch all queries up front to avoid N+1 and full table scans ---
        latest_weathers = db.query(Weather).order_by(Weather.recorded_at.desc()).limit(100).all()
        weather_map = {}
        for w in latest_weathers:
            if w.district_id not in weather_map:
                weather_map[w.district_id] = w
                
        latest_rainfalls = db.query(Rainfall).order_by(Rainfall.recorded_at.desc()).limit(100).all()
        rainfall_map = {}
        for r in latest_rainfalls:
            if r.district_id not in rainfall_map:
                rainfall_map[r.district_id] = r
                
        dem_map = {t.district_id: t for t in db.query(DemTile).all()}

        latest_preds = db.query(PredictionHistory).order_by(PredictionHistory.id.desc()).limit(100).all()
        pred_map = {}
        for p in latest_preds:
            if p.district_id not in pred_map:
                pred_map[p.district_id] = p

        for d in districts:
            node_id = f"d-{d.id}"
            pop_id = f"pop-{d.id}"
            w = weather_map.get(d.id)
            rf = rainfall_map.get(d.id)
            dem = dem_map.get(d.id)
            latest_pred = pred_map.get(d.id)
            risk = latest_pred.current_risk_score if latest_pred else 15.0

            self.graph.nodes[node_id].update({
                "label": d.name, "risk_score": float(risk), "elevation": float(dem.elevation if dem else 15.0),
                "rainfall": float(rf.mm_24h if rf else 0.0), "humidity": float(w.humidity if w else 70.0),
                "temperature": float(w.temperature if w else 28.0), "pressure": float(w.pressure if w else 1010.0),
                "population": int(d.population or 1000000)
            })
            self.graph.nodes[pop_id].update({
                "label": f"{d.name} Pop", "risk_score": float(risk * 0.9),
                "population_count": int(d.population or 1000000), "vulnerability": 5.0
            })

        rivers = db.query(RiverLevel).all()
        for idx, r in enumerate(rivers):
            node_id = f"rv-{(idx % 9) + 1}"
            catch_id = f"c-{(idx % 9) + 1}"
            ratio = r.current_level / r.danger_level if r.danger_level > 0 else 0.0
            risk = float(ratio * 100.0)
            self.graph.nodes[node_id].update({"label": r.river_name, "current_level": r.current_level, "danger_level": r.danger_level, "risk_score": risk})
            self.graph.nodes[catch_id].update({"label": f"{r.river_name} Catchment", "risk_score": risk * 0.8, "area_km2": 5000 + (idx * 500)})

        try:
            from app.services.hydrology import HydrologyEngine
            hydro = HydrologyEngine(db)
            res_stats = hydro.get_reservoir_stats()
            for idx, stats in enumerate(res_stats):
                node_id = f"rs-{(idx % 6) + 1}"
                dam_id = f"dam-{(idx % 6) + 1}"
                risk = float(stats["fill_pct"])
                self.graph.nodes[node_id].update({"label": stats["name"], "risk_score": risk, "inflow": stats["inflow_cusecs"], "outflow": stats["outflow_cusecs"]})
                self.graph.nodes[dam_id].update({"label": f"{stats['name']} Dam", "risk_score": risk, "structural_integrity": 100.0 - (risk * 0.1)})
        except Exception:
            pass  # Hydrology engine failure must not block the KG response

        # High-risk flood events (batch query, limit 5)
        high_risk_preds = db.query(PredictionHistory).filter(PredictionHistory.current_risk_score > 75).order_by(PredictionHistory.id.desc()).limit(5).all()
        for idx, pred in enumerate(high_risk_preds):
            if idx < 5:
                fe_id = f"fe-{idx+1}"
                d_name = next((d.name for d in districts if d.id == pred.district_id), "Unknown")
                self.graph.nodes[fe_id].update({"label": f"{d_name} Flood", "risk_score": float(pred.current_risk_score), "recorded_at": str(pred.created_at)})
                self.graph.add_edge(fe_id, f"d-{pred.district_id}", weight=1.0)


    def fetch_graph_snapshot(self, db: Session = None, seq_len: int = 3) -> Tuple[torch.Tensor, torch.Tensor]:
        num_nodes = len(self.node_ids)
        num_features = 12
        H = torch.zeros((num_nodes, seq_len, num_features))
        node_to_idx = {nid: i for i, nid in enumerate(self.node_ids)}
        
        if db:
            self.update_graph_from_db(db)
            for idx, nid in enumerate(self.node_ids):
                node = self.graph.nodes[nid]
                rain = node.get("rainfall", 0.0)
                risk = node.get("risk_score", 15.0)
                elev = node.get("elevation", 15.0)
                temp = node.get("temperature", 28.0)
                hum = node.get("humidity", 70.0)
                pres = node.get("pressure", 1010.0)
                pop = node.get("population", 1000000)
                
                for t in range(seq_len):
                    decay = 0.9 ** (seq_len - 1 - t)
                    H[idx, t, 0] = rain * decay
                    H[idx, t, 1] = (risk / 100.0) * decay
                    H[idx, t, 2] = hum
                    H[idx, t, 3] = pres
                    H[idx, t, 4] = temp
                    H[idx, t, 5] = elev
                    H[idx, t, 6] = 5.0 if elev < 20 else 15.0
                    H[idx, t, 7] = 80.0 if "Chennai" in node.get("label", "") else 40.0
                    H[idx, t, 8] = 5.0 if elev < 10 else 1.0
                    H[idx, t, 9] = pop / 1000000.0
                    H[idx, t, 10] = 0.8 if elev < 15 else 0.2
                    H[idx, t, 11] = float(t)
        else:
            H = torch.rand((num_nodes, seq_len, num_features))
            
        sources, targets = [], []
        for u, v in self.graph.edges():
            if u in node_to_idx and v in node_to_idx:
                sources.append(node_to_idx[u])
                targets.append(node_to_idx[v])
            
        edge_index = torch.tensor([sources, targets], dtype=torch.long)
        return H, edge_index

kg_builder = KnowledgeGraphBuilder()
