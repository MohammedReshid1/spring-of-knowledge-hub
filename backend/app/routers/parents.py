from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime

from ..db import get_parents_collection, get_student_collection, get_user_collection, get_reports_collection
from ..models.parent import Parent, ParentCreate, ParentUpdate
from ..models.student import Student
from ..utils.rbac import get_current_user, Permission, has_permission, is_hq_role
from ..utils.resource_permissions import ResourcePermissionChecker, ResourceType, ResourcePermissionDecorator
from ..models.user import User
from ..services.parent_service import ParentService
from ..utils.websocket_manager import WebSocketManager

router = APIRouter()

@router.post("/", response_model=Parent)
async def create_parent(
    parent_in: ParentCreate,
    parents: Any = Depends(get_parents_collection),
    users: Any = Depends(get_user_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    if not has_permission(current_user.get("role"), Permission.CREATE_STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'CREATE_STUDENT' required"
        )
    
    branch_id = current_user.get("branch_id")
    if not branch_id and not is_hq_role(current_user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    now = datetime.utcnow()
    doc = parent_in.dict()
    doc["branch_id"] = branch_id
    doc["created_at"] = now
    doc["updated_at"] = now
    
    result = await parents.insert_one(doc)
    parent_id = str(result.inserted_id)
    
    user_id = await ParentService._create_parent_user(doc, users, parent_id)
    if user_id:
        await parents.update_one(
            {"_id": result.inserted_id},
            {"$set": {"user_id": user_id}}
        )
        doc["user_id"] = user_id
    
    for student_id in doc.get("student_ids", []):
        await students.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {"parent_guardian_id": parent_id}}
        )
    
    return Parent(id=parent_id, **doc)

@router.get("/")
@ResourcePermissionDecorator.filter_response_fields(ResourceType.STUDENT, "items")
async def list_parents(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    search: Optional[str] = Query(None, description="Search by name or phone"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(30, ge=1, le=100, description="Items per page"),
    parents: Any = Depends(get_parents_collection),
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
            {"father_name": search_regex},
            {"mother_name": search_regex},
            {"guardian_name": search_regex},
            {"father_phone": search_regex},
            {"mother_phone": search_regex},
            {"guardian_phone": search_regex},
            {"father_email": search_regex},
            {"mother_email": search_regex},
            {"guardian_email": search_regex},
        ]
    
    skip = (page - 1) * limit
    total_count = await parents.count_documents(filter_query)
    
    items: List[Parent] = []
    cursor = parents.find(filter_query).skip(skip).limit(limit).sort([("created_at", -1)])
    
    async for p in cursor:
        parent_data = {
            "id": str(p["_id"]),
            **{k: v for k, v in p.items() if k != "_id"}
        }
        items.append(Parent(**parent_data))
    
    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "pages": (total_count + limit - 1) // limit
    }

@router.get("/{parent_id}", response_model=Parent)
async def get_parent(
    parent_id: str,
    parents: Any = Depends(get_parents_collection),
    current_user: User = Depends(get_current_user),
):
    p = await parents.find_one({"_id": ObjectId(parent_id)})
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
    
    parent_data = {
        "id": parent_id,
        **{k: v for k, v in p.items() if k != "_id"}
    }
    
    return Parent(**parent_data)

@router.get("/{parent_id}/students")
async def get_parent_students(
    parent_id: str,
    parents: Any = Depends(get_parents_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Get all students linked to a parent"""
    return await ParentService.get_parent_students(parent_id, parents, students)

@router.put("/{parent_id}", response_model=Parent)
async def update_parent(
    parent_id: str,
    parent_in: ParentUpdate,
    parents: Any = Depends(get_parents_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    if not has_permission(current_user.get("role"), Permission.UPDATE_STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'UPDATE_STUDENT' required"
        )
    
    update_data = parent_in.dict(exclude_unset=True)
    update_data["updated_at"] = datetime.utcnow()
    
    if "student_ids" in update_data:
        old_parent = await parents.find_one({"_id": ObjectId(parent_id)})
        if old_parent:
            old_student_ids = set(old_parent.get("student_ids", []))
            new_student_ids = set(update_data["student_ids"])
            
            removed_students = old_student_ids - new_student_ids
            added_students = new_student_ids - old_student_ids
            
            for student_id in removed_students:
                await students.update_one(
                    {"_id": ObjectId(student_id)},
                    {"$unset": {"parent_guardian_id": ""}}
                )
            
            for student_id in added_students:
                await students.update_one(
                    {"_id": ObjectId(student_id)},
                    {"$set": {"parent_guardian_id": parent_id}}
                )
    
    res = await parents.update_one({"_id": ObjectId(parent_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
    
    p = await parents.find_one({"_id": ObjectId(parent_id)})
    return Parent(
        id=parent_id,
        **{k: v for k, v in p.items() if k != "_id"}
    )

@router.post("/{parent_id}/link-student/{student_id}")
async def link_student_to_parent(
    parent_id: str,
    student_id: str,
    parents: Any = Depends(get_parents_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Link a student to an existing parent"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'UPDATE_STUDENT' required"
        )
    
    websocket_manager = WebSocketManager()
    await ParentService.link_student_to_parent(
        student_id, parent_id, parents, students, websocket_manager
    )
    
    return {"message": "Student linked to parent successfully"}

@router.delete("/{parent_id}/unlink-student/{student_id}")
async def unlink_student_from_parent(
    parent_id: str,
    student_id: str,
    parents: Any = Depends(get_parents_collection),
    students: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Remove student link from parent"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'UPDATE_STUDENT' required"
        )
    
    await parents.update_one(
        {"_id": ObjectId(parent_id)},
        {
            "$pull": {"student_ids": student_id},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    await students.update_one(
        {"_id": ObjectId(student_id)},
        {"$unset": {"parent_guardian_id": ""}}
    )
    
    return {"message": "Student unlinked from parent successfully"}

@router.get("/{parent_id}/reports")
async def get_parent_reports(
    parent_id: str,
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    parents: Any = Depends(get_parents_collection),
    reports: Any = Depends(get_reports_collection),
    current_user: User = Depends(get_current_user),
):
    """Get reports for parent's children with optional filters"""
    # Check if parent exists and user has access
    parent = await parents.find_one({"_id": ObjectId(parent_id)})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    # Build query for reports
    query = {"parent_id": parent_id, "is_published": True}
    
    if academic_year:
        query["academic_year"] = academic_year
    if term:
        query["term"] = term
    if student_id:
        query["student_id"] = student_id
    
    # Get total count
    total_count = await reports.count_documents(query)
    
    # Get reports with pagination
    report_list = []
    async for report in reports.find(query).skip(skip).limit(limit).sort("generated_at", -1):
        report_data = {
            "id": str(report["_id"]),
            **{k: v for k, v in report.items() if k != "_id"}
        }
        report_list.append(report_data)
    
    return {
        "reports": report_list,
        "total_count": total_count,
        "page": (skip // limit) + 1,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit
    }

@router.get("/{parent_id}/notifications")
async def get_parent_notifications(
    parent_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    parents: Any = Depends(get_parents_collection),
    current_user: User = Depends(get_current_user),
):
    """Get recent notifications for parent"""
    # Check if parent exists
    parent = await parents.find_one({"_id": ObjectId(parent_id)})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    # For now, return notifications from parent record
    # In a real implementation, this would come from a notifications collection
    notifications = parent.get("notifications", [])
    
    # Sort by timestamp (most recent first)
    sorted_notifications = sorted(notifications, key=lambda x: x.get("timestamp", datetime.min), reverse=True)
    
    # Apply pagination
    paginated = sorted_notifications[skip:skip + limit]
    
    return {
        "notifications": paginated,
        "total_count": len(notifications),
        "unread_count": len([n for n in notifications if not n.get("read", False)])
    }

@router.post("/{parent_id}/mark-notifications-read")
async def mark_notifications_read(
    parent_id: str,
    notification_ids: Optional[List[str]] = None,
    parents: Any = Depends(get_parents_collection),
    current_user: User = Depends(get_current_user),
):
    """Mark notifications as read"""
    parent = await parents.find_one({"_id": ObjectId(parent_id)})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    notifications = parent.get("notifications", [])
    
    if notification_ids:
        # Mark specific notifications as read
        for notification in notifications:
            if notification.get("id") in notification_ids:
                notification["read"] = True
                notification["read_at"] = datetime.utcnow()
    else:
        # Mark all notifications as read
        for notification in notifications:
            notification["read"] = True
            notification["read_at"] = datetime.utcnow()
    
    await parents.update_one(
        {"_id": ObjectId(parent_id)},
        {"$set": {"notifications": notifications, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Notifications marked as read"}

@router.delete("/{parent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_parent(
    parent_id: str,
    parents: Any = Depends(get_parents_collection),
    students: Any = Depends(get_student_collection),
    users: Any = Depends(get_user_collection),
    current_user: User = Depends(get_current_user),
):
    if not has_permission(current_user.get("role"), Permission.DELETE_STUDENT):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'DELETE_STUDENT' required"
        )
    
    parent = await parents.find_one({"_id": ObjectId(parent_id)})
    if not parent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")
    
    for student_id in parent.get("student_ids", []):
        await students.update_one(
            {"_id": ObjectId(student_id)},
            {"$unset": {"parent_guardian_id": ""}}
        )
    
    if parent.get("user_id"):
        await users.delete_one({"_id": ObjectId(parent["user_id"])})
    
    result = await parents.delete_one({"_id": ObjectId(parent_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent not found")