import traceback
import logging
import sys

logging.basicConfig(level=logging.INFO)

print("=== STEP 1: Running Inference Cycle Manually ===")
try:
    from app.db.session import SessionLocal
    from app.api.endpoints.inference_cycle import run_inference_cycle
    db = SessionLocal()
    res = run_inference_cycle(db=db)
    print("STEP 1 SUCCESS RESULT:")
    print(res)
except Exception as e:
    print("STEP 1 EXCEPTION:")
    traceback.print_exc()
