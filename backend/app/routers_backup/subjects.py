from typing import List, Any
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_subjects_collection
from ..models.subject import SubjectCreate, Subject
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=Subject)
async def create_subject(
    subject_in: SubjectCreate,
    coll: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = subject_in.dict()
    doc["created_at"] = now
    result = await coll.insert_one(doc)
    return Subject(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[Subject])
async def list_subjects(
    coll: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[Subject] = []
    async for s in coll.find():
        items.append(Subject(id=str(s["_id"]), **{k: s.get(k) for k in s}))
    return items

@router.get("/{subject_id}", response_model=Subject)
async def get_subject(
    subject_id: str,
    coll: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    s = await coll.find_one({"_id": ObjectId(subject_id)})
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return Subject(id=subject_id, **{k: s.get(k) for k in s})

@router.put("/{subject_id}", response_model=Subject)
async def update_subject(
    subject_id: str,
    subject_in: SubjectCreate,
    coll: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    res = await coll.update_one({"_id": ObjectId(subject_id)}, {"$set": subject_in.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subject not found")
    return Subject(id=subject_id, **subject_in.dict())

@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_subject(
    subject_id: str,
    coll: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(subject_id)})
