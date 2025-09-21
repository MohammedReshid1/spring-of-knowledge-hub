from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from .school_class import SchoolClass

class StudentBase(BaseModel):
    student_id: str = Field(..., description="Unique student identifier")
    first_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(None, description="Male, Female, M, F")
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_info: Optional[str] = None
    previous_school: Optional[str] = None
    grade_level: str
    class_id: Optional[str] = None
    admission_date: Optional[date] = None
    parent_guardian_id: Optional[str] = None
    father_name: Optional[str] = None
    grandfather_name: Optional[str] = None
    mother_name: Optional[str] = None
    photo_url: Optional[str] = None
    current_class: Optional[str] = None
    current_section: Optional[str] = None
    status: Optional[str] = Field(default="Active")
    phone_secondary: Optional[str] = None
    birth_certificate_url: Optional[str] = None
    id_card: Optional[str] = None
    previous_report_card: Optional[str] = None
    immunization_record: Optional[str] = None
    health_policy: Optional[str] = None
    other_document: Optional[str] = None
    branch_id: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class Student(StudentBase):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    classes: Optional[SchoolClass] = None

    class Config:
        orm_mode = True

class StudentUpdate(BaseModel):
    student_id: Optional[str] = None
    first_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    medical_info: Optional[str] = None
    previous_school: Optional[str] = None
    grade_level: Optional[str] = None
    class_id: Optional[str] = None
    admission_date: Optional[date] = None
    parent_guardian_id: Optional[str] = None
    father_name: Optional[str] = None
    grandfather_name: Optional[str] = None
    mother_name: Optional[str] = None
    photo_url: Optional[str] = None
    current_class: Optional[str] = None
    current_section: Optional[str] = None
    status: Optional[str] = None
    phone_secondary: Optional[str] = None
    birth_certificate_url: Optional[str] = None
    id_card: Optional[str] = None
    previous_report_card: Optional[str] = None
    immunization_record: Optional[str] = None
    health_policy: Optional[str] = None
    other_document: Optional[str] = None
    branch_id: Optional[str] = None

    class Config:
        orm_mode = True
