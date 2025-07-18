from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None
    contact_info: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool = True

class BranchCreate(BranchBase):
    pass

class Branch(BranchBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
