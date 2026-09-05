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
    district_name: Optional[str] = Field(default="Unknown", description="Name of the district")
    rainfall_24h: Optional[float] = Field(default=0.0, description="Rainfall in the last 24 hours")
    rainfall_72h: Optional[float] = Field(default=0.0, description="Rainfall in the last 72 hours")
    river_level: Optional[float] = Field(default=0.0, description="Current river level")
    river_discharge: Optional[float] = Field(default=0.0, description="River discharge rate")
    elevation: Optional[float] = Field(default=0.0, description="Elevation in meters")
    slope: Optional[float] = Field(default=0.0, description="Slope in degrees")
    distance_to_river: Optional[float] = Field(default=0.0, description="Distance to nearest river")
    impervious_area: Optional[float] = Field(default=0.0, description="Percentage of impervious area")
    population_density: Optional[float] = Field(default=0.0, description="Population density")
    
    # New fields coming from frontend Dashboard Simulator
    lat: Optional[float] = Field(default=0.0, description="Latitude")
    lon: Optional[float] = Field(default=0.0, description="Longitude")
    rainfall_24h_mm: Optional[float] = Field(default=0.0, description="Rainfall in mm")
    elevation_m: Optional[float] = Field(default=0.0, description="Elevation in meters")
    distance_to_river_m: Optional[float] = Field(default=0.0, description="Distance to river in meters")
    soil_moisture_index: Optional[float] = Field(default=0.0, description="Soil moisture index")
    slope_degrees: Optional[float] = Field(default=0.0, description="Slope in degrees")

class PredictionResponse(BaseModel):
    district: str = Field(..., description="District name")
    risk_score: float = Field(..., description="Calculated risk score 0-100")
    risk_level: str = Field(..., description="Risk category: Safe, Low, Moderate, High, Severe")
    confidence: float = Field(..., description="AI confidence score 0-1")
    probability: float = Field(..., description="Flood probability percentage")
    top_reasons: List[str] = Field(..., description="Key drivers for the prediction")
    recommended_actions: List[str] = Field(..., description="Suggested actions")

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
            x[0, -1, 0] = rainfall
            x[0, -1, 5] = elevation
            x[0, -1, 6] = req.slope_degrees
            
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
                "river_level": float(x[0, -1, 1].item()),
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

from fastapi import BackgroundTasks

@router.get("/inference-cycle")
def get_inference_cycle_route(background_tasks: BackgroundTasks):
    from app.api.endpoints.inference_cycle import run_inference_cycle
    return run_inference_cycle(background_tasks)


@router.get("/active-risks")
def get_active_risks(db: Session = Depends(get_db)):
    """Returns active district risk rankings for UI analytics widgets."""
    from app.models.district import District
    districts = db.query(District).order_by(District.risk_score.desc()).limit(10).all()
    if not districts:
        return []
    return [{"district": d.name, "score": d.risk_score or 0} for d in districts]


