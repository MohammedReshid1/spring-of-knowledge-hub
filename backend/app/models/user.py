from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = Field(default="student")
    phone: Optional[str] = None
    branch_id: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class User(UserBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
