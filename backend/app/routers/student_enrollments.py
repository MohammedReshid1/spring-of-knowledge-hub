from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_student_enrollments_collection, validate_student_id, validate_subject_id
from ..models.student_enrollment import StudentEnrollmentCreate, StudentEnrollment
from .users import get_current_user, User

router = APIRouter()

@router.post("/", response_model=StudentEnrollment)
async def create_student_enrollment(
    enrollment_in: StudentEnrollmentCreate,
    coll: Any = Depends(get_student_enrollments_collection),
    current_user: User = Depends(get_current_user),
):
    doc = enrollment_in.dict()
    # validate foreign IDs
    await validate_student_id(doc["student_id"])
    await validate_subject_id(doc["subject_id"])
    result = await coll.insert_one(doc)
    return StudentEnrollment(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[StudentEnrollment])
async def list_student_enrollments(
    coll: Any = Depends(get_student_enrollments_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[StudentEnrollment] = []
    async for e in coll.find():
        items.append(StudentEnrollment(id=str(e["_id"]), **{k: e.get(k) for k in e}))
    return items

@router.get("/{enrollment_id}", response_model=StudentEnrollment)
async def get_student_enrollment(
    enrollment_id: str,
    coll: Any = Depends(get_student_enrollments_collection),
    current_user: User = Depends(get_current_user),
):
    e = await coll.find_one({"_id": ObjectId(enrollment_id)})
    if not e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="StudentEnrollment not found")
    return StudentEnrollment(id=enrollment_id, **{k: e.get(k) for k in e})

@router.put("/{enrollment_id}", response_model=StudentEnrollment)
async def update_student_enrollment(
    enrollment_id: str,
    enrollment_in: StudentEnrollmentCreate,
    coll: Any = Depends(get_student_enrollments_collection),
    current_user: User = Depends(get_current_user),
):
    update_data = enrollment_in.dict()
    # validate foreign IDs
    await validate_student_id(update_data["student_id"])
    await validate_subject_id(update_data["subject_id"])
    res = await coll.update_one({"_id": ObjectId(enrollment_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="StudentEnrollment not found")
    return StudentEnrollment(id=enrollment_id, **enrollment_in.dict())

@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_enrollment(
    enrollment_id: str,
    coll: Any = Depends(get_student_enrollments_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(enrollment_id)})
