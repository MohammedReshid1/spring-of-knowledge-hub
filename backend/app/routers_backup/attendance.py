from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_attendance_collection, validate_branch_id, validate_student_id, validate_class_id
from ..models.attendance import AttendanceCreate, Attendance
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

from datetime import datetime, time

@router.post("/", response_model=Attendance)
async def create_attendance(
    attendance_in: AttendanceCreate,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = attendance_in.dict()
    # convert date to datetime
    if doc.get("attendance_date") is not None:
        doc["attendance_date"] = datetime.combine(doc["attendance_date"], time())
    doc["created_at"] = now
    # validate foreign IDs
    await validate_student_id(doc["student_id"])
    await validate_class_id(doc["class_id"])
    # validate branch_id
    if doc.get("branch_id") is not None:
        await validate_branch_id(doc["branch_id"])
    result = await coll.insert_one(doc)
    return Attendance(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[Attendance])
async def list_attendance(
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[Attendance] = []
    async for a in coll.find():
        items.append(Attendance(id=str(a["_id"]), **{k: a.get(k) for k in a}))
    return items

@router.get("/{attendance_id}", response_model=Attendance)
async def get_attendance(
    attendance_id: str,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    a = await coll.find_one({"_id": ObjectId(attendance_id)})
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found")
    return Attendance(id=attendance_id, **{k: a.get(k) for k in a})

@router.put("/{attendance_id}", response_model=Attendance)
async def update_attendance(
    attendance_id: str,
    attendance_in: AttendanceCreate,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    update_data = attendance_in.dict()
    # convert date to datetime
    if update_data.get("attendance_date") is not None:
        update_data["attendance_date"] = datetime.combine(update_data["attendance_date"], time())
    # validate foreign IDs
    await validate_student_id(update_data["student_id"])
    await validate_class_id(update_data["class_id"])
    # validate branch_id
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    res = await coll.update_one({"_id": ObjectId(attendance_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found")
    updated = await coll.find_one({"_id": ObjectId(attendance_id)})
    return Attendance(id=attendance_id, **{k: updated.get(k) for k in updated if k != "_id"}, created_at=updated.get("created_at"))

@router.delete("/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance(
    attendance_id: str,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(attendance_id)})
