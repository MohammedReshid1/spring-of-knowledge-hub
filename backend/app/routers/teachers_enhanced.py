from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import List, Any, Optional
from datetime import datetime
from bson import ObjectId

from ..models.teacher import Teacher, TeacherCreate, TeacherUpdate
from ..db import get_teacher_collection, get_classes_collection, get_student_collection, get_user_collection
from ..utils.rbac import get_current_user, Permission, has_permission, is_hq_role
from ..utils.resource_permissions import ResourcePermissionChecker, ResourceType, ResourcePermissionDecorator
from ..models.user import User
from ..services.teacher_class_service import TeacherClassService

router = APIRouter()

@router.get("/")
@ResourcePermissionDecorator.filter_response_fields(ResourceType.TEACHER, "items") 
async def list_teachers(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    teachers: Any = Depends(get_teacher_collection),
    current_user: User = Depends(get_current_user),
):
    filter_query = {}
    
    if is_hq_role(current_user.get("role")):
        if branch_id and branch_id != 'all':
            filter_query["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return {"items": [], "total_count": 0, "page": page, "limit": limit, "total_pages": 0}
        filter_query["branch_id"] = user_branch_id
    
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        filter_query["$or"] = [
            {"name": search_regex},
            {"email": search_regex},
            {"phone": search_regex},
            {"employee_id": search_regex},
            {"subject_specialization": search_regex}
        ]
    
    skip = (page - 1) * limit
    total_count = await teachers.count_documents(filter_query)
    
    items: List[Teacher] = []
    cursor = teachers.find(filter_query).skip(skip).limit(limit).sort([("created_at", -1)])
    
    async for t in cursor:
        teacher_data = {
            "id": str(t["_id"]),
            **{k: v for k, v in t.items() if k != "_id"}
        }
        items.append(Teacher(**teacher_data))
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit
    }

@router.get("/{teacher_id}", response_model=Teacher)
async def get_teacher(
    teacher_id: str,
    teachers: Any = Depends(get_teacher_collection),
    current_user: User = Depends(get_current_user),
):
    t = await teachers.find_one({"_id": ObjectId(teacher_id)})
    if not t:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    
    teacher_data = {
        "id": teacher_id,
        **{k: v for k, v in t.items() if k != "_id"}
    }
    
    return Teacher(**teacher_data)

@router.get("/{teacher_id}/classes")
async def get_teacher_classes(
    teacher_id: str,
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Get all classes assigned to a teacher with student rosters"""
    if not has_permission(current_user.get("role"), Permission.READ_CLASS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'READ_CLASS' required"
        )
    
    # Verify teacher exists
    teacher = await teachers.find_one({"_id": ObjectId(teacher_id)})
    if not teacher:
        # If the requester is a teacher, attempt to resolve via email mapping
        if current_user.get("role") == "teacher" and current_user.get("email"):
            teacher = await teachers.find_one({"email": current_user.get("email")})
            if teacher:
                teacher_id = str(teacher.get("_id"))
        if not teacher:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    
    # Get teacher's assigned classes with detailed info
    teacher_classes = await TeacherClassService.get_teacher_classes(
        teacher_id=teacher_id,
        classes_collection=classes,
        students_collection=students
    )
    
    return {
        "teacher_id": teacher_id,
        "teacher_name": teacher.get("name", ""),
        "classes": teacher_classes,
        "total_classes": len(teacher_classes),
        "total_students": sum(cls.get("current_enrollment", 0) for cls in teacher_classes)
    }

@router.post("/{teacher_id}/classes/{class_id}/sync-roster")
async def sync_class_roster(
    teacher_id: str,
    class_id: str,
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Manually sync teacher's access to class roster"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_CLASS):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'UPDATE_CLASS' required"
        )
    
    # Verify teacher is assigned to this class
    class_doc = await classes.find_one({
        "_id": ObjectId(class_id),
        "teacher_id": teacher_id
    })
    
    if not class_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher is not assigned to this class"
        )
    
    from ..utils.websocket_manager import WebSocketManager
    websocket_manager = WebSocketManager()
    
    result = await TeacherClassService.sync_class_roster(
        class_id=class_id,
        classes_collection=classes,
        teachers_collection=teachers,
        students_collection=students,
        websocket_manager=websocket_manager
    )
    
    return result

@router.get("/{teacher_id}/dashboard-data")
async def get_teacher_dashboard_data(
    teacher_id: str,
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive dashboard data for a teacher"""
    
    # Verify access - teacher can only access their own data or admin can access any
    # Get teacher info
    teacher = await teachers.find_one({"_id": ObjectId(teacher_id)})
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    
    # Access control: non-admins must be the same teacher (by mapping or email)
    if current_user.get("role") not in ["admin", "superadmin", "super_admin"]:
        allowed = False
        # Map via users.teacher_id if present
        try:
            uid = current_user.get("user_id")
            query = {"_id": ObjectId(uid)} if ObjectId.is_valid(uid or "") else {"_id": uid}
            user_doc = await users.find_one(query)
            if user_doc and user_doc.get("teacher_id") == teacher_id:
                allowed = True
        except Exception:
            allowed = False
        # Fallback mapping via email match
        if not allowed and teacher.get("email") and teacher.get("email") == current_user.get("email"):
            allowed = True
        # Legacy fallback: token subject equals teacher_id
        if not allowed and current_user.get("user_id") == teacher_id:
            allowed = True
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to teacher data"
            )
    
    # Get assigned classes with student data
    teacher_classes = await TeacherClassService.get_teacher_classes(
        teacher_id=teacher_id,
        classes_collection=classes,
        students_collection=students
    )
    
    # Calculate dashboard metrics
    total_classes = len(teacher_classes)
    total_students = sum(cls.get("current_enrollment", 0) for cls in teacher_classes)
    
    # Get recent activity summary
    recent_activities = []
    for cls in teacher_classes[-3:]:  # Last 3 classes for recent activity
        recent_activities.append({
            "type": "class_assigned",
            "message": f"Managing {cls.get('class_name')} with {cls.get('current_enrollment', 0)} students",
            "timestamp": cls.get("updated_at"),
            "class_id": cls.get("id"),
            "class_name": cls.get("class_name")
        })
    
    return {
        "teacher_id": teacher_id,
        "teacher_name": teacher.get("name", ""),
        "teacher_email": teacher.get("email"),
        "subject_specialization": teacher.get("subject_specialization", []),
        "summary": {
            "total_classes": total_classes,
            "total_students": total_students,
            "active_academic_year": teacher_classes[0].get("academic_year") if teacher_classes else None,
            "last_roster_sync": teacher.get("last_roster_sync")
        },
        "assigned_classes": teacher_classes,
        "recent_activities": recent_activities,
        "quick_actions": [
            {"name": "View All Classes", "type": "navigate", "target": f"/teacher/{teacher_id}/classes"},
            {"name": "Take Attendance", "type": "action", "target": "attendance"},
            {"name": "Grade Students", "type": "action", "target": "grades"},
            {"name": "Send Messages", "type": "action", "target": "messages"}
        ]
    }
