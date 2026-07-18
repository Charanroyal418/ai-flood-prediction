import app.db.base # MUST be first
from sqlalchemy.orm import configure_mappers
configure_mappers()

from app.db.session import SessionLocal
from app.api.endpoints.dashboard import get_dashboard_live

db = SessionLocal()
try:
    print("Testing get_dashboard_live() with proper imports...")
    res = get_dashboard_live(db)
    print("Success! Response keys:", res.keys())
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
