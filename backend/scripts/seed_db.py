import os
import sys
import uuid
from sqlalchemy.orm import Session
from app.core.security import get_password_hash

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

import app.db.base # Register all models before doing anything else
from app.db.session import SessionLocal, engine
from app.db.base_class import Base
from app.models.district import District
from app.models.user import User
from app.models.facility import Shelter
from app.models.river import RiverLevel

# The 38 districts of Tamil Nadu
TN_DISTRICTS = [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", 
    "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", 
    "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai", 
    "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai", 
    "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi", 
    "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", 
    "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", 
    "Vellore", "Viluppuram", "Virudhunagar"
]

def seed_districts(db: Session):
    print("Seeding Districts...")
    for idx, d_name in enumerate(TN_DISTRICTS, start=1):
        # Check if exists
        existing = db.query(District).filter(District.name == d_name).first()
        if not existing:
            # We mock the geometry as NULL for now until spatial data is ingested
            district = District(id=idx, name=d_name, population=1000000.0)
            db.add(district)
    db.commit()

def seed_users(db: Session):
    print("Seeding Users...")
    admin_email = "admin@tn.gov.in"
    collector_email = "collector_chennai@tn.gov.in"
    
    if not db.query(User).filter(User.email == admin_email).first():
        admin = User(
            name="State Admin",
            email=admin_email,
            role="Admin",
            password_hash=get_password_hash("admin123")
        )
        db.add(admin)
        
    if not db.query(User).filter(User.email == collector_email).first():
        collector = User(
            name="Chennai Collector",
            email=collector_email,
            role="Collector",
            password_hash=get_password_hash("collector123")
        )
        db.add(collector)
    db.commit()

def seed_facilities_and_rivers(db: Session):
    print("Seeding Facilities and Rivers...")
    chennai = db.query(District).filter(District.name == "Chennai").first()
    
    if chennai:
        if not db.query(Shelter).filter(Shelter.name == "Velachery Relief Camp").first():
            shelter = Shelter(district_id=chennai.id, name="Velachery Relief Camp", capacity=500)
            db.add(shelter)
    
    # All 9 major TN rivers
    rivers = [
        {"name": "Adyar River", "station": "Saidapet Bridge", "danger": 4.0, "current": 2.5, "district": "Chennai"},
        {"name": "Cooum River", "station": "Napier Bridge", "danger": 3.0, "current": 1.2, "district": "Chennai"},
        {"name": "Kosasthalaiyar River", "station": "Ennore", "danger": 4.5, "current": 2.0, "district": "Tiruvallur"},
        {"name": "Palar River", "station": "Chengalpattu", "danger": 5.0, "current": 1.5, "district": "Chengalpattu"},
        {"name": "Thenpennai River", "station": "Cuddalore", "danger": 4.2, "current": 2.8, "district": "Cuddalore"},
        {"name": "Vellar River", "station": "Sethiathope", "danger": 3.8, "current": 1.1, "district": "Cuddalore"},
        {"name": "Cauvery River", "station": "Kallanai", "danger": 6.0, "current": 4.5, "district": "Thanjavur"},
        {"name": "Vaigai River", "station": "Madurai", "danger": 5.5, "current": 3.0, "district": "Madurai"},
        {"name": "Thamirabarani River", "station": "Tirunelveli", "danger": 5.0, "current": 3.2, "district": "Tirunelveli"},
    ]
    
    for r in rivers:
        d = db.query(District).filter(District.name == r["district"]).first()
        if d and not db.query(RiverLevel).filter(RiverLevel.river_name == r["name"]).first():
            river = RiverLevel(
                district_id=d.id,
                river_name=r["name"],
                station_name=r["station"],
                current_level=r["current"],
                danger_level=r["danger"]
            )
            db.add(river)
            
    db.commit()

from app.models.alert import Alert
def seed_alerts(db: Session):
    print("Seeding Alerts...")
    chennai = db.query(District).filter(District.name == "Chennai").first()
    if chennai and not db.query(Alert).filter(Alert.district_id == chennai.id).first():
        alert = Alert(
            district_id=chennai.id,
            level="High",
            severity="Severe",
            message="Heavy rainfall expected in Chennai over the next 24 hours. Possibility of localized flooding.",
            suggested_response="Stay indoors and move to higher ground.",
            confidence=0.85,
            rainfall_mm=120.5
        )
        db.add(alert)
    db.commit()

def main():
    print("Starting Database Seed...")
    print("Rebuilding database schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        seed_districts(db)
        seed_users(db)
        seed_facilities_and_rivers(db)
        seed_alerts(db)
        print("Database Seed Completed Successfully!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
