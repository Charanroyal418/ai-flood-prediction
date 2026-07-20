import os
import sys
import logging
import networkx as nx
import geopandas as gpd
from shapely.geometry import Polygon
import itertools
from dotenv import load_dotenv

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from app.db.session import SessionLocal
from app.models.district import District
from app.models.graph import GraphEdge
from seed_geo_data import RIVER_FLOWS
import networkx.algorithms.community as nx_comm

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("build_graph")
SHAPEFILE_PATH = os.path.join(os.path.dirname(__file__), "..", "raw", "File_584333_0767fb99b02d4e08846da7e9ad44eeaf", "91", "DISTRICT_BOUNDARY.shp")

def standardize_name(name):
    """Normalize district names between DB and Shapefile."""
    if not isinstance(name, str):
        return ""
    name = name.strip().lower()
    if name == 'the nilgiris' or name == 'nilgiris': return 'the nilgiris'
    if name == 'kanchipuram' or name == 'kancheepuram': return 'kancheepuram'
    if name == 'tiruvallur' or name == 'thiruvallur': return 'thiruvallur'
    return name.title()

def build_graph_topology():
    db = SessionLocal()
    try:
        districts = db.query(District).all()
        if not districts:
            logger.error("No districts found. Run seed_districts.py first.")
            return

        dist_name_to_id = {d.name.lower(): d.id for d in districts}
        # handle special cases
        dist_name_to_id['nilgiris'] = dist_name_to_id.get('the nilgiris')
        
        # Load Shapefile
        logger.info(f"Loading shapefile from {SHAPEFILE_PATH}...")
        try:
            gdf = gpd.read_file(SHAPEFILE_PATH)
            # The shapefile likely contains districts for the whole state or country.
            # Assuming 'dtname' or 'DISTRICT' is the column name.
            col_name = None
            for col in ['dtname', 'DISTRICT', 'NAME', 'name', 'District']:
                if col in gdf.columns:
                    col_name = col
                    break
            
            if not col_name:
                logger.error(f"Could not find district name column in shapefile. Columns: {gdf.columns}")
                return
            
            gdf['norm_name'] = gdf[col_name].apply(standardize_name)
            # Filter to TN districts only (those present in our DB)
            db_district_names = [standardize_name(d.name) for d in districts]
            tn_gdf = gdf[gdf['norm_name'].isin(db_district_names)].copy()
            logger.info(f"Found {len(tn_gdf)} matching districts in shapefile out of {len(districts)} in DB.")
        except Exception as e:
            logger.error(f"Error loading shapefile: {e}")
            return

        # 1. Compute Adjacency Edges
        logger.info("Computing spatial adjacency edges (shared borders)...")
        adjacency_edges = set()
        
        # Spatial join or manual intersection to find neighbors
        for i, row1 in tn_gdf.iterrows():
            for j, row2 in tn_gdf.iterrows():
                if i >= j:
                    continue
                # If they touch, they share a border
                if row1.geometry.touches(row2.geometry) or row1.geometry.intersects(row2.geometry):
                    id1 = dist_name_to_id.get(row1['norm_name'].lower())
                    id2 = dist_name_to_id.get(row2['norm_name'].lower())
                    if id1 and id2:
                        adjacency_edges.add((id1, id2))
                        adjacency_edges.add((id2, id1))

        # 2. Compute River Flow Edges
        logger.info("Parsing directional river flow paths...")
        river_edges = set()
        for river_name, path in RIVER_FLOWS.items():
            for i in range(len(path) - 1):
                src = path[i].lower()
                tgt = path[i+1].lower()
                id1 = dist_name_to_id.get(src)
                id2 = dist_name_to_id.get(tgt)
                if id1 and id2:
                    river_edges.add((id1, id2))

        # Build NetworkX Graph for Community Detection
        G = nx.DiGraph()
        for d in districts:
            G.add_node(d.id, name=d.name)
        
        for u, v in adjacency_edges:
            G.add_edge(u, v, type='adjacency')
        for u, v in river_edges:
            G.add_edge(u, v, type='river_flow')

        # Compute Metrics
        density = nx.density(G)
        degrees = [d for n, d in G.degree()]
        avg_degree = sum(degrees) / max(1, len(G))
        clustering = nx.average_clustering(G.to_undirected())
        
        logger.info(f"--- GRAPH METRICS ---")
        logger.info(f"Nodes: {G.number_of_nodes()}")
        logger.info(f"Edges: {G.number_of_edges()} ({len(adjacency_edges)} adjacency, {len(river_edges)} river flows)")
        logger.info(f"Density: {density:.3f}")
        logger.info(f"Avg Degree: {avg_degree:.2f}")
        logger.info(f"Clustering Coeff: {clustering:.3f}")

        # Louvain Community Detection
        undirected_G = G.to_undirected()
        try:
            communities = list(nx_comm.louvain_communities(undirected_G))
            logger.info(f"Detected {len(communities)} communities.")
            community_map = {}
            for idx, comm in enumerate(communities):
                for node_id in comm:
                    community_map[node_id] = idx
        except Exception as e:
            logger.error(f"Community detection failed: {e}")
            community_map = {d.id: 0 for d in districts}

        # Clear existing edges
        logger.info("Clearing old graph topology...")
        db.query(GraphEdge).delete()

        # Insert new data
        logger.info("Persisting to database...")
        edges_to_insert = []
        for u, v in adjacency_edges:
            edges_to_insert.append(GraphEdge(source_id=u, target_id=v, edge_type="adjacency", weight=1.0))
        for u, v in river_edges:
            edges_to_insert.append(GraphEdge(source_id=u, target_id=v, edge_type="river_flow", weight=2.0))
        
        db.bulk_save_objects(edges_to_insert)

        for d in districts:
            d.community_idx = community_map.get(d.id, 0)

        db.commit()
        logger.info("SUCCESS: True knowledge graph topology persisted to DB.")

    except Exception as e:
        logger.error(f"Error building graph: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    build_graph_topology()
