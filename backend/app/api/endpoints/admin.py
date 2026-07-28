"""
Admin Management Endpoints
============================
Provides administrative control over the FloodSense AI platform.

All endpoints require Admin role (JWT).

Endpoints:
  POST /admin/etl/run           — Trigger weather ETL manually
  POST /admin/ml/retrain-gnn    — Retrain GAT+GRU model
  GET  /admin/ml/metrics        — Get model performance metrics
  POST /admin/ml/retrain        — Retrain legacy XGBoost model
  GET  /admin/logs              — View system logs
  GET  /admin/pipeline/status   — Pipeline health and last run time
  POST /admin/pipeline/reset    — Reset pipeline caches
  GET  /admin/system/stats      — System resource usage
"""
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api import deps
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.district import District
from app.models.history import (
    WeatherHistory,
    ModelInference,
    KnowledgeGraphEvents,
    PredictionHistory,
)
from app.models.logs import SchedulerLog

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Background Task Trackers ──────────────────────────────────────────────────
_etl_status: Dict[str, Any] = {"running": False, "last_run": None, "result": None}
_gnn_train_status: Dict[str, Any] = {
    "running": False, "last_run": None, "result": None, "progress": None
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _run_etl_task():
    """Background: run the full weather ETL pipeline."""
    global _etl_status
    _etl_status["running"] = True
    db = SessionLocal()
    try:
        from app.etl.weather import WeatherETL
        pipeline = WeatherETL(db)
        pipeline.execute()
        _etl_status["result"] = {
            "status": "success",
            "records_processed": pipeline.records_processed,
        }
        logger.info(f"[Admin] ETL completed: {pipeline.records_processed} records")
    except Exception as e:
        _etl_status["result"] = {"status": "error", "error": str(e)}
        logger.error(f"[Admin] ETL failed: {e}")
    finally:
        db.close()
        _etl_status["running"] = False
        _etl_status["last_run"] = datetime.now(timezone.utc).isoformat()


def _run_gnn_train_task(n_snapshots: int = 150):
    """Background: retrain the GAT+GRU model."""
    global _gnn_train_status
    _gnn_train_status["running"] = True
    _gnn_train_status["progress"] = {"stage": "starting", "pct": 0}

    def progress_cb(data: dict):
        _gnn_train_status["progress"] = data

    try:
        from app.ml.train_gnn import train_gnn
        metrics = train_gnn(n_snapshots=n_snapshots, progress_callback=progress_cb)
        _gnn_train_status["result"] = {"status": "success", "metrics": metrics}
        logger.info(f"[Admin] GNN training complete: accuracy={metrics.get('accuracy'):.1%}")

        # Reload the inference engine singleton with new weights
        try:
            from app.ml.inference import GNNInferenceEngine
            GNNInferenceEngine._instance = None
            GNNInferenceEngine._model = None
            GNNInferenceEngine._model_loaded = False
            _ = GNNInferenceEngine()
            logger.info("[Admin] GNN inference engine reloaded with new weights")
        except Exception as e:
            logger.warning(f"[Admin] Could not hot-reload GNN engine: {e}")

    except Exception as e:
        _gnn_train_status["result"] = {"status": "error", "error": str(e)}
        logger.error(f"[Admin] GNN training failed: {e}")
    finally:
        _gnn_train_status["running"] = False
        _gnn_train_status["last_run"] = datetime.now(timezone.utc).isoformat()


def _run_xgboost_train_task():
    """Background: retrain legacy XGBoost/RF model."""
    db = SessionLocal()
    try:
        from app.ml.train import train_and_evaluate
        train_and_evaluate()
    except Exception as e:
        logger.error(f"[Admin] XGBoost training failed: {e}")
    finally:
        db.close()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/etl/run")
def trigger_etl(
    background_tasks: BackgroundTasks,
    _: dict = Depends(deps.require_admin),
):
    """Trigger the full weather ETL pipeline in the background."""
    if _etl_status["running"]:
        return {"message": "ETL pipeline already running.", "status": "running"}
    background_tasks.add_task(_run_etl_task)
    return {
        "message": "ETL pipeline started.",
        "status": "started",
        "last_run": _etl_status["last_run"],
    }


@router.get("/etl/status")
def get_etl_status(_: dict = Depends(deps.require_admin)):
    """Check ETL pipeline run status."""
    return _etl_status


@router.post("/ml/retrain-gnn")
def trigger_gnn_retrain(
    background_tasks: BackgroundTasks,
    n_snapshots: int = 150,
    _: dict = Depends(deps.require_admin),
):
    """Retrain the GAT+GRU model. n_snapshots controls dataset size (default: 150)."""
    if _gnn_train_status["running"]:
        return {
            "message": "GNN training already in progress.",
            "status": "running",
            "progress": _gnn_train_status["progress"],
        }
    if n_snapshots < 30 or n_snapshots > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="n_snapshots must be between 30 and 1000.",
        )
    background_tasks.add_task(_run_gnn_train_task, n_snapshots)
    return {
        "message": f"GNN retraining started with {n_snapshots} snapshots.",
        "status": "started",
    }


