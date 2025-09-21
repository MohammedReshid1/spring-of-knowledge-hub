from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class GradeTransitionBase(BaseModel):
    academic_year: str
    transition_date: date
    students_transitioned: int = 0
    students_graduated: int = 0
    performed_by: Optional[str] = None
    notes: Optional[str] = None

class GradeTransitionCreate(GradeTransitionBase):
    pass

class GradeTransition(GradeTransitionBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
