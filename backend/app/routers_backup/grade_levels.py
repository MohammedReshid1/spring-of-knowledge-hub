from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from ..db import get_grade_levels_collection
from ..models.grade_level import GradeLevelCreate, GradeLevel
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=GradeLevel)
async def create_grade_level(
    grade_level_in: GradeLevelCreate,
    coll: Any = Depends(get_grade_levels_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = grade_level_in.dict()
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await coll.insert_one(doc)
    return GradeLevel(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[GradeLevel])
async def list_grade_levels(
    coll: Any = Depends(get_grade_levels_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[GradeLevel] = []
    async for g in coll.find():
        items.append(GradeLevel(
            id=str(g["_id"]),
            grade=g.get("grade"),
            max_capacity=g.get("max_capacity"),
            current_enrollment=g.get("current_enrollment"),
            created_at=g.get("created_at"),
            updated_at=g.get("updated_at"),
        ))
    return items

@router.get("/{grade_level_id}", response_model=GradeLevel)
async def get_grade_level(
    grade_level_id: str,
    coll: Any = Depends(get_grade_levels_collection),
    current_user: User = Depends(get_current_user),
):
    g = await coll.find_one({"_id": ObjectId(grade_level_id)})
    if not g:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GradeLevel not found")
    return GradeLevel(
        id=grade_level_id,
        grade=g.get("grade"),
        max_capacity=g.get("max_capacity"),
        current_enrollment=g.get("current_enrollment"),
        created_at=g.get("created_at"),
        updated_at=g.get("updated_at"),
    )

@router.put("/{grade_level_id}", response_model=GradeLevel)
async def update_grade_level(
    grade_level_id: str,
    grade_level_in: GradeLevelCreate,
    coll: Any = Depends(get_grade_levels_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    update_data = grade_level_in.dict()
    update_data["updated_at"] = now
    res = await coll.update_one({"_id": ObjectId(grade_level_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="GradeLevel not found")
    g = await coll.find_one({"_id": ObjectId(grade_level_id)})
    return GradeLevel(
        id=grade_level_id,
        grade=g.get("grade"),
        max_capacity=g.get("max_capacity"),
        current_enrollment=g.get("current_enrollment"),
        created_at=g.get("created_at"),
        updated_at=g.get("updated_at"),
    )

@router.delete("/{grade_level_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade_level(
    grade_level_id: str,
    coll: Any = Depends(get_grade_levels_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(grade_level_id)})