@router.get("/ml/retrain-gnn/status")
def get_gnn_train_status(_: dict = Depends(deps.require_admin)):
    """Check GNN training progress."""
    return _gnn_train_status


@router.get("/ml/metrics")
def get_model_metrics(_: dict = Depends(deps.require_admin)):
    """Get latest GNN model performance metrics."""
    metrics_path = Path(settings.MODEL_DIR) / "gnn_metrics.json"
    if not metrics_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No model metrics found. Train the model first.",
        )
    with open(metrics_path) as f:
        metrics = json.load(f)

    # Check if model weights exist
    model_path = Path(settings.GNN_MODEL_PATH)
    metrics["model_file_exists"] = model_path.exists()
    metrics["model_file_size_kb"] = (
        round(model_path.stat().st_size / 1024, 1) if model_path.exists() else 0
    )

    # Get inference engine status
    try:
        from app.ml.inference import gnn_engine
        metrics["inference_mode"] = gnn_engine.inference_mode
        metrics["model_loaded"] = gnn_engine.is_trained
    except Exception:
        metrics["inference_mode"] = "Unknown"
        metrics["model_loaded"] = False

    return metrics


@router.post("/ml/retrain")
def trigger_xgboost_retrain(
    background_tasks: BackgroundTasks,
    _: dict = Depends(deps.require_admin),
):
    """Retrain legacy XGBoost model."""
    background_tasks.add_task(_run_xgboost_train_task)
    return {"message": "XGBoost retraining started."}


@router.get("/logs")
def get_system_logs(
    limit: int = 50,
    event_type: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    _: dict = Depends(deps.require_admin),
):
    """View system scheduler and pipeline logs."""
    query = db.query(SchedulerLog).order_by(SchedulerLog.created_at.desc())
    if event_type:
        query = query.filter(SchedulerLog.event == event_type)
    logs = query.limit(limit).all()

    return [
        {
            "id": log.id,
            "event": log.event,
            "message": log.message,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]


@router.get("/pipeline/status")
def get_pipeline_status(
    db: Session = Depends(deps.get_db),
    _: dict = Depends(deps.require_admin),
):
    """Get real-time pipeline health metrics."""
    latest_inf = (
        db.query(ModelInference).order_by(ModelInference.created_at.desc()).first()
    )
    latest_weather = (
        db.query(WeatherHistory).order_by(WeatherHistory.recorded_at.desc()).first()
    )
    latest_pred = (
        db.query(PredictionHistory).order_by(PredictionHistory.created_at.desc()).first()
    )
    kg_event_count = db.query(KnowledgeGraphEvents).count()
    district_count = db.query(District).count()
    prediction_count = db.query(PredictionHistory).count()
    weather_history_count = db.query(WeatherHistory).count()

    try:
        from app.ml.inference import gnn_engine
        inference_mode = gnn_engine.inference_mode
        model_loaded = gnn_engine.is_trained
    except Exception:
        inference_mode = "Unknown"
        model_loaded = False

    return {
        "pipeline": {
            "status": "running",
            "inference_mode": inference_mode,
            "model_loaded": model_loaded,
            "last_inference_at": latest_inf.created_at.isoformat() if latest_inf else None,
            "last_inference_ms": latest_inf.inference_time_ms if latest_inf else None,
            "last_weather_at": latest_weather.recorded_at.isoformat() if latest_weather else None,
            "last_prediction_at": latest_pred.created_at.isoformat() if latest_pred else None,
        },
        "database": {
            "districts": district_count,
            "predictions_total": prediction_count,
            "weather_records_total": weather_history_count,
            "kg_events_total": kg_event_count,
        },
        "etl": _etl_status,
        "gnn_training": _gnn_train_status,
    }


@router.post("/pipeline/reset")
def reset_pipeline_caches(_: dict = Depends(deps.require_admin)):
    """Force-invalidate all in-process caches to get fresh data on next request."""
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
        from app.api.endpoints.kg import _kg_cache
        _kg_cache["ts"] = 0.0
        _kg_cache["payload"] = None
    except Exception:
        pass
    return {"message": "All pipeline caches reset. Next request will fetch fresh data."}


@router.get("/system/stats")
def get_system_stats(_: dict = Depends(deps.require_admin)):
    """Get system resource usage."""
    import platform
    stats = {
        "platform": platform.system(),
        "python_version": sys.version.split()[0],
        "environment": settings.ENVIRONMENT,
    }
    try:
        import psutil
        stats["cpu_percent"] = psutil.cpu_percent(interval=0.1)
        stats["memory_mb"] = round(psutil.virtual_memory().used / 1024 / 1024, 1)
        stats["memory_total_mb"] = round(psutil.virtual_memory().total / 1024 / 1024, 1)
        stats["disk_gb"] = round(psutil.disk_usage("/").used / 1024 / 1024 / 1024, 2)
    except ImportError:
        stats["note"] = "psutil not installed; resource stats unavailable"
    return stats
