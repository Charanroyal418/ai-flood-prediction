import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

# Shared properties
class UserBase(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str

# Properties to receive via API on update
class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None

# Properties to return via API
class UserResponse(UserBase):
    id: uuid.UUID
    role: str
    created_at: datetime

    class Config:
        from_attributes = True
