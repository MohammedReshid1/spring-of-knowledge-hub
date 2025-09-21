from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from decimal import Decimal

class FeeCategoryBase(BaseModel):
    name: str = Field(..., description="Fee category name (e.g., Tuition, Books, Transportation)")
    arabic_name: Optional[str] = Field(None, description="Arabic name for the fee category")
    description: Optional[str] = Field(None, description="Detailed description of the fee")
    amount: Decimal = Field(..., gt=0, description="Fee amount")
    fee_type: Literal["mandatory", "optional", "recurring", "one-time"] = Field(
        ...,
        description="Type of fee"
    )
    frequency: Optional[Literal["monthly", "quarterly", "semi-annual", "annual", "one-time"]] = Field(
        None,
        description="Payment frequency for recurring fees"
    )
    grade_level_id: Optional[str] = Field(None, description="Grade level this fee applies to")
    academic_year_id: Optional[str] = Field(None, description="Academic year this fee is applicable for")
    due_date_offset: Optional[int] = Field(
        None,
        description="Days from enrollment/term start when payment is due"
    )
    late_fee_percentage: Optional[Decimal] = Field(
        None,
        ge=0,
        le=100,
        description="Late payment penalty percentage"
    )
    late_fee_grace_days: Optional[int] = Field(
        default=0,
        description="Grace period in days before late fee applies"
    )
    discount_eligible: bool = Field(
        default=True,
        description="Whether this fee is eligible for discounts"
    )
    tax_percentage: Optional[Decimal] = Field(
        None,
        ge=0,
        le=100,
        description="Tax percentage applicable on this fee"
    )
    priority: int = Field(
        default=1,
        ge=1,
        le=10,
        description="Priority order for fee display and processing"
    )
    is_active: bool = Field(default=True, description="Whether this fee category is currently active")
    branch_id: str = Field(..., description="Branch identifier for data isolation")

class FeeCategoryCreate(FeeCategoryBase):
    pass

class FeeCategory(FeeCategoryBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = Field(None, description="User ID who created this fee category")
    updated_by: Optional[str] = Field(None, description="User ID who last updated this fee category")

    class Config:
        populate_by_name = True
        json_encoders = {
            Decimal: str
        }

class FeeCategoryUpdate(BaseModel):
    name: Optional[str] = None
    arabic_name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = Field(None, gt=0)
    fee_type: Optional[Literal["mandatory", "optional", "recurring", "one-time"]] = None
    frequency: Optional[Literal["monthly", "quarterly", "semi-annual", "annual", "one-time"]] = None
    grade_level_id: Optional[str] = None
    academic_year_id: Optional[str] = None
    due_date_offset: Optional[int] = None
    late_fee_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    late_fee_grace_days: Optional[int] = None
    discount_eligible: Optional[bool] = None
    tax_percentage: Optional[Decimal] = Field(None, ge=0, le=100)
    priority: Optional[int] = Field(None, ge=1, le=10)
    is_active: Optional[bool] = None

    class Config:
        json_encoders = {
            Decimal: str
        }

class FeeCategoryBulkCreate(BaseModel):
    categories: list[FeeCategoryCreate]
    branch_id: str = Field(..., description="Branch ID to apply to all categories")