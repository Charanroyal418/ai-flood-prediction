from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.prediction import DistrictPrediction
import json

class AlertEngine:
    @staticmethod
    def evaluate_predictions(db: Session):
        """
        Scans recent predictions and triggers database alerts if High or Severe.
        """
        # Get latest predictions (assuming 1 per district generated recently)
        # In production, we filter by created_at > (now - 1 hour)
        recent_predictions = db.query(DistrictPrediction).all()
        
        for pred in recent_predictions:
            if pred.risk_score >= 76: # High or Severe
                # Check if active alert already exists
                existing = db.query(Alert).filter(
                    Alert.district_id == pred.district_id,
                    Alert.is_active == True
                ).first()
                
                if not existing:
                    severity = "Severe" if pred.risk_score >= 91 else "High"
                    reasons = json.dumps(pred.top_reasons)
                    
                    alert = Alert(
                        district_id=pred.district_id,
                        severity=severity,
                        message=f"{severity} Flood Risk detected. Reasons: {reasons}",
                        source="AI_PREDICTION",
                        trigger_data={"risk_score": pred.risk_score, "confidence": pred.confidence}
                    )
                    db.add(alert)
        
        db.commit()
