from pydantic import BaseModel, Field
from datetime import datetime

class GradeLevelBase(BaseModel):
    grade: str
    max_capacity: int = 30
    current_enrollment: int = 0

class GradeLevelCreate(GradeLevelBase):
    pass

class GradeLevel(GradeLevelBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
