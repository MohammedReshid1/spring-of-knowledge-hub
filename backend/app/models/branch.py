from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class BranchBase(BaseModel):
    name: str
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_info: Optional[str] = None
    logo_url: Optional[str] = None
    established_date: Optional[str] = None
    is_active: bool = True

class BranchCreate(BranchBase):
    pass

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contact_info: Optional[str] = None
    logo_url: Optional[str] = None
    established_date: Optional[str] = None
    is_active: Optional[bool] = None

class Branch(BranchBase):
    id: str
    created_at: datetime
    updated_at: datetime
    status: str = "active"

    class Config:
        from_attributes = True
