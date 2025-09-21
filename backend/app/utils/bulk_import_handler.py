from typing import List, Dict, Any, Tuple, Optional
from decimal import Decimal
from datetime import datetime, date
import csv
import io
import json
import pandas as pd
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorCollection

from ..models.payment import PaymentCreate
from ..models.payment_detail import FeeItemCreate
from ..utils.payment_validation import PaymentValidator, PaymentValidationError


class BulkImportError(Exception):
    """Custom exception for bulk import errors"""
    def __init__(self, message: str, row_number: Optional[int] = None, field: Optional[str] = None):
        self.message = message
        self.row_number = row_number
        self.field = field
        super().__init__(self.message)


class PaymentBulkImporter:
    """Handle bulk import of payments from CSV/Excel files"""

    def __init__(
        self,
        payments_collection: AsyncIOMotorCollection,
        payment_details_collection: AsyncIOMotorCollection,
        students_collection: AsyncIOMotorCollection,
        fee_categories_collection: AsyncIOMotorCollection
    ):
        self.payments_collection = payments_collection
        self.payment_details_collection = payment_details_collection
        self.students_collection = students_collection
        self.fee_categories_collection = fee_categories_collection

        # Initialize validator
        self.validator = PaymentValidator(
            students_collection,
            fee_categories_collection,
            payments_collection
        )

        # Define required columns
        self.required_columns = [
            "student_id",
            "payment_date",
            "payment_method",
            "fee_category_name",
            "amount",
            "branch_id"
        ]

        # Define optional columns
        self.optional_columns = [
            "receipt_no",
            "payment_reference",
            "discount_amount",
            "discount_percentage",
            "discount_reason",
            "remarks",
            "payer_name",
            "payer_phone",
            "payer_email",
            "bank_name",
            "cheque_number",
            "cheque_date",
            "quantity"
        ]

    async def process_csv_file(
        self,
        file_content: bytes,
        branch_id: str,
        user_id: str,
        skip_validation: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Process CSV file for bulk payment import"""

        # Parse CSV
        try:
            csv_text = file_content.decode('utf-8')
            reader = csv.DictReader(io.StringIO(csv_text))
            rows = list(reader)
        except Exception as e:
            raise BulkImportError(f"Failed to parse CSV file: {str(e)}")

        return await self._process_rows(rows, branch_id, user_id, skip_validation, dry_run)

    async def process_excel_file(
        self,
        file_content: bytes,
        branch_id: str,
        user_id: str,
        sheet_name: Optional[str] = None,
        skip_validation: bool = False,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Process Excel file for bulk payment import"""

        try:
            # Read Excel file
            df = pd.read_excel(io.BytesIO(file_content), sheet_name=sheet_name or 0)

            # Convert to list of dictionaries
            rows = df.to_dict('records')

            # Clean up NaN values
            for row in rows:
                for key, value in row.items():
                    if pd.isna(value):
                        row[key] = None

        except Exception as e:
            raise BulkImportError(f"Failed to parse Excel file: {str(e)}")

        return await self._process_rows(rows, branch_id, user_id, skip_validation, dry_run)

    async def _process_rows(
        self,
        rows: List[Dict[str, Any]],
        branch_id: str,
        user_id: str,
        skip_validation: bool,
        dry_run: bool
    ) -> Dict[str, Any]:
        """Process parsed rows"""

        if not rows:
            raise BulkImportError("No data rows found in file")

        # Validate headers
        self._validate_headers(rows[0])

        # Process each row
        results = {
            "total_rows": len(rows),
            "successful_imports": 0,
            "failed_imports": 0,
            "errors": [],
            "warnings": [],
            "imported_payments": []
        }

        # Group rows by student and payment (for payments with multiple fee items)
        grouped_payments = self._group_payment_rows(rows)

        for group_key, payment_rows in grouped_payments.items():
            try:
                row_numbers = [r["_row_number"] for r in payment_rows]

                if dry_run:
                    # Validate only
                    await self._validate_payment_group(payment_rows, branch_id, skip_validation)
                    results["successful_imports"] += len(payment_rows)
                else:
                    # Actually import
                    payment_result = await self._import_payment_group(
                        payment_rows, branch_id, user_id, skip_validation
                    )
                    results["imported_payments"].append(payment_result)
                    results["successful_imports"] += len(payment_rows)

            except (BulkImportError, PaymentValidationError) as e:
                error_info = {
                    "rows": row_numbers if 'row_numbers' in locals() else [payment_rows[0].get("_row_number", 0)],
                    "error": str(e),
                    "field": getattr(e, 'field', None)
                }
                results["errors"].append(error_info)
                results["failed_imports"] += len(payment_rows)

            except Exception as e:
                error_info = {
                    "rows": row_numbers if 'row_numbers' in locals() else [payment_rows[0].get("_row_number", 0)],
                    "error": f"Unexpected error: {str(e)}",
                    "field": None
                }
                results["errors"].append(error_info)
                results["failed_imports"] += len(payment_rows)

        return results

    def _validate_headers(self, first_row: Dict[str, Any]):
        """Validate that required columns are present"""
        headers = set(first_row.keys())
        missing_columns = set(self.required_columns) - headers

        if missing_columns:
            raise BulkImportError(
                f"Missing required columns: {', '.join(missing_columns)}"
            )

    def _group_payment_rows(self, rows: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group rows by student and payment date to handle multi-item payments"""
        grouped = {}

        for i, row in enumerate(rows):
            row["_row_number"] = i + 2  # Excel row numbers start from 1, header is row 1

            # Create group key
            student_id = str(row.get("student_id", "")).strip()
            payment_date = str(row.get("payment_date", "")).strip()
            receipt_no = str(row.get("receipt_no", "")).strip()

            # Use receipt number if available, otherwise use student_id + date
            if receipt_no:
                group_key = receipt_no
            else:
                group_key = f"{student_id}_{payment_date}"

            if group_key not in grouped:
                grouped[group_key] = []

            grouped[group_key].append(row)

        return grouped

    async def _validate_payment_group(
        self,
        payment_rows: List[Dict[str, Any]],
        branch_id: str,
        skip_validation: bool
    ):
        """Validate a group of rows representing one payment"""
        if skip_validation:
            return

        # Use first row for payment-level validation
        first_row = payment_rows[0]

        # Validate student
        await self.validator.validate_student_exists(
            first_row["student_id"],
            branch_id
        )

        # Create fee items from all rows in group
        fee_items = []
        for row in payment_rows:
            fee_item = await self._create_fee_item_from_row(row, branch_id)
            fee_items.append(fee_item)

        # Validate fee items
        await self.validator.validate_fee_categories(fee_items, branch_id)

        # Validate payment method
        await self.validator.validate_payment_method(
            first_row["payment_method"],
            first_row.get("payment_reference"),
            first_row.get("bank_name"),
            first_row.get("cheque_number"),
            self._parse_date(first_row.get("cheque_date"))
        )

    async def _import_payment_group(
        self,
        payment_rows: List[Dict[str, Any]],
        branch_id: str,
        user_id: str,
        skip_validation: bool
    ) -> Dict[str, Any]:
        """Import a group of rows as one payment"""

        first_row = payment_rows[0]

        # Create fee items
        fee_items = []
        for row in payment_rows:
            fee_item = await self._create_fee_item_from_row(row, branch_id)
            fee_items.append(fee_item)

        # Calculate totals
        subtotal = sum(item.amount * item.quantity for item in fee_items)
        total_discount = sum(item.discount_amount or Decimal("0") for item in fee_items)

        # Apply overall discount if specified in first row
        overall_discount_percentage = self._parse_decimal(first_row.get("discount_percentage"))
        if overall_discount_percentage:
            total_discount = subtotal * (overall_discount_percentage / 100)

        total_amount = subtotal - total_discount

        # Create payment
        payment_data = {
            "receipt_no": first_row.get("receipt_no"),
            "student_id": first_row["student_id"],
            "payment_date": self._parse_datetime(first_row["payment_date"]),
            "subtotal": str(subtotal),
            "discount_amount": str(total_discount),
            "discount_percentage": str(overall_discount_percentage) if overall_discount_percentage else None,
            "discount_reason": first_row.get("discount_reason"),
            "tax_amount": "0",  # Will be calculated based on fee categories
            "late_fee_amount": "0",
            "total_amount": str(total_amount),
            "payment_method": first_row["payment_method"],
            "payment_reference": first_row.get("payment_reference"),
            "bank_name": first_row.get("bank_name"),
            "cheque_number": first_row.get("cheque_number"),
            "cheque_date": self._parse_date(first_row.get("cheque_date")),
            "status": "completed",
            "verification_status": "unverified",
            "remarks": first_row.get("remarks"),
            "payer_name": first_row.get("payer_name"),
            "payer_phone": first_row.get("payer_phone"),
            "payer_email": first_row.get("payer_email"),
            "branch_id": branch_id,
            "created_at": datetime.now(),
            "created_by": user_id
        }

        # Generate receipt number if not provided
        if not payment_data["receipt_no"]:
            from ..utils.payment_calculations import generate_receipt_number
            payment_data["receipt_no"] = await generate_receipt_number(
                self.payments_collection, branch_id
            )

        # Insert payment
        payment_result = await self.payments_collection.insert_one(payment_data)
        payment_id = str(payment_result.inserted_id)

        # Insert payment details
        detail_ids = []
        for fee_item in fee_items:
            detail_data = {
                "payment_id": payment_id,
                "fee_category_id": fee_item.fee_category_id,
                "fee_category_name": "Unknown",  # Will be filled from fee category lookup
                "original_amount": str(fee_item.amount * fee_item.quantity),
                "discount_amount": str(fee_item.discount_amount or Decimal("0")),
                "discount_percentage": str(fee_item.discount_percentage) if fee_item.discount_percentage else None,
                "tax_amount": "0",
                "late_fee_amount": "0",
                "paid_amount": str(fee_item.amount * fee_item.quantity - (fee_item.discount_amount or Decimal("0"))),
                "quantity": fee_item.quantity,
                "unit_price": str(fee_item.amount),
                "remarks": fee_item.remarks,
                "branch_id": branch_id,
                "created_at": datetime.now()
            }

            # Get fee category name
            try:
                category = await self.fee_categories_collection.find_one(
                    {"_id": ObjectId(fee_item.fee_category_id)}
                )
                if category:
                    detail_data["fee_category_name"] = category["name"]
            except:
                pass

            detail_result = await self.payment_details_collection.insert_one(detail_data)
            detail_ids.append(str(detail_result.inserted_id))

        return {
            "payment_id": payment_id,
            "receipt_no": payment_data["receipt_no"],
            "total_amount": total_amount,
            "fee_items_count": len(fee_items),
            "detail_ids": detail_ids
        }

    async def _create_fee_item_from_row(self, row: Dict[str, Any], branch_id: str) -> FeeItemCreate:
        """Create fee item from CSV row"""

        # Get fee category by name
        fee_category_name = str(row["fee_category_name"]).strip()
        category = await self.fee_categories_collection.find_one({
            "name": fee_category_name,
            "branch_id": branch_id,
            "is_active": True
        })

        if not category:
            raise BulkImportError(
                f"Fee category '{fee_category_name}' not found",
                row.get("_row_number"),
                "fee_category_name"
            )

        return FeeItemCreate(
            fee_category_id=str(category["_id"]),
            amount=self._parse_decimal(row["amount"]),
            quantity=int(row.get("quantity", 1)),
            discount_amount=self._parse_decimal(row.get("discount_amount")),
            discount_percentage=self._parse_decimal(row.get("discount_percentage")),
            remarks=row.get("remarks")
        )

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        """Parse decimal value from string"""
        if value is None or value == "":
            return None

        try:
            return Decimal(str(value).replace(",", ""))
        except Exception:
            return None

    def _parse_datetime(self, value: Any) -> datetime:
        """Parse datetime from string"""
        if isinstance(value, datetime):
            return value

        if isinstance(value, str):
            # Try various date formats
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
                "%d/%m/%Y %H:%M:%S",
                "%d/%m/%Y",
                "%m/%d/%Y",
                "%d-%m-%Y"
            ]

            for fmt in formats:
                try:
                    return datetime.strptime(value.strip(), fmt)
                except ValueError:
                    continue

        raise BulkImportError(f"Invalid date format: {value}")

    def _parse_date(self, value: Any) -> Optional[date]:
        """Parse date from string"""
        if value is None or value == "":
            return None

        try:
            dt = self._parse_datetime(value)
            return dt.date()
        except:
            return None

    def generate_template_csv(self, branch_id: str) -> str:
        """Generate CSV template for bulk import"""

        headers = self.required_columns + self.optional_columns

        # Create sample data
        sample_row = {
            "student_id": "STU001",
            "payment_date": "2024-01-15",
            "payment_method": "cash",
            "fee_category_name": "Tuition Fee",
            "amount": "1000.00",
            "branch_id": branch_id,
            "receipt_no": "RCP-2024-000001",
            "payment_reference": "",
            "discount_amount": "0.00",
            "discount_percentage": "",
            "discount_reason": "",
            "remarks": "Payment for January",
            "payer_name": "Parent Name",
            "payer_phone": "+1234567890",
            "payer_email": "parent@email.com",
            "bank_name": "",
            "cheque_number": "",
            "cheque_date": "",
            "quantity": "1"
        }

        # Generate CSV
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=headers)
        writer.writeheader()
        writer.writerow(sample_row)

        return output.getvalue()

    def generate_error_report(self, import_results: Dict[str, Any]) -> str:
        """Generate error report CSV"""

        if not import_results.get("errors"):
            return ""

        output = io.StringIO()
        writer = csv.writer(output)

        # Headers
        writer.writerow(["Row Numbers", "Error Message", "Field"])

        # Error data
        for error in import_results["errors"]:
            writer.writerow([
                ", ".join(map(str, error["rows"])),
                error["error"],
                error.get("field", "")
            ])

        return output.getvalue()


# Utility functions
def validate_file_size(file_content: bytes, max_size_mb: int = 10) -> bool:
    """Validate uploaded file size"""
    file_size_mb = len(file_content) / (1024 * 1024)
    return file_size_mb <= max_size_mb


def get_file_extension(filename: str) -> str:
    """Get file extension"""
    return filename.lower().split('.')[-1] if '.' in filename else ""


def is_supported_file_type(filename: str) -> bool:
    """Check if file type is supported"""
    supported_extensions = ["csv", "xlsx", "xls"]
    extension = get_file_extension(filename)
    return extension in supported_extensions