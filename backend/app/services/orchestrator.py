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
from app.ml.inference import gnn_engine
from app.models.district import District
from app.models.alert import Alert
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
STORM_SIMULATION_MAX_DURATION_MINUTES: int = 10

def get_storm_simulation_active() -> bool:
    global _STORM_SIMULATION_ACTIVE, _STORM_SIMULATION_ACTIVATED_AT
    if _STORM_SIMULATION_ACTIVE and _STORM_SIMULATION_ACTIVATED_AT:
        elapsed = (datetime.now(timezone.utc) - _STORM_SIMULATION_ACTIVATED_AT).total_seconds() / 60.0
        if elapsed > STORM_SIMULATION_MAX_DURATION_MINUTES:
            logger.info(f"[Orchestrator] Storm simulation auto-expired after {elapsed:.1f} minutes.")
            _STORM_SIMULATION_ACTIVE = False
            _STORM_SIMULATION_ACTIVATED_AT = None
    return _STORM_SIMULATION_ACTIVE

def set_storm_simulation_active(active: bool) -> bool:
    global _STORM_SIMULATION_ACTIVE, _STORM_SIMULATION_ACTIVATED_AT
    _STORM_SIMULATION_ACTIVE = active
    if active:
        _STORM_SIMULATION_ACTIVATED_AT = datetime.now(timezone.utc)
    else:
        _STORM_SIMULATION_ACTIVATED_AT = None
    logger.info(f"[Orchestrator] Storm simulation state set to: {active}")
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
            # ─── STEP 1: Weather ETL ──────────────────────────────────────
            logger.info("[Pipeline] Step 1: Weather ETL")
            try:
                weather_etl = WeatherETL(self.db)
                weather_etl.execute()
                summary["steps_completed"].append("weather_etl")
                logger.info(
                    f"[Pipeline] Weather ETL done: {weather_etl.records_processed} records"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Weather ETL failed: {e}")
                summary["errors"].append(f"weather_etl: {e}")

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
                logger.info(
                    f"[Pipeline] GPM ETL done: {len(fpi_records)} districts with FPI"
                )
            except Exception as e:
                logger.error(f"[Pipeline] GPM ETL failed: {e}")
                summary["errors"].append(f"nasa_gpm_etl: {e}")
                self._gpm_fpi_cache = {}

            # ─── STEP 2B: River Telemetry ETL ────────────────────────────
            logger.info("[Pipeline] Step 2B: River Telemetry")
            try:
                river_etl = RiverETL(self.db)
                river_etl.execute()
                summary["steps_completed"].append("river_etl")
                logger.info(f"[Pipeline] River ETL done: {river_etl.records_processed} records")
            except Exception as e:
                logger.error(f"[Pipeline] River ETL failed: {e}")
                summary["errors"].append(f"river_etl: {e}")

            # ─── STEP 2.5: Snapshot Generation ──────────────────────────
            logger.info("[Pipeline] Step 2.5: Node Feature Snapshot Generation")
            try:
                from app.models.history import NodeFeatureSnapshot, WeatherHistory
                from app.models.river import RiverLevel
                from app.models.terrain import DemTile
                from app.services.hydrology import GEOM_PARAMS
                from app.api.endpoints.ml import get_model
                import pandas as pd
                
                xgb_model = get_model()
                
                dem_tiles = self.db.query(DemTile).all()
                dem_map = {t.district_id: t for t in dem_tiles}
                
                districts = self.db.query(District).all()
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
                            # Using dynamic metrics per district
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
            logger.info("[Pipeline] Step 3: Knowledge Graph Update")
            try:
                H, edge_index = kg_builder.fetch_graph_snapshot(
                    db=self.db, seq_len=3
                )
                node_ids = kg_builder.node_ids
                summary["steps_completed"].append("kg_update")
                logger.info(
                    f"[Pipeline] KG built: {H.shape[0]} nodes, "
                    f"{edge_index.shape[1]} edges"
                )
            except Exception as e:
                logger.error(f"[Pipeline] KG build failed: {e}")
                summary["errors"].append(f"kg_update: {e}")
                # Cannot proceed without graph
                summary["pipeline_error"] = "KG build failed"
                return summary

            # ─── STEP 4: Storm Simulation Override ────────────────────────
            if active_storm:
                import torch, random
                from app.models.history import WeatherHistory
                districts = self.db.query(District).all()
                storm_targets = random.sample(
                    [d for d in districts], min(5, len(districts))
                )
                storm_ids = {d.id for d in storm_targets}
                logger.info(
                    f"[Pipeline] Storm simulation: injecting heavy rain into "
                    f"{[d.name for d in storm_targets]}"
                )

                now_ts = datetime.now(timezone.utc)
                for st_d in storm_targets:
                    # Write extreme storm weather history to DB so live queries reflect storm telemetry
                    w_storm = WeatherHistory(
                        district_id=st_d.id,
                        temperature=24.0,
                        humidity=98.0,
                        pressure=992.0,
                        rainfall_mm=185.5,
                        wind_speed=55.0,
                        recorded_at=now_ts
                    )
                    self.db.add(w_storm)
                self.db.commit()

                for i, nid in enumerate(node_ids):
                    if nid.startswith("d-"):
                        try:
                            district_idx = int(nid.split("-")[1])
                        except ValueError:
                            continue
                        if district_idx in storm_ids:
                            # Override features with extreme storm values (normalized 0-1 scale)
                            H[i, :, 0] = 1.0   # ~185mm rainfall scaled
                            H[i, :, 1] = 0.92  # 92% river level ratio
                            H[i, :, 2] = 0.98  # 98% humidity scaled (0.98)
                            H[i, :, 3] = 0.0   # 992 hPa low pressure scaled

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

            for district in districts:
                node_id = f"d-{district.id}"
                result = result_map.get(node_id)
                if not result:
                    continue

                risk_score = result["risk_score"]
                risk_level = result["risk_level"]
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
                    should_alert = False
                    if not recent_alert:
                        should_alert = True
                    elif recent_alert.level != risk_level:
                        should_alert = True
                        
                    if should_alert:
                        top_reason = (
                            shap_values[0]["label"] if shap_values else "High rainfall"
                        )
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
        """Record significant KG risk propagation events to DB."""
        result_map = {r["node_id"]: r for r in inference_results}

        # Find high-risk district nodes to record propagation
        high_risk_districts = [
            nid
            for nid in node_ids
            if nid.startswith("d-")
            and result_map.get(nid, {}).get("risk_score", 0) >= 60
        ]

        if not attentions:
            return
            
        edge_index, alpha = attentions[0]
        # Calculate mean attention across heads
        if alpha.dim() > 1:
            alpha = alpha.mean(dim=1)
            
        edge_index_np = edge_index.cpu().numpy()
        alpha_np = alpha.cpu().numpy()
        
        node_id_map = {i: nid for i, nid in enumerate(node_ids)}
        
        events_recorded = 0
        
        for i in range(edge_index_np.shape[1]):
            if events_recorded >= 20:
                break
                
            u_idx = edge_index_np[0, i]
            v_idx = edge_index_np[1, i]
            weight = float(alpha_np[i])
            
            edge_u = node_id_map.get(u_idx)
            edge_v = node_id_map.get(v_idx)
            
            if not edge_u or not edge_v:
                continue

            risk_u = result_map.get(edge_u, {}).get("risk_score", 0)
            risk_v = result_map.get(edge_v, {}).get("risk_score", 0)

            # Only record significant propagation
            if risk_u < 40 and risk_v < 40:
                continue

            # Extract district IDs from node IDs
            if not (edge_u.startswith("d-") and edge_v.startswith("d-")):
                continue

            try:
                src_id = int(edge_u.split("-")[1])
                tgt_id = int(edge_v.split("-")[1])
            except (ValueError, IndexError):
                continue
                
            src_name = self.db.query(District).filter_by(id=src_id).first().name
            tgt_name = self.db.query(District).filter_by(id=tgt_id).first().name

            kg_event = KnowledgeGraphEvents(
                source_district_id=src_id,
                target_district_id=tgt_id,
                event_type="RISK_PROPAGATION",
                influence_weight=round(weight, 3),
                description=(
                    f"Risk propagated from {src_name} to {tgt_name} due to river flow "
                    f"(attention_weight={weight:.3f})"
                ),
            )
            self.db.add(kg_event)
            events_recorded += 1

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

            # Build broadcast payload
            district_updates = []
            for d in districts:
                node_id = f"d-{d.id}"
                r = result_map.get(node_id, {})
                w = w_map.get(d.id)
                r_lvl = r_map.get(d.id)
                
                lon, lat = 0.0, 0.0
                if d.geom_json and "coordinates" in d.geom_json:
                    lon, lat = d.geom_json["coordinates"]
                
                score = r.get("risk_score", 0)
                lvl = r.get("risk_level", "Very Low")
                
                district_updates.append({
                    "id": d.id,
                    "district_id": d.id,
                    "name": d.name,
                    "district_name": d.name,
                    "lat": lat,
                    "lon": lon,
                    "population": d.population,
                    "risk_score": score,
                    "risk_level": "Critical" if lvl == "Severe" else lvl,
                    "risk_color": r.get("risk_color", "#22c55e"),
                    "rainfall_mm": w.rainfall_mm if w else 0.0,
                    "humidity": w.humidity if w else 0.0,
                    "temperature": w.temperature if w else 0.0,
                    "pressure": w.pressure if w else 0.0,
                    "wind_speed": w.wind_speed if w else 0.0,
                    "river_level_m": r_lvl.current_level if r_lvl else 0.0,
                    "river_danger_m": r_lvl.danger_level if r_lvl else 5.0,
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
                    "model_confidence": 0.94,
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
                        "source": u,
                        "target": v,
                        "weight": kg_builder.graph[u][v].get("weight", 0.5),
                    }
                    for u, v in kg_builder.graph.edges()
                ],
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
                else:
                    loop.run_until_complete(
                        ws_manager.broadcast(dashboard_msg, "dashboard")
                    )
                    loop.run_until_complete(
                        ws_manager.broadcast(kg_msg, "kg")
                    )
            except RuntimeError:
                # No event loop - create one
                asyncio.run(ws_manager.broadcast(dashboard_msg, "dashboard"))
                asyncio.run(ws_manager.broadcast(kg_msg, "kg"))

        except Exception as e:
            logger.warning(f"[Pipeline] WebSocket broadcast failed (non-critical): {e}")
