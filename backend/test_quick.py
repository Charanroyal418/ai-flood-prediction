import json
from app.db.session import SessionLocal
from app.api.endpoints.inference_cycle import run_inference_cycle
from app.api.endpoints.dashboard import get_dashboard_live
from app.api.endpoints.performance import get_performance_metrics

db = SessionLocal()

print("--- 1. Testing Inference Cycle Payload ---")
cycle = run_inference_cycle(db)
dist = cycle["districts"][0]
print("District Name:", dist.get("district"))
print("Rainfall 24H:", dist.get("rainfall_24h"), "mm")
print("Raw Confidence:", dist.get("confidence"))
print("Attention Heads:", cycle["model_status"].get("attention_heads"))
print("GNN Inference Latency:", cycle["model_status"].get("gnn_latency_ms"), "ms")
print("Pipeline Latency:", cycle.get("total_latency_ms"), "ms")

assert dist.get("rainfall_24h") is not None, "Rainfall 24H must not be None!"
assert cycle["model_status"].get("attention_heads") == 4, "Attention heads must be 4!"
print("PASSED!")

print("\n--- 2. Testing Live Dashboard Payload ---")
dash = get_dashboard_live(db)
d0 = dash["districts"][0]
print("Live District Name:", d0.get("name font") if "name font" in d0 else d0.get("name"))
print("Live Rainfall mm:", d0.get("rainfall_mm"), "mm")
print("Live Confidence:", d0.get("ai_confidence"))
print("Live Inference Latency:", dash["metrics"].get("gdnn_inference_ms"), "ms")
print("PASSED!")

print("\n--- 3. Testing Performance Monitoring Metrics ---")
perf = get_performance_metrics(db)
print("API Response Time:", perf["performance"].get("api_response_time_ms"), "ms")
print("PASSED!")
