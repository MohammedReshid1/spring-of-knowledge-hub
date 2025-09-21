from typing import List, Any
from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_fees_collection, get_registration_payments_collection, validate_branch_id, validate_student_id
from ..models.fee import FeeCreate, Fee
from ..models.registration_payment import RegistrationPaymentCreate, RegistrationPayment
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

# Registration Payment endpoints (must come before general fee endpoints to avoid routing conflicts)
@router.post("/registration-payments", response_model=RegistrationPayment)
async def create_registration_payment(
    payment_in: RegistrationPaymentCreate,
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = payment_in.dict()
    # convert payment_date to datetime for MongoDB
    if doc.get("payment_date") is not None:
        doc["payment_date"] = datetime.combine(doc["payment_date"], time())
    # validate student_id if provided
    if doc.get("student_id") is not None:
        await validate_student_id(doc["student_id"])
    # validate branch_id if provided
    if doc.get("branch_id") is not None:
        await validate_branch_id(doc["branch_id"])
    
    # Check for existing registration payment for this student in the same academic year
    existing_payment = await coll.find_one({
        "student_id": doc.get("student_id"),
        "payment_cycle": "registration_fee",
        "academic_year": doc.get("academic_year")
    })
    
    if existing_payment:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A registration fee payment already exists for this student in academic year {doc.get('academic_year')}. Use the existing payment record to add additional payments."
        )
    
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await coll.insert_one(doc)
    return RegistrationPayment(id=str(result.inserted_id), **doc)

