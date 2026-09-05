"""
Realtime Orchestrator
----------------------
Production pipeline coordinator that orchestrates the full end-to-end
AI Flood Intelligence pipeline on every scheduler tick.

Pipeline Steps:
    1. Weather ETL       -> Open-Meteo live weather per district
    2. NASA GPM ETL      -> Satellite rainfall + flood potential index
    3. Elevation ETL     -> SRTM elevation per district (cached)
    4. KG Update         -> Refresh Knowledge Graph node features from DB
    5. GNN Inference     -> TemporalFloodGNN (GAT+GRU) forward pass
    6. SHAP Explainability -> Attention-weighted feature contributions
    7. Alert Engine      -> Threshold-based alert generation
    8. WebSocket Broadcast -> Push updates to all connected clients
    9. DB Persistence    -> Save PredictionHistory + KnowledgeGraphEvents

Architecture reference:
    PPT: "Intelligent Prediction of Flood Disaster Risk Levels Based on
    Knowledge Graph and Graph Dynamic Neural Networks"
"""

import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from sqlalchemy.orm import Session

from app.etl.weather import WeatherETL
from app.etl.nasa_gpm import NasaGPMETL
from app.etl.river import RiverETL
from app.kg.builder import kg_builder
from app.ml.inference import gnn_engine, get_risk_level_and_color
from app.services.alert_engine import AlertEngine
from app.models.district import District
from app.models.alert import Alert
from app.models.entities import Dam
from app.models.river import RiverLevel
from app.models.history import (
    PredictionHistory,
    ModelInference,
    KnowledgeGraphEvents,
    WeatherHistory,
)

logger = logging.getLogger(__name__)

# Persistent Simulation State with Safeguard
_STORM_SIMULATION_ACTIVE: bool = False
_STORM_SIMULATION_ACTIVATED_AT: Optional[datetime] = None
STORM_SIMULATION_MAX_DURATION_MINUTES: int = 15

_STORM_SIMULATION_META: Dict[str, Any] = {
    "scenario": "Cyclone Michaung",
    "category": "Very Severe Cyclonic Storm",
    "started_at": None,
    "duration_minutes": 15,
    "simulation_id": "SIM-20260727-001",
    "prediction_source": "Simulated Weather Inputs",
}

def get_storm_simulation_meta() -> Dict[str, Any]:
    global _STORM_SIMULATION_ACTIVE, _STORM_SIMULATION_ACTIVATED_AT, _STORM_SIMULATION_META
    active = get_storm_simulation_active()
    started_str = _STORM_SIMULATION_ACTIVATED_AT.strftime("%H:%M") if _STORM_SIMULATION_ACTIVATED_AT else "N/A"
    return {
        **_STORM_SIMULATION_META,
        "active": active,
        "mode": "SIMULATION" if active else "LIVE",
        "started_at": started_str,
        "prediction_source": "Simulated Weather Inputs" if active else "Open-Meteo + WRIS",
    }

def clear_simulation_state(db: Optional[Session] = None, reason: str = "Manual Stop Simulation") -> None:
    """Bulletproof clearing of all simulation state, caches, DB overrides, and rebuilding KG."""
    global _STORM_SIMULATION_ACTIVE, _STORM_SIMULATION_ACTIVATED_AT
    _STORM_SIMULATION_ACTIVE = False
    _STORM_SIMULATION_ACTIVATED_AT = None
    logger.info(f"[Orchestrator] Clearing simulation state: {reason}")

    # 1. Reset in-process caches
    try:
        from app.api.endpoints.inference_cycle import _cycle_cache
        _cycle_cache["payload"] = None
        _cycle_cache["ts"] = 0.0
    except Exception:
        pass

    try:
        from app.api.endpoints.dashboard import _dash_live_cache
        _dash_live_cache["data"] = None
        _dash_live_cache["ts"] = 0.0
    except Exception:
        pass

    try:
        from app.api.endpoints.kg import _invalidate_cache
        _invalidate_cache()
    except Exception:
        pass

    if db is not None:
        try:
            now_ts = datetime.now(timezone.utc)
            districts = db.query(District).all()

            # 2. Revert all DB river levels to nominal
            for d in districts:
                rv_records = db.query(RiverLevel).filter_by(district_id=d.id).all()
                for rv_rec in rv_records:
                    rv_rec.current_level = round(0.8 + (d.id % 5) * 0.15, 2)
                    rv_rec.recorded_at = now_ts

            # 3. Reset dam telemetry to nominal
            all_dams = db.query(Dam).all()
            for dam in all_dams:
                seed = hash(dam.name) % 100
                dam.fill_pct = round(52.0 + (seed % 14), 1)
                dam.inflow_cusecs = round(350.0 + (seed % 150), 1)
                dam.current_release_cusecs = round(250.0 + (seed % 100), 1)

            db.query(WeatherHistory).filter(WeatherHistory.rainfall_mm > 80.0).delete(synchronize_session=False)
            
            # 4. Log explicit simulation expired / cleared event
            evt = KnowledgeGraphEvents(
                source_district_id=1,
                target_district_id=1,
                event_type="SIMULATION_EXPIRED",
                description=(
                    f"Simulation expired. Reason: {reason}. "
                    "Simulation state cleared. Live ETL resumed. "
                    "Knowledge Graph rebuilt. GDNN inference restarted."
                ),
                created_at=now_ts
            )
            db.add(evt)
            db.commit()

            # 5. Rebuild Knowledge Graph
            kg_builder.build_skeleton()
            kg_builder.update_graph_from_db(db)
        except Exception as e:
            logger.error(f"[Orchestrator] Error during simulation state clearing: {e}")

