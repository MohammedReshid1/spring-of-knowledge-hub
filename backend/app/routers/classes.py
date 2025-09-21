from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from ..db import get_db, get_classes_collection, get_teacher_collection, get_user_collection, validate_branch_id, validate_grade_level_id, validate_teacher_id, get_student_collection, get_subjects_collection
from ..models.school_class import SchoolClassCreate, SchoolClass, SchoolClassUpdate
from ..utils.rbac import get_current_user, is_hq_role
from ..models.user import User
from ..services.teacher_class_service import TeacherClassService
from ..utils.websocket_manager import WebSocketManager

router = APIRouter()

@router.post("/", response_model=SchoolClass)
async def create_class(
    class_in: SchoolClassCreate,
    coll: Any = Depends(get_classes_collection),
    teachers: Any = Depends(get_teacher_collection),
    subjects: Any = Depends(get_subjects_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
):
    # Only admin and superadmin can create classes
    if current_user.get("role") not in ["admin", "superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create classes"
        )
    
    # Handle branch assignment based on user role
    user_branch_id = current_user.get("branch_id")
    
    if is_hq_role(current_user.get("role")):
        # HQ users can create classes in any branch, use provided branch_id or their own
        branch_id = class_in.branch_id or user_branch_id
    else:
        # Regular users can only create in their assigned branch
        if not user_branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User must be assigned to a branch"
            )
        branch_id = user_branch_id
    
    now = datetime.utcnow()
    doc = class_in.dict()
    doc["created_at"] = now
    doc["updated_at"] = now
    if branch_id:
        doc["branch_id"] = branch_id  # Add branch isolation
    
    # validate foreign IDs
    await validate_grade_level_id(doc["grade_level_id"])
    if doc.get("teacher_id") is not None:
        await validate_teacher_id(doc["teacher_id"])
    # Validate subject_teachers if provided
    if isinstance(doc.get("subject_teachers"), list):
        valid_pairs = []
        for pair in doc["subject_teachers"]:
            sid = pair.get("subject_id")
            tid = pair.get("teacher_id")
            if not sid or not tid:
                continue
            # ensure subject exists
            # basic check: subject by _id
            try:
                _ = await subjects.find_one({"_id": ObjectId(sid)})
            except Exception:
                _ = await subjects.find_one({"_id": sid})
            if not _:
                continue
            await validate_teacher_id(tid)
            valid_pairs.append({"subject_id": sid, "teacher_id": tid})
        doc["subject_teachers"] = valid_pairs
    
    # Check for duplicate class name in same branch
    duplicate_query = {
        "class_name": doc["class_name"]
    }
    if branch_id:
        duplicate_query["branch_id"] = branch_id
    
    existing_class = await coll.find_one(duplicate_query)
    if existing_class:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Class '{doc['class_name']}' already exists in this branch"
        )
    
    result = await coll.insert_one(doc)
    class_id = str(result.inserted_id)
    
    # If teacher assigned, set up permissions and relationships
    if doc.get("teacher_id"):
        websocket_manager = WebSocketManager(db)
        await TeacherClassService.assign_teacher_to_class(
            class_id=class_id,
            teacher_id=doc["teacher_id"],
            classes_collection=coll,
            teachers_collection=teachers,
            students_collection=get_student_collection(),
            users_collection=users,
            websocket_manager=websocket_manager
        )
    
    return SchoolClass(id=class_id, **doc)

