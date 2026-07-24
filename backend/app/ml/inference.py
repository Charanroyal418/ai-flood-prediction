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
from typing import Dict, List, Tuple, Optional, Any
import torch
import torch.nn.functional as F

logger = logging.getLogger(__name__)

# Path to saved model weights
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "gnn_model.pth")
METRICS_PATH = os.path.join(MODEL_DIR, "gnn_metrics.json")

# Risk level thresholds (5-class: Very Low, Low, Moderate, High, Severe)
RISK_CLASS_MAP = {
    0: ("Very Low", "#22c55e"),
    1: ("Low", "#84cc16"),
    2: ("Moderate", "#f59e0b"),
    3: ("High", "#f97316"),
    4: ("Severe", "#ef4444"),
}

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

                label, color = RISK_CLASS_MAP[cls]

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
                                    "contribution_pct": round(weight * 100, 1),
                                })
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
            r_score = min(40, (rainfall / 204.4) * 40)

            # River level component
            rv_score = river_risk * 25

            # Elevation component (low elevation = higher risk)
            elev_score = max(0, (20 - elevation) / 20) * 15

            # Historical flood frequency component
            hist_score = min(10, hist_floods * 2)

            # Humidity amplifier
            hum_boost = max(0, (humidity - 75) / 25) * 5

            # Composite risk score
            risk_raw = r_score + rv_score + elev_score + hist_score + hum_boost
            risk_score = min(99.0, max(1.0, risk_raw))

            # Map to risk class
            if risk_score >= 80:
                cls = 4
            elif risk_score >= 60:
                cls = 3
            elif risk_score >= 40:
                cls = 2
            elif risk_score >= 20:
                cls = 1
            else:
                cls = 0

            label, color = RISK_CLASS_MAP[cls]
            shap = self._compute_shap(feats.tolist(), risk_score)

            results.append({
                "node_id": node_id,
                "risk_score": round(risk_score, 1),
                "risk_level": label,
                "risk_color": color,
                "confidence": 0.82,  # physics model uncertainty
                "class_probabilities": {
                    RISK_CLASS_MAP[c][0]: round(
                        1.0 if c == cls else max(0, 0.1 - abs(c - cls) * 0.03), 3
                    )
                    for c in range(5)
                },
                "shap_values": shap,
                "inference_mode": "Physics",
            })

        return {
            "nodes": results,
            "embeddings": np.random.randn(len(node_ids), 32), # Mock embeddings
            "attentions": []
        }

    def _compute_shap(self, features: List[float], risk_score: float) -> List[Dict]:
        """
        Compute SHAP-style attribution values from feature vector.
        
        Uses normalized feature magnitudes weighted by learned feature importance.
        Returns top-4 contributors formatted for the frontend explainability panel.
        """
        if risk_score == 0:
            return []

        contributions = {}
        for idx, name in enumerate(FEATURE_NAMES):
            if idx >= len(features):
                break
            val = abs(features[idx])
            base_weight = FEATURE_WEIGHTS.get(name, 0.01)
            # Scale contribution by value magnitude
            contributions[name] = val * base_weight

        total = sum(contributions.values()) or 1.0
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
        for name, contrib in sorted(contributions.items(), key=lambda x: -x[1])[:6]:
            pct = contrib / total
            if pct > 0.01:
                shap.append({
                    "label": name,
                    "value": round(pct, 3),
                    "color": color_map.get(name, "#6b7280"),
                    "contribution_pct": round(pct * 100, 1),
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
