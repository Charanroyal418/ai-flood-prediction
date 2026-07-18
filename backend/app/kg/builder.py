import os
import networkx as nx
from typing import List, Dict, Any, Tuple
import json

class KnowledgeGraphBuilder:
    def __init__(self):
        self.graph = nx.DiGraph()
        self.build_graph()

    def build_graph(self):
        # We will build the full graph here dynamically.
        # Nodes: District, River, Lake, Canal, Reservoir, RainGauge, WeatherStation,
        # FloodEvent, Hospital, ReliefCenter, Alert, etc.
        # This will be populated from DB in a real deployment, but for now we construct the skeleton.
        self.graph.clear()
        
        # Example initialization with some default nodes to ensure the API works.
        # Nodes will have features (e.g., rainfall, water_level)
        districts = ["Chennai", "Kancheepuram", "Tiruvallur", "Cuddalore", "Thoothukudi"]
        rivers = ["Cooum", "Adyar", "Kosathalaiyar", "Ponnaiyar", "Thamirabarani"]
        
        for d in districts:
            self.graph.add_node(d, type="District", population=1000000, rainfall=50.0, elevation=10.0)
            
        for r in rivers:
            self.graph.add_node(r, type="River", water_level=2.5, discharge=150.0)
            
        # Add relationships
        self.graph.add_edge("Cooum", "Chennai", type="FLOWS_THROUGH", distance_km=10.5, weight=0.8)
        self.graph.add_edge("Adyar", "Chennai", type="FLOWS_THROUGH", distance_km=8.2, weight=0.9)
        self.graph.add_edge("Kosathalaiyar", "Tiruvallur", type="FLOWS_THROUGH", distance_km=25.0, weight=0.6)
        self.graph.add_edge("Ponnaiyar", "Cuddalore", type="FLOWS_THROUGH", distance_km=15.0, weight=0.7)
        self.graph.add_edge("Thamirabarani", "Thoothukudi", type="FLOWS_THROUGH", distance_km=45.0, weight=0.5)

    def create_district_node(self, name: str, population: int, rainfall_24h: float):
        self.graph.add_node(name, type="District", population=population, rainfall=rainfall_24h)
        
    def create_river_node(self, name: str, water_level: float, discharge: float):
        self.graph.add_node(name, type="River", water_level=water_level, discharge=discharge)
        
    def create_weather_station_node(self, station_id: str, temperature: float, humidity: float):
        self.graph.add_node(station_id, type="WeatherStation", temperature=temperature, humidity=humidity)
        
    def create_flood_event_node(self, event_id: str, severity: str, depth_meters: float):
        self.graph.add_node(event_id, type="FloodEvent", severity=severity, depth_meters=depth_meters)
        
    def link_river_to_district(self, river_name: str, district_name: str, distance_km: float):
        self.graph.add_edge(river_name, district_name, type="FLOWS_THROUGH", distance_km=distance_km)
        
    def link_station_to_district(self, station_id: str, district_name: str):
        self.graph.add_edge(station_id, district_name, type="LOCATED_IN")
        
    def link_event_to_district(self, event_id: str, district_name: str):
        self.graph.add_edge(event_id, district_name, type="AFFECTS")
        
    def update_node_data(self, node_name: str, data: Dict[str, Any]):
        if self.graph.has_node(node_name):
            for key, value in data.items():
                self.graph.nodes[node_name][key] = value
        else:
            raise KeyError(f"Node {node_name} not found in Knowledge Graph.")

    def get_graph_data(self) -> Dict[str, Any]:
        """Returns graph data in a format suitable for frontend visualization (e.g., Echarts or React Force Graph)"""
        nodes = []
        edges = []
        
        for node_id, data in self.graph.nodes(data=True):
            nodes.append({
                "id": node_id,
                "label": node_id,
                **data
            })
            
        for u, v, data in self.graph.edges(data=True):
            edges.append({
                "source": u,
                "target": v,
                **data
            })
            
        return {"nodes": nodes, "links": edges}

    def fetch_graph_snapshot(self, seq_len: int = 3) -> Tuple[Any, Any]:
        """
        Extracts the spatial-temporal graph state for PyTorch Geometric inference.
        Returns PyG compatible (x, edge_index).
        x shape is [num_nodes, seq_len, num_features] representing historical sequence.
        """
        import torch
        
        num_nodes = max(len(self.graph.nodes), 10)
        num_features = 12 # Rainfall, River Level, Humidity, Pressure, Temperature, Elevation, Slope, Drainage Density, Historical Flood Count, Population Density, Land Cover, Temporal Features
        
        # Simulate sequence of graph snapshots for spatial-temporal processing
        x = torch.rand((num_nodes, seq_len, num_features))
        
        # Create edge index from our NetworkX graph
        node_mapping = {node: i for i, node in enumerate(self.graph.nodes())}
        sources = []
        targets = []
        for u, v in self.graph.edges():
            sources.append(node_mapping[u])
            targets.append(node_mapping[v])
            
        if not sources: # fallback if no edges
            sources = list(range(num_nodes - 1))
            targets = list(range(1, num_nodes))
            
        edge_index = torch.tensor([sources, targets], dtype=torch.long)
        
        return x, edge_index

# Singleton instance
kg_builder = KnowledgeGraphBuilder()
