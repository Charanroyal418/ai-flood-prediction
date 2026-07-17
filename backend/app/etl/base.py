import time
import logging
from abc import ABC, abstractmethod
from sqlalchemy.orm import Session
from app.models.logs import EtlLog

logger = logging.getLogger(__name__)

class BaseETLPipeline(ABC):
    """
    Abstract Base Class for all ETL pipelines.
    Enforces the Extract -> Validate -> Transform -> Load -> Log pattern.
    """
    def __init__(self, db: Session, pipeline_name: str):
        self.db = db
        self.pipeline_name = pipeline_name
        self.records_processed = 0
        self.start_time = time.time()

    @abstractmethod
    def extract(self):
        pass

    @abstractmethod
    def validate(self, raw_data):
        pass

    @abstractmethod
    def transform(self, valid_data):
        pass

    @abstractmethod
    def load(self, transformed_data):
        pass

    def execute(self):
        logger.info(f"Starting ETL Pipeline: {self.pipeline_name}")
        error_msg = None
        status = "SUCCESS"
        
        try:
            raw = self.extract()
            valid = self.validate(raw)
            transformed = self.transform(valid)
            self.load(transformed)
        except Exception as e:
            logger.error(f"ETL Pipeline {self.pipeline_name} failed: {e}")
            error_msg = str(e)
            status = "FAILED"
            self.db.rollback()
        finally:
            self._log_execution(status, error_msg)

    def _log_execution(self, status: str, error_msg: str):
        execution_time = int((time.time() - self.start_time) * 1000)
        log_entry = EtlLog(
            pipeline_name=self.pipeline_name,
            status=status,
            records_processed=self.records_processed,
            error_message=error_msg,
            execution_time_ms=execution_time
        )
        try:
            self.db.add(log_entry)
            self.db.commit()
            logger.info(f"ETL {self.pipeline_name} finished in {execution_time}ms [{status}]")
        except Exception as e:
            logger.critical(f"Failed to write ETL log to database: {e}")
            self.db.rollback()
