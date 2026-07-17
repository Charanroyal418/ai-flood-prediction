from pydantic import BaseModel, validator, Field
from typing import Optional
from datetime import datetime

class WeatherValidationSchema(BaseModel):
    temperature: Optional[float] = Field(None, ge=-10, le=60, description="Impossible temperature for TN")
    humidity: Optional[float] = Field(None, ge=0, le=100)
    pressure: Optional[float] = Field(None, ge=800, le=1100)
    rainfall_mm: Optional[float] = Field(None, ge=0, le=1000, description="Rainfall cannot be negative")
    recorded_at: Optional[datetime] = None

    @validator('recorded_at', pre=True, always=True)
    def check_not_in_future(cls, v):
        if v:
            # If timestamp is naive, assume UTC. Ensure it doesn't exceed current UTC + small buffer
            if isinstance(v, str):
                v = datetime.fromisoformat(v.replace("Z", "+00:00"))
            if v.timestamp() > datetime.utcnow().timestamp() + 300: # 5 min buffer
                raise ValueError("Timestamp cannot be in the future")
        return v
