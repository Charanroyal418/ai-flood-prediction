import logging
from sqlalchemy.orm import Session
import app.db.base
from app.db.session import SessionLocal
from app.models.district import District
from app.etl.weather import TN_DISTRICTS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_districts():
    db = SessionLocal()
    try:
        if db.query(District).count() == 0:
            logger.info("Seeding districts...")
            for name, (lat, lon) in TN_DISTRICTS.items():
                d = District(
                    name=name,
                    geom_json={"type": "Point", "coordinates": [lon, lat]},
                    population=1000000
                )
                db.add(d)
            db.commit()
            logger.info("Districts seeded successfully.")
        else:
            logger.info("Districts already exist.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_districts()
