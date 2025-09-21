from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from datetime import datetime
import io

from ..models.payment_receipt import (
    PaymentReceipt,
    PaymentReceiptCreate,
    PaymentReceiptUpdate,
    ReceiptTemplate,
    ReceiptGenerationRequest,
    BulkReceiptGenerationRequest
)
from ..db import (
    get_payment_receipts_collection,
    get_receipt_templates_collection,
    get_payments_collection,
    get_payment_details_collection,
    get_students_collection,
    get_branches_collection,
    validate_payment_id,
    validate_branch_id
)
from ..utils.rbac import get_current_user, has_permission, Permission
from ..utils.receipt_generator import PaymentReceiptGenerator, create_default_receipt_template, ReceiptGeneratorError

router = APIRouter()

@router.post("/generate", status_code=status.HTTP_201_CREATED)
async def generate_receipt(
    request: ReceiptGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    receipts_collection: AsyncIOMotorCollection = Depends(get_payment_receipts_collection),
    templates_collection: AsyncIOMotorCollection = Depends(get_receipt_templates_collection),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    branches_collection: AsyncIOMotorCollection = Depends(get_branches_collection)
):
    """Generate a payment receipt"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_payment_id(request.payment_id)

    # Get payment information
    payment = await payments_collection.find_one({"_id": ObjectId(request.payment_id)})
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    print(f"📄 Payment data keys: {list(payment.keys())}")
    print(f"📄 Payment receipt_number: {payment.get('receipt_number')}")
    print(f"📄 Payment amount: {payment.get('amount')}")
    print(f"📄 Payment student_id: {payment.get('student_id')}")

    # Get payment details
    payment_details = await payment_details_collection.find({
        "payment_id": request.payment_id
    }).to_list(None)

    # Get student information
    student_ref = payment.get("student_id")
    print(f"🔍 Looking for student with reference: {student_ref}")
    student = None

    # Try by MongoDB _id first (most common case)
    if student_ref and ObjectId.is_valid(student_ref):
        student = await students_collection.find_one({"_id": ObjectId(student_ref)})
        if student:
            print(f"✅ Found student by _id: {student.get('first_name')} {student.get('father_name', '')} {student.get('grandfather_name', '')}")

    # Try by student_id field if not found
    if not student:
        student = await students_collection.find_one({"student_id": student_ref})
        if student:
            print(f"✅ Found student by student_id field: {student.get('first_name')} {student.get('father_name', '')} {student.get('grandfather_name', '')}")

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student information not found"
        )

    # Get branch information
    branch = await branches_collection.find_one({"_id": ObjectId(payment["branch_id"])})
    if not branch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Branch information not found"
        )

    # Get template
    template = None
    if request.template_id:
        template_doc = await templates_collection.find_one({"_id": ObjectId(request.template_id)})
        if template_doc:
            template_doc["_id"] = str(template_doc["_id"])
            template = ReceiptTemplate(**template_doc)
    else:
        # Use default template
        default_template = await templates_collection.find_one({
            "branch_id": payment["branch_id"],
            "is_default": True,
            "is_active": True
        })
        if default_template:
            default_template["_id"] = str(default_template["_id"])
            template = ReceiptTemplate(**default_template)

    # If no template found, create a default one
    if not template:
        template = create_default_receipt_template(payment["branch_id"])

    try:
        # Convert data for generator
        payment_data = {
            **payment,
            "_id": str(payment["_id"])
        }

        student_data = {
            **student,
            "_id": str(student["_id"])
        }

        branch_data = {
            **branch,
            "_id": str(branch["_id"])
        }

        details_data = []
        for detail in payment_details:
            details_data.append({
                **detail,
                "_id": str(detail["_id"])
            })

        # Generate receipt based on format
        if request.format == "html":
            # Try using generator if available; otherwise build a simple HTML fallback
            try:
                generator = PaymentReceiptGenerator()
                receipt_content = generator.generate_receipt_html(
                    payment_data, details_data, student_data, branch_data, template
                )
            except ReceiptGeneratorError:
                # Minimal HTML fallback without ReportLab
                safe_receipt_no = payment.get("receipt_number") or payment.get("receipt_no") or str(payment.get("_id"))
                rows = []
                from decimal import Decimal
                for d in details_data:
                    orig = Decimal(str(d.get('original_amount', 0)))
                    disc = Decimal(str(d.get('discount_amount', 0)))
                    paid = Decimal(str(d.get('paid_amount', 0)))
                    rows.append(f"<tr><td>{d.get('fee_category_name','')}</td><td>{orig:,.2f}</td><td>{disc:,.2f}</td><td>{paid:,.2f}</td></tr>")
                total = payment.get('total_amount') or payment.get('amount') or 0
                html = f"""
                <!DOCTYPE html>
                <html><head><meta charset='utf-8'><title>Receipt {safe_receipt_no}</title>
                <style>body{{font-family:Arial,sans-serif;margin:20px}}table{{width:100%;border-collapse:collapse}}th,td{{border:1px solid #ddd;padding:8px;text-align:left}}th{{background:#f2f2f2}}</style>
                </head><body>
                <h2>Payment Receipt</h2>
                <p><strong>Receipt #</strong>: {safe_receipt_no}</p>
                <p><strong>Student</strong>: {student_data.get('first_name','')} {student_data.get('father_name','')} {student_data.get('grandfather_name','')}</p>
                <table><thead><tr><th>Fee Category</th><th>Amount</th><th>Discount</th><th>Total</th></tr></thead><tbody>
                {''.join(rows)}
                <tr><td colspan='3'><strong>Total Paid</strong></td><td><strong>{Decimal(str(total)):,.2f}</strong></td></tr>
                </tbody></table>
                </body></html>
                """
                receipt_content = html
            media_type = "text/html"
            file_extension = "html"
        else:  # PDF (default)
            try:
                generator = PaymentReceiptGenerator()
            except ReceiptGeneratorError as e:
                raise HTTPException(status_code=400, detail=str(e))
            receipt_content = await generator.generate_receipt(
                payment_data, details_data, student_data, branch_data, template
            )
            media_type = "application/pdf"
            file_extension = "pdf"

        # Save receipt record
        safe_receipt_no = payment.get("receipt_number") or payment.get("receipt_no") or str(payment.get("_id"))
        generated_by = current_user.get("user_id") or current_user.get("id") or "system"
        receipt_record = PaymentReceiptCreate(
            payment_id=request.payment_id,
            receipt_number=safe_receipt_no,
            template_id=request.template_id,
            generated_by=generated_by,
            file_size=len(receipt_content) if isinstance(receipt_content, bytes) else len(receipt_content.encode()),
            branch_id=payment["branch_id"]
        )

        receipt_doc = receipt_record.dict()
        receipt_doc["created_at"] = datetime.now()

        # Insert receipt record
        receipt_result = await receipts_collection.insert_one(receipt_doc)
        receipt_id = str(receipt_result.inserted_id)

        # Send notifications if requested
        if request.send_email and request.email_addresses:
            background_tasks.add_task(
                send_receipt_email,
                receipt_id,
                request.email_addresses,
                receipt_content,
                file_extension
            )

        if request.send_sms and request.phone_numbers:
            background_tasks.add_task(
                send_receipt_sms,
                receipt_id,
                request.phone_numbers,
                payment_data
            )

        # Return receipt as download
        # Use receipt_number when available, fallback to receipt_no for backward compatibility
        receipt_no = payment.get('receipt_number') or payment.get('receipt_no') or 'receipt'
        filename = f"receipt_{receipt_no}.{file_extension}"

        if isinstance(receipt_content, str):
            content_bytes = receipt_content.encode()
        else:
            content_bytes = receipt_content

        return StreamingResponse(
            io.BytesIO(content_bytes),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Receipt-ID": receipt_id
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate receipt: {str(e)}"
        )

@router.post("/generate-bulk", status_code=status.HTTP_201_CREATED)
async def generate_bulk_receipts(
    request: BulkReceiptGenerationRequest,
    current_user: dict = Depends(get_current_user),
    receipts_collection: AsyncIOMotorCollection = Depends(get_payment_receipts_collection),
    templates_collection: AsyncIOMotorCollection = Depends(get_receipt_templates_collection),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    branches_collection: AsyncIOMotorCollection = Depends(get_branches_collection)
):
    """Generate receipts for multiple payments"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not request.payment_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one payment ID is required"
        )

    # Validate all payment IDs
    for payment_id in request.payment_ids:
        await validate_payment_id(payment_id)

    try:
        # Initialize generator
        generator = PaymentReceiptGenerator()

        # Collect all payment data
        all_receipts_data = []

        for payment_id in request.payment_ids:
            # Get payment data (similar to single receipt generation)
            payment = await payments_collection.find_one({"_id": ObjectId(payment_id)})
            if not payment:
                continue  # Skip missing payments

            payment_details = await payment_details_collection.find({
                "payment_id": payment_id
            }).to_list(None)

            student = await students_collection.find_one({"student_id": payment["student_id"]})
            if not student and ObjectId.is_valid(payment["student_id"]):
                student = await students_collection.find_one({"_id": ObjectId(payment["student_id"])})

            branch = await branches_collection.find_one({"_id": ObjectId(payment["branch_id"])})

            if student and branch:
                all_receipts_data.append({
                    "payment": {**payment, "_id": str(payment["_id"])},
                    "details": [{**d, "_id": str(d["_id"])} for d in payment_details],
                    "student": {**student, "_id": str(student["_id"])},
                    "branch": {**branch, "_id": str(branch["_id"])}
                })

        if not all_receipts_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No valid payments found"
            )

        # Get template
        template = None
        if request.template_id:
            template_doc = await templates_collection.find_one({"_id": ObjectId(request.template_id)})
            if template_doc:
                template_doc["_id"] = str(template_doc["_id"])
                template = ReceiptTemplate(**template_doc)

        # Generate bulk receipts
        if request.combine_pdf and request.format == "pdf":
            # Generate combined PDF
            receipt_content = await generator.generate_bulk_receipts(all_receipts_data, template)
            filename = f"bulk_receipts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            media_type = "application/pdf"
        else:
            # For now, just generate the first receipt
            # In a full implementation, you'd create a ZIP file with individual receipts
            if all_receipts_data:
                first_receipt = all_receipts_data[0]
                receipt_content = await generator.generate_receipt(
                    first_receipt["payment"],
                    first_receipt["details"],
                    first_receipt["student"],
                    first_receipt["branch"],
                    template
                )
                filename = f"receipt_{first_receipt['payment']['receipt_no']}.pdf"
                media_type = "application/pdf"

        return StreamingResponse(
            io.BytesIO(receipt_content),
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate bulk receipts: {str(e)}"
        )

