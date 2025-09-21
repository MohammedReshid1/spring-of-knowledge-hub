from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime, time

from ..db import get_db, get_student_collection, get_classes_collection, get_parents_collection, get_user_collection, validate_branch_id, validate_class_id
from ..models.student import StudentCreate, Student, StudentUpdate
from ..models.school_class import SchoolClass
from ..utils.rbac import get_current_user, Permission, has_permission, is_hq_role
from ..utils.resource_permissions import ResourcePermissionChecker, ResourceType, ResourcePermissionDecorator
from ..models.user import User
from ..services.parent_service import ParentService
from ..utils.websocket_manager import WebSocketManager

router = APIRouter()

async def populate_class_info(student_data: dict, classes_collection: Any) -> dict:
    """Helper function to populate class information for a student"""
    if student_data.get("class_id"):
        # Try to find class by ObjectId first
        class_doc = None
        if ObjectId.is_valid(student_data["class_id"]):
            class_doc = await classes_collection.find_one({"_id": ObjectId(student_data["class_id"])})
        
        # If not found by ObjectId, try to find by string ID
        if not class_doc:
            class_doc = await classes_collection.find_one({"_id": student_data["class_id"]})
        
        if class_doc:
            student_data["classes"] = SchoolClass(
                id=str(class_doc["_id"]),
                grade_level_id=class_doc["grade_level_id"],
                class_name=class_doc["class_name"],
                max_capacity=class_doc["max_capacity"],
                current_enrollment=class_doc["current_enrollment"],
                teacher_id=class_doc.get("teacher_id"),
                academic_year=class_doc["academic_year"],
                branch_id=class_doc.get("branch_id"),
                created_at=class_doc["created_at"],
                updated_at=class_doc["updated_at"]
            )
    return student_data