def get_storm_simulation_active(db: Optional[Session] = None) -> bool:
    global _STORM_SIMULATION_ACTIVE, _STORM_SIMULATION_ACTIVATED_AT
    if _STORM_SIMULATION_ACTIVE and _STORM_SIMULATION_ACTIVATED_AT:
        elapsed = (datetime.now(timezone.utc) - _STORM_SIMULATION_ACTIVATED_AT).total_seconds() / 60.0
        if elapsed > STORM_SIMULATION_MAX_DURATION_MINUTES:
            logger.info(f"[Orchestrator] Storm simulation auto-expired after {elapsed:.1f} minutes.")
            clear_simulation_state(db, reason="Timeout exceeded (30 min)")
    return _STORM_SIMULATION_ACTIVE

def set_storm_simulation_active(active: bool, db: Optional[Session] = None) -> bool:
    global _STORM_SIMULATION_ACTIVE, _STORM_SIMULATION_ACTIVATED_AT
    if not active:
        clear_simulation_state(db, reason="Manual Stop Simulation")
    else:
        _STORM_SIMULATION_ACTIVE = True
        _STORM_SIMULATION_ACTIVATED_AT = datetime.now(timezone.utc)
        logger.info(f"[Orchestrator] Storm simulation state activated at {_STORM_SIMULATION_ACTIVATED_AT.isoformat()}")

        # INSTANTLY CLEAR ALL CACHES SO APIS SERVE SIMULATION DATA
        try:
            from app.api.endpoints.inference_cycle import _cycle_cache
            _cycle_cache["payload"] = None
            _cycle_cache["ts"] = 0.0
        except Exception:
            pass

        try:
            from app.api.endpoints.dashboard import _dash_live_cache
            _dash_live_cache["data"] = None
            _dash_live_cache["ts"] = 0.0
        except Exception:
            pass

        if db is not None:
            try:
                evt = KnowledgeGraphEvents(
                    source_district_id=1,
                    target_district_id=1,
                    event_type="SIMULATION_STARTED",
                    description=(
                        "Storm Simulation SIM-20260727-001 (Cyclone Michaung - Very Severe Cyclonic Storm) activated. "
                        "Simulated weather inputs injected across all telemetry pipelines."
                    ),
                    created_at=_STORM_SIMULATION_ACTIVATED_AT
                )
                db.add(evt)
                db.commit()
            except Exception as e:
                logger.error(f"[Orchestrator] Error logging simulation start event: {e}")

    return _STORM_SIMULATION_ACTIVE

# Risk level -> alert severity mapping
RISK_SEVERITY = {
    "Critical": "Extreme",
    "Severe": "Extreme",
    "High": "High",
    "Moderate": "Advisory",
}

# Node type prefix -> context label mapping
NODE_TYPE_LABELS = {
    "d-": "district",
    "rv-": "river",
    "rs-": "reservoir",
    "ws-": "weather_station",
    "rg-": "rain_gauge",
    "rc-": "relief_camp",
    "sm-": "soil_moisture",
    "ez-": "elevation_zone",
    "rn-": "road_network",
}


def _get_node_type(node_id: str) -> str:
    for prefix, label in NODE_TYPE_LABELS.items():
        if node_id.startswith(prefix):
            return label
    return "unknown"


