from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class SubjectBase(BaseModel):
    subject_name: str
    subject_code: str
    description: Optional[str] = None
    grade_levels: List[str] = Field(default_factory=list)

class SubjectCreate(SubjectBase):
    pass

class Subject(SubjectBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
