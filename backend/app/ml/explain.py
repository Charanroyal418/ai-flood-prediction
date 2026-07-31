"""
XAI Explainability Module
--------------------------
Provides Explainable AI (XAI) attribution for GNN flood risk predictions.

Two explanation strategies:
1. GNN mode: Gradient × Input (GradCAM-style) using backward pass through
   the loaded TemporalFloodGNN model. Produces per-feature SHAP-style scores.
2. Physics mode: Sensitivity-based attribution — partial derivatives of the
   physics risk formula with respect to each input feature.

No fake weights. No hardcoded percentages. All values come from computation.
"""

import logging
import math
from typing import Dict, List, Optional, Any

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Feature Metadata
# ---------------------------------------------------------------------------
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
    "Temporal Signal",
]

FEATURE_COLORS = {
    "Rainfall":          "#6366f1",
    "Risk Score":        "#8b5cf6",
    "Humidity":          "#0ea5e9",
    "Pressure":          "#64748b",
    "Temperature":       "#f59e0b",
    "Elevation":         "#10b981",
    "Slope":             "#f97316",
    "Urban Drainage":    "#06b6d4",
    "Historical Floods": "#f59e0b",
    "Population":        "#ec4899",
    "Land Cover":        "#84cc16",
    "Temporal Signal":   "#a855f7",
}

FEATURE_DESCRIPTIONS = {
    "Rainfall":          "24h accumulated precipitation (IMD scale)",
    "Risk Score":        "Prior risk score propagated from neighbors",
    "Humidity":          "Relative humidity amplifying runoff",
    "Pressure":          "Atmospheric pressure indicating storm systems",
    "Temperature":       "Air temperature affecting evapotranspiration",
    "Elevation":         "DEM elevation — low elevation = high inundation risk",
    "Slope":             "Terrain slope — flat = slower drainage",
    "Urban Drainage":    "Urban drainage capacity index",
    "Historical Floods": "Decadal flood frequency from historical records",
    "Population":        "Population density scaling exposure risk",
    "Land Cover":        "Impervious surface fraction (urban/rural)",
    "Temporal Signal":   "Seasonal monsoon signal from IMD calendar",
}


# ---------------------------------------------------------------------------
# Physics Sensitivity Attribution (Fallback Mode)
# ---------------------------------------------------------------------------

def _physics_gradient_attribution(features: List[float], risk_score: float) -> List[Dict]:
    """
    Compute attribution via finite-difference sensitivity analysis on the
    physics risk formula used in inference.py _physics_predict().
    
    For each feature i, attribution_i = |∂risk/∂x_i| * |x_i|
    Uses central-difference approximation with epsilon=0.01.
    
    Returns: List of attribution dicts sorted by contribution descending.
    """
    eps = 0.01
    features = list(features)
    n = len(features)
    attributions: Dict[str, float] = {}

    def _physics_risk(feats: List[float]) -> float:
        """Inline physics risk formula (mirrors inference.py _physics_predict)."""
        rainfall = feats[0] if len(feats) > 0 else 0.0
        river_risk = feats[1] if len(feats) > 1 else 0.0
        humidity = feats[2] if len(feats) > 2 else 0.0
        pressure = feats[3] if len(feats) > 3 else 0.0
        elevation = feats[5] if len(feats) > 5 else 0.0
        hist_floods = feats[8] if len(feats) > 8 else 0.0

        r_mm = rainfall * 204.4 if rainfall <= 1.0 else rainfall
        r_score = min(40.0, (r_mm / 204.4) * 40.0)

        rv_ratio = river_risk if river_risk <= 1.0 else river_risk / 100.0
        rv_score = min(25.0, rv_ratio * 25.0)

        elev_score = max(0.0, (20.0 - elevation) / 20.0) * 15.0
        hist_score = min(10.0, hist_floods * 2.0)
        hum_boost = max(0.0, (humidity - 75.0) / 25.0) * 5.0

        return min(99.0, max(1.0, r_score + rv_score + elev_score + hist_score + hum_boost))

    for i, name in enumerate(FEATURE_NAMES):
        if i >= n:
            break

        # Central-difference gradient
        feats_plus = features[:]
        feats_minus = features[:]
        feats_plus[i] = features[i] + eps
        feats_minus[i] = features[i] - eps

        grad = (_physics_risk(feats_plus) - _physics_risk(feats_minus)) / (2.0 * eps)
        # Attribution = |gradient| × |feature value| (Grad × Input)
        attribution = abs(grad) * abs(features[i])
        attributions[name] = attribution

    # Normalize to sum = 1.0
    total = sum(attributions.values())
    if total < 1e-9:
        # Uniform fallback
        for name in attributions:
            attributions[name] = 1.0 / len(attributions)
        total = 1.0

    results = []
    for name, val in sorted(attributions.items(), key=lambda x: -x[1]):
        pct = float(val / total) * 100.0
        if pct > 0.5:  # Only show features with > 0.5% contribution
            results.append({
                "label": name,
                "value": round(float(val / total), 4),
                "contribution_pct": round(pct, 1),
                "color": FEATURE_COLORS.get(name, "#6b7280"),
                "description": FEATURE_DESCRIPTIONS.get(name, ""),
            })

    return results[:6]  # Top 6 contributors


