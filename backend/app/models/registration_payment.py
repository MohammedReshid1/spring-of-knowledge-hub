from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, Dict

class RegistrationPaymentBase(BaseModel):
    student_id: Optional[str] = None
    payment_status: str = Field(default="Unpaid")
    amount_paid: float = 0
    payment_date: Optional[date] = None
    academic_year: Optional[str] = None
    notes: Optional[str] = None
    payment_id: Optional[str] = None
    transaction_data: Optional[Dict] = None
    payment_cycle: str = Field(default="registration_fee")
    payment_method: str = Field(default="Cash")
    total_amount: float = 0
    payment_details: Optional[Dict] = None
    branch_id: Optional[str] = None

class RegistrationPaymentCreate(RegistrationPaymentBase):
    pass

class RegistrationPayment(RegistrationPaymentBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
