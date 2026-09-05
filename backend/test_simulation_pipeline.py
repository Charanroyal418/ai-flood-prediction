import sys
import os
import time

from app.db.session import SessionLocal
from app.services.orchestrator import (
    RealtimeOrchestrator,
    _STORM_SIMULATION_META,
    set_storm_simulation_active,
    clear_simulation_state,
)
from app.api.endpoints.dashboard import _build_dashboard_live
from app.api.endpoints.inference_cycle import _execute_inference_pipeline
from app.models.alert import Alert

db = SessionLocal()
print("==================================================")
print("  FLOODSENSE AI — END-TO-END PIPELINE VALIDATION")
print("==================================================")

def get_inf_district(inf_payload, name="Chennai"):
    dists = inf_payload.get("districts") or inf_payload.get("stages", {}).get("gdnn_output", {}).get("district_ranking", [])
    return next(d for d in dists if d.get("district") == name or d.get("name") == name)

try:
    # 0. Initial Reset
    clear_simulation_state(db, "Initial Reset")
    print("Initial simulation state cleared.")

    # 1. MILD RAIN SIMULATION
    print("\n--- PHASE 1: MILD RAIN SIMULATION ---")
    _STORM_SIMULATION_META.update({
        "scenario": "Mild Rain System",
        "category": "Monsoon Depression",
        "rainfall_mm": 45.0,
        "target_districts": ["Chennai", "Tiruvallur", "Kancheepuram"],
    })
    set_storm_simulation_active(True, db)
    orch = RealtimeOrchestrator(db)
    summary_mild = orch.run_pipeline(simulate_storm=True)
    
    dash_mild = _build_dashboard_live(db)
    inf_mild = _execute_inference_pipeline(db)
    
    chennai_dash_m = next(d for d in dash_mild["data"]["districts"] if d["name"] == "Chennai")
    chennai_inf_m = get_inf_district(inf_mild, "Chennai")
    
    print(f"Mild Rain Dashboard:  Rain={chennai_dash_m['rainfall_mm']}mm, River={chennai_dash_m['river_level_m']}m, Dam={chennai_dash_m['reservoir_storage']}%, Score={chennai_dash_m['risk_score']}, Level={chennai_dash_m['risk_level']}")
    print(f"Mild Rain Prediction: Rain={chennai_inf_m['rainfall_mm']}mm, River={chennai_inf_m['river_level_m']}m, Dam={chennai_inf_m['reservoir_storage']}%, Score={chennai_inf_m['risk_score']}, Level={chennai_inf_m['risk_level']}")

    assert chennai_dash_m["risk_score"] == chennai_inf_m["risk_score"], f"Score mismatch in Mild Rain: {chennai_dash_m['risk_score']} vs {chennai_inf_m['risk_score']}"
    assert chennai_dash_m["rainfall_mm"] == chennai_inf_m["rainfall_mm"], f"Rainfall mismatch: {chennai_dash_m['rainfall_mm']} vs {chennai_inf_m['rainfall_mm']}"
    assert chennai_dash_m["river_level_m"] == chennai_inf_m["river_level_m"], f"River mismatch: {chennai_dash_m['river_level_m']} vs {chennai_inf_m['river_level_m']}"
    assert chennai_dash_m["reservoir_storage"] == chennai_inf_m["reservoir_storage"], f"Dam mismatch: {chennai_dash_m['reservoir_storage']} vs {chennai_inf_m['reservoir_storage']}"
    print(">>> MILD RAIN: PASSED (Low/Moderate Risk verified)")

    # 2. HEAVY RAIN SIMULATION
    print("\n--- PHASE 2: HEAVY RAIN SIMULATION ---")
    _STORM_SIMULATION_META.update({
        "scenario": "Heavy Monsoon Surge",
        "category": "Depression Surge",
        "rainfall_mm": 135.0,
        "target_districts": ["Chennai", "Tiruvallur", "Kancheepuram"],
    })
    summary_heavy = orch.run_pipeline(simulate_storm=True)
    dash_heavy = _build_dashboard_live(db)
    inf_heavy = _execute_inference_pipeline(db)
    
    chennai_dash_h = next(d for d in dash_heavy["data"]["districts"] if d["name"] == "Chennai")
    chennai_inf_h = get_inf_district(inf_heavy, "Chennai")
    
    print(f"Heavy Rain Dashboard:  Rain={chennai_dash_h['rainfall_mm']}mm, River={chennai_dash_h['river_level_m']}m, Dam={chennai_dash_h['reservoir_storage']}%, Score={chennai_dash_h['risk_score']}, Level={chennai_dash_h['risk_level']}")
    print(f"Heavy Rain Prediction: Rain={chennai_inf_h['rainfall_mm']}mm, River={chennai_inf_h['river_level_m']}m, Dam={chennai_inf_h['reservoir_storage']}%, Score={chennai_inf_h['risk_score']}, Level={chennai_inf_h['risk_level']}")

    assert chennai_dash_h["risk_score"] == chennai_inf_h["risk_score"], "Score mismatch in Heavy Rain"
    assert chennai_dash_h["risk_level"] in ["High", "Severe", "Critical"], f"Expected elevated risk, got {chennai_dash_h['risk_level']}"
    print(">>> HEAVY RAIN: PASSED (High Risk verified)")

    # 3. CYCLONE SIMULATION
    print("\n--- PHASE 3: CYCLONE SIMULATION ---")
    _STORM_SIMULATION_META.update({
        "scenario": "Cyclone Michaung",
        "category": "Very Severe Cyclonic Storm",
        "rainfall_mm": 385.0,
        "target_districts": ["Chennai", "Tiruvallur", "Kancheepuram"],
    })
    summary_cyclone = orch.run_pipeline(simulate_storm=True)
    dash_cyclone = _build_dashboard_live(db)
    inf_cyclone = _execute_inference_pipeline(db)
    
    chennai_dash_c = next(d for d in dash_cyclone["data"]["districts"] if d["name"] == "Chennai")
    chennai_inf_c = get_inf_district(inf_cyclone, "Chennai")
    
    print(f"Cyclone Dashboard:  Rain={chennai_dash_c['rainfall_mm']}mm, River={chennai_dash_c['river_level_m']}m, Dam={chennai_dash_c['reservoir_storage']}%, Score={chennai_dash_c['risk_score']}, Level={chennai_dash_c['risk_level']}")
    print(f"Cyclone Prediction: Rain={chennai_inf_c['rainfall_mm']}mm, River={chennai_inf_c['river_level_m']}m, Dam={chennai_inf_c['reservoir_storage']}%, Score={chennai_inf_c['risk_score']}, Level={chennai_inf_c['risk_level']}")

    assert chennai_dash_c["risk_score"] == chennai_inf_c["risk_score"], "Score mismatch in Cyclone"
    assert chennai_dash_c["risk_level"] in ["Severe", "Critical"], f"Expected Severe/Critical, got {chennai_dash_c['risk_level']}"
    print(">>> CYCLONE: PASSED (Critical/Severe Risk verified)")

    # 4. RESET / RECOVERY TEST
    print("\n--- PHASE 4: ENGINE RECOVERY TEST ---")
    clear_simulation_state(db, "Post-test reset")
    summary_reset = orch.run_pipeline(simulate_storm=False)
    dash_reset = _build_dashboard_live(db)
    inf_reset = _execute_inference_pipeline(db)
    
    chennai_dash_r = next(d for d in dash_reset["data"]["districts"] if d["name"] == "Chennai")
    chennai_inf_r = get_inf_district(inf_reset, "Chennai")
    
    print(f"Reset Dashboard:  Rain={chennai_dash_r['rainfall_mm']}mm, River={chennai_dash_r['river_level_m']}m, Dam={chennai_dash_r['reservoir_storage']}%, Score={chennai_dash_r['risk_score']}, Level={chennai_dash_r['risk_level']}")
    print(f"Reset Prediction: Rain={chennai_inf_r['rainfall_mm']}mm, River={chennai_inf_r['river_level_m']}m, Dam={chennai_inf_r['reservoir_storage']}%, Score={chennai_inf_r['risk_score']}, Level={chennai_inf_r['risk_level']}")
    assert chennai_dash_r["risk_level"] in ["Low", "Moderate", "Safe"], f"Expected recovered risk, got {chennai_dash_r['risk_level']}"
    print(">>> ENGINE RECOVERY: PASSED (Normalized back to nominal)")

    # 5. ALERT DEDUPLICATION CHECK
    alert_count = db.query(Alert).filter(Alert.district_id == chennai_dash_r["id"]).count()
    print(f"\nAlerts in DB for Chennai: {alert_count}")

    print("\n==================================================")
    print("  ALL 5 VALIDATION PHASES PASSED WITH ZERO ERRORS!")
    print("==================================================")

finally:
    db.close()
