from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
import logging

import app.db.base
from app.db.session import SessionLocal
from app.models.logs import SchedulerLog
from app.services.orchestrator import RealtimeOrchestrator

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def job_run_orchestrator():
    db = SessionLocal()
    try:
        orc = RealtimeOrchestrator(db)
        orc.run_pipeline()
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
    finally:
        db.close()

def init_scheduler():
    if not scheduler.running:
        logger.info("Initializing APScheduler for Real-Time Pipeline...")
        
        # Add Jobs (Tick every 60 seconds)
        scheduler.add_job(
            job_run_orchestrator,
            trigger=IntervalTrigger(minutes=1),
            id="realtime_pipeline",
            name="End-to-End Flood Intelligence Pipeline",
            replace_existing=True
        )
        
        scheduler.start()
        
        # Log to DB
        db = SessionLocal()
        try:
            log = SchedulerLog(event="STARTED", message="Real-time pipeline initialized (60s tick).")
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log scheduler start: {e}")
        finally:
            db.close()

def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
        
        db = SessionLocal()
        try:
            log = SchedulerLog(event="STOPPED", message="APScheduler shutdown gracefully.")
            db.add(log)
            db.commit()
        except:
            pass
        finally:
            db.close()
