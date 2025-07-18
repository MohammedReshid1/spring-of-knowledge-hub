from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, time

from ..db import get_grade_transitions_collection
from ..models.grade_transition import GradeTransitionCreate, GradeTransition
from .users import get_current_user, User

router = APIRouter()

@router.post("/", response_model=GradeTransition)
async def create_grade_transition(
    transition_in: GradeTransitionCreate,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = transition_in.dict()
    # convert transition_date to datetime for MongoDB
    doc["transition_date"] = datetime.combine(doc["transition_date"], time())
    doc["created_at"] = now
    result = await coll.insert_one(doc)
    return GradeTransition(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[GradeTransition])
async def list_grade_transitions(
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[GradeTransition] = []
    async for g in coll.find():
        items.append(GradeTransition(id=str(g["_id"]), **{k: g.get(k) for k in g}))
    return items

@router.get("/{transition_id}", response_model=GradeTransition)
async def get_grade_transition(
    transition_id: str,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    g = await coll.find_one({"_id": ObjectId(transition_id)})
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GradeTransition not found")
    return GradeTransition(id=transition_id, **{k: g.get(k) for k in g})

@router.put("/{transition_id}", response_model=GradeTransition)
async def update_grade_transition(
    transition_id: str,
    transition_in: GradeTransitionCreate,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    # convert transition_date to datetime for MongoDB
    update_data = transition_in.dict()
    update_data["transition_date"] = datetime.combine(update_data["transition_date"], time())
    res = await coll.update_one({"_id": ObjectId(transition_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GradeTransition not found")
    # return updated document
    g = await coll.find_one({"_id": ObjectId(transition_id)})
    return GradeTransition(id=transition_id, **{k: g.get(k) for k in g})

@router.delete("/{transition_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade_transition(
    transition_id: str,
    coll: Any = Depends(get_grade_transitions_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(transition_id)})
