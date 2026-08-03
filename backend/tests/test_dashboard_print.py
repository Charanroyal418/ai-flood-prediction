import pytest
from app.db.session import SessionLocal
from app.api.endpoints.dashboard import get_dashboard_live

def test_dashboard_output():
    db = SessionLocal()
    try:
        res = get_dashboard_live(db)
        print("DASHBOARD RESPONSE:", res)
    except Exception as e:
        print("DASHBOARD EXCEPTION:", e)
        import traceback
        traceback.print_exc()
        raise e
