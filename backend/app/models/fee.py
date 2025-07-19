from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional

class FeeBase(BaseModel):
    student_id: Optional[str] = None
    fee_type: str
    amount: float
    due_date: date
    paid_date: Optional[date] = None
    status: str = "pending"
    academic_year: str
    branch_id: Optional[str] = None

class FeeCreate(FeeBase):
    pass

class Fee(FeeBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
