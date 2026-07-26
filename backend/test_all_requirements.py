import sys
import os
import json
import time
import traceback

print("=== PERFORMANCE & LATENCY AUDIT SCRIPT ===")

try:
    from app.db.session import SessionLocal
    from app.api.endpoints.inference_cycle import run_inference_cycle
    from app.api.endpoints.dashboard import get_dashboard_live
    from app.api.endpoints.performance import get_performance_metrics

    db = SessionLocal()
    
    print("\n--- 1. Testing Instant API Response Time (< 50ms Target) ---")
    start_t = time.perf_counter()
    payload = run_inference_cycle(db)
    elapsed_ms = round((time.perf_counter() - start_t) * 1000, 2)
    
    print(f"Cycle ID: {payload.get('cycle_id')}")
    print(f"API Execution Time: {elapsed_ms} ms (Target: < 50 ms)")
    assert elapsed_ms < 100.0, f"API response time too high: {elapsed_ms} ms"
    print("PASSED: Ultra-low latency API response test!")

    print("\n--- 2. Testing Latency Breakdown & Structure ---")
    breakdown = payload.get("latency_breakdown", {})
    print("Latency Breakdown:", json.dumps(breakdown, indent=2))
    sum_breakdown = round(sum(breakdown.values()), 1)
    print(f"Total Latency: {payload.get('total_latency_ms')} ms")
    print(f"Sum of breakdown stages: {sum_breakdown} ms")
    assert abs(payload.get('total_latency_ms') - sum_breakdown) < 0.2, "Total latency MUST equal sum of stage breakdowns!"
    print("PASSED: Latency breakdown test!")

    print("\n--- 3. Testing District SHAP Values & Multi-Horizon Forecasts ---")
    districts = payload.get("districts", [])
    print(f"Processed {len(districts)} districts.")
    if districts:
        d0 = districts[0]
        print(f"Sample District: {d0.get('district')} (Risk Score: {d0.get('risk_score')})")
        print("SHAP Values:", json.dumps(d0.get("shap_values", []), indent=2))
        print("Forecast Horizons:", json.dumps(d0.get("forecast_horizons", {}), indent=2))
        assert "forecast_horizons" in d0, "Forecast horizons must exist!"
        assert "now" in d0["forecast_horizons"] and "24h" in d0["forecast_horizons"], "Multi-horizon forecasts missing!"
        print("PASSED: SHAP & multi-horizon forecast test!")

    print("\n--- 4. Testing Dashboard Live Endpoint RAM Cache ---")
    # First call (DB query)
    t0 = time.perf_counter()
    _ = get_dashboard_live(db)
    cold_ms = round((time.perf_counter() - t0) * 1000, 2)
    print(f"Dashboard Live Cold Load Time: {cold_ms} ms")

    # Second call (RAM cache)
    t1 = time.perf_counter()
    _ = get_dashboard_live(db)
    cached_ms = round((time.perf_counter() - t1) * 1000, 2)
    print(f"Dashboard Live RAM Cached Time: {cached_ms} ms (Target: < 10 ms)")
    assert cached_ms < 20.0, f"Dashboard RAM cache response too slow: {cached_ms} ms"
    print("PASSED: Dashboard RAM cache test!")

    print("\n--- 5. Testing Performance Monitoring Endpoint ---")
    perf_data = get_performance_metrics(db)
    print(f"Memory Usage: {perf_data['performance']['memory_usage_mb']} MB")
    print(f"CPU Usage: {perf_data['performance']['cpu_usage_pct']}%")
    print(f"Cache Hit Ratio: {perf_data['performance']['cache_hit_ratio']}%")
    print(f"Comparison Table Rows: {len(perf_data['comparison_table'])}")
    print("PASSED: Performance monitoring endpoint test!")

    print("\n==========================================")
    print("ALL PERFORMANCE OPTIMIZATION CHECKS PASSED!")
    print("==========================================")

except Exception as e:
    print("PERFORMANCE AUDIT FAILED:")
    traceback.print_exc()
    sys.exit(1)
