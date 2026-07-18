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

# Static topological connections (edges)
GRAPH_EDGES = [
    # Weather Stations monitors Districts
    ("ws-1", "d-3"), ("ws-1", "d-33"), ("ws-2", "d-29"), ("ws-2", "d-1"),
    ("ws-3", "d-14"), ("ws-3", "d-24"), ("ws-4", "d-4"), ("ws-4", "d-18"),
    
    # Rain Gauges measures Districts
    ("rg-1", "d-23"), ("rg-2", "d-5"), ("rg-3", "d-16"), ("rg-4", "d-30"),
    ("rg-5", "d-18"), ("rg-6", "d-11"), ("rg-7", "d-24"), ("rg-8", "d-8"),
    ("rg-9", "d-28"), ("rg-10", "d-10"),
    
    # Rivers flow through Districts
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

    # Reservoirs feeds Rivers
    ("rs-1", "rv-1"), ("rs-2", "rv-2"), ("rs-3", "rv-3"),
    ("rs-4", "rv-7"), ("rs-5", "rv-5"), ("rs-6", "rv-6"),
    
    # Soil Moisture permeates Districts
    ("sm-1", "d-3"), ("sm-1", "d-5"), ("sm-1", "d-16"), ("sm-1", "d-35"),
    ("sm-2", "d-18"), ("sm-2", "d-4"), ("sm-2", "d-27"),
    ("sm-3", "d-29"), ("sm-3", "d-26"), ("sm-3", "d-12"),
    
    # Elevation drains to Districts
    ("ez-1", "d-3"), ("ez-1", "d-16"), ("ez-1", "d-35"),
    ("ez-2", "d-5"), ("ez-2", "d-2"), ("ez-2", "d-28"),
    
    # Relief Camps supports Districts
    ("rc-1", "d-3"), ("rc-2", "d-5"), ("rc-3", "d-16"),
    ("rc-4", "d-29"), ("rc-5", "d-14"), ("rc-6", "d-4"),
    ("rc-7", "d-30"), ("rc-8", "d-26"),
    
    # Road Networks intersects Districts
    ("rn-1", "d-3"), ("rn-1", "d-37"), ("rn-1", "d-29"),
    ("rn-2", "d-3"), ("rn-2", "d-10"), ("rn-2", "d-36"),
    ("rn-3", "d-3"), ("rn-3", "d-5"), ("rn-3", "d-16"),
    ("rn-4", "d-3"), ("rn-4", "d-33"), ("rn-4", "d-2"),
    
    # Upstream spatial flows
    ("d-18", "d-4"), ("d-4", "d-8"), ("d-13", "d-6"), ("d-6", "d-23"),
    ("d-23", "d-29"), ("d-29", "d-26"), ("d-26", "d-16"), ("d-26", "d-35"),
    ("d-33", "d-3"), ("d-10", "d-3"), ("d-27", "d-14"), ("d-14", "d-24"),
    ("d-24", "d-21"), ("d-30", "d-28")
]

