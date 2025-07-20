from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone
from ..models.teacher import Teacher, TeacherCreate
from ..db import get_database
from ..auth import get_current_user

router = APIRouter(prefix="/teachers", tags=["teachers"])

@router.get("/", response_model=List[Teacher])
async def list_teachers(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get all teachers"""
    try:
        teachers_collection = db.teachers
        teachers_cursor = teachers_collection.find({})
        teachers_list = []
        
        async for teacher in teachers_cursor:
            teachers_list.append(Teacher(
                id=str(teacher.get("_id")),
                teacher_id=teacher.get("teacher_id"),
                first_name=teacher.get("first_name"),
                last_name=teacher.get("last_name"),
                email=teacher.get("email"),
                phone=teacher.get("phone"),
                date_of_birth=teacher.get("date_of_birth"),
                gender=teacher.get("gender"),
                address=teacher.get("address"),
                emergency_contact_name=teacher.get("emergency_contact_name"),
                emergency_contact_phone=teacher.get("emergency_contact_phone"),
                qualification=teacher.get("qualification"),
                experience_years=teacher.get("experience_years"),
                specialization=teacher.get("specialization"),
                joining_date=teacher.get("joining_date"),
                salary=teacher.get("salary"),
                status=teacher.get("status", "Active"),
                branch_id=teacher.get("branch_id"),
                photo_url=teacher.get("photo_url"),
                subjects=teacher.get("subjects", []),
                classes=teacher.get("classes", []),
                employee_id=teacher.get("employee_id"),
                department=teacher.get("department"),
                blood_group=teacher.get("blood_group"),
                nationality=teacher.get("nationality"),
                marital_status=teacher.get("marital_status"),
                notes=teacher.get("notes"),
                created_at=teacher.get("created_at"),
                updated_at=teacher.get("updated_at")
            ))
        
        return teachers_list
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching teachers: {str(e)}")

@router.post("/", response_model=Teacher)
async def create_teacher(
    teacher: TeacherCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Create a new teacher"""
    try:
        teachers_collection = db.teachers
        
        # Check if teacher_id already exists
        existing = await teachers_collection.find_one({"teacher_id": teacher.teacher_id})
        if existing:
            raise HTTPException(status_code=400, detail="Teacher ID already exists")
        
        # Check if email already exists
        existing_email = await teachers_collection.find_one({"email": teacher.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists")
        
        teacher_dict = teacher.dict()
        teacher_dict["created_at"] = datetime.now(timezone.utc).isoformat()
        teacher_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = await teachers_collection.insert_one(teacher_dict)
        created_teacher = await teachers_collection.find_one({"_id": result.inserted_id})
        
        return Teacher(
            id=str(created_teacher["_id"]),
            **{k: v for k, v in created_teacher.items() if k != "_id"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating teacher: {str(e)}")

@router.get("/{teacher_id}", response_model=Teacher)
async def get_teacher(
    teacher_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Get a specific teacher by ID"""
    try:
        teachers_collection = db.teachers
        teacher = await teachers_collection.find_one({"_id": teacher_id})
        
        if not teacher:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        return Teacher(
            id=str(teacher["_id"]),
            **{k: v for k, v in teacher.items() if k != "_id"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching teacher: {str(e)}")

@router.put("/{teacher_id}", response_model=Teacher)
async def update_teacher(
    teacher_id: str,
    teacher_update: TeacherCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Update a teacher"""
    try:
        teachers_collection = db.teachers
        
        # Check if teacher exists
        existing = await teachers_collection.find_one({"_id": teacher_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        update_dict = teacher_update.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await teachers_collection.update_one(
            {"_id": teacher_id},
            {"$set": update_dict}
        )
        
        updated_teacher = await teachers_collection.find_one({"_id": teacher_id})
        
        return Teacher(
            id=str(updated_teacher["_id"]),
            **{k: v for k, v in updated_teacher.items() if k != "_id"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating teacher: {str(e)}")

@router.delete("/{teacher_id}")
async def delete_teacher(
    teacher_id: str,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_database)
):
    """Delete a teacher"""
    try:
        teachers_collection = db.teachers
        
        result = await teachers_collection.delete_one({"_id": teacher_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        return {"message": "Teacher deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting teacher: {str(e)}")