from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
import re

class StudentInfo(BaseModel):
    """Student information for payments"""
    id: str
    student_id: str
    first_name: str
    father_name: Optional[str] = None
    grandfather_name: Optional[str] = None
    photo_url: Optional[str] = None

class FeeCategoryInfo(BaseModel):
    """Fee category information for payments"""
    id: str
    name: str
    description: Optional[str] = None

class PaymentBase(BaseModel):
    # Map to existing database fields
    receipt_number: Optional[str] = Field(None, description="Unique receipt number")
    payment_id: Optional[str] = Field(None, description="Payment ID")
    student_id: str = Field(..., description="Student ID reference")
    payment_date: datetime = Field(default_factory=datetime.now, description="Date and time of payment")
    academic_year: Optional[str] = Field(None, description="Academic year reference")
    semester: Optional[str] = Field(None, description="Term/semester reference")
    due_date: Optional[datetime] = Field(None, description="Due date for payment")

    # Amount fields (matching existing database structure)
    amount: Decimal = Field(..., ge=0, description="Payment amount")
    currency: Optional[str] = Field(default="USD", description="Currency code")
    discount_amount: Optional[Decimal] = Field(None, ge=0, description="Total discount applied")
    discount_percentage: Optional[Decimal] = Field(None, ge=0, le=100, description="Discount percentage")
    discount_reason: Optional[str] = Field(None, description="Reason for discount")
    tax_amount: Optional[Decimal] = Field(None, ge=0, description="Total tax amount")
    late_fee_amount: Optional[Decimal] = Field(None, ge=0, description="Late payment penalty")

    # Payment category and description
    category: Optional[str] = Field(None, description="Payment category (tuition, fees, etc.)")
    description: Optional[str] = Field(None, description="Payment description")

    # Payment details (updated to match actual database values)
    payment_method: Literal["cash", "card", "bank_transfer", "check", "mobile_money"] = Field(
        ...,
        description="Payment method used"
    )
    payment_reference: Optional[str] = Field(None, description="External payment reference (transaction ID, cheque number, etc.)")
    payment_gateway: Optional[str] = Field(None, description="Payment gateway used for online payments")

    # Bank/Card details (optional)
    bank_name: Optional[str] = Field(None, description="Bank name for transfers/cheques")
    cheque_number: Optional[str] = Field(None, description="Cheque number if applicable")
    cheque_date: Optional[date] = Field(None, description="Cheque date if applicable")
    card_last_four: Optional[str] = Field(None, max_length=4, description="Last 4 digits of card")

    # Status and metadata (updated to match actual database values)
    status: Literal["pending", "completed", "overdue", "partial", "refunded", "partial_refund"] = Field(
        default="pending",
        description="Payment status"
    )
    verification_status: Literal["unverified", "verified", "rejected"] = Field(
        default="unverified",
        description="Payment verification status"
    )
    verified_by: Optional[str] = Field(None, description="User who verified the payment")
    verified_at: Optional[datetime] = Field(None, description="Verification timestamp")

    # Notes and remarks
    remarks: Optional[str] = Field(None, description="Additional payment remarks")
    internal_notes: Optional[str] = Field(None, description="Internal notes (not shown on receipt)")

    # Parent/Guardian info
    payer_name: Optional[str] = Field(None, description="Name of person making the payment")
    payer_phone: Optional[str] = Field(None, description="Contact number of payer")
    payer_email: Optional[str] = Field(None, description="Email of payer")

    # Additional fields from database
    fee_template_id: Optional[str] = Field(None, description="Fee template reference")

    # Cancellation/Refund info
    cancellation_reason: Optional[str] = Field(None, description="Reason for cancellation")
    cancelled_by: Optional[str] = Field(None, description="User who cancelled the payment")
    cancelled_at: Optional[datetime] = Field(None, description="Cancellation timestamp")
    refund_amount: Optional[Decimal] = Field(None, ge=0, description="Amount refunded")
    refund_date: Optional[datetime] = Field(None, description="Refund date")
    refund_reference: Optional[str] = Field(None, description="Refund transaction reference")

    branch_id: str = Field(..., description="Branch identifier for data isolation")

    @field_validator('receipt_number')
    def validate_receipt_number(cls, v):
        # Receipt number is optional in existing data
        if v and not re.match(r'^[A-Z]+-\d{4}-\d{6}$', v):
            # If not matching the pattern, just return as is for now
            return v
        return v

    @field_validator('card_last_four')
    def validate_card_digits(cls, v):
        if v and not v.isdigit():
            raise ValueError('Card last four must contain only digits')
        return v

class PaymentCreate(PaymentBase):
    # Override to make receipt_number optional during creation (will be auto-generated)
    receipt_number: Optional[str] = None
    payment_id: Optional[str] = None

class Payment(PaymentBase):
    id: str = Field(..., alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = Field(None, description="User who created this payment")
    updated_by: Optional[str] = Field(None, description="User who last updated this payment")

    # Populated information
    student: Optional[StudentInfo] = Field(None, description="Student information")
    fee_category: Optional[FeeCategoryInfo] = Field(None, description="Fee category information")

    # Computed fields
    is_late_payment: Optional[bool] = Field(None, description="Whether this was a late payment")
    days_overdue: Optional[int] = Field(None, description="Number of days payment was overdue")

    class Config:
        populate_by_name = True
        json_encoders = {
            Decimal: str
        }

class PaymentUpdate(BaseModel):
    payment_date: Optional[datetime] = None
    payment_method: Optional[Literal["cash", "card", "bank_transfer", "check", "mobile_money"]] = None
    payment_reference: Optional[str] = None
    bank_name: Optional[str] = None
    cheque_number: Optional[str] = None
    cheque_date: Optional[date] = None
    status: Optional[Literal["pending", "completed", "overdue", "partial", "refunded", "partial_refund"]] = None
    verification_status: Optional[Literal["unverified", "verified", "rejected"]] = None
    remarks: Optional[str] = None
    internal_notes: Optional[str] = None
    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[str] = None

    class Config:
        json_encoders = {
            Decimal: str
        }

class PaymentSummary(BaseModel):
    """Summary of payments for reporting"""
    total_payments: int
    total_amount: Decimal
    total_discount: Optional[Decimal] = None
    total_tax: Optional[Decimal] = None
    total_late_fees: Optional[Decimal] = None
    payment_methods: dict[str, int]  # Count by payment method
    status_breakdown: dict[str, int]  # Count by status

    class Config:
        json_encoders = {
            Decimal: str
        }

class BulkPaymentCreate(BaseModel):
    """For bulk payment imports"""
    payments: List[PaymentCreate]
    skip_validation: bool = Field(default=False, description="Skip validation for faster imports")
    notify_parents: bool = Field(default=False, description="Send notifications to parents")