@router.post("/", response_model=Student)
async def create_student(
    student_in: StudentCreate,
    students: Any = Depends(get_student_collection),
    parents: Any = Depends(get_parents_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
):
    # Check permission using RBAC
    if not has_permission(current_user.get("role"), Permission.CREATE_STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'CREATE_STUDENT' required"
        )
    
    # Get user's branch or use provided branch for HQ roles
    user_branch_id = current_user.get("branch_id")
    if not user_branch_id and not is_hq_role(current_user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    now = datetime.utcnow()
    doc = student_in.dict()
    # convert date fields to datetime for MongoDB
    doc["date_of_birth"] = datetime.combine(doc["date_of_birth"], time())
    
    # For HQ roles (superadmin), allow using the branch_id from the request data
    # For regular users, use their assigned branch_id
    if is_hq_role(current_user.get("role")):
        # HQ users can create students in any branch, use provided branch_id or None
        branch_id = doc.get("branch_id")  # Use branch from request data
        if branch_id:
            doc["branch_id"] = branch_id  # Ensure it's set in doc
    else:
        # Regular users can only create in their assigned branch
        branch_id = user_branch_id
        doc["branch_id"] = branch_id
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
    student_id = str(result.inserted_id)
    
    # Create parent account automatically
    websocket_manager = WebSocketManager(db)
    created_parent = await ParentService.create_parent_from_student(
        {**doc, "_id": result.inserted_id}, 
        parents, 
        users, 
        students,
        websocket_manager
    )
    
    return Student(id=student_id, **doc)

@router.get("/")
async def list_students(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    search: Optional[str] = Query(None, description="Search by name, student ID, or phone"),
    status: Optional[str] = Query(None, description="Filter by status"),
    grade_level: Optional[str] = Query(None, description="Filter by grade level"),
    class_id: Optional[str] = Query(None, description="Filter by class ID"),
    sort_by: Optional[str] = Query("created_at", description="Sort by field (name, student_id, grade_level, created_at)"),
    sort_order: Optional[str] = Query("desc", description="Sort order (asc, desc)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    students: Any = Depends(get_student_collection),
    classes: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    # Build filter query with mandatory branch filtering
    filter_query = {}
    
    # Enforce branch isolation
    user_role = current_user.get("role")
    
    # Handle superadmin vs super_admin role name mismatch
    if user_role == "superadmin" or is_hq_role(user_role):
        # HQ roles can optionally filter by branch or see all
        if branch_id and branch_id != 'all':
            filter_query["branch_id"] = branch_id
    else:
        # Regular users see only their branch's students
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return {"items": [], "total": 0, "page": page, "limit": limit, "pages": 0}
        filter_query["branch_id"] = user_branch_id
    
    if status and status != 'all':
        filter_query["status"] = status
    
    if grade_level and grade_level != 'all':
        filter_query["grade_level"] = grade_level
    
    if class_id and class_id != 'all':
        filter_query["class_id"] = class_id
    
    # Search functionality
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        filter_query["$or"] = [
            {"first_name": search_regex},
            {"last_name": search_regex},
            {"student_id": search_regex},
            {"mother_name": search_regex},
            {"father_name": search_regex},
            {"grandfather_name": search_regex},
            {"phone": search_regex},
            {"phone_secondary": search_regex},
            {"email": search_regex},
        ]
    
    # Calculate skip for pagination
    skip = (page - 1) * limit
    
    # Get total count for pagination
    total_count = await students.count_documents(filter_query)
    
    # Build sort query
    sort_direction = 1 if sort_order == "asc" else -1
    
    if sort_by == "name":
        # Sort by first_name, then last_name
        sort_query = [("first_name", sort_direction), ("last_name", sort_direction)]
    elif sort_by == "student_id":
        sort_query = [("student_id", sort_direction)]
    elif sort_by == "grade_level":
        # For grade level, we need to sort numerically by extracting the grade number
        # Use MongoDB aggregation pipeline for proper grade sorting
        pipeline = [
            {"$match": filter_query},
            {"$addFields": {
                "grade_number": {
                    "$toInt": {
                        "$replaceAll": {
                            "input": "$grade_level",
                            "find": "grade_",
                            "replacement": ""
                        }
                    }
                }
            }},
            {"$sort": {"grade_number": sort_direction}},
            {"$skip": skip},
            {"$limit": limit}
        ]
        
        # Execute aggregation pipeline
        items: List[Student] = []
        cursor = students.aggregate(pipeline)
        async for s in cursor:
            student_data = {
                "id": str(s.get("_id")),
                "student_id": s.get("student_id"),
                "first_name": s.get("first_name"),
                "last_name": s.get("last_name", ""),
                "date_of_birth": s.get("date_of_birth"),
                "gender": s.get("gender"),
                "address": s.get("address"),
                "phone": s.get("phone"),
                "email": s.get("email"),
                "emergency_contact_name": s.get("emergency_contact_name"),
                "emergency_contact_phone": s.get("emergency_contact_phone"),
                "medical_info": s.get("medical_info"),
                "previous_school": s.get("previous_school"),
                "grade_level": s.get("grade_level"),
                "class_id": s.get("class_id"),
                "admission_date": s.get("admission_date"),
                "parent_guardian_id": s.get("parent_guardian_id"),
                "father_name": s.get("father_name"),
                "grandfather_name": s.get("grandfather_name"),
                "mother_name": s.get("mother_name"),
                "photo_url": s.get("photo_url"),
                "current_class": s.get("current_class"),
                "current_section": s.get("current_section"),
                "status": s.get("status"),
                "phone_secondary": s.get("phone_secondary"),
                "birth_certificate_url": s.get("birth_certificate_url"),
                "id_card": s.get("id_card"),
                "previous_report_card": s.get("previous_report_card"),
                "immunization_record": s.get("immunization_record"),
                "health_policy": s.get("health_policy"),
                "other_document": s.get("other_document"),
                "branch_id": s.get("branch_id"),
                "created_at": s.get("created_at"),
                "updated_at": s.get("updated_at"),
            }
            
            # Populate class information
            student_data = await populate_class_info(student_data, classes)
            
            # Skip resource-level permission filtering for now - RBAC handles basic permissions
            # TODO: Re-implement resource permissions after fixing user_id field mapping
            items.append(Student(**student_data))
        
        return {
            "items": items,
            "total": total_count,
            "page": page,
            "limit": limit,
            "pages": (total_count + limit - 1) // limit
        }
    elif sort_by == "created_at":
        sort_query = [("created_at", sort_direction)]
    else:
        # Default sort by created_at desc
        sort_query = [("created_at", -1)]
    
    # Get paginated results with sorting
    items: List[Student] = []
    cursor = students.find(filter_query).skip(skip).limit(limit).sort(sort_query)
    
    async for s in cursor:
        student_data = {
            "id": str(s.get("_id")),
            "student_id": s.get("student_id"),
            "first_name": s.get("first_name"),
            "last_name": s.get("last_name", ""),
            "date_of_birth": s.get("date_of_birth"),
            "gender": s.get("gender"),
            "address": s.get("address"),
            "phone": s.get("phone"),
            "email": s.get("email"),
            "emergency_contact_name": s.get("emergency_contact_name"),
            "emergency_contact_phone": s.get("emergency_contact_phone"),
            "medical_info": s.get("medical_info"),
            "previous_school": s.get("previous_school"),
            "grade_level": s.get("grade_level"),
            "class_id": s.get("class_id"),
            "admission_date": s.get("admission_date"),
            "parent_guardian_id": s.get("parent_guardian_id"),
            "father_name": s.get("father_name"),
            "grandfather_name": s.get("grandfather_name"),
            "mother_name": s.get("mother_name"),
            "photo_url": s.get("photo_url"),
            "current_class": s.get("current_class"),
            "current_section": s.get("current_section"),
            "status": s.get("status"),
            "phone_secondary": s.get("phone_secondary"),
            "birth_certificate_url": s.get("birth_certificate_url"),
            "id_card": s.get("id_card"),
            "previous_report_card": s.get("previous_report_card"),
            "immunization_record": s.get("immunization_record"),
            "health_policy": s.get("health_policy"),
            "other_document": s.get("other_document"),
            "branch_id": s.get("branch_id"),
            "created_at": s.get("created_at"),
            "updated_at": s.get("updated_at"),
        }
        
        # Populate class information
        student_data = await populate_class_info(student_data, classes)
        
        # Skip resource-level permission filtering for now - RBAC handles basic permissions
        # TODO: Re-implement resource permissions after fixing user_id field mapping
        items.append(Student(**student_data))
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit
    }

@router.get("/all")
async def get_all_students(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    students: Any = Depends(get_student_collection),
    classes: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    """Get all students for duplicate checking (no pagination limits)"""
    # Build filter query
    filter_query = {}
    
    if branch_id and branch_id != 'all':
        # Only filter by branch if it's explicitly set and not 'all'
        filter_query["branch_id"] = branch_id
    
    # Helper function to safely convert dates
    def safe_date(value):
        from datetime import date
        if value is None:
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00')).date()
            except:
                return None
        return None
    
    # Helper function to safely convert datetimes
    def safe_datetime(value):
        if value is None:
            return datetime.utcnow()  # Default to current time
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace('Z', '+00:00'))
            except:
                return datetime.utcnow()
        return datetime.utcnow()
    
    # Get all students without pagination
    items: List[Student] = []
    cursor = students.find(filter_query)
    async for s in cursor:
        student_data = {
            "id": str(s.get("_id")),
            "student_id": s.get("student_id"),
            "first_name": s.get("first_name"),
            "last_name": s.get("last_name", ""),
            "date_of_birth": safe_date(s.get("date_of_birth")),
            "gender": s.get("gender"),
            "address": s.get("address"),
            "phone": s.get("phone"),
            "email": s.get("email"),
            "emergency_contact_name": s.get("emergency_contact_name"),
            "emergency_contact_phone": s.get("emergency_contact_phone"),
            "medical_info": s.get("medical_info"),
            "previous_school": s.get("previous_school"),
            "grade_level": s.get("grade_level"),
            "class_id": s.get("class_id"),
            "admission_date": safe_date(s.get("admission_date")),
            "parent_guardian_id": s.get("parent_guardian_id"),
            "father_name": s.get("father_name"),
            "grandfather_name": s.get("grandfather_name"),
            "mother_name": s.get("mother_name"),
            "photo_url": s.get("photo_url"),
            "current_class": s.get("current_class"),
            "current_section": s.get("current_section"),
            "status": s.get("status"),
            "phone_secondary": s.get("phone_secondary"),
            "birth_certificate_url": s.get("birth_certificate_url"),
            "id_card": s.get("id_card"),
            "previous_report_card": s.get("previous_report_card"),
            "immunization_record": s.get("immunization_record"),
            "health_policy": s.get("health_policy"),
            "other_document": s.get("other_document"),
            "branch_id": s.get("branch_id"),
            "created_at": safe_datetime(s.get("created_at")),
            "updated_at": safe_datetime(s.get("updated_at")),
        }
        
        # Populate class information
        student_data = await populate_class_info(student_data, classes)
        items.append(Student(**student_data))
    
    return items

@router.get("/stats")
async def get_student_stats(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Get student statistics for dashboard"""
    filter_query = {}
    if branch_id and branch_id != 'all':
        # Only filter by branch if it's explicitly set and not 'all'
        filter_query["branch_id"] = branch_id
    
    # Get total students
    total_students = await students.count_documents(filter_query)
    
    # Get active students
    active_filter = {**filter_query, "status": "Active"}
    active_students = await students.count_documents(active_filter)
    
    # Get status breakdown
    pipeline = [
        {"$match": filter_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_breakdown = await students.aggregate(pipeline).to_list(None)
    status_counts = {item["_id"]: item["count"] for item in status_breakdown}
    
    # Get grade level breakdown
    grade_pipeline = [
        {"$match": filter_query},
        {"$group": {"_id": "$grade_level", "count": {"$sum": 1}}}
    ]
    grade_breakdown = await students.aggregate(grade_pipeline).to_list(None)
    grade_counts = {item["_id"]: item["count"] for item in grade_breakdown}
    
    # Get recent registrations (this month)
    this_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    recent_filter = {**filter_query, "created_at": {"$gte": this_month_start}}
    recent_registrations = await students.count_documents(recent_filter)
    
    return {
        "totalStudents": total_students,
        "activeStudents": active_students,
        "statusCounts": status_counts,
        "gradeCounts": grade_counts,
        "recentRegistrations": recent_registrations,
        "debug": {
            "branch_id": branch_id,
            "filter_query": filter_query,
            "total_students": total_students,
            "active_students": active_students
        }
    }

@router.get("/{student_id}", response_model=Student)
async def get_student(
    student_id: str,
    students: Any = Depends(get_student_collection),
    classes: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    # Try to find by student_id first (format: SCH-2025-00003)
    s = await students.find_one({"student_id": student_id})
    if not s:
        # If not found, try to find by MongoDB _id (format: 68b9333be504ca1505d599db)
        try:
            from bson import ObjectId
            s = await students.find_one({"_id": ObjectId(student_id)})
        except:
            pass
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    
    student_data = {
        "id": student_id,
        "student_id": s.get("student_id"),
        "first_name": s.get("first_name"),
        "last_name": s.get("last_name", ""),
        "date_of_birth": s.get("date_of_birth"),
        "gender": s.get("gender"),
        "address": s.get("address"),
        "phone": s.get("phone"),
        "email": s.get("email"),
        "emergency_contact_name": s.get("emergency_contact_name"),
        "emergency_contact_phone": s.get("emergency_contact_phone"),
        "medical_info": s.get("medical_info"),
        "previous_school": s.get("previous_school"),
        "grade_level": s.get("grade_level"),
        "class_id": s.get("class_id"),
        "admission_date": s.get("admission_date"),
        "parent_guardian_id": s.get("parent_guardian_id"),
        "father_name": s.get("father_name"),
        "grandfather_name": s.get("grandfather_name"),
        "mother_name": s.get("mother_name"),
        "photo_url": s.get("photo_url"),
        "current_class": s.get("current_class"),
        "current_section": s.get("current_section"),
        "status": s.get("status"),
        "phone_secondary": s.get("phone_secondary"),
        "birth_certificate_url": s.get("birth_certificate_url"),
        "id_card": s.get("id_card"),
        "previous_report_card": s.get("previous_report_card"),
        "immunization_record": s.get("immunization_record"),
        "health_policy": s.get("health_policy"),
        "other_document": s.get("other_document"),
        "branch_id": s.get("branch_id"),
        "created_at": s.get("created_at"),
        "updated_at": s.get("updated_at"),
    }
    
    # Populate class information
    student_data = await populate_class_info(student_data, classes)
    return Student(**student_data)

@router.put("/{student_id}", response_model=Student)
async def update_student(
    student_id: str,
    student_in: StudentUpdate,
    students: Any = Depends(get_student_collection),
    parents: Any = Depends(get_parents_collection),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
):
    now = datetime.utcnow()
    # Get current student data for class sync
    # Try to find by student_id first (format: SCH-2025-00003)
    s = await students.find_one({"student_id": student_id})
    if not s:
        # If not found, try to find by MongoDB _id (format: 68b9333be504ca1505d599db)
        try:
            from bson import ObjectId
            s = await students.find_one({"_id": ObjectId(student_id)})
        except:
            pass
    if not s:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    
    # Construct partial update data
    update_data = student_in.dict(exclude_unset=True)
    # convert date fields to datetime for MongoDB
    if "date_of_birth" in update_data and update_data.get("date_of_birth") is not None:
        update_data["date_of_birth"] = datetime.combine(update_data["date_of_birth"], time())
    if "admission_date" in update_data and update_data.get("admission_date") is not None:
        update_data["admission_date"] = datetime.combine(update_data["admission_date"], time())
    update_data["updated_at"] = now
    # validate class_id if provided
    if "class_id" in update_data and update_data.get("class_id") is not None:
        await validate_class_id(update_data["class_id"])
    # validate branch_id if provided
    if "branch_id" in update_data and update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    # Update using the same query method that found the student
    if s.get("student_id") == student_id:
        # Student was found by student_id
        res = await students.update_one({"student_id": student_id}, {"$set": update_data})
    else:
        # Student was found by _id
        res = await students.update_one({"_id": ObjectId(student_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    
    # Sync relevant changes to parent record
    websocket_manager = WebSocketManager(db)
    await ParentService.sync_student_data_to_parent(
        student_id, update_data, parents, websocket_manager
    )
    
    # If class assignment changed, sync teacher roster
    if "class_id" in update_data:
        from ..services.teacher_class_service import TeacherClassService
        
        # Sync old class if it existed
        old_class_id = s.get("class_id")
        if old_class_id:
            await TeacherClassService.sync_class_roster(
                class_id=old_class_id,
                classes_collection=get_classes_collection(),
                teachers_collection=get_teacher_collection(),
                students_collection=students,
                websocket_manager=websocket_manager
            )
        
        # Sync new class if assigned
        new_class_id = update_data.get("class_id")
        if new_class_id and new_class_id != old_class_id:
            await TeacherClassService.sync_class_roster(
                class_id=new_class_id,
                classes_collection=get_classes_collection(),
                teachers_collection=get_teacher_collection(),
                students_collection=students,
                websocket_manager=websocket_manager
            )
    
    # Refetch updated student data using the same method
    if s.get("student_id") == student_id:
        s = await students.find_one({"student_id": student_id})
    else:
        s = await students.find_one({"_id": ObjectId(student_id)})
    return Student(
        id=student_id,
        student_id=s.get("student_id"),
        first_name=s.get("first_name"),
        last_name=s.get("last_name", ""),
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
        id_card=s.get("id_card"),
        previous_report_card=s.get("previous_report_card"),
        immunization_record=s.get("immunization_record"),
        health_policy=s.get("health_policy"),
        other_document=s.get("other_document"),
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
    # Try to delete by student_id first (format: SCH-2025-00003)
    result = await students.delete_one({"student_id": student_id})
    if result.deleted_count == 0:
        # If not found, try to delete by MongoDB _id (format: 68b9333be504ca1505d599db)
        try:
            from bson import ObjectId
            result = await students.delete_one({"_id": ObjectId(student_id)})
        except:
            pass
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_students(
    student_ids: List[str],
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Bulk delete multiple students"""
    result = await students.delete_many({"student_id": {"$in": student_ids}})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No students found to delete")
    return {"deleted_count": result.deleted_count}
