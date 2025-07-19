from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional

class AttendanceBase(BaseModel):
    student_id: str
    class_id: str
    attendance_date: Optional[date] = None
    status: str = Field(..., description="present, absent, late, excused")
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    branch_id: Optional[str] = None

class AttendanceCreate(AttendanceBase):
    pass

class Attendance(AttendanceBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
