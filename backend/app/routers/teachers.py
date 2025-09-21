from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Any, Optional
from datetime import datetime, timezone
from bson import ObjectId

from ..models.teacher import Teacher, TeacherCreate, TeacherUpdate
from ..db import get_db, get_teacher_collection, get_classes_collection, get_student_collection, get_user_collection
from ..utils.rbac import get_current_user, Permission, has_permission, is_hq_role
from ..utils.resource_permissions import ResourcePermissionChecker, ResourceType, ResourcePermissionDecorator
from ..models.user import User
from ..services.teacher_class_service import TeacherClassService

router = APIRouter(tags=["teachers"])

@router.get("/")
async def list_teachers(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    teachers: Any = Depends(get_teacher_collection),
    current_user: User = Depends(get_current_user),
):
    """Get all teachers with branch isolation and enhanced filtering"""
    try:
        teachers_collection = teachers
        
        # Build query with mandatory branch filtering
        query = {}
        if current_user.get("role") in ["superadmin", "super_admin"]:
            # Superadmin sees all teachers
            pass
        else:
            # Regular users see only their branch's teachers
            branch_id = current_user.get("branch_id")
            if not branch_id:
                return []  # No branch = no data
            query["branch_id"] = branch_id
        
        teachers_cursor = teachers_collection.find(query)
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
    db = Depends(get_db)
):
    """Create a new teacher"""
    # Only admin and superadmin can create teachers
    if current_user.get("role") not in ["admin", "superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create teachers"
        )
    
    # Determine branch_id for the teacher
    if current_user.get("role") in ["superadmin", "super_admin"]:
        # Superadmin can specify branch_id in the request or use their own branch_id
        branch_id = teacher.branch_id or current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Superadmin must specify branch_id in request or be assigned to a branch"
            )
    else:
        # Regular users can only create teachers in their own branch
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a branch"
            )
    
    try:
        teachers_collection = db.teachers
        
        # Check if teacher_id already exists within the branch
        existing = await teachers_collection.find_one({
            "teacher_id": teacher.teacher_id,
            "branch_id": branch_id
        })
        if existing:
            raise HTTPException(status_code=400, detail="Teacher ID already exists in this branch")
        
        # Check if email already exists within the branch
        existing_email = await teachers_collection.find_one({
            "email": teacher.email,
            "branch_id": branch_id
        })
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already exists in this branch")
        
        teacher_dict = teacher.dict()
        teacher_dict["branch_id"] = branch_id  # Add branch isolation
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
    db = Depends(get_db)
):
    """Get a specific teacher by ID"""
    try:
        teachers_collection = db.teachers
        query = {"_id": ObjectId(teacher_id)} if ObjectId.is_valid(teacher_id) else {"_id": teacher_id}
        teacher = await teachers_collection.find_one(query)
        
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
    db = Depends(get_db)
):
    """Update a teacher"""
    try:
        teachers_collection = db.teachers
        
        # Check if teacher exists
        key = {"_id": ObjectId(teacher_id)} if ObjectId.is_valid(teacher_id) else {"_id": teacher_id}
        existing = await teachers_collection.find_one(key)
        if not existing:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        update_dict = teacher_update.dict(exclude_unset=True)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await teachers_collection.update_one(key, {"$set": update_dict})
        updated_teacher = await teachers_collection.find_one(key)
        
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
    db = Depends(get_db)
):
    """Delete a teacher"""
    try:
        teachers_collection = db.teachers
        key = {"_id": ObjectId(teacher_id)} if ObjectId.is_valid(teacher_id) else {"_id": teacher_id}
        result = await teachers_collection.delete_one(key)
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Teacher not found")
        
        return {"message": "Teacher deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting teacher: {str(e)}")

@router.get("/{teacher_id}/dashboard-data")
async def get_teacher_dashboard_data(
    teacher_id: str,
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
):
    """Fallback dashboard data endpoint for teacher, matching frontend expectations.

    This mirrors the enhanced teachers dashboard endpoint so existing clients using
    `/teachers/{teacher_id}/dashboard-data` continue to work.
    """
    # Verify teacher exists
    teacher = await teachers.find_one({"_id": ObjectId(teacher_id)})
    if not teacher:
        if current_user.get("role") == "teacher" and current_user.get("email"):
            teacher = await teachers.find_one({"email": current_user.get("email")})
            if teacher:
                teacher_id = str(teacher.get("_id"))
        if not teacher:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    
    # Access control: teacher can view own data; admins/superadmins can view any
    if current_user.get("role") not in ["admin", "superadmin", "super_admin"]:
        allowed = False
        try:
            uid = current_user.get("user_id")
            query = {"_id": ObjectId(uid)} if ObjectId.is_valid(uid or "") else {"_id": uid}
            user_doc = await users.find_one(query)
            if user_doc and user_doc.get("teacher_id") == teacher_id:
                allowed = True
        except Exception:
            allowed = False
        # Fallback mapping via email
        if not allowed and teacher.get("email") and teacher.get("email") == current_user.get("email"):
            allowed = True
        # Legacy fallback: token subject equals teacher_id
        if not allowed and current_user.get("user_id") == teacher_id:
            allowed = True
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to teacher data",
            )

    # Get assigned classes with student data
    teacher_classes = await TeacherClassService.get_teacher_classes(
        teacher_id=teacher_id,
        classes_collection=classes,
        students_collection=students,
    )

    total_classes = len(teacher_classes)
    total_students = sum(cls.get("current_enrollment", 0) for cls in teacher_classes)

    # Build recent activities summary (simple, last few classes)
    recent_activities = []
    for cls in teacher_classes[-3:]:
        recent_activities.append(
            {
                "type": "class_assigned",
                "message": f"Managing {cls.get('class_name')} with {cls.get('current_enrollment', 0)} students",
                "timestamp": cls.get("updated_at"),
                "class_id": cls.get("id"),
                "class_name": cls.get("class_name"),
            }
        )

    return {
        "teacher_id": teacher_id,
        "teacher_name": teacher.get("name", "")
        if teacher.get("name")
        else f"{teacher.get('first_name', '')} {teacher.get('last_name', '')}".strip(),
        "teacher_email": teacher.get("email"),
        "subject_specialization": teacher.get("subject_specialization", []),
        "summary": {
            "total_classes": total_classes,
            "total_students": total_students,
            "active_academic_year": teacher_classes[0].get("academic_year") if teacher_classes else None,
            "last_roster_sync": teacher.get("last_roster_sync"),
        },
        "assigned_classes": teacher_classes,
        "recent_activities": recent_activities,
        "quick_actions": [
            {"name": "View All Classes", "type": "navigate", "target": f"/teacher/{teacher_id}/classes"},
            {"name": "Take Attendance", "type": "action", "target": "attendance"},
            {"name": "Grade Students", "type": "action", "target": "grades"},
            {"name": "Send Messages", "type": "action", "target": "messages"},
        ],
    }
