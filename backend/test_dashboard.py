from app.db.session import SessionLocal
from app.api.endpoints.dashboard import get_dashboard_live

db = SessionLocal()
try:
    res = get_dashboard_live(db)
    print("SUCCESS")
except Exception as e:
    print("FAILED:", e)
    import traceback
    traceback.print_exc()
