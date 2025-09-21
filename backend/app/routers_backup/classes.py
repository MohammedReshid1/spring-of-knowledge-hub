from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from ..db import get_classes_collection, validate_branch_id, validate_grade_level_id, validate_teacher_id, get_student_collection
from ..models.school_class import SchoolClassCreate, SchoolClass
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=SchoolClass)
async def create_class(
    class_in: SchoolClassCreate,
    coll: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = class_in.dict()
    doc["created_at"] = now
    doc["updated_at"] = now
    # validate foreign IDs
    await validate_grade_level_id(doc["grade_level_id"])
    if doc.get("teacher_id") is not None:
        await validate_teacher_id(doc["teacher_id"])
    if doc.get("branch_id") is not None:
        await validate_branch_id(doc["branch_id"])
    result = await coll.insert_one(doc)
    return SchoolClass(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[SchoolClass])
async def list_classes(
    coll: Any = Depends(get_classes_collection),
    student_coll: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[SchoolClass] = []
    async for c in coll.find():
        # compute current enrollment dynamically
        class_id_str = str(c["_id"])
        count = await student_coll.count_documents({"class_id": class_id_str})
        # prepare class data overriding stored current_enrollment
        data = {k: c.get(k) for k in c}
        data["current_enrollment"] = count
        items.append(SchoolClass(id=class_id_str, **data))
    return items

@router.get("/{class_id}", response_model=SchoolClass)
async def get_class(
    class_id: str,
    coll: Any = Depends(get_classes_collection),
    student_coll: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    c = await coll.find_one({"_id": ObjectId(class_id)})
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SchoolClass not found")
    # compute current enrollment
    count = await student_coll.count_documents({"class_id": class_id})
    data = {k: c.get(k) for k in c}
    data["current_enrollment"] = count
    return SchoolClass(id=class_id, **data)

@router.put("/{class_id}", response_model=SchoolClass)
async def update_class(
    class_id: str,
    class_in: SchoolClassCreate,
    coll: Any = Depends(get_classes_collection),
    student_coll: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    update_data = class_in.dict()
    update_data["updated_at"] = now
    # validate foreign IDs
    if update_data.get("grade_level_id") is not None:
        await validate_grade_level_id(update_data["grade_level_id"])
    if update_data.get("teacher_id") is not None:
        await validate_teacher_id(update_data["teacher_id"])
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    res = await coll.update_one({"_id": ObjectId(class_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SchoolClass not found")
    c = await coll.find_one({"_id": ObjectId(class_id)})
    # recompute enrollment count
    count = await student_coll.count_documents({"class_id": class_id})
    return SchoolClass(
        id=class_id,
        grade_level_id=c.get("grade_level_id"),
        class_name=c.get("class_name"),
        max_capacity=c.get("max_capacity"),
        current_enrollment=count,
        teacher_id=c.get("teacher_id"),
        academic_year=c.get("academic_year"),
        branch_id=c.get("branch_id"),
        created_at=c.get("created_at"),
        updated_at=c.get("updated_at"),
    )

@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: str,
    coll: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(class_id)})
