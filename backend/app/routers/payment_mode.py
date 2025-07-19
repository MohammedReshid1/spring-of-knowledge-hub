from typing import List, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_payment_mode_collection
from ..models.payment_mode import PaymentModeCreate, PaymentMode
from .users import get_current_user, User

router = APIRouter()

@router.post("/", response_model=PaymentMode)
async def create_payment_mode(
    pm_in: PaymentModeCreate,
    coll: Any = Depends(get_payment_mode_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = pm_in.dict()
    doc["created_at"] = now
    result = await coll.insert_one(doc)
    return PaymentMode(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[PaymentMode])
async def list_payment_modes(
    coll: Any = Depends(get_payment_mode_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[PaymentMode] = []
    async for p in coll.find():
        items.append(PaymentMode(id=str(p["_id"]), **{k: p.get(k) for k in p}))
    return items

@router.get("/{pm_id}", response_model=PaymentMode)
async def get_payment_mode(
    pm_id: str,
    coll: Any = Depends(get_payment_mode_collection),
    current_user: User = Depends(get_current_user),
):
    p = await coll.find_one({"_id": ObjectId(pm_id)})
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PaymentMode not found")
    return PaymentMode(id=pm_id, **{k: p.get(k) for k in p})

@router.put("/{pm_id}", response_model=PaymentMode)
async def update_payment_mode(
    pm_id: str,
    pm_in: PaymentModeCreate,
    coll: Any = Depends(get_payment_mode_collection),
    current_user: User = Depends(get_current_user),
):
    res = await coll.update_one({"_id": ObjectId(pm_id)}, {"$set": pm_in.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="PaymentMode not found")
    return PaymentMode(id=pm_id, **pm_in.dict())

@router.delete("/{pm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_payment_mode(
    pm_id: str,
    coll: Any = Depends(get_payment_mode_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(pm_id)})
