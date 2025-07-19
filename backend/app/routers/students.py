from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime, time

from ..db import get_student_collection, validate_branch_id, validate_class_id
from ..models.student import StudentCreate, Student
from .users import get_current_user, User

router = APIRouter()

@router.post("/", response_model=Student)
async def create_student(
    student_in: StudentCreate,
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = student_in.dict()
    # convert date fields to datetime for MongoDB
    doc["date_of_birth"] = datetime.combine(doc["date_of_birth"], time())
    if doc.get("admission_date") is not None:
        doc["admission_date"] = datetime.combine(doc["admission_date"], time())
    doc["created_at"] = now
    doc["updated_at"] = now
    # validate class_id if provided
    if doc.get("class_id") is not None:
        await validate_class_id(doc["class_id"])
    # validate branch_id if provided
    if doc.get("branch_id") is not None:
        await validate_branch_id(doc["branch_id"])
    result = await students.insert_one(doc)
    return Student(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[Student])
async def list_students(
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[Student] = []
    async for s in students.find():
        items.append(Student(
            id=str(s.get("_id")),
            student_id=s.get("student_id"),
            first_name=s.get("first_name"),
            last_name=s.get("last_name"),
            date_of_birth=s.get("date_of_birth"),
            gender=s.get("gender"),
            address=s.get("address"),
            phone=s.get("phone"),
            email=s.get("email"),
            emergency_contact_name=s.get("emergency_contact_name"),
            emergency_contact_phone=s.get("emergency_contact_phone"),
            medical_info=s.get("medical_info"),
            previous_school=s.get("previous_school"),
            grade_level=s.get("grade_level"),
            class_id=s.get("class_id"),
            admission_date=s.get("admission_date"),
            parent_guardian_id=s.get("parent_guardian_id"),
            father_name=s.get("father_name"),
            grandfather_name=s.get("grandfather_name"),
            mother_name=s.get("mother_name"),
            photo_url=s.get("photo_url"),
            current_class=s.get("current_class"),
            current_section=s.get("current_section"),
            status=s.get("status"),
            phone_secondary=s.get("phone_secondary"),
            birth_certificate_url=s.get("birth_certificate_url"),
            branch_id=s.get("branch_id"),
            created_at=s.get("created_at"),
            updated_at=s.get("updated_at"),
        ))
    return items

@router.get("/{student_id}", response_model=Student)
async def get_student(
    student_id: str,
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    s = await students.find_one({"_id": ObjectId(student_id)})
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return Student(
        id=student_id,
        student_id=s.get("student_id"),
        first_name=s.get("first_name"),
        last_name=s.get("last_name"),
        date_of_birth=s.get("date_of_birth"),
        gender=s.get("gender"),
        address=s.get("address"),
        phone=s.get("phone"),
        email=s.get("email"),
        emergency_contact_name=s.get("emergency_contact_name"),
        emergency_contact_phone=s.get("emergency_contact_phone"),
        medical_info=s.get("medical_info"),
        previous_school=s.get("previous_school"),
        grade_level=s.get("grade_level"),
        class_id=s.get("class_id"),
        admission_date=s.get("admission_date"),
        parent_guardian_id=s.get("parent_guardian_id"),
        father_name=s.get("father_name"),
        grandfather_name=s.get("grandfather_name"),
        mother_name=s.get("mother_name"),
        photo_url=s.get("photo_url"),
        current_class=s.get("current_class"),
        current_section=s.get("current_section"),
        status=s.get("status"),
        phone_secondary=s.get("phone_secondary"),
        birth_certificate_url=s.get("birth_certificate_url"),
        branch_id=s.get("branch_id"),
        created_at=s.get("created_at"),
        updated_at=s.get("updated_at"),
    )

@router.put("/{student_id}", response_model=Student)
async def update_student(
    student_id: str,
    student_in: StudentCreate,
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    update_data = student_in.dict()
    # convert date fields to datetime for MongoDB
    update_data["date_of_birth"] = datetime.combine(update_data["date_of_birth"], time())
    if update_data.get("admission_date") is not None:
        update_data["admission_date"] = datetime.combine(update_data["admission_date"], time())
    update_data["updated_at"] = now
    # validate class_id if provided
    if update_data.get("class_id") is not None:
        await validate_class_id(update_data["class_id"])
    # validate branch_id if provided
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    res = await students.update_one({"_id": ObjectId(student_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    s = await students.find_one({"_id": ObjectId(student_id)})
    return Student(
        id=student_id,
        student_id=s.get("student_id"),
        first_name=s.get("first_name"),
        last_name=s.get("last_name"),
        date_of_birth=s.get("date_of_birth"),
        gender=s.get("gender"),
        address=s.get("address"),
        phone=s.get("phone"),
        email=s.get("email"),
        emergency_contact_name=s.get("emergency_contact_name"),
        emergency_contact_phone=s.get("emergency_contact_phone"),
        medical_info=s.get("medical_info"),
        previous_school=s.get("previous_school"),
        grade_level=s.get("grade_level"),
        class_id=s.get("class_id"),
        admission_date=s.get("admission_date"),
        parent_guardian_id=s.get("parent_guardian_id"),
        father_name=s.get("father_name"),
        grandfather_name=s.get("grandfather_name"),
        mother_name=s.get("mother_name"),
        photo_url=s.get("photo_url"),
        current_class=s.get("current_class"),
        current_section=s.get("current_section"),
        status=s.get("status"),
        phone_secondary=s.get("phone_secondary"),
        birth_certificate_url=s.get("birth_certificate_url"),
        branch_id=s.get("branch_id"),
        created_at=s.get("created_at"),
        updated_at=s.get("updated_at"),
    )

@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(
    student_id: str,
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    result = await students.delete_one({"_id": ObjectId(student_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
