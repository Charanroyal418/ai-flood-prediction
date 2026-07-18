from pydantic import BaseModel, field_validator, Field
from typing import Optional
from datetime import datetime, timezone

class WeatherValidationSchema(BaseModel):
    temperature: Optional[float] = Field(None, ge=-10, le=60, description="Impossible temperature for TN")
    humidity: Optional[float] = Field(None, ge=0, le=100)
    pressure: Optional[float] = Field(None, ge=800, le=1100)
    rainfall_mm: Optional[float] = Field(None, ge=0, le=1000, description="Rainfall cannot be negative")
    recorded_at: Optional[datetime] = None

    @field_validator('recorded_at', mode='before')
    @classmethod
    def check_not_in_future(cls, v):
        if v:
            # If timestamp is naive, assume UTC. Ensure it doesn't exceed current UTC + small buffer
            if isinstance(v, str):
                v = datetime.fromisoformat(v.replace("Z", "+00:00"))
            now_utc = datetime.now(timezone.utc).timestamp()
            if v.timestamp() > now_utc + 300: # 5 min buffer
                raise ValueError("Timestamp cannot be in the future")
        return v
