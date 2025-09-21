from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SchoolClassBase(BaseModel):
    grade_level_id: str
    class_name: str
    max_capacity: int = 25
    current_enrollment: int = 0
    teacher_id: Optional[str] = None
    academic_year: str
    branch_id: Optional[str] = None
    # New: support multiple teachers per class by subject
    subject_teachers: Optional[List[dict]] = Field(default_factory=list, description="List of {subject_id, teacher_id}")

class SchoolClassCreate(SchoolClassBase):
    pass

class SchoolClass(SchoolClassBase):
    id: str
    created_at: datetime
    updated_at: datetime
    student_ids: Optional[List[str]] = Field(default_factory=list)
    recent_students: Optional[List[dict]] = Field(default_factory=list)

    class Config:
        orm_mode = True

class SchoolClassUpdate(BaseModel):
    grade_level_id: Optional[str] = None
    class_name: Optional[str] = None
    max_capacity: Optional[int] = None
    teacher_id: Optional[str] = None
    academic_year: Optional[str] = None
    branch_id: Optional[str] = None
    subject_teachers: Optional[List[dict]] = None

    class Config:
        orm_mode = True
