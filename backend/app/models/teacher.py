from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime

class TeacherBase(BaseModel):
    teacher_id: str = Field(..., description="Unique teacher identifier")
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, description="Male, Female, M, F")
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = None
    specialization: Optional[str] = None
    joining_date: Optional[date] = None
    salary: Optional[float] = None
    status: Optional[str] = Field(default="Active")
    branch_id: Optional[str] = None
    photo_url: Optional[str] = None
    subjects: Optional[List[str]] = Field(default_factory=list)
    classes: Optional[List[str]] = Field(default_factory=list)
    employee_id: Optional[str] = None
    department: Optional[str] = None
    blood_group: Optional[str] = None
    nationality: Optional[str] = None
    marital_status: Optional[str] = None
    notes: Optional[str] = None

class TeacherCreate(TeacherBase):
    pass

class Teacher(TeacherBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True