# ---------------------------------------------------------------------------
# GNN Gradient × Input Attribution
# ---------------------------------------------------------------------------

def _gnn_gradient_attribution(
    model: Any,
    H: Any,         # torch.Tensor [num_nodes, seq_len, num_features]
    edge_index: Any, # torch.Tensor [2, num_edges]
    node_idx: int,
    risk_score: float,
) -> List[Dict]:
    """
    Gradient × Input attribution for a single node in the GNN.
    
    Method: GradCAM on node features
    1. Forward pass with gradient tracking
    2. Backward pass targeting predicted class logit
    3. Attribution = gradient × input feature (last time step)
    4. Normalize and format
    
    Returns sorted attribution list.
    """
    try:
        import torch
        import torch.nn.functional as F

        H_clone = H.clone().detach().requires_grad_(True)

        model.eval()
        out = model(H_clone, edge_index)
        if isinstance(out, tuple):
            log_probs = out[0]
        else:
            log_probs = out

        probs = torch.exp(log_probs)
        pred_class = probs[node_idx].argmax().item()

        # Backward from predicted class logit
        model.zero_grad()
        log_probs[node_idx, pred_class].backward()

        # Gradient of predicted class logit w.r.t. input
        grads = H_clone.grad  # [num_nodes, seq_len, num_features]
        if grads is None:
            logger.debug("[XAI] Gradient is None — falling back to physics attribution")
            return _physics_gradient_attribution(
                H[node_idx, -1, :].detach().tolist(), risk_score
            )

        # Use last time step gradients for this node
        node_grads = grads[node_idx, -1, :].detach().cpu().numpy()  # [num_features]
        node_feats = H[node_idx, -1, :].detach().cpu().numpy()

        # Grad × Input
        attributions_raw = np.abs(node_grads * node_feats)
        total = attributions_raw.sum()
        if total < 1e-9:
            return _physics_gradient_attribution(node_feats.tolist(), risk_score)

        results = []
        for i, name in enumerate(FEATURE_NAMES):
            if i >= len(attributions_raw):
                break
            pct = float(attributions_raw[i] / total) * 100.0
            if pct > 0.5:
                results.append({
                    "label": name,
                    "value": round(float(attributions_raw[i] / total), 4),
                    "contribution_pct": round(pct, 1),
                    "color": FEATURE_COLORS.get(name, "#6b7280"),
                    "description": FEATURE_DESCRIPTIONS.get(name, ""),
                })

        results.sort(key=lambda x: -x["contribution_pct"])
        return results[:6]

    except Exception as e:
        logger.warning(f"[XAI] GNN gradient attribution failed: {e}. Using physics fallback.")
        try:
            feats = H[node_idx, -1, :].detach().tolist()
        except Exception:
            feats = [0.0] * len(FEATURE_NAMES)
        return _physics_gradient_attribution(feats, risk_score)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def explain_prediction(
    features_dict: Dict[str, float],
    prediction_class: int,
) -> List[str]:
    """
    Legacy interface: accepts a features dict and returns human-readable strings.
    Used by older parts of the codebase.
    
    Uses physics-gradient attribution internally.
    """
    # Convert dict to ordered feature vector
    feat_vec = [features_dict.get(
        name.lower().replace(" ", "_"), 0.0
    ) for name in FEATURE_NAMES]

    # Estimate risk score from prediction class
    risk_score = prediction_class * 25.0 + 12.5

    attributions = _physics_gradient_attribution(feat_vec, risk_score)

    results = []
    for attr in attributions[:5]:
        label = attr["label"]
        pct = attr["contribution_pct"]
        desc = attr.get("description", "")
        results.append(f"{label} contributes {pct:.1f}% to the risk — {desc}")

    return results


def explain_node(
    features: List[float],
    risk_score: float,
    model: Any = None,
    H: Any = None,
    edge_index: Any = None,
    node_idx: int = 0,
) -> List[Dict]:
    """
    Main explanation entry point for the inference engine.
    
    If model + tensors are provided → uses GNN gradient attribution.
    Otherwise → uses physics sensitivity attribution.
    
    Returns: List of attribution dicts (sorted by contribution descending)
    """
    if model is not None and H is not None and edge_index is not None:
        return _gnn_gradient_attribution(model, H, edge_index, node_idx, risk_score)
    else:
        return _physics_gradient_attribution(features, risk_score)


def get_ml_components():
    """Legacy stub — returns None triple for backward compat."""
    return None, None, None


def get_top_reasons(df: Any, pred_class: int) -> List[str]:
    """Legacy interface for tabular data."""
    try:
        row_dict = df.iloc[0].to_dict()
    except Exception:
        row_dict = {}
    return explain_prediction(row_dict, pred_class)
