import traceback
from sqlalchemy import text

print("=== STEP 2: Direct SQL Query Verification ===")
try:
    from app.db.session import SessionLocal
    db = SessionLocal()
    
    q1 = db.execute(text("SELECT COUNT(*) FROM prediction_history WHERE created_at > NOW() - INTERVAL '1 hour'")).scalar()
    q2 = db.execute(text("SELECT COUNT(*) FROM graph_edges")).scalar()
    q3 = db.execute(text("SELECT COUNT(*) FROM alerts")).scalar()
    
    print(f"prediction_history (last 1 hour count): {q1}")
    print(f"graph_edges count: {q2}")
    print(f"alerts count: {q3}")
except Exception as e:
    print("STEP 2 EXCEPTION:")
    traceback.print_exc()
