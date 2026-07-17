from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy.orm import Session
import logging

from app.db.session import SessionLocal
from app.models.logs import SchedulerLog
from app.etl.weather import WeatherETL

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()

def job_run_weather_etl():
    db = SessionLocal()
    try:
        pipeline = WeatherETL(db)
        pipeline.execute()
    finally:
        db.close()

def init_scheduler():
    if not scheduler.running:
        logger.info("Initializing APScheduler...")
        
        # Add Jobs
        scheduler.add_job(
            job_run_weather_etl,
            trigger=IntervalTrigger(minutes=15),
            id="weather_etl_15m",
            name="Fetch real-time weather",
            replace_existing=True
        )
        
        scheduler.start()
        
        # Log to DB
        db = SessionLocal()
        try:
            log = SchedulerLog(event="STARTED", message="APScheduler initialized with 1 job.")
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