async def _resolve_current_teacher(users, teachers, current_user: User):
    """Resolve the teacher document and id for the logged-in user."""
    # Try user -> teacher_id mapping first
    teacher_doc = None
    teacher_id = None
    try:
        uid = current_user.get("user_id")
        query = {"_id": ObjectId(uid)} if ObjectId.is_valid(uid or "") else {"_id": uid}
        user_doc = await users.find_one(query)
    except Exception:
        user_doc = None
    if user_doc and user_doc.get("teacher_id"):
        mapped_id = user_doc.get("teacher_id")
        try:
            teacher_doc = await teachers.find_one({"_id": ObjectId(mapped_id)})
        except Exception:
            teacher_doc = await teachers.find_one({"_id": mapped_id})
        if teacher_doc:
            teacher_id = str(teacher_doc.get("_id"))
    # Fallback: resolve by email
    if not teacher_doc and current_user.get("email"):
        teacher_doc = await teachers.find_one({"email": current_user.get("email")})
        if teacher_doc:
            teacher_id = str(teacher_doc.get("_id"))
    return teacher_id, teacher_doc

@router.get("/me/classes")
async def get_my_classes(
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
):
    try:
        if current_user.get("role") != "teacher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can access this endpoint")
        teacher_id, teacher_doc = await _resolve_current_teacher(users, teachers, current_user)
        if not teacher_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found for current user")
        teacher_classes = await TeacherClassService.get_teacher_classes(
            teacher_id=teacher_id,
            classes_collection=classes,
            students_collection=students
        )
        return {
            "teacher_id": teacher_id,
            "teacher_name": teacher_doc.get("name", "") if teacher_doc else "",
            "classes": teacher_classes,
            "total_classes": len(teacher_classes),
            "total_students": sum(c.get("current_enrollment", 0) for c in teacher_classes)
        }
    except HTTPException:
        raise
    except Exception as e:
        # Convert internal errors to 400 to avoid opaque 500s that drop CORS headers
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"me/classes resolution error: {str(e)}")

@router.get("/me/dashboard-data")
async def get_my_dashboard_data(
    teachers: Any = Depends(get_teacher_collection),
    classes: Any = Depends(get_classes_collection),
    students: Any = Depends(get_student_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
):
    try:
        if current_user.get("role") != "teacher":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can access this endpoint")
        teacher_id, teacher_doc = await _resolve_current_teacher(users, teachers, current_user)
        if not teacher_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found for current user")
        teacher_classes = await TeacherClassService.get_teacher_classes(
            teacher_id=teacher_id,
            classes_collection=classes,
            students_collection=students
        )
        total_classes = len(teacher_classes)
        total_students = sum(cls.get("current_enrollment", 0) for cls in teacher_classes)
        recent_activities = []
        for cls in teacher_classes[-3:]:
            recent_activities.append({
                "type": "class_assigned",
                "message": f"Managing {cls.get('class_name')} with {cls.get('current_enrollment', 0)} students",
                "timestamp": cls.get("updated_at"),
                "class_id": cls.get("id"),
                "class_name": cls.get("class_name")
            })
        return {
            "teacher_id": teacher_id,
            "teacher_name": teacher_doc.get("name", "") if teacher_doc else "",
            "summary": {
                "total_classes": total_classes,
                "total_students": total_students,
                "active_academic_year": teacher_classes[0].get("academic_year") if teacher_classes else None,
            },
            "assigned_classes": teacher_classes,
            "recent_activities": recent_activities,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"me/dashboard-data resolution error: {str(e)}")
