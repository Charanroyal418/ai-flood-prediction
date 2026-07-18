import sys
from app.db.session import SessionLocal
from app.api.endpoints.dashboard import get_dashboard_live

db = SessionLocal()
try:
    print("Testing get_dashboard_live()...")
    res = get_dashboard_live(db)
    print("Success!")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
