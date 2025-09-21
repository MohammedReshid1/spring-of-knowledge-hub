from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime

from ..db import (
    get_messages_collection, get_message_recipients_collection, get_notifications_collection,
    get_announcements_collection, get_parent_student_links_collection,
    get_communication_settings_collection, get_student_collection, get_user_collection,
    get_parents_collection, get_classes_collection, get_exam_results_collection,
    get_exams_collection, get_grading_scales_collection, get_fees_collection,
    get_registration_payments_collection, get_attendance_collection, get_disciplinary_actions_collection,
    validate_branch_id, validate_student_id
)
from ..models.communication import (
    MessageCreate, Message, MessageUpdate, MessageRecipientCreate, MessageRecipient,
    NotificationCreate, Notification, AnnouncementCreate, Announcement,
    ParentStudentLinkCreate, ParentStudentLink, CommunicationSettingsCreate,
    CommunicationSettings, MessageStats
)
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import (
    sanitize_input, prevent_nosql_injection, validate_mongodb_id
)
from ..services.comprehensive_parent_portal_service import ComprehensiveParentPortalService
from ..services.parent_notification_service import ParentNotificationService
from ..utils.audit_logger import AuditAction, AuditSeverity

router = APIRouter()

# Messages
@router.post("/messages", response_model=Message)
async def create_message(
    message_in: MessageCreate,
    messages_coll: Any = Depends(get_messages_collection),
    recipients_coll: Any = Depends(get_message_recipients_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new message."""
    if current_user.role not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to send messages")
    
    # Sanitize input
    message_data = sanitize_input(message_in.dict(), [
        "subject", "content", "message_type", "priority", "recipients",
        "recipient_type", "class_ids", "grade_level", "attachments",
        "scheduled_send_time", "requires_acknowledgment", "branch_id"
    ])
    
    # Validate branch_id if provided
    if message_data.get("branch_id"):
        await validate_branch_id(message_data["branch_id"])
    
    # Add metadata
    now = datetime.utcnow()
    message_data.update({
        "sender_id": current_user.id,
        "sent_at": now if not message_data.get("scheduled_send_time") else None,
        "is_sent": not bool(message_data.get("scheduled_send_time")),
        "created_at": now,
        "updated_at": now
    })
    
    result = await messages_coll.insert_one(message_data)
    message_id = str(result.inserted_id)
    
    # Create recipient records
    for recipient_id in message_data["recipients"]:
        recipient_data = {
            "message_id": message_id,
            "recipient_id": recipient_id,
            "recipient_type": message_data["recipient_type"],
            "created_at": now
        }
        await recipients_coll.insert_one(recipient_data)
    
    message_data["id"] = message_id
    return Message(**message_data)

@router.get("/messages", response_model=List[Message])
async def list_messages(
    message_type: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    is_sent: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    messages_coll: Any = Depends(get_messages_collection),
    current_user: User = Depends(get_current_user),
):
    """List messages."""
    query = {}
    
    if message_type:
        query["message_type"] = message_type
    if priority:
        query["priority"] = priority
    if is_sent is not None:
        query["is_sent"] = is_sent
    
    # Filter by sender for non-admin users
    if current_user.role not in ['super_admin', 'hq_admin']:
        query["sender_id"] = current_user.id
    
    query = prevent_nosql_injection(query)
    
    messages = []
    async for message in messages_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        messages.append(Message(
            id=str(message["_id"]),
            **{k: v for k, v in message.items() if k != "_id"}
        ))
    
    return messages

@router.get("/messages/received", response_model=List[dict])
async def get_received_messages(
    is_read: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    recipients_coll: Any = Depends(get_message_recipients_collection),
    messages_coll: Any = Depends(get_messages_collection),
    current_user: User = Depends(get_current_user),
):
    """Get messages received by current user."""
    query = {"recipient_id": current_user.id}
    
    if is_read is not None:
        query["is_read"] = is_read
    
    received_messages = []
    async for recipient in recipients_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        # Get the actual message
        message = await messages_coll.find_one({"_id": ObjectId(recipient["message_id"])})
        if message:
            received_messages.append({
                "id": str(recipient["_id"]),
                "message": {
                    "id": str(message["_id"]),
                    "subject": message["subject"],
                    "content": message["content"],
                    "message_type": message["message_type"],
                    "priority": message["priority"],
                    "sender_id": message["sender_id"],
                    "sent_at": message.get("sent_at"),
                    "attachments": message.get("attachments", [])
                },
                "is_read": recipient["is_read"],
                "read_at": recipient.get("read_at"),
                "is_acknowledged": recipient.get("is_acknowledged", False),
                "acknowledged_at": recipient.get("acknowledged_at"),
                "received_at": recipient["created_at"]
            })
    
    return received_messages

@router.put("/messages/received/{recipient_id}/read")
async def mark_message_as_read(
    recipient_id: str,
    recipients_coll: Any = Depends(get_message_recipients_collection),
    current_user: User = Depends(get_current_user),
):
    """Mark a received message as read."""
    if not validate_mongodb_id(recipient_id):
        raise HTTPException(status_code=400, detail="Invalid recipient ID")
    
    result = await recipients_coll.update_one(
        {"_id": ObjectId(recipient_id), "recipient_id": current_user.id},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"status": "marked as read"}

# Notifications
@router.post("/notifications", response_model=Notification)
async def create_notification(
    notification_in: NotificationCreate,
    notifications_coll: Any = Depends(get_notifications_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new notification."""
    # Sanitize input
    notification_data = sanitize_input(notification_in.dict(), [
        "title", "message", "notification_type", "user_id", "related_entity_type",
        "related_entity_id", "action_url", "expires_at"
    ])
    
    # Add metadata
    now = datetime.utcnow()
    notification_data.update({
        "created_at": now
    })
    
    result = await notifications_coll.insert_one(notification_data)
    notification_data["id"] = str(result.inserted_id)
    
    return Notification(**notification_data)

@router.get("/user-notifications")
async def get_user_notifications(
    is_read: Optional[bool] = Query(None),
    notification_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    notifications_coll: Any = Depends(get_notifications_collection),
    current_user: User = Depends(get_current_user),
):
    """Get notifications for current user."""
    query = {"user_id": current_user.id}
    
    if is_read is not None:
        query["is_read"] = is_read
    if notification_type:
        query["notification_type"] = notification_type
    
    # Filter out expired notifications
    now = datetime.utcnow()
    query["$or"] = [
        {"expires_at": None},
        {"expires_at": {"$gt": now}}
    ]
    
    notifications = []
    async for notification in notifications_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        notification_data = {
            "id": str(notification["_id"]),
            "title": notification.get("title", ""),
            "message": notification.get("message", ""),
            "notification_type": notification.get("notification_type", "info"),
            "is_read": notification.get("is_read", False),
            "created_at": notification.get("created_at"),
            "read_at": notification.get("read_at"),
            "user_id": notification.get("user_id"),
            "related_entity_type": notification.get("related_entity_type"),
            "related_entity_id": notification.get("related_entity_id"),
            "action_url": notification.get("action_url"),
            "expires_at": notification.get("expires_at")
        }
        notifications.append(notification_data)
    
    return notifications

@router.put("/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: str,
    notifications_coll: Any = Depends(get_notifications_collection),
    current_user: User = Depends(get_current_user),
):
    """Mark a notification as read."""
    if not validate_mongodb_id(notification_id):
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    
    result = await notifications_coll.update_one(
        {"_id": ObjectId(notification_id), "user_id": current_user.id},
        {"$set": {"is_read": True, "read_at": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"status": "marked as read"}

# Announcements
@router.post("/announcements", response_model=Announcement)
async def create_announcement(
    announcement_in: AnnouncementCreate,
    announcements_coll: Any = Depends(get_announcements_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new announcement."""
    if current_user.role not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create announcements")
    
    # Sanitize input
    announcement_data = sanitize_input(announcement_in.dict(), [
        "title", "content", "announcement_type", "priority", "target_audience",
        "class_ids", "grade_levels", "publish_date", "expiry_date",
        "attachments", "is_pinned", "branch_id"
    ])
    
    # Validate branch_id if provided
    if announcement_data.get("branch_id"):
        await validate_branch_id(announcement_data["branch_id"])
    
    # Add metadata
    now = datetime.utcnow()
    announcement_data.update({
        "author_id": current_user.id,
        "is_published": announcement_data["publish_date"] <= now,
        "view_count": 0,
        "created_at": now,
        "updated_at": now
    })
    
    result = await announcements_coll.insert_one(announcement_data)
    announcement_data["id"] = str(result.inserted_id)
    
    return Announcement(**announcement_data)

@router.get("/announcements", response_model=List[Announcement])
async def list_announcements(
    announcement_type: Optional[str] = Query(None),
    target_audience: Optional[str] = Query(None),
    is_published: Optional[bool] = Query(True),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    announcements_coll: Any = Depends(get_announcements_collection),
    current_user: User = Depends(get_current_user),
):
    """List announcements."""
    query = {}
    
    if announcement_type:
        query["announcement_type"] = announcement_type
    if target_audience:
        query["target_audience"] = target_audience
    if is_published is not None:
        query["is_published"] = is_published
    
    # Filter expired announcements
    now = datetime.utcnow()
    query["$or"] = [
        {"expiry_date": None},
        {"expiry_date": {"$gt": now}}
    ]
    
    # Add branch filter for branch admins
    if current_user.role == 'branch_admin' and current_user.branch_id:
        query["branch_id"] = current_user.branch_id
    
    query = prevent_nosql_injection(query)
    
    announcements = []
    async for announcement in announcements_coll.find(query).skip(skip).limit(limit).sort([("is_pinned", -1), ("publish_date", -1)]):
        announcements.append(Announcement(
            id=str(announcement["_id"]),
            **{k: v for k, v in announcement.items() if k != "_id"}
        ))
    
    return announcements

# Parent-Student Links
@router.post("/parent-links", response_model=ParentStudentLink)
async def create_parent_student_link(
    link_in: ParentStudentLinkCreate,
    links_coll: Any = Depends(get_parent_student_links_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a parent-student link."""
    if current_user.role not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create parent links")
    
    # Sanitize input
    link_data = sanitize_input(link_in.dict(), [
        "parent_user_id", "student_id", "relationship", "is_primary_contact",
        "can_view_grades", "can_view_attendance", "can_view_assignments",
        "can_view_fees", "can_receive_notifications"
    ])
    
    # Validate student exists
    await validate_student_id(link_data["student_id"])
    
    # Check if link already exists
    existing_link = await links_coll.find_one({
        "parent_user_id": link_data["parent_user_id"],
        "student_id": link_data["student_id"]
    })
    
    if existing_link:
        raise HTTPException(status_code=400, detail="Parent-student link already exists")
    
    # Add metadata
    now = datetime.utcnow()
    link_data.update({
        "verified": False,
        "created_at": now,
        "updated_at": now
    })
    
    result = await links_coll.insert_one(link_data)
    link_data["id"] = str(result.inserted_id)
    
    return ParentStudentLink(**link_data)

@router.get("/parent-links", response_model=List[ParentStudentLink])
async def list_parent_student_links(
    parent_user_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    links_coll: Any = Depends(get_parent_student_links_collection),
    current_user: User = Depends(get_current_user),
):
    """List parent-student links."""
    query = {}
    
    # If user is a parent, only show their links
    if current_user.role == 'parent':
        query["parent_user_id"] = current_user.id
    else:
        if parent_user_id:
            query["parent_user_id"] = parent_user_id
        if student_id:
            query["student_id"] = student_id
    
    links = []
    async for link in links_coll.find(query).sort("created_at", -1):
        links.append(ParentStudentLink(
            id=str(link["_id"]),
            **{k: v for k, v in link.items() if k != "_id"}
        ))
    
    return links

# Communication Settings
@router.post("/settings", response_model=CommunicationSettings)
async def create_or_update_communication_settings(
    settings_in: CommunicationSettingsCreate,
    settings_coll: Any = Depends(get_communication_settings_collection),
    current_user: User = Depends(get_current_user),
):
    """Create or update communication settings for current user."""
    # Sanitize input
    settings_data = sanitize_input(settings_in.dict(), [
        "user_id", "email_notifications", "sms_notifications", "push_notifications",
        "notification_types", "quiet_hours_start", "quiet_hours_end", "language_preference"
    ])
    
    # Ensure user can only update their own settings
    if current_user.role not in ['super_admin', 'hq_admin'] and settings_data["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Can only update your own settings")
    
    now = datetime.utcnow()
    
    # Check if settings already exist
    existing_settings = await settings_coll.find_one({"user_id": settings_data["user_id"]})
    
    if existing_settings:
        # Update existing settings
        settings_data["updated_at"] = now
        await settings_coll.update_one(
            {"user_id": settings_data["user_id"]},
            {"$set": settings_data}
        )
        settings_data["id"] = str(existing_settings["_id"])
        settings_data["created_at"] = existing_settings["created_at"]
    else:
        # Create new settings
        settings_data["created_at"] = now
        settings_data["updated_at"] = now
        result = await settings_coll.insert_one(settings_data)
        settings_data["id"] = str(result.inserted_id)
    
    return CommunicationSettings(**settings_data)

@router.get("/settings", response_model=CommunicationSettings)
async def get_communication_settings(
    user_id: Optional[str] = Query(None),
    settings_coll: Any = Depends(get_communication_settings_collection),
    current_user: User = Depends(get_current_user),
):
    """Get communication settings for user."""
    target_user_id = user_id or current_user.id
    
    # Ensure user can only view their own settings unless admin
    if current_user.role not in ['super_admin', 'hq_admin'] and target_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only view your own settings")
    
    settings = await settings_coll.find_one({"user_id": target_user_id})
    if not settings:
        # Return default settings
        default_settings = CommunicationSettingsCreate(user_id=target_user_id)
        return await create_or_update_communication_settings(default_settings, settings_coll, current_user)
    
    return CommunicationSettings(
        id=str(settings["_id"]),
        **{k: v for k, v in settings.items() if k != "_id"}
    )

# Parent Portal Endpoints
@router.get("/parent-info")
async def get_parent_info(
    parents_coll: Any = Depends(get_parents_collection),
    students_coll: Any = Depends(get_student_collection),
    current_user: User = Depends(get_current_user),
):
    """Get parent information with linked children for current user"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Find parent record by user_id
    parent = await parents_coll.find_one({"user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent record not found")
    
    # Get linked children information
    children = []
    for student_id in parent.get("student_ids", []):
        student = await students_coll.find_one({"_id": ObjectId(student_id)})
        if student:
            children.append({
                "id": str(student["_id"]),
                "student_id": student.get("student_id", ""),
                "full_name": student.get("full_name", ""),
                "grade_level": student.get("grade_level", ""),
                "class_name": student.get("class_name", ""),
                "overall_grade": student.get("overall_grade"),
                "attendance_percentage": student.get("attendance_percentage", 0.0),
                "behavior_points": student.get("behavior_points", 0),
                "outstanding_balance": student.get("outstanding_balance", 0.0),
                "recent_activity": student.get("recent_activity", [])
            })
    
    # Prepare parent info
    parent_info = {
        "id": str(parent["_id"]),
        "full_name": parent.get("father_name") or parent.get("mother_name") or parent.get("guardian_name", ""),
        "email": parent.get("father_email") or parent.get("mother_email") or parent.get("guardian_email", ""),
        "phone": parent.get("father_phone") or parent.get("mother_phone") or parent.get("guardian_phone"),
        "address": parent.get("address"),
        "relationship": "parent",
        "children": children
    }
    
    return parent_info

@router.get("/parent-dashboard/stats")
async def get_parent_dashboard_stats(
    parents_coll: Any = Depends(get_parents_collection),
    students_coll: Any = Depends(get_student_collection),
    notifications_coll: Any = Depends(get_notifications_collection),
    current_user: User = Depends(get_current_user),
):
    """Get dashboard statistics for parent portal"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Find parent record
    parent = await parents_coll.find_one({"user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent record not found")
    
    # Count active notifications
    active_notifications = await notifications_coll.count_documents({
        "user_id": current_user.id,
        "is_read": False,
        "$or": [
            {"expires_at": None},
            {"expires_at": {"$gt": datetime.utcnow()}}
        ]
    })
    
    return {
        "total_children": len(parent.get("student_ids", [])),
        "active_notifications": active_notifications,
        "upcoming_events": 0,  # TODO: Implement events system
        "pending_payments": 0,  # TODO: Calculate from fees
        "recent_grades": 0,  # TODO: Calculate from recent exam results
        "attendance_alerts": 0  # TODO: Calculate from attendance issues
    }

@router.get("/parent-dashboard/student/{student_id}")
async def get_student_details_for_parent(
    student_id: str,
    parents_coll: Any = Depends(get_parents_collection),
    students_coll: Any = Depends(get_student_collection),
    classes_coll: Any = Depends(get_classes_collection),
    exam_results_coll: Any = Depends(get_exam_results_collection),
    exams_coll: Any = Depends(get_exams_collection),
    grading_scales_coll: Any = Depends(get_grading_scales_collection),
    notifications_coll: Any = Depends(get_notifications_collection),
    fees_coll: Any = Depends(get_fees_collection),
    transactions_coll: Any = Depends(get_registration_payments_collection),
    attendance_coll: Any = Depends(get_attendance_collection),
    discipline_coll: Any = Depends(get_disciplinary_actions_collection),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive student details for parent portal"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Verify parent has access to this student with comprehensive checks
    parent = await parents_coll.find_one({"user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=403, detail="Parent record not found")
    
    # Check if student is linked to this parent
    has_access = False
    if student_id in parent.get("student_ids", []):
        has_access = True
    else:
        # Additional check: verify student's parent_guardian_id matches this parent
        student = await students_coll.find_one({"_id": ObjectId(student_id)})
        if student and student.get("parent_guardian_id") == str(parent["_id"]):
            has_access = True
    
    if not has_access:
        # Log security violation attempt
        await portal_service.audit_logger.log_async(
            action=AuditAction.UNAUTHORIZED_ACCESS_ATTEMPT,
            user_id=current_user.id,
            resource_type="student_data",
            resource_id=student_id,
            details=f"Parent {parent['_id']} attempted unauthorized access to student {student_id}",
            severity=AuditSeverity.HIGH
        )
        raise HTTPException(status_code=403, detail="Access denied to student information")
    
    # Initialize the comprehensive service
    portal_service = ComprehensiveParentPortalService()
    
    # Log authorized student data access
    await portal_service.audit_logger.log_async(
        action=AuditAction.READ,
        user_id=current_user.id,
        resource_type="student_data",
        resource_id=student_id,
        details=f"Parent {parent['_id']} accessed detailed data for student {student_id}",
        severity=AuditSeverity.LOW
    )
    
    try:
        # Get unified student data
        student_details = await portal_service._get_comprehensive_student_data(
            student_id=student_id,
            students_collection=students_coll,
            classes_collection=classes_coll,
            exam_results_collection=exam_results_coll,
            exams_collection=exams_coll,
            grading_scales_collection=grading_scales_coll,
            fees_collection=fees_coll,
            transactions_collection=transactions_coll,
            attendance_collection=attendance_coll,
            discipline_collection=discipline_coll
        )
        
        # Apply parent-specific data filtering for privacy
        filtered_details = await portal_service._filter_student_data_for_parent(
            student_details, 
            parent_id=str(parent["_id"]),
            parent_permissions=parent.get("permissions", {})
        )
        
        return filtered_details
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving student details: {str(e)}")

@router.get("/parent-dashboard/unified/{parent_id}")
async def get_unified_parent_dashboard(
    parent_id: str,
    parents_coll: Any = Depends(get_parents_collection),
    students_coll: Any = Depends(get_student_collection),
    classes_coll: Any = Depends(get_classes_collection),
    exam_results_coll: Any = Depends(get_exam_results_collection),
    exams_coll: Any = Depends(get_exams_collection),
    grading_scales_coll: Any = Depends(get_grading_scales_collection),
    notifications_coll: Any = Depends(get_notifications_collection),
    fees_coll: Any = Depends(get_fees_collection),
    transactions_coll: Any = Depends(get_registration_payments_collection),
    attendance_coll: Any = Depends(get_attendance_collection),
    discipline_coll: Any = Depends(get_disciplinary_actions_collection),
    current_user: User = Depends(get_current_user),
):
    """Get unified dashboard data for parent portal"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Verify parent access
    parent = await parents_coll.find_one({"_id": ObjectId(parent_id), "user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=403, detail="Access denied to parent dashboard")
    
    # Initialize the comprehensive service
    portal_service = ComprehensiveParentPortalService()
    
    try:
        # Get unified dashboard data
        dashboard_data = await portal_service.get_unified_parent_dashboard(
            parent_id=parent_id,
            students_collection=students_coll,
            parents_collection=parents_coll,
            classes_collection=classes_coll,
            exam_results_collection=exam_results_coll,
            exams_collection=exams_coll,
            grading_scales_collection=grading_scales_coll,
            portal_notifications_collection=notifications_coll,
            fees_collection=fees_coll,
            transactions_collection=transactions_coll,
            attendance_collection=attendance_coll,
            discipline_collection=discipline_coll,
            branch_id=parent.get("branch_id")
        )
        
        return dashboard_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving dashboard data: {str(e)}")

@router.get("/parent-dashboard/payments/{parent_id}")
async def get_parent_payment_data(
    parent_id: str,
    parents_coll: Any = Depends(get_parents_collection),
    students_coll: Any = Depends(get_student_collection),
    fees_coll: Any = Depends(get_fees_collection),
    transactions_coll: Any = Depends(get_registration_payments_collection),
    current_user: User = Depends(get_current_user),
):
    """Get payment data for parent portal"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Verify parent access
    parent = await parents_coll.find_one({"_id": ObjectId(parent_id), "user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=403, detail="Access denied to parent payment data")
    
    # Initialize the comprehensive service
    portal_service = ComprehensiveParentPortalService()
    
    try:
        # Get comprehensive payment data for all children
        payment_data = await portal_service._get_parent_financial_summary(
            parent_id=parent_id,
            students_collection=students_coll,
            parents_collection=parents_coll,
            fees_collection=fees_coll,
            transactions_collection=transactions_coll
        )
        
        return payment_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving payment data: {str(e)}")

# Parent Notification Management Endpoints
@router.get("/parent-notifications/preferences")
async def get_parent_notification_preferences(
    parents_coll: Any = Depends(get_parents_collection),
    current_user: User = Depends(get_current_user),
):
    """Get notification preferences for parent"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Find parent record
    parent = await parents_coll.find_one({"user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent record not found")
    
    notification_service = ParentNotificationService()
    preferences = await notification_service.get_parent_notification_preferences(
        str(parent["_id"]), parents_coll
    )
    
    return preferences

@router.put("/parent-notifications/preferences")
async def update_parent_notification_preferences(
    preferences: dict,
    parents_coll: Any = Depends(get_parents_collection),
    current_user: User = Depends(get_current_user),
):
    """Update notification preferences for parent"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Find parent record
    parent = await parents_coll.find_one({"user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent record not found")
    
    notification_service = ParentNotificationService()
    success = await notification_service.update_parent_notification_preferences(
        str(parent["_id"]), preferences, parents_coll
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update notification preferences")
    
    return {"message": "Notification preferences updated successfully"}

@router.post("/parent-notifications/test")
async def send_test_notification(
    notification_type: str,
    parents_coll: Any = Depends(get_parents_collection),
    notifications_coll: Any = Depends(get_notifications_collection),
    current_user: User = Depends(get_current_user),
):
    """Send a test notification to parent (for testing purposes)"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Find parent record
    parent = await parents_coll.find_one({"user_id": current_user.id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent record not found")
    
    notification_service = ParentNotificationService()
    
    # Send different test notifications based on type
    if notification_type == "grade_update":
        success = await notification_service.notify_parent_grade_update(
            parent_id=str(parent["_id"]),
            student_id="test_student_id",
            student_name="Test Student",
            subject="Mathematics",
            grade="A-",
            exam_name="Midterm Exam",
            parents_collection=parents_coll,
            notifications_collection=notifications_coll
        )
    elif notification_type == "attendance_alert":
        success = await notification_service.notify_parent_attendance_alert(
            parent_id=str(parent["_id"]),
            student_id="test_student_id",
            student_name="Test Student",
            alert_type="absent",
            attendance_percentage=85.0,
            parents_collection=parents_coll,
            notifications_collection=notifications_coll
        )
    elif notification_type == "payment_due":
        success = await notification_service.notify_parent_payment_due(
            parent_id=str(parent["_id"]),
            student_id="test_student_id",
            student_name="Test Student",
            fee_type="Tuition Fee",
            amount=500.00,
            due_date="2024-02-15",
            parents_collection=parents_coll,
            notifications_collection=notifications_coll
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid notification type")
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to send test notification")
    
    return {"message": f"Test {notification_type} notification sent successfully"}

@router.get("/parent-notifications/summary")
async def get_parent_notifications_summary(
    parents_coll: Any = Depends(get_parents_collection),
    notifications_coll: Any = Depends(get_notifications_collection),
    current_user: User = Depends(get_current_user),
):
    """Get notification summary for parent dashboard"""
    if current_user.role != 'parent':
        raise HTTPException(status_code=403, detail="Only parents can access this endpoint")
    
    # Count unread notifications by type
    unread_counts = await notifications_coll.aggregate([
        {"$match": {"user_id": current_user.id, "is_read": False}},
        {"$group": {
            "_id": "$notification_type",
            "count": {"$sum": 1}
        }}
    ]).to_list(length=None)
    
    # Format the response
    summary = {
        "total_unread": sum(item["count"] for item in unread_counts),
        "by_type": {item["_id"]: item["count"] for item in unread_counts}
    }
    
    return summary