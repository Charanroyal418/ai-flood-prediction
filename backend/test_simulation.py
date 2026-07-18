import app.db.base
from app.db.session import SessionLocal
from app.services.orchestrator import RealtimeOrchestrator

db = SessionLocal()
try:
    print("Testing orchestrator run_pipeline(simulate_storm=True)...")
    orc = RealtimeOrchestrator(db)
    orc.run_pipeline(simulate_storm=True)
    print("Success!")
except Exception as e:
    import traceback
    traceback.print_exc()
finally:
    db.close()
