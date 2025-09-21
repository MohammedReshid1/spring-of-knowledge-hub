from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, BackgroundTasks, Body
# Fixed permission checking imports
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from datetime import datetime, date, timedelta
from decimal import Decimal
import csv
import io
import json

from ..models.payment import (
    Payment,
    PaymentCreate,
    PaymentUpdate,
    PaymentSummary,
    BulkPaymentCreate,
    StudentInfo,
    FeeCategoryInfo
)
from ..models.payment_detail import (
    PaymentDetail,
    PaymentDetailCreate,
    FeeItemCreate,
    PaymentWithDetails
)
from ..db import (
    get_payments_collection,
    get_payment_details_collection,
    get_fee_categories_collection,
    get_student_collection,
    validate_branch_id,
    validate_student_id,
    validate_fee_category_id
)
from ..utils.rbac import get_current_user, has_permission, Permission
from ..models.user import User
from ..utils.payment_calculations import (
    calculate_payment_totals,
    apply_late_fees,
    generate_receipt_number
)

router = APIRouter()

@router.post("/", response_model=PaymentWithDetails, status_code=status.HTTP_201_CREATED)
async def create_payment(
    student_id: str,
    branch_id: str,
    payment_method: str,
    fee_items: List[FeeItemCreate] = Body(...),
    payment_date: Optional[datetime] = None,
    payment_reference: Optional[str] = None,
    discount_percentage: Optional[Decimal] = None,
    discount_reason: Optional[str] = None,
    remarks: Optional[str] = None,
    payer_name: Optional[str] = None,
    payer_phone: Optional[str] = None,
    payer_email: Optional[str] = None,
    bank_name: Optional[str] = None,
    cheque_number: Optional[str] = None,
    cheque_date: Optional[date] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Create a new payment with details"""
    if not has_permission(current_user.get("role"), Permission.CREATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Validate references
    await validate_branch_id(branch_id)
    await validate_student_id(student_id)

    # Validate fee categories and calculate totals
    payment_details = []
    subtotal = Decimal("0")
    total_discount = Decimal("0")
    total_tax = Decimal("0")
    total_late_fees = Decimal("0")

    for item in fee_items:
        # Validate fee category
        await validate_fee_category_id(item.fee_category_id)

        # Get fee category details
        category_doc = await categories_collection.find_one({"_id": ObjectId(item.fee_category_id)})

        if not category_doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Fee category {item.fee_category_id} not found"
            )

        # Calculate amounts
        original_amount = Decimal(str(category_doc.get("amount", 0))) * item.quantity
        item_discount = item.discount_amount or Decimal("0")

        # Apply percentage discount if specified at item level
        if item.discount_percentage:
            item_discount = original_amount * (item.discount_percentage / 100)

        # Calculate tax
        tax_percentage_value = category_doc.get("tax_percentage")
        if tax_percentage_value is not None:
            # Handle both Decimal128 from MongoDB and regular values
            try:
                # Convert Decimal128 to Decimal if needed
                if hasattr(tax_percentage_value, 'to_decimal'):
                    tax_percentage = tax_percentage_value.to_decimal()
                else:
                    # Handle string or numeric values
                    str_value = str(tax_percentage_value).strip()
                    if str_value in ['', 'None', 'null']:
                        tax_percentage = Decimal("0")
                    else:
                        tax_percentage = Decimal(str_value)
            except (ValueError, decimal.InvalidOperation) as e:
                print(f"⚠️ Tax percentage conversion error: {tax_percentage_value} -> {e}")
                tax_percentage = Decimal("0")
        else:
            tax_percentage = Decimal("0")
        tax_amount = (original_amount - item_discount) * (tax_percentage / 100) if tax_percentage else Decimal("0")

        # Check for late fees
        late_fee_amount = Decimal("0")
        late_fee_percentage_value = category_doc.get("late_fee_percentage")
        if payment_date and late_fee_percentage_value is not None:
            # This is a simplified late fee calculation
            # In production, you'd check against actual due dates
            try:
                # Convert Decimal128 to Decimal if needed
                if hasattr(late_fee_percentage_value, 'to_decimal'):
                    late_fee_percentage = late_fee_percentage_value.to_decimal()
                else:
                    # Handle string or numeric values
                    str_value = str(late_fee_percentage_value).strip()
                    if str_value in ['', 'None', 'null']:
                        late_fee_percentage = Decimal("0")
                    else:
                        late_fee_percentage = Decimal(str_value)
            except (ValueError, decimal.InvalidOperation) as e:
                print(f"⚠️ Late fee percentage conversion error: {late_fee_percentage_value} -> {e}")
                late_fee_percentage = Decimal("0")
            late_fee_amount = await apply_late_fees(
                original_amount,
                late_fee_percentage,
                category_doc.get("late_fee_grace_days", 0)
            )

        paid_amount = original_amount - item_discount + tax_amount + late_fee_amount

        # Create payment detail
        detail = PaymentDetailCreate(
            payment_id="",  # Will be set after payment creation
            fee_category_id=item.fee_category_id,
            fee_category_name=category_doc["name"],
            original_amount=original_amount,
            discount_amount=item_discount,
            discount_percentage=item.discount_percentage,
            tax_amount=tax_amount,
            late_fee_amount=late_fee_amount,
            paid_amount=paid_amount,
            quantity=item.quantity,
            unit_price=Decimal(str(category_doc.get("amount", 0))),
            remarks=item.remarks,
            branch_id=branch_id
        )

        payment_details.append(detail)

        # Update totals
        subtotal += original_amount
        total_discount += item_discount
        total_tax += tax_amount
        total_late_fees += late_fee_amount

    # Apply overall discount if specified
    if discount_percentage:
        overall_discount = subtotal * (discount_percentage / 100)
        total_discount = overall_discount  # Override item-level discounts

    total_amount = subtotal - total_discount + total_tax + total_late_fees

    # Generate receipt number
    receipt_no = await generate_receipt_number(payments_collection, branch_id)

    # Create payment document
    payment_doc = {
        "receipt_number": receipt_no,
        "student_id": student_id,
        "payment_date": payment_date or datetime.now(),
        "amount": str(total_amount),  # Map to Payment model's 'amount' field
        "discount_amount": str(total_discount),
        "discount_percentage": str(discount_percentage) if discount_percentage else None,
        "discount_reason": discount_reason,
        "tax_amount": str(total_tax),
        "late_fee_amount": str(total_late_fees),
        "payment_method": payment_method,
        "payment_reference": payment_reference,
        "bank_name": bank_name,
        "cheque_number": cheque_number,
        "cheque_date": cheque_date,
        "status": "completed" if payment_method == "cash" else "pending",
        "verification_status": "unverified",
        "remarks": remarks,
        "payer_name": payer_name,
        "payer_phone": payer_phone,
        "payer_email": payer_email,
        "branch_id": branch_id,
        "created_at": datetime.now(),
        "created_by": current_user.get("user_id") or current_user.get("id")
    }

    # Insert payment
    payment_result = await payments_collection.insert_one(payment_doc)
    payment_id = str(payment_result.inserted_id)
    payment_doc["_id"] = payment_id

    # Insert payment details
    details_docs = []
    for detail in payment_details:
        detail_doc = detail.dict()
        detail_doc["payment_id"] = payment_id
        detail_doc["created_at"] = datetime.now()

        # Convert Decimal to string
        for key in ["original_amount", "discount_amount", "discount_percentage",
                   "tax_amount", "late_fee_amount", "paid_amount", "unit_price"]:
            if key in detail_doc and detail_doc[key] is not None:
                detail_doc[key] = str(detail_doc[key])

        details_docs.append(detail_doc)

    if details_docs:
        details_result = await details_collection.insert_many(details_docs)
        for i, inserted_id in enumerate(details_result.inserted_ids):
            details_docs[i]["_id"] = str(inserted_id)

    # Background task: Send payment notification
    if payer_email:
        background_tasks.add_task(send_payment_notification, payment_id, payer_email)

    # Prepare response
    return PaymentWithDetails(
        payment=Payment(**payment_doc),
        details=[PaymentDetail(**doc) for doc in details_docs],
        summary={
            "payment_id": payment_id,
            "total_items": len(details_docs),
            "fee_categories": [d["fee_category_name"] for d in details_docs],
            "total_original": subtotal,
            "total_discount": total_discount,
            "total_tax": total_tax,
            "total_late_fees": total_late_fees,
            "total_paid": total_amount
        }
    )

class PaymentListResponse(BaseModel):
    payments: List[Payment]
    total: int
    page: int
    per_page: int
    pages: int

@router.get("/", response_model=PaymentListResponse)
async def get_payments(
    branch_id: str = Query(..., description="Branch ID to filter by"),
    student_id: Optional[str] = Query(None, description="Filter by student"),
    status: Optional[str] = Query(None, description="Filter by payment status"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    date_from: Optional[date] = Query(None, description="Filter payments from this date"),
    date_to: Optional[date] = Query(None, description="Filter payments until this date"),
    search: Optional[str] = Query(None, description="Search by student name, receipt number, or reference"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_student_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection),
    details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection)
):
    """Get payments with filters and populate student and fee category information"""
    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Build query
    query = {"branch_id": branch_id}

    if student_id:
        query["student_id"] = student_id

    if status:
        query["status"] = status

    if payment_method:
        query["payment_method"] = payment_method

    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.combine(date_from, datetime.min.time())
        if date_to:
            date_filter["$lte"] = datetime.combine(date_to, datetime.max.time())
        query["payment_date"] = date_filter

    # Handle search functionality
    if search:
        print(f"🔍 Searching payments for: '{search}'")
        search_conditions = [
            {"receipt_number": {"$regex": search, "$options": "i"}},
            {"payment_reference": {"$regex": search, "$options": "i"}},
            {"payer_name": {"$regex": search, "$options": "i"}},
            {"remarks": {"$regex": search, "$options": "i"}},
        ]

        # Also search in student names by finding student IDs that match the search term
        student_name_query = {
            "$or": [
                {"first_name": {"$regex": search, "$options": "i"}},
                {"last_name": {"$regex": search, "$options": "i"}},
                {"father_name": {"$regex": search, "$options": "i"}},
                {"grandfather_name": {"$regex": search, "$options": "i"}},
                {"student_id": {"$regex": search, "$options": "i"}}
            ],
            "branch_id": branch_id
        }

        matching_students = await students_collection.find(student_name_query, {"_id": 1}).to_list(length=100)
        if matching_students:
            student_ids = [str(s["_id"]) for s in matching_students]
            search_conditions.append({"student_id": {"$in": student_ids}})
            print(f"✅ Found {len(matching_students)} students matching '{search}'")

        query["$or"] = search_conditions
        print(f"🔍 Final search query: {query}")

    # Get total count for pagination
    total_count = await collection.count_documents(query)
    print(f"📊 Total payments found: {total_count}")

    # Execute query
    cursor = collection.find(query).skip(skip).limit(limit).sort("payment_date", -1)
    payments = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])

        # Convert Decimal128 fields to float for JSON serialization
        decimal_fields = ["amount", "discount_amount", "tax_amount", "late_fee_amount", "total_amount", "subtotal"]
        for field in decimal_fields:
            if field in doc and doc[field] is not None:
                doc[field] = float(str(doc[field]))

        # Handle field mapping for backward compatibility
        if "receipt_no" in doc and "receipt_number" not in doc:
            doc["receipt_number"] = doc["receipt_no"]

        if "total_amount" in doc and "amount" not in doc:
            doc["amount"] = doc["total_amount"]
        elif "amount" not in doc:
            # Provide default amount if missing
            doc["amount"] = 0.0

        # Ensure required fields have defaults
        if "student_id" not in doc:
            doc["student_id"] = "unknown"
        if "payment_method" not in doc:
            doc["payment_method"] = "cash"

        # Debug: Print current document for troubleshooting
        print(f"🔍 Processing payment doc: student_id={doc.get('student_id')}, branch_id={branch_id}")

        # Populate student information
        student_data = None
        if doc.get("student_id") and doc["student_id"] != "unknown":
            try:
                # Try ObjectId lookup first
                if ObjectId.is_valid(doc["student_id"]):
                    student_query = {"_id": ObjectId(doc["student_id"]), "branch_id": branch_id}
                else:
                    # Fallback to student_id field lookup
                    student_query = {"student_id": doc["student_id"], "branch_id": branch_id}

                print(f"🔍 Student query: {student_query}")
                student_doc = await students_collection.find_one(student_query)

                if student_doc:
                    print(f"✅ Found student: {student_doc.get('first_name', 'Unknown')} {student_doc.get('father_name', '')}")
                    student_data = StudentInfo(
                        id=str(student_doc["_id"]),
                        student_id=student_doc.get("student_id", ""),
                        first_name=student_doc.get("first_name", ""),
                        father_name=student_doc.get("father_name", ""),
                        grandfather_name=student_doc.get("grandfather_name", ""),
                        photo_url=student_doc.get("photo_url", "")
                    )
                else:
                    print(f"❌ Student not found for id: {doc['student_id']}")
            except Exception as e:
                print(f"❌ Error fetching student {doc['student_id']}: {e}")

        # Populate fee category information
        fee_category_data = None
        if doc.get("category"):
            try:
                # Try to find fee category by name first, then by ID
                fee_cat_query = {"name": doc["category"], "branch_id": branch_id, "is_active": True}
                fee_cat_doc = await fee_categories_collection.find_one(fee_cat_query)

                if fee_cat_doc:
                    fee_category_data = FeeCategoryInfo(
                        id=str(fee_cat_doc["_id"]),
                        name=fee_cat_doc.get("name", doc["category"]),
                        description=fee_cat_doc.get("description", "")
                    )
                else:
                    # Fallback to just the category name
                    fee_category_data = FeeCategoryInfo(
                        id="",
                        name=doc["category"],
                        description=""
                    )
            except Exception as e:
                print(f"❌ Error fetching fee category {doc.get('category')}: {e}")
                fee_category_data = FeeCategoryInfo(
                    id="",
                    name=doc.get("category", "Unknown Category"),
                    description=""
                )
        else:
            # Fallback: derive category from payment details if available
            try:
                payment_id = str(doc.get("_id"))
                if payment_id and payment_id != "unknown":
                    detail = await details_collection.find_one({"payment_id": payment_id})
                    if detail and detail.get("fee_category_name"):
                        fee_category_data = FeeCategoryInfo(
                            id=str(detail.get("fee_category_id", "")),
                            name=detail.get("fee_category_name", "Unknown"),
                            description=""
                        )
                    else:
                        # Check if multiple categories exist
                        two = await details_collection.find({"payment_id": payment_id}).limit(2).to_list(2)
                        if two and len(two) > 1:
                            fee_category_data = FeeCategoryInfo(
                                id="",
                                name="Multiple",
                                description=""
                            )
            except Exception as e:
                print(f"❌ Error deriving fee category from details for payment {doc.get('_id')}: {e}")

        # Add populated data to document
        if student_data:
            doc["student"] = student_data.dict()
        if fee_category_data:
            doc["fee_category"] = fee_category_data.dict()

        payments.append(Payment(**doc))

    # Calculate pagination info
    page = (skip // limit) + 1 if limit > 0 else 1
    total_pages = (total_count + limit - 1) // limit if limit > 0 else 1

    return PaymentListResponse(
        payments=payments,
        total=total_count,
        page=page,
        per_page=limit,
        pages=total_pages
    )

@router.get("/dashboard-stats")
async def get_dashboard_stats(
    branch_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payments_collection)
):
    """Get payment dashboard statistics"""
    print(f"🔍 Dashboard stats called with: branch_id={branch_id}, date_from={date_from}, date_to={date_to}")

    try:
        if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
            print(f"❌ Permission denied for user role: {current_user.get('role')}")
            raise HTTPException(status_code=403, detail="Permission denied")

        # Build query
        query = {"status": {"$ne": "cancelled"}}

        if branch_id:
            query["branch_id"] = branch_id

        # Parse date strings manually
        if date_from or date_to:
            date_filter = {}
            if date_from:
                try:
                    parsed_date_from = datetime.strptime(date_from, "%Y-%m-%d").date()
                    date_filter["$gte"] = datetime.combine(parsed_date_from, datetime.min.time())
                    print(f"✅ Parsed date_from: {parsed_date_from}")
                except ValueError as e:
                    print(f"❌ Invalid date_from format: {date_from}, error: {e}")
                    raise HTTPException(status_code=400, detail=f"Invalid date_from format: {date_from}")

            if date_to:
                try:
                    parsed_date_to = datetime.strptime(date_to, "%Y-%m-%d").date()
                    date_filter["$lte"] = datetime.combine(parsed_date_to, datetime.max.time())
                    print(f"✅ Parsed date_to: {parsed_date_to}")
                except ValueError as e:
                    print(f"❌ Invalid date_to format: {date_to}, error: {e}")
                    raise HTTPException(status_code=400, detail=f"Invalid date_to format: {date_to}")

            query["payment_date"] = date_filter

        print(f"📊 Dashboard stats query: {query}")  # Debug logging

        # Enhanced aggregation pipeline for comprehensive dashboard stats
        main_pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": None,
                    "total_payments": {"$sum": 1},
                    "total_amount": {"$sum": {"$toDecimal": "$amount"}},
                    "total_discount": {
                        "$sum": {
                            "$cond": [
                                {"$ifNull": ["$discount_amount", False]},
                                {"$toDecimal": "$discount_amount"},
                                0
                            ]
                        }
                    },
                    "pending_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "pending"]}, 1, 0]}
                    },
                    "pending_amount": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "pending"]},
                                {"$toDecimal": "$amount"},
                                0
                            ]
                        }
                    },
                    "completed_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "completed"]}, 1, 0]}
                    },
                    "completed_amount": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "completed"]},
                                {"$toDecimal": "$amount"},
                                0
                            ]
                        }
                    },
                    "overdue_count": {
                        "$sum": {"$cond": [{"$eq": ["$status", "overdue"]}, 1, 0]}
                    },
                    "overdue_amount": {
                        "$sum": {
                            "$cond": [
                                {"$eq": ["$status", "overdue"]},
                                {"$toDecimal": "$amount"},
                                0
                            ]
                        }
                    }
                }
            }
        ]

        # Aggregation for top fee categories
        fee_categories_pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": "$category",
                    "total_amount": {"$sum": {"$toDecimal": "$amount"}},
                    "payment_count": {"$sum": 1}
                }
            },
            {"$sort": {"total_amount": -1}},
            {"$limit": 5},
            {
                "$project": {
                    "category_name": {"$ifNull": ["$_id", "Unknown"]},
                    "total_amount": 1,
                    "payment_count": 1,
                    "_id": 0
                }
            }
        ]

        # Aggregation for monthly trend (last 6 months)
        monthly_pipeline = [
            {"$match": query},
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m",
                            "date": "$payment_date"
                        }
                    },
                    "amount": {"$sum": {"$toDecimal": "$amount"}},
                    "payment_count": {"$sum": 1}
                }
            },
            {"$sort": {"_id": 1}},
            {"$limit": 6},
            {
                "$project": {
                    "month": "$_id",
                    "amount": 1,
                    "payment_count": 1,
                    "_id": 0
                }
            }
        ]

        # Execute all aggregations
        main_result = await collection.aggregate(main_pipeline).to_list(1)
        fee_categories_result = await collection.aggregate(fee_categories_pipeline).to_list(5)
        monthly_result = await collection.aggregate(monthly_pipeline).to_list(6)

        print(f"Main aggregation result: {main_result}")  # Debug logging
        print(f"Fee categories result: {fee_categories_result}")  # Debug logging
        print(f"Monthly result: {monthly_result}")  # Debug logging

        if not main_result:
            return {
                "total_payments": 0,
                "total_amount_collected": 0.0,
                "pending_payments": 0,
                "pending_amount": 0.0,
                "overdue_payments": 0,
                "overdue_amount": 0.0,
                "collection_rate": 0.0,
                "average_payment_amount": 0.0,
                "top_fee_categories": [],
                "monthly_collection_trend": []
            }

        data = main_result[0]

        # Convert Decimal128 to float safely
        def decimal_to_float(value):
            if value is None:
                return 0.0
            return float(str(value))

        # Calculate derived metrics
        total_payments = data.get("total_payments", 0)
        total_amount = decimal_to_float(data.get("total_amount", 0))
        completed_amount = decimal_to_float(data.get("completed_amount", 0))
        pending_amount = decimal_to_float(data.get("pending_amount", 0))
        overdue_amount = decimal_to_float(data.get("overdue_amount", 0))

        # Collection rate: completed amount / total amount * 100
        collection_rate = (completed_amount / total_amount * 100) if total_amount > 0 else 0.0

        # Average payment amount
        average_payment_amount = total_amount / total_payments if total_payments > 0 else 0.0

        # Process fee categories
        top_fee_categories = []
        for cat in fee_categories_result:
            top_fee_categories.append({
                "category_name": cat.get("category_name", "Unknown"),
                "total_amount": decimal_to_float(cat.get("total_amount", 0)),
                "payment_count": cat.get("payment_count", 0)
            })

        # Process monthly trend
        monthly_collection_trend = []
        for month in monthly_result:
            monthly_collection_trend.append({
                "month": month.get("month", ""),
                "amount": decimal_to_float(month.get("amount", 0)),
                "payment_count": month.get("payment_count", 0)
            })

        response_data = {
            "total_payments": total_payments,
            "total_amount_collected": total_amount,
            "pending_payments": data.get("pending_count", 0),
            "pending_amount": pending_amount,
            "overdue_payments": data.get("overdue_count", 0),
            "overdue_amount": overdue_amount,
            "collection_rate": collection_rate,
            "average_payment_amount": average_payment_amount,
            "top_fee_categories": top_fee_categories,
            "monthly_collection_trend": monthly_collection_trend
        }

        print(f"Response data: {response_data}")  # Debug logging
        return response_data

    except Exception as e:
        print(f"Dashboard stats error: {e}")  # Debug logging
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Error retrieving dashboard stats: {str(e)}")

@router.get("/{payment_id}", response_model=PaymentWithDetails)
async def get_payment(
    payment_id: str,
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection)
):
    """Get payment with full details"""
    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID"
        )

    # Get payment
    payment_doc = await payments_collection.find_one({"_id": ObjectId(payment_id)})

    if not payment_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    payment_doc["_id"] = str(payment_doc["_id"])

    # Get payment details
    cursor = details_collection.find({"payment_id": payment_id})
    details = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        details.append(PaymentDetail(**doc))

    # Calculate summary
    summary = {
        "payment_id": payment_id,
        "total_items": len(details),
        "fee_categories": [d.fee_category_name for d in details],
        "total_original": sum(Decimal(d.original_amount) for d in details),
        "total_discount": sum(Decimal(d.discount_amount) for d in details),
        "total_tax": sum(Decimal(d.tax_amount) for d in details),
        "total_late_fees": sum(Decimal(d.late_fee_amount) for d in details),
        "total_paid": sum(Decimal(d.paid_amount) for d in details)
    }

    return PaymentWithDetails(
        payment=Payment(**payment_doc),
        details=details,
        summary=summary
    )

@router.put("/{payment_id}", response_model=Payment)
async def update_payment(
    payment_id: str,
    update_data: PaymentUpdate,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payments_collection)
):
    """Update payment information"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID"
        )

    # Check if payment exists
    existing = await collection.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Check if payment can be modified
    if existing.get("status") in ["cancelled", "refunded"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot modify a {existing['status']} payment"
        )

    # Prepare update document
    update_doc = {k: v for k, v in update_data.dict().items() if v is not None}

    if update_doc:
        update_doc["updated_at"] = datetime.now()
        update_doc["updated_by"] = current_user.get("user_id") or current_user.get("id")

        # Handle verification
        if "verification_status" in update_doc and update_doc["verification_status"] == "verified":
            update_doc["verified_by"] = current_user.get("user_id") or current_user.get("id")
            update_doc["verified_at"] = datetime.now()

        # Update document
        await collection.update_one(
            {"_id": ObjectId(payment_id)},
            {"$set": update_doc}
        )

    # Return updated document
    doc = await collection.find_one({"_id": ObjectId(payment_id)})
    doc["_id"] = str(doc["_id"])
    return Payment(**doc)

