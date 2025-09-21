from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class ParentBase(BaseModel):
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    father_email: Optional[EmailStr] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None
    mother_email: Optional[EmailStr] = None
    mother_occupation: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[EmailStr] = None
    guardian_relationship: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    branch_id: Optional[str] = None

class ParentCreate(ParentBase):
    student_ids: List[str] = Field(default_factory=list, description="List of student IDs linked to this parent")

class Parent(ParentBase):
    id: str
    student_ids: List[str] = Field(default_factory=list)
    user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class ParentUpdate(BaseModel):
    father_name: Optional[str] = None
    father_phone: Optional[str] = None
    father_email: Optional[EmailStr] = None
    father_occupation: Optional[str] = None
    mother_name: Optional[str] = None
    mother_phone: Optional[str] = None
    mother_email: Optional[EmailStr] = None
    mother_occupation: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_email: Optional[EmailStr] = None
    guardian_relationship: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relationship: Optional[str] = None
    student_ids: Optional[List[str]] = None
    branch_id: Optional[str] = None

    class Config:
        orm_mode = True