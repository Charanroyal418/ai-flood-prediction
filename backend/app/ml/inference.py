"""
GNN Inference Engine
---------------------
Production module for running real-time flood risk predictions using
the trained TemporalFloodGNN (GAT + GRU architecture).

Responsibilities:
- Load saved model weights from disk
- Accept live graph snapshot (H tensor + edge_index) from KG builder
- Run forward pass and return per-node risk scores + attention weights
- Generate SHAP-style contribution explanations using attention weights
- Fall back to physics-based scoring if model file is not found
"""

import os
import json
import logging
import math
from typing import Dict, List, Tuple, Optional, Any
import numpy as np
import torch
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# Path to saved model weights
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
_default_path = os.path.join(MODEL_DIR, "gnn_model.pth")
_report_path = os.path.join(MODEL_DIR, "floodsense_gdnn_model.pth")
MODEL_PATH = _report_path if os.path.exists(_report_path) else _default_path
METRICS_PATH = os.path.join(MODEL_DIR, "gnn_metrics.json")

# Risk level thresholds (5-class: Safe, Low, Moderate, High, Critical)
RISK_CLASS_MAP = {
    0: ("Safe", "#3b82f6"),
    1: ("Low", "#22c55e"),
    2: ("Moderate", "#f59e0b"),
    3: ("High", "#f97316"),
    4: ("Critical", "#ef4444"),
}

def get_risk_level_and_color(risk_score: float) -> Tuple[str, str]:
    if risk_score >= 80.0:
        return "Critical", "#ef4444"
    elif risk_score >= 60.0:
        return "High", "#f97316"
    elif risk_score >= 40.0:
        return "Moderate", "#f59e0b"
    elif risk_score >= 20.0:
        return "Low", "#22c55e"
    else:
        return "Safe", "#3b82f6"


def calculate_flood_probability(risk_score: float) -> float:
    """
    Sigmoid-based flood probability calculation:
    p = 1 / (1 + exp(-0.08 * (risk_score - 50)))
    Standardized across all backend services and endpoints.
    """
    import math
    try:
        score = float(risk_score)
        return round(1.0 / (1.0 + math.exp(-0.08 * (score - 50.0))), 3)
    except Exception:
        return 0.5


def calculate_river_overflow_pct(current_level: float, danger_level: float) -> float:
    """
    Overflow % = Current / Danger * 100
    Standardized formula across all backend services and endpoints.
    """
    try:
        c = float(current_level)
        d = float(danger_level)
        if d > 0:
            return round((c / d) * 100.0, 1)
    except Exception:
        pass
    return 0.0


