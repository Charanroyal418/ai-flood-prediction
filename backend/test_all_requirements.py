import sys
import os
import json
import traceback

print("=== AUDIT VERIFICATION SCRIPT ===")

try:
    from app.db.session import SessionLocal
    from app.api.endpoints.inference_cycle import run_inference_cycle
    from app.api.endpoints.dashboard import get_dashboard_live, simulate_storm_event
    from app.services.orchestrator import get_storm_simulation_active, set_storm_simulation_active, clear_simulation_state

    db = SessionLocal()
    
    print("\n--- 1. Testing Inference Cycle & Latency Breakdown ---")
    payload = run_inference_cycle(db)
    print(f"Cycle ID: {payload.get('cycle_id')}")
    print(f"Total Latency: {payload.get('total_latency_ms')} ms")
    
    breakdown = payload.get("latency_breakdown", {})
    print("Latency Breakdown:", json.dumps(breakdown, indent=2))
    sum_breakdown = round(sum(breakdown.values()), 1)
    print(f"Sum of breakdown stages: {sum_breakdown} ms")
    assert abs(payload.get('total_latency_ms') - sum_breakdown) < 0.2, "Total latency MUST equal sum of stage breakdowns!"
    print("PASSED: Latency breakdown test!")

    print("\n--- 2. Testing District SHAP Values & Multi-Horizon Forecasts ---")
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

    print("\n--- 3. Testing Stop Simulation & State Clearing ---")
    set_storm_simulation_active(True, db)
    print(f"Storm simulation state after activation: {get_storm_simulation_active(db)}")
    clear_simulation_state(db, reason="Audit test stop simulation")
    print(f"Storm simulation state after clearing: {get_storm_simulation_active(db)}")
    assert not get_storm_simulation_active(db), "Simulation mode failed to clear!"
    print("PASSED: Stop simulation bulletproof test!")

    print("\n--- 4. Testing Live Dashboard Endpoint & Operational Event Stream ---")
    dash = get_dashboard_live(db)
    events = dash.get("events", [])
    print(f"Dashboard status: {dash.get('status')}")
    print(f"Total operational events returned: {len(events)}")
    if events:
        e0 = events[0]
        print("Sample Operational Event:", json.dumps(e0, indent=2))
        assert "operation" in e0 and "elapsed_time" in e0 and "source" in e0, "Event missing required operational fields!"
    print("PASSED: Operational event stream test!")

    print("\n==========================================")
    print("ALL AUDIT VERIFICATION CHECKS PASSED SUCCESSFULLY!")
    print("==========================================")

except Exception as e:
    print("AUDIT VERIFICATION FAILED:")
    traceback.print_exc()
    sys.exit(1)
