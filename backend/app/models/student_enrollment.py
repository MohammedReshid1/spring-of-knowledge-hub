from pydantic import BaseModel, Field
from datetime import datetime

class StudentEnrollmentBase(BaseModel):
    student_id: str
    subject_id: str
    academic_year: str
    enrolled_at: datetime = Field(default_factory=datetime.utcnow)

class StudentEnrollmentCreate(StudentEnrollmentBase):
    pass

class StudentEnrollment(StudentEnrollmentBase):
    id: str

    class Config:
        orm_mode = True
