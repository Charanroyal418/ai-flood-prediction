from fastapi import APIRouter
from app.kg.builder import kg_builder

router = APIRouter()

@router.get("/graph")
def get_knowledge_graph():
    """
    Returns the Knowledge Graph nodes and edges for visualization in the UI.
    Uses NetworkX fallback graph for local simulations if Neo4j is unavailable.
    """
    nodes = []
    links = []
    
    # If the fallback graph is empty, populate it with mock topological data for TN rivers
    if len(kg_builder.fallback_graph.nodes) == 0:
        # Mock data representing Tamil Nadu hydrology
        districts = [
            {"id": "Chennai", "population": 7000000, "rainfall_24h": 120.5},
            {"id": "Cuddalore", "population": 2600000, "rainfall_24h": 85.0},
            {"id": "Kancheepuram", "population": 3900000, "rainfall_24h": 65.2},
            {"id": "Tiruvallur", "population": 3700000, "rainfall_24h": 90.1},
            {"id": "Thoothukudi", "population": 1700000, "rainfall_24h": 40.0}
        ]
        
        rivers = [
            {"id": "Adyar", "water_level": 4.5, "discharge": 1500},
            {"id": "Cooum", "water_level": 3.8, "discharge": 800},
            {"id": "Ponnaiyar", "water_level": 6.2, "discharge": 3500},
            {"id": "Kosasthalaiyar", "water_level": 5.1, "discharge": 2100},
            {"id": "Thamirabarani", "water_level": 7.5, "discharge": 4200}
        ]
        
        for d in districts:
            kg_builder.create_district_node(d["id"], d["population"], d["rainfall_24h"])
            
        for r in rivers:
            kg_builder.create_river_node(r["id"], r["water_level"], r["discharge"])
            
        # Create relations (FLOWS_THROUGH)
        kg_builder.link_river_to_district("Adyar", "Chennai", 15)
        kg_builder.link_river_to_district("Cooum", "Chennai", 10)
        kg_builder.link_river_to_district("Ponnaiyar", "Cuddalore", 20)
        kg_builder.link_river_to_district("Kosasthalaiyar", "Tiruvallur", 25)
        kg_builder.link_river_to_district("Thamirabarani", "Thoothukudi", 18)
        kg_builder.link_river_to_district("Adyar", "Kancheepuram", 40)

    for node_id, data in kg_builder.fallback_graph.nodes(data=True):
        nodes.append({
            "id": node_id,
            "name": node_id,
            "val": 1.5 if data.get("type") == "River" else 2,
            "group": 1 if data.get("type") == "River" else 2,
            "type": data.get("type", "Unknown"),
            **data
        })
        
    for source, target, data in kg_builder.fallback_graph.edges(data=True):
        links.append({
            "source": source,
            "target": target,
            "relationship": data.get("type", "CONNECTED_TO"),
            **data
        })
        
    return {
        "nodes": nodes,
        "links": links
    }
