from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, time

from ..db import get_registration_payments_collection, validate_branch_id, validate_student_id
from ..models.registration_payment import RegistrationPaymentCreate, RegistrationPayment
from .users import get_current_user, User

router = APIRouter()

@router.post("/", response_model=RegistrationPayment)
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
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await coll.insert_one(doc)
    return RegistrationPayment(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[RegistrationPayment])
async def list_registration_payments(
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[RegistrationPayment] = []
    async for p in coll.find():
        items.append(RegistrationPayment(id=str(p["_id"]), **{k: p.get(k) for k in p}))
    return items

@router.get("/{payment_id}", response_model=RegistrationPayment)
async def get_registration_payment(
    payment_id: str,
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    p = await coll.find_one({"_id": ObjectId(payment_id)})
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="RegistrationPayment not found")
    return RegistrationPayment(id=payment_id, **{k: p.get(k) for k in p})

@router.put("/{payment_id}", response_model=RegistrationPayment)
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
    return RegistrationPayment(id=payment_id, **{**p, "id": payment_id})

@router.delete("/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_registration_payment(
    payment_id: str,
    coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(payment_id)})