@router.get("/", response_model=List[PaymentReceipt])
async def get_receipts(
    payment_id: Optional[str] = None,
    branch_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payment_receipts_collection)
):
    """Get payment receipts"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Build query
    query = {}
    if payment_id:
        await validate_payment_id(payment_id)
        query["payment_id"] = payment_id

    if branch_id:
        await validate_branch_id(branch_id)
        query["branch_id"] = branch_id

    # Execute query
    cursor = collection.find(query).skip(skip).limit(limit).sort("generated_at", -1)
    receipts = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        receipts.append(PaymentReceipt(**doc))

    return receipts

@router.get("/{receipt_id}", response_model=PaymentReceipt)
async def get_receipt(
    receipt_id: str,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payment_receipts_collection)
):
    """Get a specific receipt"""

    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(receipt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid receipt ID"
        )

    doc = await collection.find_one({"_id": ObjectId(receipt_id)})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    doc["_id"] = str(doc["_id"])
    return PaymentReceipt(**doc)

@router.put("/{receipt_id}", response_model=PaymentReceipt)
async def update_receipt(
    receipt_id: str,
    update_data: PaymentReceiptUpdate,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payment_receipts_collection)
):
    """Update receipt information"""

    if not has_permission(current_user.get("role"), Permission.UPDATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(receipt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid receipt ID"
        )

    # Prepare update document
    update_doc = {k: v for k, v in update_data.dict().items() if v is not None}

    if update_doc:
        update_doc["updated_at"] = datetime.now()

        # Update document
        result = await collection.update_one(
            {"_id": ObjectId(receipt_id)},
            {"$set": update_doc}
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Receipt not found"
            )

    # Return updated document
    doc = await collection.find_one({"_id": ObjectId(receipt_id)})
    doc["_id"] = str(doc["_id"])
    return PaymentReceipt(**doc)

@router.post("/{receipt_id}/resend")
async def resend_receipt(
    receipt_id: str,
    email_addresses: Optional[List[str]] = None,
    phone_numbers: Optional[List[str]] = None,
    whatsapp_numbers: Optional[List[str]] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_payment_receipts_collection)
):
    """Resend receipt via email/SMS"""

    if not has_permission(current_user.get("role"), Permission.UPDATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(receipt_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid receipt ID"
        )

    receipt = await collection.find_one({"_id": ObjectId(receipt_id)})
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receipt not found"
        )

    # Schedule notifications
    if email_addresses:
        background_tasks.add_task(
            resend_receipt_email,
            receipt_id,
            email_addresses
        )

    if phone_numbers:
        background_tasks.add_task(
            resend_receipt_sms,
            receipt_id,
            phone_numbers
        )

    if whatsapp_numbers:
        background_tasks.add_task(
            resend_receipt_whatsapp,
            receipt_id,
            whatsapp_numbers
        )

    return {"message": "Receipt resend scheduled"}

# Background task functions (placeholders)
async def send_receipt_email(
    receipt_id: str,
    email_addresses: List[str],
    receipt_content: bytes,
    file_extension: str
):
    """Send receipt via email"""
    # Implement email sending logic
    print(f"Sending receipt {receipt_id} to {email_addresses}")

async def send_receipt_sms(
    receipt_id: str,
    phone_numbers: List[str],
    payment_data: Dict[str, Any]
):
    """Send receipt notification via SMS"""
    # Implement SMS sending logic
    print(f"Sending SMS notification for receipt {receipt_id} to {phone_numbers}")

async def resend_receipt_email(receipt_id: str, email_addresses: List[str]):
    """Resend receipt via email"""
    print(f"Resending receipt {receipt_id} to {email_addresses}")

async def resend_receipt_sms(receipt_id: str, phone_numbers: List[str]):
    """Resend receipt via SMS"""
    print(f"Resending SMS for receipt {receipt_id} to {phone_numbers}")

async def resend_receipt_whatsapp(receipt_id: str, whatsapp_numbers: List[str]):
    """Resend receipt via WhatsApp"""
    print(f"Resending WhatsApp message for receipt {receipt_id} to {whatsapp_numbers}")