@router.get("/registration-payments", response_model=List[RegistrationPayment])
async def list_registration_payments(
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[RegistrationPayment] = []
    async for p in coll.find():
        items.append(RegistrationPayment(id=str(p["_id"]), **{k: p.get(k) for k in p}))
    return items

@router.get("/registration-payments/{payment_id}", response_model=RegistrationPayment)
async def get_registration_payment(
    payment_id: str,
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    p = await coll.find_one({"_id": ObjectId(payment_id)})
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RegistrationPayment not found")
    return RegistrationPayment(id=payment_id, **{k: p.get(k) for k in p})

@router.put("/registration-payments/{payment_id}", response_model=RegistrationPayment)
async def update_registration_payment(
    payment_id: str,
    payment_in: RegistrationPaymentCreate,
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    update_data = payment_in.dict()
    # convert payment_date to datetime for MongoDB
    if update_data.get("payment_date") is not None:
        update_data["payment_date"] = datetime.combine(update_data["payment_date"], time())
    update_data["updated_at"] = now
    # validate student_id if provided
    if update_data.get("student_id") is not None:
        await validate_student_id(update_data["student_id"])
    # validate branch_id if provided
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    res = await coll.update_one({"_id": ObjectId(payment_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RegistrationPayment not found")
    p = await coll.find_one({"_id": ObjectId(payment_id)})
    # Return updated registration payment without duplicating 'id' keyword
    return RegistrationPayment(id=payment_id, **{k: p.get(k) for k in p})

@router.delete("/registration-payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_registration_payment(
    payment_id: str,
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(payment_id)})

# Fee endpoints
@router.post("/", response_model=Fee)
async def create_fee(
    fee_in: FeeCreate,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = fee_in.dict()
    # validate student_id if provided
    if doc.get("student_id") is not None:
        await validate_student_id(doc["student_id"])
    # convert date fields to datetime for MongoDB
    doc["due_date"] = datetime.combine(doc["due_date"], time())
    if doc.get("paid_date") is not None:
        doc["paid_date"] = datetime.combine(doc["paid_date"], time())
    # validate branch_id if provided
    if doc.get("branch_id") is not None:
        await validate_branch_id(doc["branch_id"])
    
    # Check for existing fee of the same type for this student in the same academic year
    existing_fee = await coll.find_one({
        "student_id": doc.get("student_id"),
        "fee_type": doc.get("fee_type"),
        "academic_year": doc.get("academic_year")
    })
    
    if existing_fee:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A {doc.get('fee_type')} fee already exists for this student in academic year {doc.get('academic_year')}. Use the existing fee record to add payments."
        )
    
    # Set default values for new fields
    doc["payment_method"] = doc.get("payment_method", "Cash")
    doc["notes"] = doc.get("notes", "")
    doc["amount_paid"] = doc.get("amount_paid", 0)
    
    # Calculate remaining amount
    total_amount = doc.get("amount", 0)
    amount_paid = doc.get("amount_paid", 0)
    doc["remaining_amount"] = total_amount - amount_paid
    
    # Set status based on payment
    if amount_paid >= total_amount:
        doc["status"] = "paid"
    elif amount_paid > 0:
        doc["status"] = "partial"
    else:
        doc["status"] = "pending"
    
    doc["created_at"] = now
    result = await coll.insert_one(doc)
    return Fee(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[Fee])
async def list_fees(
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[Fee] = []
    async for f in coll.find():
        items.append(Fee(id=str(f["_id"]), **{k: f.get(k) for k in f}))
    return items

@router.get("/{fee_id}", response_model=Fee)
async def get_fee(
    fee_id: str,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    f = await coll.find_one({"_id": ObjectId(fee_id)})
    if not f:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee not found")
    return Fee(id=fee_id, **{k: f.get(k) for k in f})

@router.put("/{fee_id}", response_model=Fee)
async def update_fee(
    fee_id: str,
    fee_in: FeeCreate,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    update_data = fee_in.dict()
    # validate student_id if provided
    if update_data.get("student_id") is not None:
        await validate_student_id(update_data["student_id"])
    # convert date fields to datetime for MongoDB
    update_data["due_date"] = datetime.combine(update_data["due_date"], time())
    if update_data.get("paid_date") is not None:
        update_data["paid_date"] = datetime.combine(update_data["paid_date"], time())
    # validate branch_id if provided
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    
    # Set default values for new fields
    update_data["payment_method"] = update_data.get("payment_method", "Cash")
    update_data["notes"] = update_data.get("notes", "")
    update_data["amount_paid"] = update_data.get("amount_paid", 0)
    
    # Calculate remaining amount
    total_amount = update_data.get("amount", 0)
    amount_paid = update_data.get("amount_paid", 0)
    update_data["remaining_amount"] = total_amount - amount_paid
    
    # Set status based on payment
    if amount_paid >= total_amount:
        update_data["status"] = "paid"
    elif amount_paid > 0:
        update_data["status"] = "partial"
    else:
        update_data["status"] = "pending"
    
    res = await coll.update_one({"_id": ObjectId(fee_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee not found")
    
    # Return updated fee
    updated_fee = await coll.find_one({"_id": ObjectId(fee_id)})
    return Fee(id=fee_id, **{k: updated_fee.get(k) for k in updated_fee})

@router.delete("/{fee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fee(
    fee_id: str,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    res = await coll.delete_one({"_id": ObjectId(fee_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee not found")

@router.get("/check-existing/{student_id}")
async def check_existing_fees(
    student_id: str,
    academic_year: str,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    """Check what fees already exist for a student in a given academic year"""
    existing_fees = await coll.find({
        "student_id": student_id,
        "academic_year": academic_year
    }).to_list(length=100)
    
    fee_types = [fee["fee_type"] for fee in existing_fees]
    return {
        "existing_fees": fee_types,
        "fee_details": [
            {
                "id": str(fee["_id"]),
                "fee_type": fee["fee_type"],
                "status": fee.get("status", "pending"),
                "amount": fee.get("amount", 0),
                "amount_paid": fee.get("amount_paid", 0),
                "remaining_amount": fee.get("remaining_amount", 0)
            }
            for fee in existing_fees
        ]
    }

@router.post("/{fee_id}/add-payment", response_model=Fee)
async def add_partial_payment_to_fee(
    fee_id: str,
    additional_payment: dict,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    """Add an additional payment to an existing fee record"""
    now = datetime.utcnow()
    existing_fee = await coll.find_one({"_id": ObjectId(fee_id)})
    if not existing_fee:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee not found")
    
    current_amount_paid = existing_fee.get("amount_paid", 0)
    additional_amount = float(additional_payment.get("amount", 0) or 0)
    new_amount_paid = current_amount_paid + additional_amount
    total_amount = existing_fee.get("amount", 0)
    
    if new_amount_paid >= total_amount:
        status = "paid"
        remaining_amount = 0
    else:
        status = "partial"
        remaining_amount = total_amount - new_amount_paid
    
    update_data = {
        "amount_paid": new_amount_paid,
        "status": status,
        "remaining_amount": remaining_amount,
        "payment_method": additional_payment.get("payment_method", "Cash"),
        "notes": additional_payment.get("notes", ""),
        "paid_date": now
    }
    
    await coll.update_one({"_id": ObjectId(fee_id)}, {"$set": update_data})
    updated_fee = await coll.find_one({"_id": ObjectId(fee_id)})
    return Fee(id=fee_id, **{k: updated_fee.get(k) for k in updated_fee})
