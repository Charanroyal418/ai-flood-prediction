from sqlalchemy.orm import Session
from app.models.alert import Alert
from app.models.history import PredictionHistory
from app.models.river import RiverLevel
from app.models.weather import Rainfall
from datetime import datetime, timedelta, timezone
import json
import logging

logger = logging.getLogger(__name__)

class AlertEngine:
    @staticmethod
    def evaluate_all(db: Session):
        """
        Scans recent predictions, river levels, and rainfall to trigger alerts.
        """
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        recent_threshold = now - timedelta(hours=2)
        
        # 1. AI Predictions
        recent_predictions = db.query(PredictionHistory).filter(PredictionHistory.created_at >= recent_threshold).all()
        for pred in recent_predictions:
            if pred.current_risk_score >= 60.0:
                is_crit = pred.current_risk_score >= 80.0
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=pred.district_id,
                    level="Critical" if is_crit else "High",
                    severity="Severe" if is_crit else "High",
                    reason=f"AI predicted elevated flood risk score: {pred.current_risk_score:.1f}/100."
                )
                
        # 2. River Levels
        recent_rivers = db.query(RiverLevel).filter(RiverLevel.recorded_at >= recent_threshold).all()
        for river in recent_rivers:
            if river.current_level >= 0.8 * river.danger_level:
                is_crit = river.current_level >= river.danger_level
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=river.district_id,
                    level="Critical" if is_crit else "High",
                    severity="Severe" if is_crit else "High",
                    reason=f"River {river.river_name} ({river.station_name}) level elevated: {river.current_level}m (Danger: {river.danger_level}m)"
                )
                
        # 3. Rainfall
        recent_rain = db.query(Rainfall).filter(Rainfall.recorded_at >= recent_threshold).all()
        for rain in recent_rain:
            if rain.mm_24h >= 100: # Heavy/Extreme rainfall threshold
                is_crit = rain.mm_24h >= 200
                AlertEngine._create_alert_if_needed(
                    db,
                    district_id=rain.district_id,
                    level="Critical" if is_crit else "High",
                    severity="Severe" if is_crit else "High",
                    reason=f"Heavy rainfall detected: {rain.mm_24h}mm in last 24h"
                )
                
        db.commit()
        
    @staticmethod
    def _create_alert_if_needed(db: Session, district_id: int, level: str, severity: str, reason: str):
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        recent_threshold = now - timedelta(hours=2)
        
        existing = db.query(Alert).filter(
            Alert.district_id == district_id,
            Alert.created_at >= recent_threshold
        ).order_by(Alert.created_at.desc()).first()
        
        # Only create if no alert in the last 2 hours OR if the level escalated
        if not existing or existing.level != level:
            alert = Alert(
                district_id=district_id,
                level=level,
                severity=severity,
                message=f"[{level}] Flood alert for District {district_id}: {reason}",
                confidence=0.9,
                expected_time=now + timedelta(hours=2),
                suggested_response="Evacuate low lying areas" if severity in ["Severe", "Critical"] else "Monitor water levels and stay alert"
            )
            db.add(alert)
            db.flush()
            logger.info(f"[AlertEngine] Triggered {level} Alert for District {district_id}: {reason}")
