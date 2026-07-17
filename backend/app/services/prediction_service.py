import pandas as pd
import numpy as np
from sqlalchemy.orm import Session
from app.ml.explain import get_ml_components, get_top_reasons
from app.ml.config import NUMERIC_FEATURES, CATEGORICAL_FEATURES, RISK_LABELS

def calculate_risk_score(probability_array):
    """
    Convert multiclass probabilities into a 0-100 risk score.
    Class 0: 0-25 (Very Low)
    Class 1: 26-50 (Low)
    Class 2: 51-75 (Moderate)
    Class 3: 76-90 (High)
    Class 4: 91-100 (Severe)
    """
    # Expected value calculation for continuous score
    weights = np.array([12.5, 38.0, 63.0, 83.0, 95.5])
    raw_score = np.dot(probability_array, weights)
    
    # Clip and return
    return round(float(np.clip(raw_score, 0, 100)), 1)

def get_recommendations(risk_level):
    if risk_level == "Severe":
        return ["Evacuate immediate flood plains", "Deploy NDRF teams", "Open all relief camps"]
    elif risk_level == "High":
        return ["Prepare for evacuation", "Move valuables to higher ground", "Alert district emergency responders"]
    elif risk_level == "Moderate":
        return ["Monitor local river levels", "Stay away from water bodies", "Clear storm drains"]
    elif risk_level == "Low":
        return ["Stay updated with weather forecasts"]
    return ["Normal conditions"]

class PredictionService:
    @staticmethod
    def predict_district(db: Session, feature_dict: dict) -> dict:
        """
        Run inference on a single district.
        """
        model, preprocessor, explainer = get_ml_components()
        if not model or not preprocessor:
            raise Exception("ML Model not loaded or trained yet.")
            
        # Create single row DataFrame matching training features
        df = pd.DataFrame([feature_dict])
        
        # Process and predict
        processed = preprocessor.transform(df)
        probs = model.predict_proba(processed)[0]
        
        # Get highest probability class
        pred_class = int(np.argmax(probs))
        confidence = round(float(probs[pred_class]) * 100, 1)
        risk_level = RISK_LABELS.get(pred_class, "Unknown")
        
        risk_score = calculate_risk_score(probs)
        
        # Explainability
        top_reasons = get_top_reasons(df, pred_class)
        recommendations = get_recommendations(risk_level)
        
        return {
            "district": feature_dict.get("district_name", "Unknown"),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "confidence": confidence,
            "probability": float(probs[pred_class]),
            "top_reasons": top_reasons,
            "recommended_actions": recommendations
        }
