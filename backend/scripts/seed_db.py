import os
import sys
import uuid
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.db.session import SessionLocal
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
            password_hash=generate_password_hash("admin123")
        )
        db.add(admin)
        
    if not db.query(User).filter(User.email == collector_email).first():
        collector = User(
            name="Chennai Collector",
            email=collector_email,
            role="Collector",
            password_hash=generate_password_hash("collector123")
        )
        db.add(collector)
    db.commit()

def seed_facilities_and_rivers(db: Session):
    print("Seeding Facilities and Rivers...")
    # Find Chennai for foreign key
    chennai = db.query(District).filter(District.name == "Chennai").first()
    
    if chennai:
        # Sample Shelter
        if not db.query(Shelter).filter(Shelter.name == "Velachery Relief Camp").first():
            shelter = Shelter(
                district_id=chennai.id,
                name="Velachery Relief Camp",
                capacity=500,
                current_occupancy=0
            )
            db.add(shelter)
            
        # Sample River
        if not db.query(RiverLevel).filter(RiverLevel.river_name == "Adyar River").first():
            river = RiverLevel(
                district_id=chennai.id,
                river_name="Adyar River",
                station_name="Saidapet Bridge",
                current_level=2.5,
                danger_level=4.0
            )
            db.add(river)
            
        db.commit()

def main():
    print("Starting Database Seed...")
    db = SessionLocal()
    try:
        seed_districts(db)
        seed_users(db)
        seed_facilities_and_rivers(db)
        print("Database Seed Completed Successfully!")
    except Exception as e:
        print(f"Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
