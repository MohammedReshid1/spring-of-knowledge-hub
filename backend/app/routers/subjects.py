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
    # Only admin and superadmin can create subjects
    if current_user.get("role") not in ["admin", "superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create subjects"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") not in ["superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    now = datetime.utcnow()
    doc = subject_in.dict()
    doc["created_at"] = now
    doc["branch_id"] = branch_id  # Add branch filtering
    
    result = await coll.insert_one(doc)
    return Subject(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[Subject])
async def list_subjects(
    coll: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    # Build query based on user role
    query = {}
    
    if current_user.get("role") in ["superadmin", "super_admin"]:
        # Superadmin sees all subjects
        pass
    else:
        # Regular users see only their branch's subjects
        branch_id = current_user.get("branch_id")
        if not branch_id:
            return []  # No branch = no data
        query["branch_id"] = branch_id
    
    items: List[Subject] = []
    async for s in coll.find(query):
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
