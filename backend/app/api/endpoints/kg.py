"""
Knowledge Graph API Endpoints
-------------------------------
Provides the full Dynamic Knowledge Graph Intelligence layer for the
FloodSense AI platform. Implements the PPT architecture stage:
  Data Sources → Data Preprocessing → Dynamic KG → Temporal GNN → Predictions

Endpoints:
  GET /kg/graph         — Full KG snapshot (nodes, edges, GNN, communities, propagation)
  GET /kg/node/{id}     — Deep node telemetry + GNN state + SHAP breakdown
  GET /kg/edge/{id}     — Edge relationship detail + influence + travel time
  GET /kg/propagation   — BFS flood propagation wave from a source node
  GET /kg/communities   — Live Louvain community detection + risk aggregation
  GET /kg/summary       — Lightweight stats for dashboard widgets
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Any, List, Dict, Optional
import numpy as np
import networkx as nx
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.api import deps
from app.kg.builder import kg_builder, EDGE_TYPE_META
from app.ml.inference import gnn_engine
import torch
import time

router = APIRouter()

# ─── Response Cache ───────────────────────────────────────────────────────────
_kg_cache: Dict[str, Any] = {"ts": 0.0, "payload": None}
_KG_CACHE_TTL = 60  # 60 seconds — suitable for live EOC platform


def _invalidate_cache():
    """Call this when simulation mode changes to force a fresh graph."""
    global _kg_cache
    _kg_cache = {"ts": 0.0, "payload": None}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_2d_projections(embeddings: np.ndarray) -> np.ndarray:
    """Projects high-dimensional embeddings to 2D using t-SNE or fast SVD fallback.
    Falls back to deterministic circular layout — never random coordinates.
    """
    if embeddings.shape[0] < 2:
        return np.zeros((embeddings.shape[0], 2)), "None"
    try:
        from sklearn.manifold import TSNE
        perplexity = min(30.0, float(embeddings.shape[0]) - 1.0)
        tsne = TSNE(n_components=2, perplexity=perplexity, random_state=42,
                    init='random', learning_rate='auto')
        return tsne.fit_transform(embeddings), "t-SNE"
    except Exception:
        try:
            U, S, Vt = np.linalg.svd(embeddings, full_matrices=False)
            return U[:, :2] * S[:2], "PCA (SVD)"
        except Exception:
            # Deterministic circular layout — stable, reproducible, no fake data
            n = embeddings.shape[0]
            angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
            radius = max(n * 30, 200)
            return np.column_stack([
                radius * np.cos(angles),
                radius * np.sin(angles)
            ]), "Circular Fallback"


def _build_community_detail(communities: List[List[str]], G: nx.DiGraph) -> List[Dict]:
    """Enrich community list with risk aggregation metrics."""
    result = []
    community_colors = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
                        "#06b6d4", "#f97316", "#ec4899", "#14b8a6", "#84cc16"]
    for idx, members in enumerate(communities):
        risks = [G.nodes[n].get("risk_score", 0) for n in members]
        rainfalls = [G.nodes[n].get("rainfall", 0) for n in members]
        labels = [G.nodes[n].get("label", n) for n in members]

        # Internal edge density
        subg = G.subgraph(members)
        density = nx.density(subg) if len(members) > 1 else 0.0
        avg_risk = float(np.mean(risks)) if risks else 0.0
        max_risk = float(np.max(risks)) if risks else 0.0
        avg_rain = float(np.mean(rainfalls)) if rainfalls else 0.0

        # Flood probability: sigmoid-like mapping from max risk
        flood_prob = round(1 / (1 + np.exp(-0.08 * (max_risk - 50))), 3)

        result.append({
            "id": f"community-{idx}",
            "members": members,
            "member_labels": labels,
            "size": len(members),
            "avg_risk": round(avg_risk, 1),
            "max_risk": round(max_risk, 1),
            "avg_rainfall_mm": round(avg_rain, 1),
            "internal_density": round(density, 3),
            "flood_probability": flood_prob,
            "color": community_colors[idx % len(community_colors)],
        })

    return sorted(result, key=lambda x: -x["avg_risk"])


# ─── Main Graph Endpoint ──────────────────────────────────────────────────────

@router.get("/graph")
def get_knowledge_graph(db: Session = Depends(deps.get_db)) -> Any:
    """
    Full Dynamic Knowledge Graph snapshot.
    Runs TemporalFloodGNN forward pass, computes Louvain communities,
    and returns enriched nodes + edges with real relationship metadata.
    Cached for 60 seconds to balance freshness and compute cost.
    """
    global _kg_cache
    now = time.time()
    if _kg_cache["payload"] is not None and (now - _kg_cache["ts"]) < _KG_CACHE_TTL:
        return _kg_cache["payload"]

    start_time = datetime.now(timezone.utc)

    # ── GNN Forward Pass ──────────────────────────────────────────────────────
    H, edge_index = kg_builder.fetch_graph_snapshot(db, seq_len=3)
    t_gnn_start = time.time()
    gnn_results = gnn_engine.predict(H, edge_index, kg_builder.node_ids)
    gnn_latency_ms = round((time.time() - t_gnn_start) * 1000, 1)

    # ── Build NetworkX working graph ──────────────────────────────────────────
    G = nx.DiGraph()
    for nid in kg_builder.node_ids:
        G.add_node(nid, **kg_builder.graph.nodes[nid])
    for u, v, data in kg_builder.graph.edges(data=True):
        G.add_edge(u, v, **data)

    # ── Apply GAT attention weights to edges ──────────────────────────────────
    last_attn = gnn_results["attentions"][-1] if gnn_results["attentions"] else None
    idx_to_node = {i: nid for i, nid in enumerate(kg_builder.node_ids)}

    if last_attn is not None:
        attn_edge_idx, attn_alpha = last_attn
        attn_edge_idx = attn_edge_idx.cpu().numpy()
        attn_alpha = attn_alpha.cpu().detach().numpy().flatten()

        if attn_alpha.size > attn_edge_idx.shape[1]:
            heads = attn_alpha.size // attn_edge_idx.shape[1]
            attn_alpha = attn_alpha.reshape(-1, heads).mean(axis=1)

        for i in range(attn_edge_idx.shape[1]):
            src_idx = attn_edge_idx[0, i]
            tgt_idx = attn_edge_idx[1, i]
            src = idx_to_node.get(src_idx)
            tgt = idx_to_node.get(tgt_idx)
            if src and tgt and G.has_edge(src, tgt):
                alpha_val = float(attn_alpha[i])
                G[src][tgt]["attention"] = alpha_val
                G.nodes[tgt]["incoming_influence"] = G.nodes[tgt].get("incoming_influence", 0) + alpha_val

    # ── Build Edge Response ───────────────────────────────────────────────────
    edges_response = []
    for u, v, data in G.edges(data=True):
        edge_type = data.get("relationship_type", data.get("type", "river_flow"))
        meta = EDGE_TYPE_META.get(edge_type, EDGE_TYPE_META["river_flow"])
        attn = data.get("attention", data.get("weight", 0.5))
        src_risk = G.nodes[u].get("risk_score", 15.0)
        influence = float(attn) * float(src_risk)
        confidence = data.get("confidence", meta["confidence_base"])
        travel_time = data.get("travel_time_min", meta["travel_time_base_min"])

        edges_response.append({
            "id": f"e-{u}-{v}",
            "source": u,
            "target": v,
            "type": edge_type,
            "relationship_type": edge_type,
            "relationship_label": meta["label"],
            "weight": round(float(attn), 3),
            "attention": round(float(attn), 3),
            "influence": round(float(influence), 2),
            "confidence": round(float(confidence), 2),
            "travel_time_min": int(travel_time),
            "color": meta["color"],
            "label": meta["label"],
            "source_name": data.get("source_name", u),
            "target_name": data.get("target_name", v),
            "animated": influence > 20.0 or float(attn) > 0.4,
            "last_updated": data.get("last_updated", start_time.isoformat()),
        })

    # ── Build Node Response ───────────────────────────────────────────────────
    node_preds = {n["node_id"]: n for n in gnn_results["nodes"]}
    embeddings = gnn_results["embeddings"]
    t_tsne_start = time.time()
    if len(embeddings) > 0:
        coords_2d, proj_method = get_2d_projections(embeddings)
    else:
        coords_2d = np.zeros((len(kg_builder.node_ids), 2))
        proj_method = "None"
    tsne_latency_ms = round((time.time() - t_tsne_start) * 1000, 1)

    min_x, max_x = np.min(coords_2d[:, 0]), np.max(coords_2d[:, 0])
    min_y, max_y = np.min(coords_2d[:, 1]), np.max(coords_2d[:, 1])

    nodes_response = []
    embeddings_projection = []

    for idx, node_id in enumerate(kg_builder.node_ids):
        n = G.nodes[node_id]
        pred = node_preds.get(node_id, {})

        x_val = ((coords_2d[idx, 0] - min_x) / (max_x - min_x) * 200 - 100) if max_x != min_x else 0.0
        y_val = ((coords_2d[idx, 1] - min_y) / (max_y - min_y) * 200 - 100) if max_y != min_y else 0.0

        embeddings_projection.append({
            "id": node_id,
            "label": n.get("label", node_id),
            "type": n.get("type", "unknown"),
            "x": float(round(x_val, 2)),
            "y": float(round(y_val, 2)),
        })

        base_risk = pred.get("risk_score", n.get("risk_score", 15.0))
        # Temporal forecast horizons: Now, +15m, +30m, +1h, +3h, +6h, +12h, +24h
        # Scale is physically motivated: rainfall runoff lag + river routing
        elev_factor = max(0.8, 1.0 - n.get("elevation", 20.0) / 200.0)
        temporal_scales = [1.0, 1.04 * elev_factor, 1.10 * elev_factor,
                           1.18 * elev_factor, 1.30 * elev_factor,
                           1.45 * elev_factor, 1.58 * elev_factor, 1.70 * elev_factor]
        history = [round(min(99.9, max(1.0, base_risk * s)), 1) for s in temporal_scales]

        # Outgoing influence: sum of attention × risk on outgoing edges
        out_influence = sum(
            G[node_id][nb].get("attention", G[node_id][nb].get("weight", 0.3)) * G.nodes[nb].get("risk_score", 0)
            for nb in G.successors(node_id)
        )

        nodes_response.append({
            "id": node_id,
            "label": n.get("label", node_id),
            "type": n.get("type", "unknown"),
            "risk_score": base_risk,
            "history": history,
            "status": pred.get("risk_level", "Safe"),
            "risk_color": pred.get("risk_color", "#3b82f6"),
            "confidence": pred.get("confidence", 0.95),
            "source": pred.get("inference_mode", "Physics"),
            "timestamp": start_time.isoformat(),
            "sensor_count": 1,
            "importance": round(float(n.get("incoming_influence", 0.0)), 3),
            "incoming_influence": round(float(n.get("incoming_influence", 0.0)), 3),
            "outgoing_influence": round(float(out_influence), 2),
            "embedding": [float(v) for v in embeddings[idx][:8]] if len(embeddings) > 0 else [0.0] * 8,
            "embedding_norm": round(float(np.linalg.norm(embeddings[idx])), 3) if len(embeddings) > 0 else 0.0,
            "history": history,
            "lat": float(n.get("lat", 0.0)),
            "lon": float(n.get("lon", 0.0)),
            "data": {
                "rainfall_mm": round(float(n.get("rainfall", 0.0)), 1),
                "river_level": round(float(n.get("river_level", 0.0)), 2),
                "river_danger_level": round(float(n.get("river_danger_level", 5.0)), 2),
                "river_ratio": round(float(n.get("river_ratio", 0.0)), 3),
                "river_name": n.get("river_name", ""),
                "elevation": round(float(n.get("elevation", 0.0)), 1),
                "temperature": round(float(n.get("temperature", 28.0)), 1),
                "humidity": round(float(n.get("humidity", 70.0)), 1),
                "pressure": round(float(n.get("pressure", 1010.0)), 1),
                "population": int(n.get("population", 0)),
            },
            "shap_values": pred.get("shap_values", []),
            "class_probabilities": pred.get("class_probabilities", {}),
        })

    # ── Louvain Community Detection ───────────────────────────────────────────
    raw_communities = kg_builder.compute_louvain_communities()
    communities_detail = _build_community_detail(raw_communities, G)
    communities_list = raw_communities  # keep raw list for backward compat

    # ── Graph Structural Metrics ──────────────────────────────────────────────
    density = nx.density(G)
    avg_degree = sum(dict(G.degree()).values()) / max(1, len(kg_builder.node_ids))
    try:
        clustering_coeff = nx.average_clustering(G.to_undirected())
        connected_comp = nx.number_connected_components(G.to_undirected())
    except Exception:
        clustering_coeff = 0.0
        connected_comp = 1

    total_latency_ms = round((datetime.now(timezone.utc) - start_time).total_seconds() * 1000, 1)

    # ── Critical Paths for Explainability ────────────────────────────────────
    valid_edges = [e for e in edges_response
                   if (e["source"].startswith("d-") and e["target"].startswith("d-")) or 
                      (e["source"].startswith("rv-") and e["target"].startswith("d-"))]
    critical_edges = sorted(valid_edges, key=lambda x: x["influence"], reverse=True)[:5]

    attention_paths = []
    if critical_edges:
        start_edge = critical_edges[0]
        path = [start_edge["source"], start_edge["target"]]
        current = start_edge["target"]
        for _ in range(4):
            out_edges = [e for e in valid_edges if e["source"] == current]
            if not out_edges:
                break
            best = max(out_edges, key=lambda x: x["attention"])
            path.append(best["target"])
            current = best["target"]
        attention_paths.append(path)

    # ── Top influential districts ─────────────────────────────────────────────
    district_nodes_resp = [n for n in nodes_response if n["id"].startswith("d-")]
    top_influential = sorted(district_nodes_resp, key=lambda x: x["incoming_influence"], reverse=True)[:5]

    # ── GNN Pipeline Metadata ─────────────────────────────────────────────────
    gnn_pipeline = {
        "inference_mode": gnn_engine.inference_mode,
        "is_trained": gnn_engine.is_trained,
        "architecture": [
            {"layer": "Input Features", "dim": 12, "description": "Rainfall, River Level, Humidity, Pressure, Temperature, Elevation, Slope, Urban Drainage, Historical Floods, Population, Land Cover, Temporal"},
            {"layer": "GRU (Temporal)", "dim": 32, "description": "Captures temporal flood patterns across 3 time steps per district"},
            {"layer": "GAT Layer 1", "dim": 256, "description": "Graph Attention: 4 heads × 64 dim — spatial message passing across district topology"},
            {"layer": "GAT Layer 2", "dim": 32, "description": "Graph Attention: 1 head — compressed spatial embeddings with attention weights"},
            {"layer": "Classifier", "dim": 5, "description": "5-class flood risk: Very Low → Low → Moderate → High → Critical"},
        ],
        "gnn_latency_ms": gnn_latency_ms,
        "tsne_latency_ms": tsne_latency_ms,
        "total_latency_ms": total_latency_ms,
        "nodes_processed": len(kg_builder.node_ids),
        "edges_processed": len(edges_response),
    }

    payload = {
        "nodes": nodes_response,
        "edges": edges_response,
        "stats": {
            "total_nodes": len(kg_builder.node_ids),
            "total_edges": len(edges_response),
            "district_nodes": len([n for n in kg_builder.node_ids if n.startswith("d-")]),
            "density": round(density, 4),
            "avg_degree": round(avg_degree, 2),
            "clustering_coefficient": round(clustering_coeff, 3),
            "connected_components": connected_comp,
            "latency_ms": total_latency_ms,
            "gnn_latency_ms": gnn_latency_ms,
            "embedding_dim": int(embeddings.shape[1]) if len(embeddings) > 0 else 32,
            "active_sensors": sum(n.get("sensor_count", 1) for n in nodes_response),
            "communities_count": len(raw_communities),
            "inference_mode": gnn_engine.inference_mode,
        },
        "communities": communities_list,
        "communities_detail": communities_detail,
        "embeddings_projection": embeddings_projection,
        "gnn_pipeline": gnn_pipeline,
        "explainability": {
            "top_influential_nodes": [
                {"node_id": n["id"], "label": n["label"], "influence": n["incoming_influence"],
                 "risk_score": n["risk_score"]}
                for n in top_influential
            ],
            "critical_edges": critical_edges,
            "highest_attention_paths": attention_paths,
            "bottlenecks": [],
            "projection_method": proj_method,
        },
        "propagation_steps": [
            [nid for nid in kg_builder.node_ids if nid.startswith("sn-") or nid.startswith("ws-") or nid.startswith("rg-")],
            [nid for nid in kg_builder.node_ids if nid.startswith("c-") or nid.startswith("db-") or nid.startswith("ez-")],
            [nid for nid in kg_builder.node_ids if nid.startswith("rv-") or nid.startswith("rs-") or nid.startswith("dam-")],
            [nid for nid in kg_builder.node_ids if nid.startswith("d-")],
            [nid for nid in kg_builder.node_ids if nid.startswith("pop-") or nid.startswith("fe-")],
        ],
        "timestamp": start_time.isoformat(),
    }

    _kg_cache["ts"] = now
    _kg_cache["payload"] = payload
    return payload


# ─── Node Inspector Endpoint ──────────────────────────────────────────────────

@router.get("/node/{node_id}")
def get_node_detail(node_id: str, db: Session = Depends(deps.get_db)) -> Any:
    """
    Deep node telemetry for the Node Inspector panel.
    Returns full district sensor data, GNN embedding, attention score,
    SHAP breakdown, and neighbour influence analysis.
    """
    # Ensure graph is fresh
    if not kg_builder.graph.nodes.get(node_id):
        # Try refreshing
        kg_builder.update_graph_from_db(db)

    if node_id not in kg_builder.graph:
        raise HTTPException(status_code=404, detail=f"Node '{node_id}' not found in knowledge graph")

    G = kg_builder.graph
    n = G.nodes[node_id]

    # Get GNN prediction for this node
    H, edge_index = kg_builder.fetch_graph_snapshot(db, seq_len=3)
    gnn_results = gnn_engine.predict(H, edge_index, kg_builder.node_ids)
    node_preds = {r["node_id"]: r for r in gnn_results["nodes"]}
    pred = node_preds.get(node_id, {})
    embeddings = gnn_results["embeddings"]
    node_idx = kg_builder.node_ids.index(node_id) if node_id in kg_builder.node_ids else -1

    emb_vec = embeddings[node_idx].tolist() if node_idx >= 0 and len(embeddings) > 0 else [0.0] * 32
    emb_norm = float(np.linalg.norm(embeddings[node_idx])) if node_idx >= 0 and len(embeddings) > 0 else 0.0

    # Neighbour analysis
    predecessors = list(G.predecessors(node_id))
    successors = list(G.successors(node_id))

    incoming_edges = []
    for pred_node in predecessors:
        edge_data = G[pred_node][node_id]
        incoming_edges.append({
            "from_node": pred_node,
            "from_label": G.nodes[pred_node].get("label", pred_node),
            "relationship_type": edge_data.get("relationship_type", "flow"),
            "weight": round(float(edge_data.get("weight", 0.5)), 3),
            "attention": round(float(edge_data.get("attention", edge_data.get("weight", 0.3))), 3),
            "influence": round(float(edge_data.get("attention", 0.3)) * G.nodes[pred_node].get("risk_score", 15.0), 2),
            "travel_time_min": int(edge_data.get("travel_time_min", 120)),
            "confidence": round(float(edge_data.get("confidence", 0.7)), 2),
        })

    outgoing_edges = []
    for succ_node in successors:
        edge_data = G[node_id][succ_node]
        outgoing_edges.append({
            "to_node": succ_node,
            "to_label": G.nodes[succ_node].get("label", succ_node),
            "relationship_type": edge_data.get("relationship_type", "flow"),
            "weight": round(float(edge_data.get("weight", 0.5)), 3),
            "travel_time_min": int(edge_data.get("travel_time_min", 120)),
        })

    # Historical flood events connected to this node
    connected_flood_events = [
        {"event_node": p, "label": G.nodes[p].get("label", p), "risk": G.nodes[p].get("risk_score", 0.0)}
        for p in predecessors if p.startswith("fe-")
    ]

    return {
        "node_id": node_id,
        "label": n.get("label", node_id),
        "type": n.get("type", "district"),
        "district_id": n.get("district_id"),
        "risk_score": pred.get("risk_score", n.get("risk_score", 15.0)),
        "risk_level": pred.get("risk_level", "Safe"),
        "risk_color": pred.get("risk_color", "#3b82f6"),
        "confidence": pred.get("confidence", 0.82),
        "inference_mode": pred.get("inference_mode", "Physics"),
        "class_probabilities": pred.get("class_probabilities", {}),
        "telemetry": {
            "rainfall_mm_24h": round(float(n.get("rainfall", 0.0)), 1),
            "temperature_c": round(float(n.get("temperature", 28.0)), 1),
            "humidity_pct": round(float(n.get("humidity", 70.0)), 1),
            "pressure_hpa": round(float(n.get("pressure", 1010.0)), 1),
            "river_name": n.get("river_name", "Unknown"),
            "river_level_m": round(float(n.get("river_level", 0.0)), 2),
            "river_danger_level_m": round(float(n.get("river_danger_level", 5.0)), 2),
            "river_ratio_pct": round(float(n.get("river_ratio", 0.0)) * 100, 1),
            "elevation_m": round(float(n.get("elevation", 15.0)), 1),
            "population": int(n.get("population", 0)),
        },
        "gnn_state": {
            "embedding_vector": emb_vec[:16],  # First 16 dims for display
            "embedding_norm": round(emb_norm, 3),
            "embedding_dim": len(emb_vec),
            "incoming_influence": round(float(n.get("incoming_influence", 0.0)), 3),
        },
        "shap_values": pred.get("shap_values", []),
        "incoming_edges": sorted(incoming_edges, key=lambda x: -x["influence"])[:10],
        "outgoing_edges": outgoing_edges[:10],
        "historical_flood_events": connected_flood_events,
        "coordinates": {"lat": float(n.get("lat", 0.0)), "lon": float(n.get("lon", 0.0))},
        "community_idx": int(n.get("community_idx", 0)),
        "last_updated": n.get("last_updated", datetime.now(timezone.utc).isoformat()),
    }


# ─── Edge Inspector Endpoint ──────────────────────────────────────────────────

@router.get("/edge/{edge_id}")
def get_edge_detail(edge_id: str, db: Session = Depends(deps.get_db)) -> Any:
    """
    Edge relationship detail for the Edge Inspector panel.
    edge_id format: 'e-{source}-{target}' e.g. 'e-d-1-d-2'
    """
    # Parse edge_id → source, target node IDs
    # Format: e-d-1-d-2 → source=d-1, target=d-2
    parts = edge_id.split("-")
    if len(parts) < 4 or parts[0] != "e":
        raise HTTPException(status_code=400, detail="Edge ID format must be 'e-{source}-{target}'")

    # Reconstruct: after removing leading 'e', find split point
    # e.g. 'e-d-1-d-2' → strip 'e-' → 'd-1-d-2' → we need to find the boundary
    remainder = edge_id[2:]  # strip 'e-'
    # Find the split between source and target node IDs (both have format PREFIX-NUM)
    # Try all possible split points
    source_id = None
    target_id = None
    G = kg_builder.graph

    if not G.nodes:
        kg_builder.update_graph_from_db(db)
        G = kg_builder.graph

    for u, v in G.edges():
        if f"e-{u}-{v}" == edge_id:
            source_id, target_id = u, v
            break

    if source_id is None or target_id is None:
        raise HTTPException(status_code=404, detail=f"Edge '{edge_id}' not found in knowledge graph")

    edge_data = G[source_id][target_id]
    src_node = G.nodes[source_id]
    tgt_node = G.nodes[target_id]

    edge_type = edge_data.get("relationship_type", edge_data.get("type", "flow"))
    meta = EDGE_TYPE_META.get(edge_type, EDGE_TYPE_META["river_flow"])
    attn = float(edge_data.get("attention", edge_data.get("weight", 0.5)))
    src_risk = float(src_node.get("risk_score", 15.0))

    return {
        "edge_id": edge_id,
        "source": source_id,
        "target": target_id,
        "source_label": src_node.get("label", source_id),
        "target_label": tgt_node.get("label", target_id),
        "relationship_type": edge_type,
        "relationship_label": meta["label"],
        "color": meta["color"],
        "weight": round(float(edge_data.get("weight", 0.5)), 3),
        "attention": round(attn, 3),
        "influence": round(attn * src_risk, 2),
        "propagation_probability": round(min(0.99, attn * float(edge_data.get("confidence", 0.7))), 3),
        "confidence": round(float(edge_data.get("confidence", 0.7)), 2),
        "travel_time_min": int(edge_data.get("travel_time_min", 120)),
        "source_risk": round(src_risk, 1),
        "target_risk": round(float(tgt_node.get("risk_score", 15.0)), 1),
        "last_updated": edge_data.get("last_updated", datetime.now(timezone.utc).isoformat()),
    }


# ─── Flood Propagation Endpoint ───────────────────────────────────────────────

@router.get("/propagation")
def get_flood_propagation(
    source_node: str = Query(..., description="Source node ID, e.g. 'd-14'"),
    max_hops: int = Query(6, ge=1, le=10),
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    BFS flood propagation wave from a source district node.
    Uses real edge weights and travel_time_min values from the Knowledge Graph.
    Returns ordered list of districts with estimated flood arrival times.
    """
    if not kg_builder.graph.nodes:
        kg_builder.update_graph_from_db(db)

    if source_node not in kg_builder.graph:
        raise HTTPException(status_code=404, detail=f"Source node '{source_node}' not found")

    src_node_data = kg_builder.graph.nodes[source_node]
    wave = kg_builder.get_propagation_wave(source_node, max_hops=max_hops)

    return {
        "source_node": source_node,
        "source_label": src_node_data.get("label", source_node),
        "source_risk": round(float(src_node_data.get("risk_score", 15.0)), 1),
        "propagation_wave": wave,
        "total_districts_affected": len(wave),
        "max_travel_time_min": max((w["estimated_time_min"] for w in wave), default=0),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Live Community Detection Endpoint ───────────────────────────────────────

@router.get("/communities")
def get_communities(db: Session = Depends(deps.get_db)) -> Any:
    """
    Live Louvain community detection on the current Knowledge Graph.
    Returns enriched community objects with risk aggregation, rainfall avg,
    internal edge density, and flood probability.
    """
    if not kg_builder.graph.nodes:
        kg_builder.update_graph_from_db(db)

    G = kg_builder.graph
    raw_communities = kg_builder.compute_louvain_communities()
    communities_detail = _build_community_detail(raw_communities, G)

    return {
        "communities": communities_detail,
        "total_communities": len(communities_detail),
        "algorithm": "Louvain (NetworkX)",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ─── Summary Endpoint ─────────────────────────────────────────────────────────

@router.get("/summary")
def get_kg_summary(db: Session = Depends(deps.get_db)) -> Any:
    """Returns lightweight stats for dashboard widgets."""
    from app.models.history import ModelInference
    from app.models.district import District

    db_dist_count = db.query(District).count()
    dist_count = db_dist_count if db_dist_count > 0 else 38

    inf = db.query(ModelInference).order_by(ModelInference.created_at.desc()).first()
    nodes_count = inf.node_count if inf else 147
    edges_count = inf.edge_count if inf else 248
    last_updated_ts = inf.created_at.isoformat() + "Z" if inf else datetime.now(timezone.utc).isoformat()

    r_nodes = len([n for n in kg_builder.graph.nodes if n.startswith("rv-")]) if kg_builder.graph else 0
    res_nodes = len([n for n in kg_builder.graph.nodes if n.startswith("rs-")]) if kg_builder.graph else 0
    ws_nodes = len([n for n in kg_builder.graph.nodes if n.startswith("ws-")]) if kg_builder.graph else 0

    return {
        "nodes": nodes_count,
        "edges": edges_count,
        "district_nodes": dist_count,
        "river_nodes": r_nodes,
        "reservoir_nodes": res_nodes,
        "weather_station_nodes": ws_nodes,
        "last_updated": last_updated_ts,
        "inference_mode": gnn_engine.inference_mode,
    }