@router.post("/{payment_id}/cancel", response_model=Payment)
async def cancel_payment(
    payment_id: str,
    cancellation_reason: str,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payments_collection)
):
    """Cancel a payment"""
    if not has_permission(current_user.get("role"), Permission.DELETE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID"
        )

    # Check if payment exists
    existing = await collection.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Check if payment can be cancelled
    if existing.get("status") in ["cancelled", "refunded"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment is already {existing['status']}"
        )

    # Update payment status
    update_doc = {
        "status": "cancelled",
        "cancellation_reason": cancellation_reason,
        "cancelled_by": current_user.get("user_id") or current_user.get("id"),
        "cancelled_at": datetime.now(),
        "updated_at": datetime.now(),
                "updated_by": current_user.get("user_id") or current_user.get("id")
    }

    await collection.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": update_doc}
    )

    # Return updated document
    doc = await collection.find_one({"_id": ObjectId(payment_id)})
    doc["_id"] = str(doc["_id"])
    return Payment(**doc)

class RefundRequest(BaseModel):
    amount: Decimal
    reason: Optional[str] = None
    refund_method: Optional[str] = None

@router.put("/{payment_id}/refund", response_model=Payment)
async def refund_payment(
    payment_id: str,
    request: RefundRequest,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payments_collection)
):
    """Process a refund for a payment"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(payment_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payment ID"
        )

    # Check if payment exists
    existing = await collection.find_one({"_id": ObjectId(payment_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Check if payment can be refunded
    if existing.get("status") not in ["completed", "verified"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only completed or verified payments can be refunded"
        )

    # Check refund amount
    total_amount = Decimal(str(existing.get("total_amount") or existing.get("amount", 0)))
    already_refunded = Decimal(str(existing.get("refund_amount", 0)))
    refund_amount = request.amount

    if refund_amount > (total_amount - already_refunded):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Refund amount exceeds remaining payment amount"
        )

    # Determine new status
    new_status = "partial_refund" if refund_amount < (total_amount - already_refunded) else "refunded"

    # Update payment
    update_doc = {
        "status": new_status,
        "refund_amount": str(already_refunded + refund_amount),
        "refund_date": datetime.now(),
        "refund_reference": request.refund_method,
        "cancellation_reason": request.reason,  # Reuse this field for refund reason
        "updated_at": datetime.now(),
        "updated_by": current_user.get("user_id") or current_user.get("id")
    }

    await collection.update_one(
        {"_id": ObjectId(payment_id)},
        {"$set": update_doc}
    )

    # Return updated document
    doc = await collection.find_one({"_id": ObjectId(payment_id)})
    doc["_id"] = str(doc["_id"])
    return Payment(**doc)

@router.get("/summary/branch", response_model=PaymentSummary)
async def get_payment_summary(
    branch_id: str,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payments_collection)
):
    """Get payment summary for a branch"""
    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Build query
    query = {"branch_id": branch_id, "status": {"$ne": "cancelled"}}

    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = datetime.combine(date_from, datetime.min.time())
        if date_to:
            date_filter["$lte"] = datetime.combine(date_to, datetime.max.time())
        query["payment_date"] = date_filter

    # Aggregate data
    pipeline = [
        {"$match": query},
        {
            "$group": {
                "_id": None,
                "total_payments": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$total_amount"}},
                "total_discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                "total_tax": {"$sum": {"$toDecimal": "$tax_amount"}},
                "total_late_fees": {"$sum": {"$toDecimal": "$late_fee_amount"}},
                "payment_methods": {"$push": "$payment_method"},
                "statuses": {"$push": "$status"}
            }
        }
    ]

    result = await collection.aggregate(pipeline).to_list(1)

    if not result:
        return PaymentSummary(
            total_payments=0,
            total_amount=Decimal("0"),
            total_discount=Decimal("0"),
            total_tax=Decimal("0"),
            total_late_fees=Decimal("0"),
            payment_methods={},
            status_breakdown={}
        )

    data = result[0]

    # Count payment methods and statuses
    payment_methods = {}
    for method in data.get("payment_methods", []):
        payment_methods[method] = payment_methods.get(method, 0) + 1

    status_breakdown = {}
    for status in data.get("statuses", []):
        status_breakdown[status] = status_breakdown.get(status, 0) + 1

    return PaymentSummary(
        total_payments=data.get("total_payments", 0),
        total_amount=data.get("total_amount", Decimal("0")),
        total_discount=data.get("total_discount", Decimal("0")),
        total_tax=data.get("total_tax", Decimal("0")),
        total_late_fees=data.get("total_late_fees", Decimal("0")),
        payment_methods=payment_methods,
        status_breakdown=status_breakdown
    )

# Helper function for notifications (placeholder)
async def send_payment_notification(payment_id: str, email: str):
    """Send payment notification email"""
    # This would integrate with your notification system
    print(f"Sending payment notification for {payment_id} to {email}")
    pass
