import traceback
import json

print("=== STEP 3: Testing get_dashboard_live Function Directly ===")
try:
    from app.db.session import SessionLocal
    from app.api.endpoints.dashboard import get_dashboard_live
    db = SessionLocal()
    data = get_dashboard_live(db=db)
    print("STEP 3 SUCCESS!")
    print(f"Status: {data.get('status')}")
    print(f"Metrics: {data.get('metrics')}")
    print(f"Districts returned count: {len(data.get('districts', []))}")
    print(f"Events count: {len(data.get('events', []))}")
    print("Sample District 1:", data.get('districts', [])[0] if data.get('districts') else None)
except Exception as e:
    print("STEP 3 EXCEPTION:")
    traceback.print_exc()
