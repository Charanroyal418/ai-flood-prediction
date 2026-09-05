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
        from app.services.orchestrator import RealtimeOrchestrator
        orc = RealtimeOrchestrator(db)
        orc.run_pipeline()
    except Exception as e:
        logger.error(f"Pipeline background execution error: {e}")
    finally:
        db.close()

def init_scheduler():
    if not scheduler.running:
        logger.info("Initializing APScheduler for Real-Time Pipeline (20s interval)...")
        
        # Add Jobs (Tick every 20 seconds)
        scheduler.add_job(
            job_run_orchestrator,
            trigger=IntervalTrigger(seconds=20),
            id="realtime_pipeline",
            name="End-to-End Flood Intelligence Pipeline",
            replace_existing=True
        )
        
        scheduler.start()
        
        # Log to DB
        db = SessionLocal()
        try:
            log = SchedulerLog(event="STARTED", message="Real-time pipeline initialized (15m tick).")
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log scheduler start: {e}")
        finally:
            db.close()

def shutdown_scheduler():
    try:
        if scheduler.running:
            scheduler.shutdown(wait=False)
            
            db = SessionLocal()
            try:
                log = SchedulerLog(event="STOPPED", message="APScheduler shutdown gracefully.")
                db.add(log)
                db.commit()
            except Exception as e:
                logger.error(f"Failed to log scheduler shutdown: {e}")
            finally:
                db.close()
    except Exception as e:
        logger.warning(f"Scheduler shutdown error handled gracefully: {e}")
