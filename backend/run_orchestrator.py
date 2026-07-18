import logging
import app.db.base
from app.db.session import SessionLocal
from app.services.orchestrator import RealtimeOrchestrator
import sys
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    db = SessionLocal()
    try:
        logger.info("Manually triggering RealtimeOrchestrator pipeline...")
        orc = RealtimeOrchestrator(db)
        orc.run_pipeline()
        logger.info("Pipeline executed successfully.")
    except Exception as e:
        logger.error(f"Pipeline error: {e}")
        sys.exit(1)
    finally:
        db.close()
