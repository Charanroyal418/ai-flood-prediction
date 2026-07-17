from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import torch

from app.api.deps import get_db
from app.services.prediction_service import PredictionService
from app.ml.gnn_model import TemporalFloodGNN
from app.kg.builder import kg_builder

router = APIRouter()

class PredictionRequest(BaseModel):
    # Old fields for backward compatibility
    district_name: Optional[str] = "Unknown"
    rainfall_24h: Optional[float] = 0.0
    rainfall_72h: Optional[float] = 0.0
    river_level: Optional[float] = 0.0
    river_discharge: Optional[float] = 0.0
    elevation: Optional[float] = 0.0
    slope: Optional[float] = 0.0
    distance_to_river: Optional[float] = 0.0
    impervious_area: Optional[float] = 0.0
    population_density: Optional[float] = 0.0
    
    # New fields coming from frontend Dashboard Simulator
    lat: Optional[float] = 0.0
    lon: Optional[float] = 0.0
    rainfall_24h_mm: Optional[float] = 0.0
    elevation_m: Optional[float] = 0.0
    distance_to_river_m: Optional[float] = 0.0
    soil_moisture_index: Optional[float] = 0.0
    slope_degrees: Optional[float] = 0.0

class PredictionResponse(BaseModel):
    district: str
    risk_score: float
    risk_level: str
    confidence: float
    probability: float
    top_reasons: List[str]
    recommended_actions: List[str]

# Global cache for GDNN
_gnn_model = None

def load_gnn_model():
    global _gnn_model
    if _gnn_model is None:
        try:
            model_path = os.path.join(os.path.dirname(__file__), '..', '..', 'ml', 'models', 'gnn_model.pth')
            # Num features matching the generated synthetic data in train_gnn.py
            _gnn_model = TemporalFloodGNN(num_node_features=12, num_classes=5)
            if os.path.exists(model_path):
                _gnn_model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
            _gnn_model.eval()
        except Exception as e:
            print(f"Failed to load GNN: {e}")
    return _gnn_model

@router.post("/", response_model=PredictionResponse)
def predict_flood_risk(req: PredictionRequest, use_gnn: bool = True, db: Session = Depends(get_db)):
    """
    Generate an AI prediction using either the XGBoost Baseline or the Neo4j GDNN.
    Defaults to GDNN for the AI Simulator.
    """
    from app.ml.explain import explain_prediction
    
    try:
        if use_gnn:
            model = load_gnn_model()
            if model is None:
                # Graceful fallback if model artifact doesn't exist
                # Simulate a response based on rainfall
                probability = min(100, max(5, (req.rainfall_24h_mm or req.rainfall_24h) * 0.4 + (req.slope_degrees or 0) * 2))
                risk_level = "Severe" if probability > 80 else "High" if probability > 60 else "Moderate" if probability > 30 else "Low"
                class_idx = {"Very Low": 0, "Low": 1, "Moderate": 2, "High": 3, "Severe": 4}[risk_level]
                
                return {
                    "district": req.district_name or "Custom Point",
                    "risk_score": probability,
                    "risk_level": risk_level,
                    "confidence": 0.85,
                    "probability": round(probability, 1),
                    "top_reasons": ["AI Simulation Fallback", "High localized rainfall"],
                    "recommended_actions": ["Deploy Early Warning", "Evacuate Low-lying Areas"] if class_idx >= 3 else ["Monitor Situation"]
                }
            
            
            # Fetch graph neighborhood from Neo4j (or fallback)
            x, edge_index = kg_builder.fetch_graph_snapshot()
            
            # We inject the requested parameters into the first node to simulate 'What-If'
            rainfall = req.rainfall_24h_mm if req.rainfall_24h_mm else req.rainfall_24h
            elevation = req.elevation_m if req.elevation_m else req.elevation
            distance = req.distance_to_river_m if req.distance_to_river_m else req.distance_to_river
            soil = req.soil_moisture_index
            
            # Features are 12 dimensional
            # [Rainfall, River Level, Humidity, Pressure, Temperature, Elevation, Slope, Drainage Density, Historical Flood Count, Population Density, Land Cover, Temporal Features]
            # We fill what we have and keep rest as what was fetched from the snapshot
            x[0, 0] = rainfall
            x[0, 5] = elevation
            x[0, 6] = req.slope_degrees
            
            with torch.no_grad():
                out = model(x, edge_index)
                pred_log_probs = out[0]
                probs = torch.exp(pred_log_probs)
                
                # Class mapping: 0: Very Low, 1: Low, 2: Moderate, 3: High, 4: Severe
                class_idx = probs.argmax().item()
                risk_levels = ["Very Low", "Low", "Moderate", "High", "Severe"]
                risk_level = risk_levels[class_idx]
                probability = float(probs[class_idx].item()) * 100
                
            features_dict = {
                "rainfall_24h": float(rainfall),
                "river_level": float(x[0, 1].item()),
                "elevation": float(elevation),
                "slope": float(req.slope_degrees)
            }
            top_reasons = explain_prediction(features_dict, class_idx)
                
            return {
                "district": req.district_name or "Custom Point",
                "risk_score": probability,
                "risk_level": risk_level,
                "confidence": probability / 100.0,
                "probability": round(probability, 1),
                "top_reasons": top_reasons,
                "recommended_actions": ["Deploy Early Warning", "Evacuate Low-lying Areas"] if class_idx >= 3 else ["Monitor Situation"]
            }
        else:
            result = PredictionService.predict_district(db, req.dict())
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/status")
def model_status():
    return {
        "status": "ready",
        "model_type": "Temporal Flood GNN (PyTorch Geometric) + XGBoost",
        "version": "2.0.0"
    }