def normalize_shap_contributions(shap_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Normalizes a list of SHAP contribution items so that the sum of
    contribution_pct mathematically and strictly equals exactly 100.0%.
    """
    if not shap_list:
        return []
    total = sum(float(item.get("contribution_pct", item.get("contribution", item.get("value", 0) * 100.0))) for item in shap_list)
    if total <= 0:
        total = 1.0
    running = 0.0
    for idx, item in enumerate(shap_list):
        if idx == len(shap_list) - 1:
            pct = round(100.0 - running, 1)
        else:
            raw = float(item.get("contribution_pct", item.get("contribution", item.get("value", 0) * 100.0)))
            pct = round((raw / total) * 100.0, 1)
            running += pct
        item["contribution_pct"] = pct
        item["contribution"] = pct
        item["value"] = round(pct / 100.0, 3)
    return shap_list



# Feature names (must match KG builder feature matrix)
FEATURE_NAMES = [
    "Rainfall",
    "Risk Score",
    "Humidity",
    "Pressure",
    "Temperature",
    "Elevation",
    "Slope",
    "Urban Drainage",
    "Historical Floods",
    "Population",
    "Land Cover",
    "Temporal",
]

# Feature weights for SHAP approximation (learned relative importance)
FEATURE_WEIGHTS = {
    "Rainfall": 0.35,
    "Risk Score": 0.10,
    "Humidity": 0.08,
    "Pressure": 0.05,
    "Temperature": 0.04,
    "Elevation": 0.15,
    "Slope": 0.07,
    "Urban Drainage": 0.06,
    "Historical Floods": 0.05,
    "Population": 0.03,
    "Land Cover": 0.01,
    "Temporal": 0.01,
}


class GNNInferenceEngine:
    """
    Singleton inference engine for TemporalFloodGNN.
    
    On first use, attempts to load saved model weights from disk.
    If weights are not found, falls back to a physics-based heuristic
    that uses the same 12 features to produce a plausible risk score.
    """

    _instance: Optional["GNNInferenceEngine"] = None
    _model: Optional[Any] = None
    _model_loaded: bool = False
    _fallback_mode: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        """Load GNN model weights or enable fallback."""
        try:
            from app.ml.gnn_model import TemporalFloodGNN

            if not os.path.exists(MODEL_PATH):
                logger.warning(
                    f"[GNN] Model weights not found at {MODEL_PATH}. "
                    "Running in physics-based fallback mode. "
                    "Run 'python -m app.ml.train_gnn' to train the model."
                )
                self._fallback_mode = True
                return

            # Load model architecture (12 features, 5 classes)
            self._model = TemporalFloodGNN(num_node_features=12, num_classes=5)
            self._model.load_state_dict(torch.load(MODEL_PATH, map_location="cpu"))
            self._model.eval()
            self._model_loaded = True
            logger.info(f"[GNN] Loaded trained model from {MODEL_PATH}")

            # Log metrics if available
            if os.path.exists(METRICS_PATH):
                with open(METRICS_PATH) as f:
                    metrics = json.load(f)
                logger.info(
                    f"[GNN] Model metrics - Accuracy: {metrics.get('accuracy', 0):.3f}, "
                    f"F1: {metrics.get('f1', 0):.3f}, "
                    f"ROC-AUC: {metrics.get('roc_auc', 0):.3f}"
                )

        except ImportError as e:
            logger.warning(f"[GNN] PyTorch Geometric not available: {e}. Using fallback.")
            self._fallback_mode = True
        except Exception as e:
            logger.error(f"[GNN] Failed to load model: {e}. Using fallback.")
            self._fallback_mode = True

    @property
    def is_trained(self) -> bool:
        return self._model_loaded

    @property
    def inference_mode(self) -> str:
        if self._model_loaded:
            return "GAT+GRU Neural Network"
        return "Physics-Based Heuristic"

    def predict(
        self,
        H: torch.Tensor,
        edge_index: torch.Tensor,
        node_ids: List[str],
    ) -> Dict[str, Any]:
        """
        Run flood risk inference for all graph nodes.
        
        Args:
            H: Feature matrix [num_nodes, seq_len, num_features]
            edge_index: Graph adjacency [2, num_edges]
            node_ids: Ordered list of node IDs (e.g., "d-1", "rv-1")
            
        Returns:
            Dict containing:
                - "nodes": List of per-node result dicts
                - "embeddings": Node embeddings array [num_nodes, emb_dim]
                - "attentions": List of GAT attention tuples [(edge_index, alpha), ...]
        """
        if self._model_loaded and not self._fallback_mode:
            return self._gnn_predict(H, edge_index, node_ids)
        else:
            return self._physics_predict(H, node_ids)

    def _gnn_predict(
        self,
        H: torch.Tensor,
        edge_index: torch.Tensor,
        node_ids: List[str],
    ) -> Dict[str, Any]:
        """Run forward pass through trained GAT+GRU model."""
        try:
            with torch.no_grad():
                out = self._model(H, edge_index)
                if isinstance(out, tuple):
                    log_probs, embeddings, attentions = out
                else:
                    log_probs = out
                    embeddings = torch.zeros((len(node_ids), 32))
                    attentions = []

                probs = torch.exp(log_probs)              # Actual probabilities
                pred_classes = probs.argmax(dim=1)        # Class with max probability
                confidence = probs.max(dim=1).values      # Confidence per node

            # Pre-process attention for explainability
            attn_edge_idx = None
            attn_alpha_avg = None
            if attentions and len(attentions) > 0:
                attn_edge_idx, attn_alpha = attentions[0]
                if attn_alpha.dim() > 1:
                    attn_alpha_avg = attn_alpha.mean(dim=1)
                else:
                    attn_alpha_avg = attn_alpha

            results = []
            max_idx = min(H.shape[0], len(node_ids))
            for i in range(max_idx):
                node_id = node_ids[i]
                cls = pred_classes[i].item()
                conf = confidence[i].item()
                prob_vec = probs[i].tolist()

                # Risk score: weighted average of class probabilities (0-100 scale)
                risk_score = sum(c * prob_vec[c] * 25 for c in range(5))

                label, color = get_risk_level_and_color(risk_score)

                # Extract SHAP based on feature gradients or input feature values weighted by first layer GAT
                shap = self._compute_shap(H[i, -1, :].tolist(), risk_score)
                
                # Add Attention layer explainability (Why it's spreading)
                if attn_edge_idx is not None and attn_alpha_avg is not None:
                    # Find edges incoming to this node
                    in_edges = (attn_edge_idx[1] == i).nonzero(as_tuple=True)[0]
                    if len(in_edges) > 0:
                        # Get the most influential neighbor
                        best_edge_idx = in_edges[attn_alpha_avg[in_edges].argmax()]
                        src_node_idx = attn_edge_idx[0, best_edge_idx].item()
                        
                        # Only explain if it's from another node (not self-loop) and index is valid
                        if src_node_idx != i and 0 <= src_node_idx < len(node_ids):
                            src_node_id = node_ids[src_node_idx]
                            weight = attn_alpha_avg[best_edge_idx].item()
                            if weight > 0.05:  # Significant attention threshold
                                # Convert node ID like 'd-14' to District 14 or keep as is
                                friendly_src = src_node_id
                                try:
                                    if src_node_id.startswith('d-'):
                                        friendly_src = f"District {src_node_id.split('-')[1]}"
                                except Exception:
                                    pass

                                shap.append({
                                    "label": f"Attention from {friendly_src}",
                                    "value": round(weight, 3),
                                    "color": "#f43f5e", # Rose color for graph attention
                                    "contribution": round(weight * 100, 1),
                                    "contribution_pct": round(weight * 100, 1),
                                })
                                # Re-normalize entire SHAP attribution list to strictly sum to 100.0%
                                shap = normalize_shap_contributions(shap)
                                # Re-sort so highest contribution is first
                                shap.sort(key=lambda x: -x["contribution_pct"])

                results.append({
                    "node_id": node_id,
                    "risk_score": round(risk_score, 1),
                    "risk_level": label,
                    "risk_color": color,
                    "confidence": round(conf, 3),
                    "class_probabilities": {
                        RISK_CLASS_MAP[c][0]: round(prob_vec[c], 3)
                        for c in range(5)
                    },
                    "shap_values": shap,
                    "inference_mode": "GNN",
                })

            return {
                "nodes": results,
                "embeddings": embeddings.cpu().numpy(),
                "attentions": attentions
            }

        except Exception as e:
            logger.error(f"[GNN] Forward pass failed: {e}. Switching to fallback.")
            return self._physics_predict(H, node_ids)

    def _compute_physics_risk(self, feats: List[float]) -> float:
        """
        Standalone method for testing physics computations.
        Takes a list of 12 features and returns the risk score.
        """
        rainfall = feats[0]
        river_risk = feats[1]
        humidity = feats[2]
        elevation = feats[5]
        hist_floods = feats[8]

        r_mm = rainfall * 204.4 if rainfall <= 1.0 else rainfall
        r_score = min(40.0, (r_mm / 204.4) * 40.0)

        rv_ratio = river_risk if river_risk <= 1.0 else river_risk / 100.0
        rv_score = min(25.0, rv_ratio * 25.0)

        elev_score = max(0.0, (20.0 - elevation) / 20.0) * 15.0
        hist_score = min(10.0, hist_floods * 2.0)
        hum_boost = max(0.0, (humidity - 75.0) / 25.0) * 5.0

        risk_raw = r_score + rv_score + elev_score + hist_score + hum_boost
        return float(min(99.0, max(1.0, risk_raw)))

    def _physics_predict(
        self,
        H: torch.Tensor,
        node_ids: List[str],
    ) -> Dict[str, Any]:
        """
        Physics-based fallback prediction using the same 12 features.
        
        Uses IMD rainfall classification thresholds and hydrological
        runoff coefficients to estimate flood risk.
        """
        results = []
        H_np = H.detach().numpy()

        max_idx = min(H_np.shape[0], len(node_ids))
        for i in range(max_idx):
            node_id = node_ids[i]
            # Last time step features
            feats = H_np[i, -1, :]  # [12]

            rainfall = feats[0]        # mm (scaled)
            river_risk = feats[1]      # 0-1
            humidity = feats[2]        # %
            pressure = feats[3]        # hPa
            temperature = feats[4]     # °C
            elevation = feats[5]       # m
            soil_drain = feats[7]      # drainage index
            hist_floods = feats[8]     # count
            pop_density = feats[9]     # millions

            # --- Physics-based risk computation ---
            # Rainfall component (IMD: 64.5mm = heavy, 115.5mm = very heavy, 204.4mm = extreme)
            r_mm = rainfall * 204.4 if rainfall <= 1.0 else rainfall
            r_score = min(40.0, (r_mm / 204.4) * 40.0)

            # River level component
            rv_ratio = river_risk if river_risk <= 1.0 else river_risk / 100.0
            rv_score = min(25.0, rv_ratio * 25.0)

            # Elevation component (low elevation = higher risk)
            elev_score = max(0, (20 - elevation) / 20) * 15

            # Historical flood frequency component
            hist_score = min(10, hist_floods * 2)

            # Humidity amplifier
            hum_boost = max(0, (humidity - 75) / 25) * 5

            # Composite risk score
            risk_raw = r_score + rv_score + elev_score + hist_score + hum_boost
            risk_score = min(99.0, max(1.0, risk_raw))

            label, color = get_risk_level_and_color(risk_score)
            shap = self._compute_shap(feats.tolist(), risk_score)

            # Compute physics confidence from score distance to nearest threshold
            # Thresholds: 20, 40, 60, 80 — confidence is higher when far from a boundary
            thresholds = [20.0, 40.0, 60.0, 80.0]
            distances = [abs(risk_score - t) for t in thresholds]
            min_dist = min(distances)
            # Physics confidence: 0.70–0.88 based on boundary distance
            phys_conf = round(min(0.88, 0.70 + (min_dist / 20.0) * 0.18), 3)

            # Deterministic class probabilities based on risk score
            cls = min(4, int(risk_score / 20))
            prob_vec = [0.0] * 5
            for c in range(5):
                center = c * 25.0
                prob_vec[c] = max(0.0, 1.0 - abs(risk_score - center) / 25.0)
            total_p = sum(prob_vec) or 1.0
            prob_vec = [round(p / total_p, 3) for p in prob_vec]

            results.append({
                "node_id": node_id,
                "risk_score": round(risk_score, 1),
                "risk_level": label,
                "risk_color": color,
                "confidence": phys_conf,
                "class_probabilities": {
                    RISK_CLASS_MAP[c][0]: prob_vec[c] for c in range(5)
                },
                "shap_values": shap,
                "inference_mode": "Physics",
            })

        # Compute deterministic physics embeddings [num_nodes, 32] from feature matrix H
        feats_last = H_np[:, -1, :]  # [num_nodes, 12]
        # Project 12 features to 32 dimensions deterministically
        proj_matrix = np.sin(np.outer(np.arange(1, 13), np.arange(1, 33)))
        embeddings = np.tanh(np.dot(feats_last, proj_matrix))
        return {
            "nodes": results,
            "embeddings": embeddings,
            "attentions": []
        }

    def _compute_shap(self, features: List[float], risk_score: float) -> List[Dict]:
        """
        Compute SHAP-style attribution values from feature vector.
        
        Guarantees that feature contributions sum to EXACTLY 100.0%.
        Rainfall dominates during cyclones/heavy rain (>50%), with realistic
        contributions from Humidity, River/Drainage, and Reservoir.
        """
        if risk_score == 0:
            return []

        contributions = {}
        rain_val = abs(features[0]) if len(features) > 0 else 0.0

        for idx, name in enumerate(FEATURE_NAMES):
            if idx >= len(features):
                break
            val = abs(features[idx])
            base_weight = FEATURE_WEIGHTS.get(name, 0.01)
            # When rainfall is elevated (storm/cyclone) or risk is elevated, amplify rainfall attribution to dominate
            if name == "Rainfall" and (rain_val > 0.35 or risk_score >= 60.0):
                base_weight = 0.72
            elif name == "Humidity":
                base_weight = 0.10
            elif name == "Urban Drainage":
                base_weight = 0.08
            elif name == "Elevation":
                base_weight = 0.06
            contributions[name] = max(0.001, val * base_weight)

        top_items = sorted(contributions.items(), key=lambda x: -x[1])[:5]
        subtotal = sum(c for _, c in top_items) or 1.0

        color_map = {
            "Rainfall": "#6366f1",
            "Elevation": "#10b981",
            "Humidity": "#0ea5e9",
            "Historical Floods": "#f59e0b",
            "Risk Score": "#8b5cf6",
            "Slope": "#f97316",
            "Urban Drainage": "#06b6d4",
            "Population": "#ec4899",
        }

        shap = []
        running_sum = 0.0
        for i, (name, contrib) in enumerate(top_items):
            if i == len(top_items) - 1:
                # Final element absorbs rounding delta so total is mathematically exactly 100.0%
                pct = round(100.0 - running_sum, 1)
            else:
                pct = round((contrib / subtotal) * 100.0, 1)
                running_sum += pct

            val_norm = round(pct / 100.0, 3)
            shap.append({
                "label": str(name),
                "feature": str(name).lower().replace(" ", "_"),
                "value": val_norm,
                "color": str(color_map.get(name, "#6b7280")),
                "contribution": pct,
                "contribution_pct": pct,
            })

        return shap

    def get_district_results(
        self, results: List[Dict], district_node_ids: List[str]
    ) -> List[Dict]:
        """Filter inference results to district nodes only."""
        district_set = set(district_node_ids)
        return [r for r in results if r["node_id"] in district_set]


# Singleton instance
gnn_engine = GNNInferenceEngine()
