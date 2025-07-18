from typing import List, Any
from datetime import datetime, time
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_fees_collection, validate_branch_id, validate_student_id
from ..models.fee import FeeCreate, Fee
from .users import get_current_user, User

router = APIRouter()

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
    res = await coll.update_one({"_id": ObjectId(fee_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fee not found")
    return Fee(id=fee_id, **fee_in.dict())

@router.delete("/{fee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fee(
    fee_id: str,
    coll: Any = Depends(get_fees_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(fee_id)})