class KnowledgeGraphBuilder:
    def __init__(self):
        self.graph = nx.DiGraph()
        # Initialize nodes order
        self.node_ids = []
        self._init_node_order()
        self.build_skeleton()

    def _init_node_order(self):
        # Enforce exact order for index matrix mappings in PyTorch
        self.node_ids = [f"d-{i}" for i in range(1, 39)]  # Districts (38 nodes)
        self.node_ids += [f"rv-{i}" for i in range(1, 10)] # Rivers (9 nodes)
        self.node_ids += [f"rs-{i}" for i in range(1, 7)]  # Reservoirs (6 nodes)
        self.node_ids += [f"ws-{i}" for i in range(1, 5)]  # Weather Stations (4 nodes)
        self.node_ids += [f"rg-{i}" for i in range(1, 11)] # Rain Gauges (10 nodes)
        self.node_ids += [f"rc-{i}" for i in range(1, 9)]  # Relief Camps (8 nodes)
        self.node_ids += [f"sm-{i}" for i in range(1, 6)]  # Soil Moisture (5 nodes)
        self.node_ids += [f"ez-{i}" for i in range(1, 6)]  # Elevation Zones (5 nodes)
        self.node_ids += [f"rn-{i}" for i in range(1, 5)]  # Road Networks (4 nodes)

    def build_skeleton(self):
        self.graph.clear()
        for nid in self.node_ids:
            t = "district" if nid.startswith("d-") else \
                "river" if nid.startswith("rv-") else \
                "reservoir" if nid.startswith("rs-") else \
                "weather_station" if nid.startswith("ws-") else \
                "rain_gauge" if nid.startswith("rg-") else \
                "relief_camp" if nid.startswith("rc-") else \
                "soil_moisture" if nid.startswith("sm-") else \
                "elevation_zone" if nid.startswith("ez-") else "road_network"
            self.graph.add_node(nid, type=t, risk_score=15.0, elevation=20.0, rainfall=0.0, river_level=0.0)
            
        for u, v in GRAPH_EDGES:
            self.graph.add_edge(u, v, weight=0.5)

    def update_graph_from_db(self, db: Session):
        """Populates the NetworkX graph with dynamic database entries."""
        districts = db.query(District).all()
        dist_map = {d.id: d for d in districts}
        
        # 1. Update District Nodes
        for d in districts:
            node_id = f"d-{d.id}"
            
            # Fetch latest weather & rainfall
            w = db.query(Weather).filter(Weather.district_id == d.id).first()
            rf = db.query(Rainfall).filter(Rainfall.district_id == d.id).first()
            dem = db.query(DemTile).filter(DemTile.district_id == d.id).first()
            
            # Fetch latest prediction score (risk)
            latest_pred = db.query(PredictionHistory).filter(PredictionHistory.district_id == d.id).order_by(PredictionHistory.id.desc()).first()
            risk = latest_pred.current_risk_score if latest_pred else 15.0
            
            self.graph.nodes[node_id].update({
                "label": d.name,
                "risk_score": float(risk),
                "elevation": float(dem.elevation if dem else 15.0),
                "rainfall": float(rf.mm_24h if rf else 0.0),
                "humidity": float(w.humidity if w else 70.0),
                "temperature": float(w.temperature if w else 28.0),
                "pressure": float(w.pressure if w else 1010.0),
                "population": int(d.population or 1000000)
            })
            
        # 2. Update Rivers
        rivers = db.query(RiverLevel).all()
        for idx, r in enumerate(rivers):
            # Map database records to rv-1 to rv-9 nodes
            node_id = f"rv-{(idx % 9) + 1}"
            ratio = r.current_level / r.danger_level if r.danger_level > 0 else 0.0
            self.graph.nodes[node_id].update({
                "label": r.river_name,
                "current_level": r.current_level,
                "danger_level": r.danger_level,
                "risk_score": float(ratio * 100.0)
            })

        # 3. Update Reservoirs
        # We model the capacity & releases dynamically
        from app.services.hydrology import HydrologyEngine
        hydro = HydrologyEngine(db)
        res_stats = hydro.get_reservoir_stats()
        for idx, stats in enumerate(res_stats):
            node_id = f"rs-{(idx % 6) + 1}"
            self.graph.nodes[node_id].update({
                "label": stats["name"],
                "risk_score": float(stats["fill_pct"]),
                "inflow": stats["inflow_cusecs"],
                "outflow": stats["outflow_cusecs"]
            })

        # 4. Update Dynamic Edge Weights
        for u, v in self.graph.edges():
            risk_u = self.graph.nodes[u].get("risk_score", 15.0)
            risk_v = self.graph.nodes[v].get("risk_score", 15.0)
            
            # Edges attention weight increases with source node threat
            w = 0.1 + (risk_u / 100.0) * 0.8
            self.graph[u][v]["weight"] = float(round(w, 3))

    def fetch_graph_snapshot(self, db: Session = None, seq_len: int = 3) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Builds the 12-dimensional feature matrix sequence H and edge_index for PyG.
        H shape: [num_nodes, seq_len, 12]
        """
        num_nodes = len(self.node_ids)
        num_features = 12
        
        # Initialize snapshot tensor [num_nodes, seq_len, num_features]
        # Features mapping:
        # [Rainfall, River Level, Humidity, Pressure, Temperature, Elevation, Slope, Drainage, Hist Flood, Pop, Urban/Landcover, Temporal]
        H = torch.zeros((num_nodes, seq_len, num_features))
        
        # Build mapping index
        node_to_idx = {nid: i for i, nid in enumerate(self.node_ids)}
        
        # If DB is provided, populate tensor with real chronological variables
        if db:
            self.update_graph_from_db(db)
            
            # Query weather/predictions history for sequence
            for idx, nid in enumerate(self.node_ids):
                # Retrieve base values from current graph state
                node = self.graph.nodes[nid]
                
                # Fetch node variables
                rain = node.get("rainfall", 0.0)
                risk = node.get("risk_score", 15.0)
                elev = node.get("elevation", 15.0)
                temp = node.get("temperature", 28.0)
                hum = node.get("humidity", 70.0)
                pres = node.get("pressure", 1010.0)
                pop = node.get("population", 1000000)
                
                # Model historical sequence states (simulating decay in time steps)
                for t in range(seq_len):
                    decay = 0.9 ** (seq_len - 1 - t)
                    H[idx, t, 0] = rain * decay
                    H[idx, t, 1] = (risk / 100.0) * decay
                    H[idx, t, 2] = hum
                    H[idx, t, 3] = pres
                    H[idx, t, 4] = temp
                    H[idx, t, 5] = elev
                    H[idx, t, 6] = 5.0 if elev < 20 else 15.0 # Slope
                    H[idx, t, 7] = 80.0 if nid.startswith("d-3") else 40.0 # Urban drainage index
                    H[idx, t, 8] = 5.0 if elev < 10 else 1.0 # Historical flood events count
                    H[idx, t, 9] = pop / 1000000.0 # Population density
                    H[idx, t, 10] = 0.8 if elev < 15 else 0.2 # Land cover impervious ratio
                    H[idx, t, 11] = float(t) # Temporal step
        else:
            # Mock generator fallback for train_gnn.py pre-training
            H = torch.rand((num_nodes, seq_len, num_features))
            
        # Build edge index list
        sources = []
        targets = []
        for u, v in self.graph.edges():
            sources.append(node_to_idx[u])
            targets.append(node_to_idx[v])
            
        edge_index = torch.tensor([sources, targets], dtype=torch.long)
        return H, edge_index

# Singleton instance
kg_builder = KnowledgeGraphBuilder()
