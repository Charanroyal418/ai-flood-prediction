import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from geoalchemy2 import Geometry
from sqlalchemy.dialects.postgresql import UUID
from app.db.base_class import Base

class Report(Base):
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("user.id"), nullable=False)
    location = Column(Geometry('POINT', srid=4326), nullable=True)
    issue_type = Column(String, nullable=False) # Waterlogging, RoadBlock
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    reported_at = Column(DateTime, default=datetime.utcnow, index=True)
