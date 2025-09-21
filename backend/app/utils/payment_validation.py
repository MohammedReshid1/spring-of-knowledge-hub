from typing import List, Dict, Optional, Tuple
from decimal import Decimal
from datetime import datetime, date
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from ..models.payment import PaymentCreate
from ..models.payment_detail import FeeItemCreate


class PaymentValidationError(Exception):
    """Custom exception for payment validation errors"""
    def __init__(self, message: str, field: Optional[str] = None):
        self.message = message
        self.field = field
        super().__init__(self.message)


class PaymentValidator:
    """Comprehensive payment validation service"""

    def __init__(
        self,
        students_collection: AsyncIOMotorCollection,
        fee_categories_collection: AsyncIOMotorCollection,
        payments_collection: AsyncIOMotorCollection
    ):
        self.students_collection = students_collection
        self.fee_categories_collection = fee_categories_collection
        self.payments_collection = payments_collection

    async def validate_student_exists(self, student_id: str, branch_id: str) -> Dict:
        """Validate that student exists and is active in the branch"""
        student = await self.students_collection.find_one({
            "student_id": student_id,
            "branch_id": branch_id,
            "status": "Active"
        })

        if not student:
            # Try MongoDB _id if student_id field doesn't match
            if ObjectId.is_valid(student_id):
                student = await self.students_collection.find_one({
                    "_id": ObjectId(student_id),
                    "branch_id": branch_id,
                    "status": "Active"
                })

        if not student:
            raise PaymentValidationError(
                f"Student '{student_id}' not found or inactive in branch '{branch_id}'",
                "student_id"
            )

        return student

    async def validate_fee_categories(
        self,
        fee_items: List[FeeItemCreate],
        branch_id: str,
        grade_level: Optional[str] = None
    ) -> List[Dict]:
        """Validate all fee categories in the payment"""
        validated_categories = []

        for item in fee_items:
            # Check if fee category exists
            category = await self.fee_categories_collection.find_one({
                "_id": ObjectId(item.fee_category_id),
                "branch_id": branch_id,
                "is_active": True
            })

            if not category:
                raise PaymentValidationError(
                    f"Fee category '{item.fee_category_id}' not found or inactive",
                    "fee_category_id"
                )

            # Check if fee category applies to the student's grade level
            if grade_level and category.get("grade_level_id"):
                if category["grade_level_id"] != grade_level:
                    raise PaymentValidationError(
                        f"Fee category '{category['name']}' does not apply to grade level '{grade_level}'",
                        "fee_category_id"
                    )

            # Validate amount against fee category
            category_amount = Decimal(str(category.get("amount", 0)))
            item_total = item.amount * item.quantity

            if item_total != (category_amount * item.quantity):
                # Allow for manual amount adjustment if configured
                if not category.get("allow_manual_amount", False):
                    raise PaymentValidationError(
                        f"Amount for '{category['name']}' ({item_total}) does not match expected amount ({category_amount * item.quantity})",
                        "amount"
                    )

            # Validate discount
            if item.discount_amount and item.discount_percentage:
                raise PaymentValidationError(
                    "Cannot specify both discount amount and percentage",
                    "discount"
                )

            if item.discount_amount and item.discount_amount > item_total:
                raise PaymentValidationError(
                    f"Discount amount ({item.discount_amount}) cannot exceed item total ({item_total})",
                    "discount_amount"
                )

            if item.discount_percentage and item.discount_percentage > 100:
                raise PaymentValidationError(
                    "Discount percentage cannot exceed 100%",
                    "discount_percentage"
                )

            # Check if category is discount eligible
            if (item.discount_amount or item.discount_percentage) and not category.get("discount_eligible", True):
                raise PaymentValidationError(
                    f"Fee category '{category['name']}' is not eligible for discounts",
                    "discount"
                )

            validated_categories.append(category)

        return validated_categories

    async def validate_payment_method(
        self,
        payment_method: str,
        payment_reference: Optional[str] = None,
        bank_name: Optional[str] = None,
        cheque_number: Optional[str] = None,
        cheque_date: Optional[date] = None
    ):
        """Validate payment method and related fields"""
        valid_methods = ["cash", "card", "bank_transfer", "check", "mobile_money"]

        if payment_method not in valid_methods:
            raise PaymentValidationError(
                f"Invalid payment method '{payment_method}'. Must be one of: {', '.join(valid_methods)}",
                "payment_method"
            )

        # Validate required fields for specific payment methods
        if payment_method == "check":
            if not cheque_number:
                raise PaymentValidationError(
                    "Cheque number is required for cheque payments",
                    "cheque_number"
                )
            if not bank_name:
                raise PaymentValidationError(
                    "Bank name is required for cheque payments",
                    "bank_name"
                )
            if not cheque_date:
                raise PaymentValidationError(
                    "Cheque date is required for cheque payments",
                    "cheque_date"
                )

        if payment_method == "bank_transfer" and not payment_reference:
            raise PaymentValidationError(
                "Payment reference is required for bank transfers",
                "payment_reference"
            )

        if payment_method in ["card", "online"] and not payment_reference:
            raise PaymentValidationError(
                f"Payment reference is required for {payment_method} payments",
                "payment_reference"
            )

    async def validate_duplicate_payment(
        self,
        student_id: str,
        receipt_no: Optional[str] = None,
        payment_reference: Optional[str] = None,
        cheque_number: Optional[str] = None
    ):
        """Check for duplicate payments"""
        # Check receipt number uniqueness
        if receipt_no:
            existing = await self.payments_collection.find_one({
                "receipt_no": receipt_no
            })
            if existing:
                raise PaymentValidationError(
                    f"Receipt number '{receipt_no}' already exists",
                    "receipt_no"
                )

        # Check payment reference uniqueness (for non-cash payments)
        if payment_reference:
            existing = await self.payments_collection.find_one({
                "payment_reference": payment_reference,
                "status": {"$nin": ["cancelled", "failed"]}
            })
            if existing:
                raise PaymentValidationError(
                    f"Payment reference '{payment_reference}' already used",
                    "payment_reference"
                )

        # Check cheque number uniqueness
        if cheque_number:
            existing = await self.payments_collection.find_one({
                "cheque_number": cheque_number,
                "status": {"$nin": ["cancelled", "failed"]}
            })
            if existing:
                raise PaymentValidationError(
                    f"Cheque number '{cheque_number}' already processed",
                    "cheque_number"
                )

    async def validate_payment_amounts(
        self,
        fee_items: List[FeeItemCreate],
        overall_discount_percentage: Optional[Decimal] = None
    ) -> Tuple[Decimal, Decimal, Decimal]:
        """Validate and calculate payment amounts"""
        if not fee_items:
            raise PaymentValidationError(
                "At least one fee item is required",
                "fee_items"
            )

        subtotal = Decimal("0")
        total_discount = Decimal("0")

        for item in fee_items:
            if item.amount <= 0:
                raise PaymentValidationError(
                    "Fee amount must be greater than zero",
                    "amount"
                )

            if item.quantity <= 0:
                raise PaymentValidationError(
                    "Quantity must be greater than zero",
                    "quantity"
                )

            item_total = item.amount * item.quantity
            subtotal += item_total

            # Calculate item discount
            item_discount = item.discount_amount or Decimal("0")
            if item.discount_percentage:
                item_discount = item_total * (item.discount_percentage / 100)

            total_discount += item_discount

        # Apply overall discount if specified (overrides item-level discounts)
        if overall_discount_percentage:
            total_discount = subtotal * (overall_discount_percentage / 100)

        # Validate total discount doesn't exceed subtotal
        if total_discount > subtotal:
            raise PaymentValidationError(
                "Total discount cannot exceed subtotal amount",
                "discount"
            )

        final_total = subtotal - total_discount

        if final_total <= 0:
            raise PaymentValidationError(
                "Payment total must be greater than zero after discounts",
                "total_amount"
            )

        return subtotal, total_discount, final_total

    async def validate_academic_period(
        self,
        academic_year_id: Optional[str] = None,
        term_id: Optional[str] = None,
        branch_id: str = None
    ):
        """Validate academic year and term references"""
        # This would validate against academic_years and terms collections
        # For now, just basic validation
        if academic_year_id and not ObjectId.is_valid(academic_year_id):
            raise PaymentValidationError(
                "Invalid academic year ID",
                "academic_year_id"
            )

        if term_id and not ObjectId.is_valid(term_id):
            raise PaymentValidationError(
                "Invalid term ID",
                "term_id"
            )

    async def validate_complete_payment(
        self,
        student_id: str,
        branch_id: str,
        fee_items: List[FeeItemCreate],
        payment_method: str,
        payment_reference: Optional[str] = None,
        overall_discount_percentage: Optional[Decimal] = None,
        receipt_no: Optional[str] = None,
        **kwargs
    ) -> Dict:
        """Complete payment validation - calls all validation methods"""
        validation_result = {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "student": None,
            "fee_categories": None,
            "amounts": None
        }

        try:
            # Validate student
            student = await self.validate_student_exists(student_id, branch_id)
            validation_result["student"] = student

            # Validate fee categories
            fee_categories = await self.validate_fee_categories(
                fee_items, branch_id, student.get("grade_level")
            )
            validation_result["fee_categories"] = fee_categories

            # Validate payment method
            await self.validate_payment_method(
                payment_method,
                payment_reference,
                kwargs.get("bank_name"),
                kwargs.get("cheque_number"),
                kwargs.get("cheque_date")
            )

            # Validate amounts
            subtotal, discount, total = await self.validate_payment_amounts(
                fee_items, overall_discount_percentage
            )
            validation_result["amounts"] = {
                "subtotal": subtotal,
                "discount": discount,
                "total": total
            }

            # Check for duplicates
            await self.validate_duplicate_payment(
                student_id,
                receipt_no,
                payment_reference,
                kwargs.get("cheque_number")
            )

            # Validate academic period
            await self.validate_academic_period(
                kwargs.get("academic_year_id"),
                kwargs.get("term_id"),
                branch_id
            )

        except PaymentValidationError as e:
            validation_result["is_valid"] = False
            validation_result["errors"].append({
                "field": e.field,
                "message": e.message
            })

        return validation_result


# Helper functions
def validate_receipt_number_format(receipt_no: str) -> bool:
    """Validate receipt number format (RCP-YYYY-NNNNNN)"""
    import re
    pattern = r'^[A-Z]+-\d{4}-\d{6}$'
    return bool(re.match(pattern, receipt_no))


def validate_phone_number(phone: str) -> bool:
    """Basic phone number validation"""
    import re
    # Allow various phone formats
    pattern = r'^\+?[\d\s\-\(\)]{10,15}$'
    return bool(re.match(pattern, phone.replace(' ', '')))


def validate_email(email: str) -> bool:
    """Basic email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))