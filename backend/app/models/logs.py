import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class EtlLog(Base):
    __tablename__ = "etl_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pipeline_name = Column(String, index=True, nullable=False)
    status = Column(String, nullable=False) # SUCCESS, FAILED
    records_processed = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class SchedulerLog(Base):
    __tablename__ = "scheduler_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event = Column(String, nullable=False) # STARTED, STOPPED, ERROR
    message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ApiLog(Base):
    __tablename__ = "api_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    endpoint = Column(String, index=True, nullable=False)
    method = Column(String, nullable=False)
    status_code = Column(Integer, nullable=False)
    response_time_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
