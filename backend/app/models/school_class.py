from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SchoolClassBase(BaseModel):
    grade_level_id: str
    class_name: str
    max_capacity: int = 25
    current_enrollment: int = 0
    teacher_id: Optional[str] = None
    academic_year: str
    branch_id: Optional[str] = None

class SchoolClassCreate(SchoolClassBase):
    pass

class SchoolClass(SchoolClassBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
