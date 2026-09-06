import urllib.request
import json
import time

def test_lifecycle():
    print("--- SIMULATION TRIGGER TEST ---")
    # 1. Start simulation: Cyclone Michaung
    start_payload = {
        "active": True,
        "scenario": "Cyclone Michaung",
        "category": "Extremely Severe Cyclonic Storm",
        "rainfall_mm": 450.0,
        "wind_speed_kmh": 110.0,
        "storm_surge_m": 1.5,
        "duration_minutes": 30,
        "target_districts": ["Chennai", "Tiruvallur", "Kancheepuram", "Chengalpattu"]
    }
    req = urllib.request.Request(
        'https://tn-flood-ai-backend.onrender.com/api/v1/dashboard/simulate-storm',
        data=json.dumps(start_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    res = urllib.request.urlopen(req)
    start_res = json.loads(res.read().decode('utf-8'))
    print('Simulation start response:', start_res)

    time.sleep(2)

    # 2. Check Live Telemetry during simulation
    req_live = urllib.request.urlopen('https://tn-flood-ai-backend.onrender.com/api/v1/dashboard/live')
    live = json.loads(req_live.read().decode('utf-8'))
    metrics = live.get('metrics', {})
    districts = live.get('districts', [])
    print(f"During Storm -> Storm Active: {metrics.get('storm_simulation_active')}, Avg Risk: {metrics.get('avg_risk_score')}, Alerts: {metrics.get('active_alerts_count')}")
    chennai = next((d for d in districts if d.get('district_name') == 'Chennai'), None)
    if chennai:
        print(f"  Chennai During Storm -> Risk: {chennai.get('risk_score')}, Level: {chennai.get('risk_level')}, Rain: {chennai.get('rainfall_mm')}mm, Prob: {chennai.get('flood_probability')}")

    # 3. Check SHAP during storm
    req_cyc = urllib.request.urlopen('https://tn-flood-ai-backend.onrender.com/api/v1/predict/inference-cycle')
    cyc = json.loads(req_cyc.read().decode('utf-8'))
    chennai_cyc = next((d for d in cyc.get('districts', []) if d.get('district') == 'Chennai'), None)
    if chennai_cyc:
        shap = chennai_cyc.get('shap_values', [])
        total_shap = round(sum(s.get('contribution', 0) for s in shap), 2)
        print(f"  Chennai SHAP sum: {total_shap}%, Dominant: {shap[0] if shap else None}")
        print(f"  All SHAP Features: {[(s.get('feature') or s.get('label'), s.get('contribution')) for s in shap]}")

    # 4. Halt simulation
    stop_payload = {"active": False}
    req_stop = urllib.request.Request(
        'https://tn-flood-ai-backend.onrender.com/api/v1/dashboard/simulate-storm',
        data=json.dumps(stop_payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    res_stop = urllib.request.urlopen(req_stop)
    print('Simulation stop response:', json.loads(res_stop.read().decode('utf-8')))

    time.sleep(2)

    # 5. Check Restoration to Live
    req_restored = urllib.request.urlopen('https://tn-flood-ai-backend.onrender.com/api/v1/dashboard/live')
    restored = json.loads(req_restored.read().decode('utf-8'))
    m_res = restored.get('metrics', {})
    chennai_restored = next((d for d in restored.get('districts', []) if d.get('district_name') == 'Chennai'), None)
    print(f"After Halt -> Storm Active: {m_res.get('storm_simulation_active')}, Avg Risk: {m_res.get('avg_risk_score')}, Alerts: {m_res.get('active_alerts_count')}")
    if chennai_restored:
        print(f"  Chennai Restored -> Risk: {chennai_restored.get('risk_score')}, Level: {chennai_restored.get('risk_level')}, Rain: {chennai_restored.get('rainfall_mm')}mm, Prob: {chennai_restored.get('flood_probability')}")

if __name__ == '__main__':
    test_lifecycle()