@router.get("/", response_model=List[SchoolClass])
async def list_classes(
    coll: Any = Depends(get_classes_collection),
    student_coll: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    # Build query with mandatory branch filtering
    query = {}
    if current_user.get("role") in ["superadmin", "super_admin"]:
        # Superadmin sees all classes
        pass
    else:
        # Regular users see only their branch's classes
        branch_id = current_user.get("branch_id")
        if not branch_id:
            return []  # No branch = no data
        query["branch_id"] = branch_id
    
    items: List[SchoolClass] = []
    async for c in coll.find(query):
        # compute current enrollment dynamically
        class_id_str = str(c["_id"])
        # Also filter students by branch for accurate count
        student_query = {"class_id": class_id_str}
        if current_user.get("role") not in ["superadmin", "super_admin"]:
            student_query["branch_id"] = current_user.get("branch_id")
        count = await student_coll.count_documents(student_query)
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
    # Build query with branch filtering
    query = {"_id": ObjectId(class_id)}
    if current_user.get("role") not in ["superadmin", "super_admin"]:
        # Regular users can only access their branch's classes
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User must be assigned to a branch")
        query["branch_id"] = branch_id
    
    c = await coll.find_one(query)
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SchoolClass not found")
    
    # compute current enrollment with branch filtering
    student_query = {"class_id": class_id}
    if current_user.get("role") not in ["superadmin", "super_admin"]:
        student_query["branch_id"] = current_user.get("branch_id")
    count = await student_coll.count_documents(student_query)
    data = {k: c.get(k) for k in c}
    data["current_enrollment"] = count
    return SchoolClass(id=class_id, **data)

@router.put("/{class_id}", response_model=SchoolClass)
async def update_class(
    class_id: str,
    class_in: SchoolClassUpdate,
    coll: Any = Depends(get_classes_collection),
    student_coll: Any = Depends(get_student_collection),
    teachers: Any = Depends(get_teacher_collection),
    subjects: Any = Depends(get_subjects_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
):
    # Get current class data to check for teacher changes
    current_class = await coll.find_one({"_id": ObjectId(class_id)})
    if not current_class:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SchoolClass not found")
    
    now = datetime.utcnow()
    update_data = class_in.dict(exclude_unset=True)
    update_data["updated_at"] = now
    
    # validate foreign IDs
    if update_data.get("grade_level_id") is not None:
        await validate_grade_level_id(update_data["grade_level_id"])
    if update_data.get("teacher_id") is not None:
        await validate_teacher_id(update_data["teacher_id"])
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    if update_data.get("subject_teachers") is not None:
        valid_pairs = []
        for pair in (update_data.get("subject_teachers") or []):
            sid = pair.get("subject_id")
            tid = pair.get("teacher_id")
            if not sid or not tid:
                continue
            try:
                _ = await subjects.find_one({"_id": ObjectId(sid)})
            except Exception:
                _ = await subjects.find_one({"_id": sid})
            if not _:
                continue
            await validate_teacher_id(tid)
            valid_pairs.append({"subject_id": sid, "teacher_id": tid})
        update_data["subject_teachers"] = valid_pairs
    
    # Check for duplicate class name if class_name is being updated
    if "class_name" in update_data:
        duplicate_query = {
            "class_name": update_data.get("class_name"),
            "_id": {"$ne": ObjectId(class_id)}  # Exclude current class
        }
        
        # Check branch constraint
        branch_id_to_check = update_data.get("branch_id", current_class.get("branch_id"))
        if branch_id_to_check:
            duplicate_query["branch_id"] = branch_id_to_check
        
        existing_class = await coll.find_one(duplicate_query)
        if existing_class:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Class '{duplicate_query['class_name']}' already exists in this branch"
            )
    
    # Handle teacher assignment changes
    websocket_manager = WebSocketManager(db)
    old_teacher_id = current_class.get("teacher_id")
    new_teacher_id = update_data.get("teacher_id")
    
    # If teacher is being changed or removed
    if "teacher_id" in update_data and old_teacher_id != new_teacher_id:
        # Unassign old teacher if exists
        if old_teacher_id:
            await TeacherClassService.unassign_teacher_from_class(
                class_id=class_id,
                classes_collection=coll,
                teachers_collection=teachers,
                users_collection=users,
                websocket_manager=websocket_manager
            )
        
        # Assign new teacher if provided
        if new_teacher_id:
            await TeacherClassService.assign_teacher_to_class(
                class_id=class_id,
                teacher_id=new_teacher_id,
                classes_collection=coll,
                teachers_collection=teachers,
                students_collection=student_coll,
                users_collection=users,
                websocket_manager=websocket_manager
            )
    
    res = await coll.update_one({"_id": ObjectId(class_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="SchoolClass not found")
    c = await coll.find_one({"_id": ObjectId(class_id)})
    
    # Sync roster if teacher assigned
    if c.get("teacher_id"):
        await TeacherClassService.sync_class_roster(
            class_id=class_id,
            classes_collection=coll,
            teachers_collection=teachers,
            students_collection=student_coll,
            websocket_manager=websocket_manager
        )
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
        subject_teachers=c.get("subject_teachers", []),
        created_at=c.get("created_at"),
        updated_at=c.get("updated_at"),
    )

@router.post("/{class_id}/subject-teachers")
async def assign_subject_teacher(
    class_id: str,
    payload: dict,
    coll: Any = Depends(get_classes_collection),
    teachers: Any = Depends(get_teacher_collection),
    subjects: Any = Depends(get_subjects_collection),
    current_user: User = Depends(get_current_user),
):
    """Assign a teacher to a subject for a class (multi-teacher support)."""
    class_doc = await coll.find_one({"_id": ObjectId(class_id)})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    sid = payload.get("subject_id")
    tid = payload.get("teacher_id")
    if not sid or not tid:
        raise HTTPException(status_code=400, detail="subject_id and teacher_id are required")
    try:
        exists = await subjects.find_one({"_id": ObjectId(sid)})
    except Exception:
        exists = await subjects.find_one({"_id": sid})
    if not exists:
        raise HTTPException(status_code=400, detail="Invalid subject_id")
    await validate_teacher_id(tid)
    mapping = class_doc.get("subject_teachers", [])
    if not any(m.get("subject_id") == sid and m.get("teacher_id") == tid for m in mapping):
        mapping.append({"subject_id": sid, "teacher_id": tid})
        await coll.update_one({"_id": ObjectId(class_id)}, {"$set": {"subject_teachers": mapping, "updated_at": datetime.utcnow()}})
    return {"message": "Assigned", "class_id": class_id, "subject_id": sid, "teacher_id": tid}

@router.delete("/{class_id}/subject-teachers")
async def unassign_subject_teacher(
    class_id: str,
    subject_id: str,
    teacher_id: str,
    coll: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    class_doc = await coll.find_one({"_id": ObjectId(class_id)})
    if not class_doc:
        raise HTTPException(status_code=404, detail="Class not found")
    mapping = [m for m in class_doc.get("subject_teachers", []) if not (m.get("subject_id") == subject_id and m.get("teacher_id") == teacher_id)]
    await coll.update_one({"_id": ObjectId(class_id)}, {"$set": {"subject_teachers": mapping, "updated_at": datetime.utcnow()}})
    return {"message": "Unassigned"}

@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: str,
    coll: Any = Depends(get_classes_collection),
    teachers: Any = Depends(get_teacher_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db),
):
    # Get class info before deletion for cleanup
    class_doc = await coll.find_one({"_id": ObjectId(class_id)})
    if class_doc and class_doc.get("teacher_id"):
        # Unassign teacher and clean up permissions
        websocket_manager = WebSocketManager(db)
        await TeacherClassService.unassign_teacher_from_class(
            class_id=class_id,
            classes_collection=coll,
            teachers_collection=teachers,
            users_collection=users,
            websocket_manager=websocket_manager
        )
    
    await coll.delete_one({"_id": ObjectId(class_id)})
