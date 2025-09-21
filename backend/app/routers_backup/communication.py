from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime

from ..db import (
    get_messages_collection, get_message_recipients_collection, get_notifications_collection,
    get_announcements_collection, get_parent_student_links_collection,
    get_communication_settings_collection, get_student_collection, get_user_collection,
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

@router.get("/notifications", response_model=List[Notification])
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
        notifications.append(Notification(
            id=str(notification["_id"]),
            **{k: v for k, v in notification.items() if k != "_id"}
        ))
    
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