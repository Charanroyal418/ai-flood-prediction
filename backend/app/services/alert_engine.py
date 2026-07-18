from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.prediction import DistrictPrediction
from app.models.river import RiverLevel
from app.models.weather import Rainfall
from datetime import datetime, timedelta, timezone
import json

class AlertEngine:
    @staticmethod
    def evaluate_all(db: Session):
        """
        Scans recent predictions, river levels, and rainfall to trigger alerts.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        recent_threshold = now - timedelta(hours=2)
        
        # 1. AI Predictions
        recent_predictions = db.query(DistrictPrediction).filter(DistrictPrediction.predicted_at >= recent_threshold).all()
        for pred in recent_predictions:
            if pred.risk_score >= 76: # High or Severe
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=pred.district_id,
                    level="Critical" if pred.risk_score >= 91 else "Warning",
                    severity="Severe" if pred.risk_score >= 91 else "High",
                    reason=f"AI predicted flood risk score: {pred.risk_score:.1f}. Reasons: {json.dumps(pred.explanation)}"
                )
                
        # 2. River Levels
        recent_rivers = db.query(RiverLevel).filter(RiverLevel.recorded_at >= recent_threshold).all()
        for river in recent_rivers:
            if river.current_level >= river.danger_level:
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=river.district_id,
                    level="Critical",
                    severity="Severe",
                    reason=f"River {river.river_name} ({river.station_name}) exceeded danger level. Current: {river.current_level}m, Danger: {river.danger_level}m"
                )
                
        # 3. Rainfall
        recent_rain = db.query(Rainfall).filter(Rainfall.recorded_at >= recent_threshold).all()
        for rain in recent_rain:
            if rain.mm_24h > 150: # Threshold for severe rain
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=rain.district_id,
                    level="Warning" if rain.mm_24h < 250 else "Critical",
                    severity="High" if rain.mm_24h < 250 else "Severe",
                    reason=f"Heavy rainfall detected: {rain.mm_24h}mm in last 24h"
                )
                
        db.commit()
        
    @staticmethod
    def _create_alert_if_needed(db: Session, district_id: int, level: str, severity: str, reason: str):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        recent_threshold = now - timedelta(hours=6)
        
        existing = db.query(Alert).filter(
            Alert.district_id == district_id,
            Alert.created_at >= recent_threshold
        ).first()
        
        if not existing:
            alert = Alert(
                district_id=district_id,
                level=level,
                severity=severity,
                message=f"{severity} Alert. {reason}",
                confidence=0.9,
                expected_time=now + timedelta(hours=2),
                suggested_response="Evacuate low lying areas" if severity == "Severe" else "Stay alert"
            )
            db.add(alert)
