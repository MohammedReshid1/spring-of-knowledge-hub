from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class PaymentDetailBase(BaseModel):
    payment_id: str = Field(..., description="Reference to parent payment document")
    fee_category_id: str = Field(..., description="Reference to fee category")
    fee_category_name: str = Field(..., description="Fee category name (denormalized for receipts)")

    # Amount details
    original_amount: Decimal = Field(..., ge=0, description="Original fee amount")
    discount_amount: Decimal = Field(default=Decimal("0"), ge=0, description="Discount applied to this fee")
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100, description="Discount percentage")
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, description="Tax amount for this fee")
    late_fee_amount: Decimal = Field(default=Decimal("0"), ge=0, description="Late fee if applicable")
    paid_amount: Decimal = Field(..., ge=0, description="Final amount paid for this fee")

    # Additional details
    quantity: int = Field(default=1, gt=0, description="Quantity (for items like books)")
    unit_price: Optional[Decimal] = Field(None, ge=0, description="Unit price if quantity > 1")
    remarks: Optional[str] = Field(None, description="Specific remarks for this fee item")

    # Period information
    period_start: Optional[datetime] = Field(None, description="Start of period this fee covers")
    period_end: Optional[datetime] = Field(None, description="End of period this fee covers")

    branch_id: str = Field(..., description="Branch identifier for data isolation")

class PaymentDetailCreate(PaymentDetailBase):
    pass

class PaymentDetail(PaymentDetailBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
        json_encoders = {
            Decimal: str
        }

class PaymentDetailUpdate(BaseModel):
    discount_amount: Optional[Decimal] = Field(None, ge=0)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    remarks: Optional[str] = None

    class Config:
        json_encoders = {
            Decimal: str
        }

class PaymentDetailSummary(BaseModel):
    """Summary of payment details for a payment"""
    payment_id: str
    total_items: int
    fee_categories: List[str]
    total_original: Decimal
    total_discount: Decimal
    total_tax: Decimal
    total_late_fees: Decimal
    total_paid: Decimal

    class Config:
        json_encoders = {
            Decimal: str
        }

class FeeItemCreate(BaseModel):
    """Simplified fee item for payment creation"""
    fee_category_id: str
    amount: Decimal = Field(..., gt=0)
    quantity: int = Field(default=1, gt=0)
    discount_amount: Optional[Decimal] = Field(default=Decimal("0"), ge=0)
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    remarks: Optional[str] = None

    class Config:
        json_encoders = {
            Decimal: str
        }

class PaymentWithDetails(BaseModel):
    """Complete payment information with details"""
    payment: 'Payment'
    details: List[PaymentDetail]
    summary: PaymentDetailSummary

    class Config:
        json_encoders = {
            Decimal: str
        }

# Import Payment model to avoid circular dependency issues
from .payment import Payment