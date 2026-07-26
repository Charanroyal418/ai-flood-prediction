import json
from app.db.session import SessionLocal
from app.api.endpoints.inference_cycle import run_inference_cycle
from app.api.endpoints.dashboard import get_dashboard_live

db = SessionLocal()

print("Running inference cycle test...")
res = run_inference_cycle(db)
print("SUCCESS!")
print("Cycle ID:", res.get("cycle_id"))
print("Total Latency:", res.get("total_latency_ms"), "ms")
print("Breakdown:", json.dumps(res.get("latency_breakdown"), indent=2))
print("District count:", len(res.get("districts", [])))

print("\nRunning live dashboard test...")
dash = get_dashboard_live(db)
print("SUCCESS!")
print("Events count:", len(dash.get("events", [])))
if dash.get("events"):
    print("Sample event:", json.dumps(dash["events"][0], indent=2))
