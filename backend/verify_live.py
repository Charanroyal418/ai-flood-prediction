import urllib.request
import json

def verify_live():
    print("--- LIVE VALIDATION AUDIT ---")
    
    # 1. Live Telemetry
    req = urllib.request.urlopen("https://tn-flood-ai-backend.onrender.com/api/v1/dashboard/live")
    live = json.loads(req.read().decode("utf-8"))
    metrics = live.get("metrics", {})
    districts = live.get("districts", [])
    print(f"[LIVE TELEMETRY] Districts: {len(districts)}, Avg Risk: {metrics.get('avg_risk_score')}, Storm Active: {metrics.get('storm_simulation_active')}")
    
    # Check district consistency
    chennai_live = next((d for d in districts if d.get("district_name") == "Chennai"), None)
    if chennai_live:
        print(f"  Chennai Live -> Risk: {chennai_live.get('risk_score')}, Prob: {chennai_live.get('flood_probability')}, Rain: {chennai_live.get('rainfall_mm')}mm")

    # 2. Rivers
    req = urllib.request.urlopen("https://tn-flood-ai-backend.onrender.com/api/v1/dashboard/rivers")
    rivers_res = json.loads(req.read().decode("utf-8"))
    rivers = rivers_res.get("data", [])
    print(f"[RIVERS] Stations count: {len(rivers)}")
    if rivers:
        r0 = rivers[0]
        calc_overflow = round((r0['current_m'] / r0['danger_m']) * 100, 1)
        print(f"  River 0: {r0['name']} -> Current: {r0['current_m']}m, Danger: {r0['danger_m']}m, Overflow%: {r0['overflow_pct']} (Formula: {calc_overflow}%)")
        print(f"  History sparkline points: {len(r0.get('history', []))}")

    # 3. Inference Cycle & SHAP
    req = urllib.request.urlopen("https://tn-flood-ai-backend.onrender.com/api/v1/predict/inference-cycle")
    cycle = json.loads(req.read().decode("utf-8"))
    cyc_districts = cycle.get("districts", [])
    print(f"[INFERENCE CYCLE] Districts: {len(cyc_districts)}")
    chennai_cyc = next((d for d in cyc_districts if d.get("district") == "Chennai"), None)
    if chennai_cyc:
        shap = chennai_cyc.get("shap_values", [])
        total_shap = round(sum(s.get("contribution", 0) for s in shap), 2)
        print(f"  Chennai Inferred -> Risk: {chennai_cyc.get('risk_score')}, Prob: {chennai_cyc.get('flood_probability')}, SHAP sum: {total_shap}%")
        print(f"  Features: {[(s.get('feature') or s.get('label'), s.get('contribution')) for s in shap]}")

    # 4. Knowledge Graph
    req = urllib.request.urlopen("https://tn-flood-ai-backend.onrender.com/api/v1/kg/graph")
    kg = json.loads(req.read().decode("utf-8"))
    nodes = kg.get("nodes", [])
    edges = kg.get("edges", [])
    edge_pairs = set()
    dup_edges = 0
    for e in edges:
        pair = (e.get("source"), e.get("target"), e.get("type"))
        if pair in edge_pairs:
            dup_edges += 1
        edge_pairs.add(pair)
    print(f"[KNOWLEDGE GRAPH] Nodes: {len(nodes)}, Edges: {len(edges)}, Duplicate Edges: {dup_edges}")
    chennai_kg = next((n for n in nodes if n.get("label") == "Chennai"), None)
    if chennai_kg:
        print(f"  Chennai KG Node -> Risk: {chennai_kg.get('risk_score')}, Color: {chennai_kg.get('risk_color')}, Prob: {chennai_kg.get('flood_probability')}")

if __name__ == "__main__":
    verify_live()
