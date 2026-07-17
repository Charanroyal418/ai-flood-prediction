from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.prediction import DistrictPrediction
from app.models.river import RiverLevel
from app.models.weather import Rainfall
from datetime import datetime, timedelta
import json

class AlertEngine:
    @staticmethod
    def evaluate_all(db: Session):
        """
        Scans recent predictions, river levels, and rainfall to trigger alerts.
        """
        now = datetime.utcnow()
        recent_threshold = now - timedelta(hours=2)
        
        # 1. AI Predictions
        recent_predictions = db.query(DistrictPrediction).filter(DistrictPrediction.created_at >= recent_threshold).all()
        for pred in recent_predictions:
            if pred.risk_score >= 76: # High or Severe
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=pred.district_id,
                    severity="Severe" if pred.risk_score >= 91 else "High",
                    reason=f"AI predicted flood risk score: {pred.risk_score:.1f}. Reasons: {json.dumps(pred.top_reasons)}",
                    source="AI_PREDICTION"
                )
                
        # 2. River Levels
        recent_rivers = db.query(RiverLevel).filter(RiverLevel.recorded_at >= recent_threshold).all()
        for river in recent_rivers:
            if river.current_level >= river.danger_level:
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=river.district_id,
                    severity="Severe",
                    reason=f"River {river.river_name} ({river.station_name}) exceeded danger level. Current: {river.current_level}m, Danger: {river.danger_level}m",
                    source="SENSOR_RIVER"
                )
                
        # 3. Rainfall
        recent_rain = db.query(Rainfall).filter(Rainfall.recorded_at >= recent_threshold).all()
        for rain in recent_rain:
            if rain.mm_24h > 150: # Threshold for severe rain
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=rain.district_id,
                    severity="High" if rain.mm_24h < 250 else "Severe",
                    reason=f"Heavy rainfall detected: {rain.mm_24h}mm in last 24h",
                    source="SENSOR_WEATHER"
                )
                
        db.commit()
        
    @staticmethod
    def _create_alert_if_needed(db: Session, district_id: int, severity: str, reason: str, source: str):
        existing = db.query(Alert).filter(
            Alert.district_id == district_id,
            Alert.is_active == True,
            Alert.source == source
        ).first()
        
        if not existing:
            alert = Alert(
                district_id=district_id,
                severity=severity,
                message=f"{severity} Alert. {reason}",
                source=source,
                trigger_data={"reason": reason}
            )
            db.add(alert)
