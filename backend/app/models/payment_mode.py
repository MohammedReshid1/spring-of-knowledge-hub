from pydantic import BaseModel
from typing import Optional, Dict
from datetime import datetime

class PaymentModeBase(BaseModel):
    name: Optional[str] = None
    payment_type: Optional[str] = None
    payment_data: Optional[Dict] = None
    payment_id: str

class PaymentModeCreate(PaymentModeBase):
    pass

class PaymentMode(PaymentModeBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True