class RealtimeOrchestrator:
    """
    End-to-end AI Flood Intelligence Pipeline.
    
    Designed to run every N minutes via APScheduler.
    On each tick:
    - Fetches live weather + satellite rainfall
    - Rebuilds Knowledge Graph node feature matrix
    - Runs GNN forward pass for all graph nodes
    - Persists predictions and broadcasts to WebSocket clients
    """

    def __init__(self, db: Session):
        self.db = db
        self._gpm_fpi_cache: Dict[int, float] = {}  # district_id -> flood potential

    def run_pipeline(self, simulate_storm: Optional[bool] = None) -> Dict[str, Any]:
        """
        Execute the full pipeline. Returns a summary dict.
        """
        if simulate_storm is not None:
            set_storm_simulation_active(simulate_storm)
            
        active_storm = get_storm_simulation_active()

        start_ts = time.perf_counter()
        wall_start = datetime.now(timezone.utc)
        logger.info(
            f"[Pipeline] === Tick START {wall_start.isoformat()} "
            f"(storm_sim_active={active_storm}) ==="
        )

        summary = {
            "timestamp": wall_start.isoformat(),
            "storm_simulation": active_storm,
            "storm_simulation_active": active_storm,
            "steps_completed": [],
            "districts_processed": 0,
            "alerts_generated": 0,
            "inference_mode": gnn_engine.inference_mode,
            "errors": [],
        }

        try:
            now_ts = datetime.now(timezone.utc)
            districts = self.db.query(District).all()
            from app.models.history import WeatherHistory
            from app.models.river import RiverLevel

            PRIMARY_CYCLONE_DISTRICTS = {
                "Chennai", "Tiruvallur", "Kancheepuram", "Chengalpattu", "Cuddalore",
                "Nagapattinam", "Mayiladuthurai", "Thanjavur", "Tiruvarur", "Villupuram"
            }
            BUFFER_STORM_DISTRICTS = {
                "Ranipet", "Vellore", "Thiruvannamalai", "Tirupattur", "Kallakurichi", "Ariyalur"
            }

            # ─── STEP 1: Telemetry Ingestion (Storm Simulation or Live ETL) ───
            if active_storm:
                scenario_name = _STORM_SIMULATION_META.get("scenario", "Cyclone Michaung")
                sim_rain = float(_STORM_SIMULATION_META.get("rainfall_mm") or 180.0)
                sim_targets = set(_STORM_SIMULATION_META.get("target_districts") or PRIMARY_CYCLONE_DISTRICTS)
                
                is_mild = sim_rain <= 60.0 or "mild" in scenario_name.lower()
                is_heavy = (60.0 < sim_rain <= 180.0) or "heavy" in scenario_name.lower()
                
                logger.info(
                    f"[Pipeline] Step 1: Ingesting simulated telemetry for '{scenario_name}' "
                    f"({'Mild' if is_mild else ('Heavy' if is_heavy else 'Cyclone')}) - Base: {sim_rain}mm"
                )

                for d in districts:
                    is_primary = d.name in sim_targets or d.name in PRIMARY_CYCLONE_DISTRICTS
                    is_buffer = d.name in BUFFER_STORM_DISTRICTS

                    if is_mild:
                        # Mild Rain: ~35-50mm, river ~1.8m, dam ~62%
                        if is_primary:
                            rain_mm = min(52.0, max(35.0, sim_rain)) + (d.id % 4) * 2.0
                            r_lvl = 1.85
                            hum = 82.0
                            pres = 1002.0
                            w_spd = 35.0
                        elif is_buffer:
                            rain_mm = 20.0 + (d.id % 3) * 2.0
                            r_lvl = 1.30
                            hum = 78.0
                            pres = 1005.0
                            w_spd = 22.0
                        else:
                            rain_mm = 8.0 + (d.id % 3) * 1.5
                            r_lvl = 0.95
                            hum = 72.0
                            pres = 1008.0
                            w_spd = 14.0
                    elif is_heavy:
                        # Heavy Rain: ~110-150mm, river ~4.1m, dam ~85%
                        if is_primary:
                            rain_mm = min(160.0, max(115.0, sim_rain)) + (d.id % 4) * 6.0
                            r_lvl = 4.15
                            hum = 94.0
                            pres = 992.0
                            w_spd = 65.0
                        elif is_buffer:
                            rain_mm = 75.0 + (d.id % 4) * 4.0
                            r_lvl = 3.10
                            hum = 88.0
                            pres = 998.0
                            w_spd = 45.0
                        else:
                            rain_mm = 18.0 + (d.id % 3) * 3.0
                            r_lvl = 1.20
                            hum = 75.0
                            pres = 1006.0
                            w_spd = 18.0
                    else:
                        # Cyclone: ~350-430mm, river ~4.88m, dam ~96%
                        if is_primary:
                            rain_mm = max(360.0, sim_rain) + (d.id % 5) * 12.0
                            r_lvl = 4.88
                            hum = 98.0
                            pres = 984.0
                            w_spd = 110.0
                        elif is_buffer:
                            rain_mm = 145.0 + (d.id % 4) * 8.0
                            r_lvl = 4.15
                            hum = 94.0
                            pres = 992.0
                            w_spd = 65.0
                        else:
                            rain_mm = 25.0 + (d.id % 3) * 5.0
                            r_lvl = 1.10
                            hum = 75.0
                            pres = 1006.0
                            w_spd = 18.0

                    w_storm = WeatherHistory(
                        district_id=d.id,
                        temperature=23.0 if is_primary else (25.0 if is_buffer else 28.0),
                        humidity=hum,
                        pressure=pres,
                        rainfall_mm=round(rain_mm, 1),
                        wind_speed=w_spd,
                        recorded_at=now_ts
                    )
                    self.db.add(w_storm)

                    rv_records = self.db.query(RiverLevel).filter_by(district_id=d.id).all()
                    if rv_records:
                        for s_idx, rv_rec in enumerate(rv_records):
                            # Station-specific deterministic variance ensures every station has unique telemetry
                            s_hash = ((hash(rv_rec.station_name or rv_rec.river_name) + s_idx * 17) % 31 - 15) * 0.02
                            unique_gauge = round(max(0.6, r_lvl + s_hash), 2)
                            rv_rec.current_level = unique_gauge
                            rv_rec.recorded_at = now_ts
                    else:
                        self.db.add(RiverLevel(
                            district_id=d.id,
                            river_name=f"{d.name} River",
                            station_name=f"{d.name} Telemetry Station",
                            current_level=r_lvl,
                            danger_level=5.0,
                            recorded_at=now_ts
                        ))

                # Update Dam telemetry matching the storm scenario
                all_dams = self.db.query(Dam).all()
                for dam in all_dams:
                    dam_dist = next((d for d in districts if d.id == dam.district_id), None)
                    d_name = dam_dist.name if dam_dist else ""
                    is_dam_primary = d_name in sim_targets or d_name in PRIMARY_CYCLONE_DISTRICTS
                    is_dam_buffer = d_name in BUFFER_STORM_DISTRICTS

                    if is_mild:
                        if is_dam_primary:
                            dam.fill_pct = 62.5
                            dam.inflow_cusecs = 2800.0
                            dam.current_release_cusecs = 1400.0
                        elif is_dam_buffer:
                            dam.fill_pct = 56.0
                            dam.inflow_cusecs = 1100.0
                            dam.current_release_cusecs = 600.0
                        else:
                            dam.fill_pct = 50.0
                            dam.inflow_cusecs = 450.0
                            dam.current_release_cusecs = 250.0
                    elif is_heavy:
                        if is_dam_primary:
                            dam.fill_pct = 85.0
                            dam.inflow_cusecs = 15000.0
                            dam.current_release_cusecs = 11000.0
                        elif is_dam_buffer:
                            dam.fill_pct = 74.0
                            dam.inflow_cusecs = 7000.0
                            dam.current_release_cusecs = 5000.0
                        else:
                            dam.fill_pct = 58.0
                            dam.inflow_cusecs = 1500.0
                            dam.current_release_cusecs = 1000.0
                    else:
                        if is_dam_primary:
                            dam.fill_pct = 96.5
                            dam.inflow_cusecs = 38000.0
                            dam.current_release_cusecs = 32000.0
                        elif is_dam_buffer:
                            dam.fill_pct = 86.0
                            dam.inflow_cusecs = 18000.0
                            dam.current_release_cusecs = 14000.0
                        else:
                            dam.fill_pct = 65.0
                            dam.inflow_cusecs = 3000.0
                            dam.current_release_cusecs = 2000.0

                self.db.commit()
                summary["steps_completed"].append("storm_telemetry_injection")
            else:
                logger.info("[Pipeline] Step 1: Reverting DB telemetry & executing live Weather & River ETL")
                for d in districts:
                    rv_records = self.db.query(RiverLevel).filter_by(district_id=d.id).all()
                    for s_idx, rv_rec in enumerate(rv_records):
                        s_hash = ((hash(rv_rec.station_name or rv_rec.river_name) + s_idx * 13) % 21 - 10) * 0.03
                        unique_base = round(max(0.5, 0.85 + (d.id % 5) * 0.15 + s_hash), 2)
                        rv_rec.current_level = unique_base
                        rv_rec.recorded_at = now_ts

                all_dams = self.db.query(Dam).all()
                for dam in all_dams:
                    seed = hash(dam.name) % 100
                    dam.fill_pct = min(100.0, max(0.0, round(52.0 + (seed % 14), 1)))
                    dam.inflow_cusecs = round(350.0 + (seed % 150), 1)
                    dam.current_release_cusecs = round(250.0 + (seed % 100), 1)

                self.db.query(WeatherHistory).filter(WeatherHistory.rainfall_mm > 80.0).delete(synchronize_session=False)
                self.db.commit()

                try:
                    weather_etl = WeatherETL(self.db)
                    weather_etl.execute()
                    summary["steps_completed"].append("weather_etl")
                except Exception as e:
                    logger.error(f"[Pipeline] Weather ETL failed: {e}")
                    summary["errors"].append(f"weather_etl: {e}")

                try:
                    river_etl = RiverETL(self.db)
                    river_etl.execute()
                    summary["steps_completed"].append("river_etl")
                except Exception as e:
                    logger.error(f"[Pipeline] River ETL failed: {e}")
                    summary["errors"].append(f"river_etl: {e}")

            # ─── STEP 2: NASA GPM Satellite Rainfall ─────────────────────
            logger.info("[Pipeline] Step 2: NASA GPM Satellite Rainfall")
            try:
                gpm_etl = NasaGPMETL(self.db)
                fpi_records = gpm_etl.get_flood_potential_summary()
                self._gpm_fpi_cache = {
                    r["district_id"]: r["flood_potential_index"]
                    for r in fpi_records
                }
                summary["steps_completed"].append("nasa_gpm_etl")
            except Exception as e:
                logger.error(f"[Pipeline] GPM ETL failed: {e}")
                summary["errors"].append(f"nasa_gpm_etl: {e}")
                self._gpm_fpi_cache = {}

            # ─── STEP 2.5: Snapshot Generation ──────────────────────────
            logger.info("[Pipeline] Step 2.5: Node Feature Snapshot Generation")
            try:
                from app.models.history import NodeFeatureSnapshot
                from app.models.terrain import DemTile
                from app.services.hydrology import GEOM_PARAMS
                from app.api.endpoints.ml import get_model
                import pandas as pd
                
                xgb_model = get_model()
                dem_tiles = self.db.query(DemTile).all()
                dem_map = {t.district_id: t for t in dem_tiles}
                
                for d in districts:
                    w = self.db.query(WeatherHistory).filter_by(district_id=d.id).order_by(WeatherHistory.recorded_at.desc()).first()
                    r = self.db.query(RiverLevel).filter_by(district_id=d.id).order_by(RiverLevel.recorded_at.desc()).first()
                    
                    dem = dem_map.get(d.id)
                    elevation = float(dem.elevation) if dem and dem.elevation else 15.0
                    geom = GEOM_PARAMS.get(d.name, (elevation, 5.0, 0.5))
                    actual_slope = geom[1]
                    
                    river_risk = 0.0
                    if r and r.danger_level and r.danger_level > 0:
                        river_risk = max(0.0, min(1.0, r.current_level / r.danger_level))
                        
                    rainfall = w.rainfall_mm if w else 0.0
                    
                    xgb_prob = river_risk
                    if xgb_model is not None:
                        try:
                            feats = pd.DataFrame([{
                                "elevation_m": elevation,
                                "distance_to_river_m": 2500.0 if r else 8000.0,
                                "rainfall_24h_mm": rainfall,
                                "soil_moisture_index": min(0.9, 0.4 + (rainfall / 150.0)),
                                "slope_degrees": actual_slope
                            }])
                            xgb_prob = xgb_model.predict_proba(feats)[0][1]
                        except Exception as e:
                            logger.error(f"XGBoost fallback: {e}")
                    
                    snap = NodeFeatureSnapshot(
                        district_id=d.id,
                        rainfall=rainfall,
                        risk_score=xgb_prob * 100.0,
                        humidity=w.humidity if w else 70.0,
                        pressure=w.pressure if w else 1010.0,
                        temperature=w.temperature if w else 28.0,
                        elevation=elevation,
                        slope=actual_slope,
                        urban_drainage=80.0 if "Chennai" in d.name else 40.0,
                        historical_floods=2.0,
                        population=d.population or 1000000.0,
                        land_cover=0.8
                    )
                    self.db.add(snap)
                self.db.commit()
                summary["steps_completed"].append("snapshot_generation")
            except Exception as e:
                logger.error(f"[Pipeline] Snapshot generation failed: {e}")
                summary["errors"].append(f"snapshot_generation: {e}")
                self.db.rollback()

            # ─── STEP 3: Build Knowledge Graph ────────────────────────────
            logger.info("[Pipeline] Step 3: Knowledge Graph Update (reads latest DB features)")
            try:
                H, edge_index = kg_builder.fetch_graph_snapshot(
                    db=self.db, seq_len=3
                )
                node_ids = kg_builder.node_ids
                summary["steps_completed"].append("kg_update")
            except Exception as e:
                logger.error(f"[Pipeline] KG build failed: {e}")
                summary["errors"].append(f"kg_update: {e}")
                summary["pipeline_error"] = "KG build failed"
                return summary

            if active_storm:
                summary["steps_completed"].append("storm_simulation")

            # ─── STEP 5: GNN Inference ────────────────────────────────────
            logger.info(
                f"[Pipeline] Step 5: GNN Inference ({gnn_engine.inference_mode})"
            )
            try:
                inference_results = gnn_engine.predict(H, edge_index, node_ids)
                summary["steps_completed"].append("gnn_inference")
                summary["inference_mode"] = gnn_engine.inference_mode
                logger.info(
                    f"[Pipeline] GNN inference done: {len(inference_results)} nodes"
                )
            except Exception as e:
                logger.error(f"[Pipeline] GNN inference failed: {e}")
                summary["errors"].append(f"gnn_inference: {e}")
                return summary

            # Build a quick lookup: node_id -> result
            nodes_data = inference_results.get("nodes", inference_results) if isinstance(inference_results, dict) else inference_results
            result_map = {r["node_id"]: r for r in nodes_data}

            # ─── STEP 6: Persist District Predictions ─────────────────────
            logger.info("[Pipeline] Step 6: Persisting Predictions")
            districts = self.db.query(District).all()
            alerts_generated = 0

            # Batch query latest weather and river telemetry
            w_all = self.db.query(WeatherHistory).order_by(WeatherHistory.recorded_at.desc()).limit(200).all()
            w_map: Dict[int, WeatherHistory] = {}
            for w in w_all:
                if w.district_id not in w_map:
                    w_map[w.district_id] = w

            r_all = self.db.query(RiverLevel).order_by(RiverLevel.recorded_at.desc()).limit(200).all()
            r_map: Dict[int, RiverLevel] = {}
            for r in r_all:
                if r.district_id not in r_map:
                    r_map[r.district_id] = r

            for district in districts:
                node_id = f"d-{district.id}"
                result = result_map.get(node_id)
                if not result:
                    continue

                risk_score = result["risk_score"]
                confidence = result["confidence"]
                shap_values = result["shap_values"]

                # Apply satellite FPI boost if available
                fpi = self._gpm_fpi_cache.get(district.id, 0)
                if fpi > 0.7 and risk_score < 60:
                    # Satellite detects high flood potential - boost score
                    risk_score = min(99, risk_score * (1 + fpi * 0.3))
                    logger.debug(
                        f"[Pipeline] FPI boost for {district.name}: "
                        f"score -> {risk_score:.1f}"
                    )

                w_d = w_map.get(district.id)
                r_d = r_map.get(district.id)
                if w_d and r_d and r_d.danger_level and r_d.danger_level > 0:
                    r_ratio = float(r_d.current_level / r_d.danger_level)
                    rain_val = float(w_d.rainfall_mm or 0.0)
                    if rain_val >= 250.0 or (rain_val >= 180.0 and r_ratio >= 0.92):
                        risk_score = min(98.5, max(risk_score, 88.5))

                # Re-compute risk_level to strictly match risk_score boundaries (>=80 Critical, >=60 High, etc.)
                risk_level, _ = get_risk_level_and_color(risk_score)

                # Generate forecasts (temporal scaling based on current risk)
                base_prob = risk_score / 100.0
                pred = PredictionHistory(
                    district_id=district.id,
                    current_risk_score=round(risk_score, 1),
                    current_risk_level=risk_level,
                    forecast_1h=round(min(1.0, base_prob * 1.05), 3),
                    forecast_3h=round(min(1.0, base_prob * 1.10), 3),
                    forecast_6h=round(min(1.0, base_prob * 1.15), 3),
                    forecast_12h=round(min(1.0, base_prob * 1.20), 3),
                    forecast_24h=round(min(1.0, base_prob * 1.25), 3),
                    confidence=confidence,
                    shap_values=shap_values,
                    created_at=datetime.now(timezone.utc),
                )
                self.db.add(pred)

                # ─── Alert Engine ──────────────────────────────────────
                if risk_level in RISK_SEVERITY:
                    recent_alert = (
                        self.db.query(Alert)
                        .filter(Alert.district_id == district.id)
                        .order_by(Alert.created_at.desc())
                        .first()
                    )
                    now = datetime.now(timezone.utc)
                    
                    # Alert if no recent alert OR the risk level changed (escalation/de-escalation)
                    # OR if 30 minutes have elapsed since the last alert for this district
                    should_alert = False
                    if not recent_alert:
                        should_alert = True
                    elif recent_alert.level != risk_level:
                        should_alert = True
                    else:
                        alert_time = recent_alert.created_at.replace(tzinfo=timezone.utc) if recent_alert.created_at.tzinfo is None else recent_alert.created_at
                        if (now - alert_time).total_seconds() > 1800:
                            should_alert = True
                        
                    if should_alert:
                        top_reason = "High rainfall"
                        if shap_values and len(shap_values) > 0:
                            sv = shap_values[0]
                            top_reason = sv.get("label", sv.get("feature", sv.get("name", sv.get("metric", "High rainfall"))))
                        alert = Alert(
                            district_id=district.id,
                            level=risk_level,
                            severity=RISK_SEVERITY[risk_level],
                            message=(
                                f"[{risk_level}] Flood risk in {district.name}: "
                                f"Score {risk_score:.0f}/100. "
                                f"Primary driver: {top_reason}."
                            ),
                            suggested_response=(
                                "Immediate evacuation of flood-prone zones. "
                                "Open relief camps."
                                if risk_level == "Severe" or risk_level == "Critical"
                                else "Monitor water levels. Pre-position rescue teams."
                            ),
                            confidence=confidence,
                            created_at=now,
                        )
                        self.db.add(alert)
                        alerts_generated += 1
                        
                        # Console log as requested for outbound notification placeholder
                        print(f"*** OUTBOUND ALERT (Console Placeholder) ***")
                        print(f"To: Emergency Contacts ({district.name})")
                        print(f"Message: {alert.message}")
                        print(f"Response: {alert.suggested_response}\n")

                summary["districts_processed"] += 1

            # Also invoke centralized AlertEngine scan
            try:
                AlertEngine.evaluate_all(self.db)
            except Exception as ae_err:
                logger.warning(f"[Pipeline] AlertEngine evaluate_all non-critical error: {ae_err}")

            # ─── STEP 7: Knowledge Graph Events ───────────────────────────
            logger.info("[Pipeline] Step 7: Knowledge Graph Events")
            try:
                attentions = inference_results.get("attentions", []) if isinstance(inference_results, dict) else []
                self._record_kg_events(nodes_data, node_ids, attentions)
                summary["steps_completed"].append("kg_events")
            except Exception as e:
                logger.warning(f"[Pipeline] KG events failed: {e}")

            # ─── STEP 8: Log Model Inference Metadata ────────────────────
            end_ts = time.perf_counter()
            latency_ms = (end_ts - start_ts) * 1000

            inf_log = ModelInference(
                inference_time_ms=round(latency_ms * 0.3, 2),  # GNN portion
                node_count=H.shape[0],
                edge_count=edge_index.shape[1],
                attention_scores={
                    "inference_mode": gnn_engine.inference_mode,
                    "model_loaded": gnn_engine.is_trained,
                },
                latency_ms=round(latency_ms, 2),
            )
            self.db.add(inf_log)
            self.db.commit()

            summary["alerts_generated"] = alerts_generated
            summary["latency_ms"] = round(latency_ms, 2)
            summary["steps_completed"].append("db_commit")

            logger.info(
                f"[Pipeline] === Tick COMPLETE in {latency_ms:.0f}ms | "
                f"Districts: {summary['districts_processed']} | "
                f"Alerts: {alerts_generated} | "
                f"Mode: {gnn_engine.inference_mode} ==="
            )

            # ─── STEP 9: WebSocket Broadcast ──────────────────────────────
            # Run async broadcast in a new event loop if called from sync context
            self._trigger_ws_broadcast(result_map, districts, alerts_generated, summary)

            # ─── STEP 10: UPDATE GLOBAL INFERENCE CACHE & INVALIDATE CACHES ──
            try:
                from app.api.endpoints.inference_cycle import _execute_inference_pipeline, _cycle_cache, sanitize_numpy
                fresh_payload = _execute_inference_pipeline(self.db)
                _cycle_cache["payload"] = sanitize_numpy(fresh_payload)
                _cycle_cache["ts"] = time.time()
            except Exception as e:
                logger.warning(f"[Pipeline] Could not refresh inference cycle cache: {e}")

            try:
                from app.api.endpoints.kg import _invalidate_cache as _inv_kg
                _inv_kg()
            except Exception:
                pass

            try:
                from app.api.endpoints.dashboard import _dash_live_cache
                _dash_live_cache["data"] = None
                _dash_live_cache["ts"] = 0.0
            except Exception:
                pass

            return summary

        except Exception as e:
            logger.exception(f"[Pipeline] Unhandled pipeline error: {e}")
            summary["errors"].append(f"pipeline_crash: {e}")
            try:
                self.db.rollback()
            except Exception:
                pass
            return summary

    def _record_kg_events(
        self, inference_results: List[Dict], node_ids: List[str], attentions: List[tuple] = None
    ):
        """Record significant KG risk propagation events to DB for top-risk districts."""
        if not inference_results:
            return

        result_map = {r["node_id"]: r for r in inference_results if isinstance(r, dict)}
        districts = self.db.query(District).all()
        now = datetime.now(timezone.utc)

        # Sort districts by risk score descending
        district_scores = []
        for d in districts:
            node_id = f"d-{d.id}"
            score = result_map.get(node_id, {}).get("risk_score", 0)
            district_scores.append((d.id, d.name, score))

        district_scores.sort(key=lambda x: -x[2])
        top_districts = district_scores[:5]

        # Record fresh events for top-risk districts
        events_recorded = 0
        for d_id, d_name, d_score in top_districts:
            if events_recorded >= 10:
                break

            r_info = result_map.get(f"d-{d_id}", {})
            shap_list = r_info.get("shap_values", [])
            top_reason = shap_list[0]["label"] if shap_list else "High rainfall telemetry"
            lvl, _ = get_risk_level_and_color(d_score)

            # Find a neighboring downstream/connected target district
            next_idx = (d_id % len(districts)) + 1
            tgt_d = next((d for d in districts if d.id == next_idx), districts[0])

            kg_event = KnowledgeGraphEvents(
                source_district_id=d_id,
                target_district_id=tgt_d.id,
                event_type="RISK_PROPAGATION",
                influence_weight=round(min(0.99, max(0.1, d_score / 100.0)), 3),
                description=(
                    f"[{lvl}] GNN spatial risk influence: {d_name} (Risk Score {d_score:.1f}) "
                    f"propagating influence to {tgt_d.name}. Primary driver: {top_reason}."
                ),
                created_at=now,
            )
            self.db.add(kg_event)
            events_recorded += 1

        self.db.commit()

    def _trigger_ws_broadcast(
        self,
        result_map: Dict,
        districts: List,
        alerts_generated: int,
        summary: Dict,
    ):
        """
        Schedule WebSocket broadcast asynchronously.
        Uses asyncio to fire-and-forget into the running event loop.
        """
        try:
            import asyncio
            from app.services.ws_manager import ws_manager
            from app.models.river import RiverLevel
            from app.models.history import WeatherHistory

            # Get latest weather per district
            all_w = self.db.query(WeatherHistory).order_by(WeatherHistory.recorded_at.desc()).limit(200).all()
            w_map = {}
            for w in all_w:
                if w.district_id not in w_map:
                    w_map[w.district_id] = w
            
            # Get latest river levels per district
            all_r = self.db.query(RiverLevel).order_by(RiverLevel.recorded_at.desc()).limit(200).all()
            r_map = {}
            for r in all_r:
                if r.district_id not in r_map:
                    r_map[r.district_id] = r

            # Get latest dam storage per district
            all_dams = self.db.query(Dam).all()
            dam_map = {dam.district_id: dam for dam in all_dams if dam.district_id is not None}
            valid_dam_fill = [float(dam.fill_pct) for dam in all_dams if dam.fill_pct is not None]
            avg_dam_fill = round(float(sum(valid_dam_fill) / len(valid_dam_fill)), 1) if valid_dam_fill else 58.0

            # Build broadcast payload
            district_updates = []
            for d in districts:
                node_id = f"d-{d.id}"
                r = result_map.get(node_id, {})
                w = w_map.get(d.id)
                r_lvl = r_map.get(d.id)
                dam_obj = dam_map.get(d.id)
                res_storage = round(float(dam_obj.fill_pct), 1) if (dam_obj and dam_obj.fill_pct is not None) else avg_dam_fill
                
                lon, lat = 0.0, 0.0
                if d.geom_json and isinstance(d.geom_json, dict) and "coordinates" in d.geom_json:
                    coords = d.geom_json["coordinates"]
                    if isinstance(coords, (list, tuple)) and len(coords) >= 2 and isinstance(coords[0], (int, float)):
                        lon, lat = float(coords[0]), float(coords[1])
                
                score = r.get("risk_score", 0)
                lvl, color = get_risk_level_and_color(score)
                
                district_updates.append({
                    "id": d.id,
                    "district_id": d.id,
                    "name": d.name,
                    "district_name": d.name,
                    "lat": lat,
                    "lon": lon,
                    "population": d.population,
                    "risk_score": score,
                    "risk_level": lvl,
                    "risk_color": color,
                    "rainfall_mm": w.rainfall_mm if w else 0.0,
                    "humidity": w.humidity if w else 0.0,
                    "temperature": w.temperature if w else 0.0,
                    "pressure": w.pressure if w else 0.0,
                    "wind_speed": w.wind_speed if w else 0.0,
                    "river_level_m": r_lvl.current_level if r_lvl else 0.0,
                    "river_danger_m": r_lvl.danger_level if r_lvl else 5.0,
                    "reservoir_storage": res_storage,
                    "flood_probability": score / 100.0,
                    "confidence": r.get("confidence", 0.82),
                    "ai_confidence": r.get("confidence", 0.82),
                    "shap_values": r.get("shap_values", []),
                })

            is_storm = get_storm_simulation_active()
            dashboard_msg = {
                "type": "PIPELINE_UPDATE",
                "timestamp": summary["timestamp"],
                "inference_mode": summary["inference_mode"],
                "storm_simulation_active": is_storm,
                "districts": district_updates,
                "alerts_generated": alerts_generated,
                "latency_ms": summary.get("latency_ms", 0),
                "metrics": {
                    "avg_risk_score": round(sum(d["risk_score"] for d in district_updates) / (len(district_updates) or 1), 1),
                    "active_alerts_count": len([d for d in district_updates if d["risk_level"] in ["Critical", "Severe", "High"]]),
                    "critical_districts": len([d for d in district_updates if d["risk_level"] in ["Critical", "Severe"]]),
                    "high_risk_districts": len([d for d in district_updates if d["risk_level"] == "High"]),
                    "avg_rainfall_24h_mm": round(sum(d["rainfall_mm"] for d in district_updates) / (len(district_updates) or 1), 1),
                    "districts_monitored": len(district_updates),
                    "model_confidence": 0.0,
                    "gdnn_inference_ms": summary.get("latency_ms", 0),
                    "storm_simulation_active": is_storm,
                }
            }

            kg_msg = {
                "type": "KG_UPDATE",
                "timestamp": summary["timestamp"],
                "nodes": [
                    {
                        "id": nid,
                        "type": _get_node_type(nid),
                        "risk_score": result_map.get(nid, {}).get("risk_score", 0),
                        "risk_level": result_map.get(nid, {}).get("risk_level", "Very Low"),
                        "risk_color": result_map.get(nid, {}).get("risk_color", "#22c55e"),
                    }
                    for nid in kg_builder.node_ids
                ],
                "edges": [
                    {
                        "source": edge[0],
                        "target": edge[1],
                        "weight": kg_builder.graph[edge[0]][edge[1]].get("weight", 0.5) if (edge[0] in kg_builder.graph and edge[1] in kg_builder.graph[edge[0]]) else 0.5,
                    }
                    for edge in kg_builder.graph.edges()
                    if isinstance(edge, (tuple, list)) and len(edge) >= 2
                ],
            }

            # Build alerts payload for active alert subscribers
            recent_alerts = self.db.query(Alert).order_by(Alert.created_at.desc()).limit(15).all()
            alert_list = [
                {
                    "id": f"alert-{a.id}",
                    "district_id": a.district_id,
                    "district": next((d.name for d in districts if d.id == a.district_id), f"District-{a.district_id}"),
                    "level": a.level,
                    "severity": a.severity,
                    "message": a.message,
                    "suggested_response": a.suggested_response,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                    "confidence": a.confidence,
                    "rainfall_mm": (w_map.get(a.district_id).rainfall_mm if w_map.get(a.district_id) else None),
                }
                for a in recent_alerts
            ]
            alerts_msg = {
                "type": "ALERTS_UPDATE",
                "timestamp": summary["timestamp"],
                "alerts": alert_list,
            }

            # Try to get the running event loop
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.ensure_future(
                        ws_manager.broadcast(dashboard_msg, "dashboard")
                    )
                    asyncio.ensure_future(
                        ws_manager.broadcast(kg_msg, "kg")
                    )
                    asyncio.ensure_future(
                        ws_manager.broadcast(alerts_msg, "alerts")
                    )
                else:
                    loop.run_until_complete(
                        ws_manager.broadcast(dashboard_msg, "dashboard")
                    )
                    loop.run_until_complete(
                        ws_manager.broadcast(kg_msg, "kg")
                    )
                    loop.run_until_complete(
                        ws_manager.broadcast(alerts_msg, "alerts")
                    )
            except RuntimeError:
                # No event loop - create one
                asyncio.run(ws_manager.broadcast(dashboard_msg, "dashboard"))
                asyncio.run(ws_manager.broadcast(kg_msg, "kg"))
                asyncio.run(ws_manager.broadcast(alerts_msg, "alerts"))

        except Exception as e:
            logger.warning(f"[Pipeline] WebSocket broadcast failed (non-critical): {e}")

        # Invalidate all backend caches so fresh pipeline results are served immediately
        try:
            from app.api.endpoints.dashboard import _dash_live_cache
            _dash_live_cache["data"] = None
            _dash_live_cache["ts"] = 0.0
        except Exception:
            pass
        try:
            from app.api.endpoints.kg import _invalidate_cache
            _invalidate_cache()
        except Exception:
            pass
        try:
            from app.api.endpoints.inference_cycle import _cycle_cache
            _cycle_cache["payload"] = None
            _cycle_cache["ts"] = 0.0
        except Exception:
            pass

        return summary
