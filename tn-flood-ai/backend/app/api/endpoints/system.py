from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import psutil
import time

from app.api import deps
from app.models.logs import EtlLog, SchedulerLog

router = APIRouter()
start_time = time.time()

@router.get("/status")
def get_system_status(db: Session = Depends(deps.get_db)) -> Any:
    """
    Returns server hardware health, scheduler status, and database metrics.
    """
    # System Hardware
    cpu_usage = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    # Uptime
    uptime_seconds = int(time.time() - start_time)
    
    # Scheduler Status
    last_scheduler_log = db.query(SchedulerLog).order_by(SchedulerLog.created_at.desc()).first()
    scheduler_running = last_scheduler_log.event == "STARTED" if last_scheduler_log else False
    
    # ETL Status
    last_etl = db.query(EtlLog).order_by(EtlLog.created_at.desc()).first()
    
    return {
        "hardware": {
            "cpu_percent": cpu_usage,
            "memory_percent": memory.percent,
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "disk_percent": disk.percent
        },
        "uptime_seconds": uptime_seconds,
        "scheduler_running": scheduler_running,
        "last_etl_job": {
            "pipeline": last_etl.pipeline_name if last_etl else None,
            "status": last_etl.status if last_etl else None,
            "execution_time_ms": last_etl.execution_time_ms if last_etl else None,
            "timestamp": last_etl.created_at if last_etl else None
        }
    }
