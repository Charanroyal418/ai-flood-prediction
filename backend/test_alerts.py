import os
import sys

# Setup FastAPI context for standalone script
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend')))
from app.db.session import SessionLocal
from app.models.district import District
from app.models.weather import Rainfall
from app.services.orchestrator import RealtimeOrchestrator
from datetime import datetime

def test_alert_generation():
    print("Testing real-time alert generation...")
    db = SessionLocal()
    try:
        # Find Chennai or the first district
        district = db.query(District).filter(District.name == "Chennai").first()
        if not district:
            district = db.query(District).first()
            
        print(f"Testing with district: {district.name}")
        
        # Insert extreme rainfall
        rain = Rainfall(
            district_id=district.id,
            recorded_at=datetime.utcnow(),
            mm_24h=350.0  # Extreme rainfall
        )
        db.add(rain)
        db.commit()
        
        print("Inserted extreme rainfall. Running orchestrator cycle...")
        
        # Run orchestrator
        orchestrator = RealtimeOrchestrator(db)
        orchestrator.run_pipeline()
        
        print("Cycle complete. Checking database for alerts...")
        
        from app.models.alert import Alert
        recent_alert = db.query(Alert).filter(Alert.district_id == district.id).order_by(Alert.created_at.desc()).first()
        if recent_alert:
            print(f"SUCCESS: Alert found in DB!")
            print(f"Level: {recent_alert.level}")
            print(f"Message: {recent_alert.message}")
        else:
            print("FAILED: No alert found in DB.")
            
    finally:
        db.close()

if __name__ == "__main__":
    test_alert_generation()
