from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import uuid
import logging

from ..models.notifications import (
    Notification, NotificationTemplate, NotificationRecipient, 
    NotificationPreference, NotificationQueue, NotificationBatch,
    NotificationCampaign, NotificationAnalytics, PushNotificationDevice,
    NotificationSettings, NotificationType, NotificationPriority,
    NotificationChannel, NotificationStatus, RecipientType
)
from ..db import (
    get_notifications_collection, get_notification_templates_collection,
    get_notification_recipients_collection, get_notification_preferences_collection,
    get_notification_queue_collection, get_notification_batches_collection,
    get_notification_campaigns_collection, get_notification_analytics_collection,
    get_push_devices_collection, get_notification_settings_collection,
    get_user_collection, get_student_collection
)
from ..utils.rbac import get_current_user, has_permission, Role, Permission

router = APIRouter()
logger = logging.getLogger(__name__)

def require_auth(current_user: dict, allowed_roles: list):
    """Helper function to check user roles"""
    if not current_user or current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized")


def generate_notification_code(prefix: str) -> str:
    """Generate unique notification code"""
    timestamp = datetime.now().strftime("%Y%m%d%H%M")
    unique_id = str(uuid.uuid4())[:8].upper()
    return f"{prefix}-{timestamp}-{unique_id}"


# Notifications CRUD
@router.post("/", response_model=Notification)
async def create_notification(
    notification: Notification,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    notifications_collection: AsyncIOMotorCollection = Depends(get_notifications_collection)
):
    """Create a new notification"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    notification_dict = notification.dict(exclude={"id"})
    notification_dict["notification_code"] = generate_notification_code("NOT")
    notification_dict["sender_id"] = current_user["user_id"]
    notification_dict["sender_name"] = current_user.get("full_name", current_user["email"])
    notification_dict["sender_role"] = current_user["role"]
    
    # If no scheduled time, send immediately
    if not notification_dict.get("scheduled_for"):
        notification_dict["scheduled_for"] = datetime.utcnow()
    
    result = await notifications_collection.insert_one(notification_dict)
    
    # Add background task to process notification
    background_tasks.add_task(process_notification, str(result.inserted_id))
    
    notification_dict["id"] = str(result.inserted_id)
    return Notification(**notification_dict)


@router.get("/", response_model=List[Notification])
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    notification_type: Optional[NotificationType] = None,
    status: Optional[NotificationStatus] = None,
    current_user: dict = Depends(get_current_user),
    notifications_collection: AsyncIOMotorCollection = Depends(get_notifications_collection)
):
    """Get notifications with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {}
    if notification_type:
        filter_dict["notification_type"] = notification_type
    if status:
        filter_dict["status"] = status
    
    cursor = notifications_collection.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    notifications = await cursor.to_list(length=limit)
    
    for notification in notifications:
        notification["id"] = str(notification["_id"])
        del notification["_id"]
    
    return [Notification(**notification) for notification in notifications]


@router.get("/user-notifications")
async def get_user_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user),
    recipients_collection: AsyncIOMotorCollection = Depends(get_notification_recipients_collection)
):
    """Get notifications for the current user"""
    filter_dict = {"user_id": current_user["user_id"]}
    
    if unread_only:
        filter_dict["read_at"] = {"$exists": False}
    
    cursor = recipients_collection.find(filter_dict).skip(skip).limit(limit).sort("sent_at", -1)
    user_notifications = await cursor.to_list(length=limit)
    
    # Get the full notification details
    notification_ids = [rec["notification_id"] for rec in user_notifications]
    from ..db import get_db
    db = get_db()
    notifications_collection = db["notifications"]
    
    notifications = await notifications_collection.find({
        "_id": {"$in": [ObjectId(nid) for nid in notification_ids]}
    }).to_list(length=len(notification_ids))
    
    # Create notification map
    notification_map = {str(n["_id"]): n for n in notifications}
    
    # Combine notification data with recipient data
    result = []
    for recipient in user_notifications:
        notification_data = notification_map.get(recipient["notification_id"])
        if notification_data:
            notification_data["recipient_status"] = recipient["in_app_status"]
            notification_data["read_at"] = recipient.get("read_at")
            notification_data["clicked"] = recipient.get("clicked", False)
            notification_data["id"] = str(notification_data["_id"])
            del notification_data["_id"]
            result.append(notification_data)
    
    return result


@router.post("/mark-read/{notification_id}")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
    recipients_collection: AsyncIOMotorCollection = Depends(get_notification_recipients_collection)
):
    """Mark a notification as read"""
    result = await recipients_collection.update_one(
        {
            "notification_id": notification_id,
            "user_id": current_user["user_id"]
        },
        {
            "$set": {
                "in_app_status": NotificationStatus.READ,
                "read_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_user),
    recipients_collection: AsyncIOMotorCollection = Depends(get_notification_recipients_collection)
):
    """Mark all notifications as read for current user"""
    result = await recipients_collection.update_many(
        {
            "user_id": current_user["user_id"],
            "read_at": {"$exists": False}
        },
        {
            "$set": {
                "in_app_status": NotificationStatus.READ,
                "read_at": datetime.utcnow()
            }
        }
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}


# Notification Templates
@router.post("/templates", response_model=NotificationTemplate)
async def create_notification_template(
    template: NotificationTemplate,
    current_user: dict = Depends(get_current_user),
    templates_collection: AsyncIOMotorCollection = Depends(get_notification_templates_collection)
):
    """Create a new notification template"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    template_dict = template.dict(exclude={"id"})
    template_dict["template_code"] = generate_notification_code("TPL")
    template_dict["created_by"] = current_user["user_id"]
    
    result = await templates_collection.insert_one(template_dict)
    template_dict["id"] = str(result.inserted_id)
    
    return NotificationTemplate(**template_dict)


@router.get("/templates", response_model=List[NotificationTemplate])
async def get_notification_templates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    notification_type: Optional[NotificationType] = None,
    current_user: dict = Depends(get_current_user),
    templates_collection: AsyncIOMotorCollection = Depends(get_notification_templates_collection)
):
    """Get notification templates"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {"is_active": True}
    if notification_type:
        filter_dict["notification_type"] = notification_type
    
    cursor = templates_collection.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    templates = await cursor.to_list(length=limit)
    
    for template in templates:
        template["id"] = str(template["_id"])
        del template["_id"]
    
    return [NotificationTemplate(**template) for template in templates]


# Notification Preferences
@router.get("/preferences")
async def get_notification_preferences(
    current_user: dict = Depends(get_current_user),
    preferences_collection: AsyncIOMotorCollection = Depends(get_notification_preferences_collection)
):
    """Get current user's notification preferences"""
    preferences = await preferences_collection.find_one({"user_id": current_user["user_id"]})
    
    if not preferences:
        # Create default preferences
        default_preferences = NotificationPreference(
            user_id=current_user["user_id"]
        )
        await preferences_collection.insert_one(default_preferences.dict(exclude={"id"}))
        return default_preferences
    
    preferences["id"] = str(preferences["_id"])
    del preferences["_id"]
    return NotificationPreference(**preferences)


@router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreference,
    current_user: dict = Depends(get_current_user),
    preferences_collection: AsyncIOMotorCollection = Depends(get_notification_preferences_collection)
):
    """Update current user's notification preferences"""
    preferences_dict = preferences.dict(exclude={"id", "user_id"})
    preferences_dict["user_id"] = current_user["user_id"]
    preferences_dict["updated_at"] = datetime.utcnow()
    
    result = await preferences_collection.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": preferences_dict},
        upsert=True
    )
    
    return {"message": "Preferences updated successfully"}


# Quick Notifications
@router.post("/quick/announcement")
async def send_quick_announcement(
    title: str,
    message: str,
    background_tasks: BackgroundTasks,
    recipient_type: RecipientType = RecipientType.ALL_USERS,
    priority: NotificationPriority = NotificationPriority.MEDIUM,
    current_user: dict = Depends(get_current_user),
    notifications_collection: AsyncIOMotorCollection = Depends(get_notifications_collection)
):
    """Send a quick announcement"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    notification = Notification(
        notification_code=generate_notification_code("ANN"),
        title=title,
        message=message,
        notification_type=NotificationType.ANNOUNCEMENT,
        priority=priority,
        sender_id=current_user["user_id"],
        sender_name=current_user.get("full_name", current_user["email"]),
        sender_role=current_user["role"],
        recipient_type=recipient_type,
        channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        scheduled_for=datetime.utcnow()
    )
    
    notification_dict = notification.dict(exclude={"id"})
    result = await notifications_collection.insert_one(notification_dict)
    
    # Process immediately
    background_tasks.add_task(process_notification, str(result.inserted_id))
    
    return {"message": "Announcement sent successfully", "notification_id": str(result.inserted_id)}


@router.post("/quick/emergency")
async def send_emergency_notification(
    title: str,
    message: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
    notifications_collection: AsyncIOMotorCollection = Depends(get_notifications_collection)
):
    """Send an emergency notification to all users"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    notification = Notification(
        notification_code=generate_notification_code("EMG"),
        title=f"🚨 EMERGENCY: {title}",
        message=message,
        notification_type=NotificationType.EMERGENCY,
        priority=NotificationPriority.URGENT,
        sender_id=current_user["user_id"],
        sender_name=current_user.get("full_name", current_user["email"]),
        sender_role=current_user["role"],
        recipient_type=RecipientType.ALL_USERS,
        channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
        scheduled_for=datetime.utcnow()
    )
    
    notification_dict = notification.dict(exclude={"id"})
    result = await notifications_collection.insert_one(notification_dict)
    
    # Process immediately with high priority
    background_tasks.add_task(process_notification, str(result.inserted_id))
    
    return {"message": "Emergency notification sent successfully", "notification_id": str(result.inserted_id)}


# Analytics and Statistics
@router.get("/analytics/overview")
async def get_notification_analytics(
    days: int = Query(30, ge=1, le=365),
    current_user: dict = Depends(get_current_user),
    notifications_collection: AsyncIOMotorCollection = Depends(get_notifications_collection),
    recipients_collection: AsyncIOMotorCollection = Depends(get_notification_recipients_collection)
):
    """Get notification analytics overview"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    # Get total notifications sent
    total_notifications = await notifications_collection.count_documents({
        "created_at": {"$gte": start_date}
    })
    
    # Get delivery statistics
    delivery_stats = await recipients_collection.aggregate([
        {"$match": {"sent_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$in_app_status",
            "count": {"$sum": 1}
        }}
    ]).to_list(length=None)
    
    # Get notification type distribution
    type_distribution = await notifications_collection.aggregate([
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$notification_type",
            "count": {"$sum": 1}
        }}
    ]).to_list(length=None)
    
    # Get engagement metrics
    engagement_stats = await recipients_collection.aggregate([
        {"$match": {"sent_at": {"$gte": start_date}}},
        {"$group": {
            "_id": None,
            "total_sent": {"$sum": 1},
            "total_read": {"$sum": {"$cond": [{"$ne": ["$read_at", None]}, 1, 0]}},
            "total_clicked": {"$sum": {"$cond": ["$clicked", 1, 0]}}
        }}
    ]).to_list(length=1)
    
    engagement = engagement_stats[0] if engagement_stats else {}
    
    return {
        "total_notifications": total_notifications,
        "delivery_stats": {item["_id"]: item["count"] for item in delivery_stats},
        "type_distribution": {item["_id"]: item["count"] for item in type_distribution},
        "engagement_metrics": {
            "total_sent": engagement.get("total_sent", 0),
            "total_read": engagement.get("total_read", 0),
            "total_clicked": engagement.get("total_clicked", 0),
            "read_rate": (engagement.get("total_read", 0) / max(engagement.get("total_sent", 1), 1)) * 100,
            "click_rate": (engagement.get("total_clicked", 0) / max(engagement.get("total_sent", 1), 1)) * 100
        }
    }


@router.get("/analytics/performance")
async def get_notification_performance(
    current_user: dict = Depends(get_current_user),
    notifications_collection: AsyncIOMotorCollection = Depends(get_notifications_collection)
):
    """Get notification system performance metrics"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # Get recent performance data
    recent_notifications = await notifications_collection.find({
        "status": {"$in": ["sent", "delivered"]},
        "sent_at": {"$gte": datetime.utcnow() - timedelta(hours=24)}
    }).to_list(length=None)
    
    # Calculate average delivery time and success rate
    total_processed = len(recent_notifications)
    successful_deliveries = len([n for n in recent_notifications if n.get("delivered_count", 0) > 0])
    
    return {
        "total_processed_24h": total_processed,
        "successful_deliveries": successful_deliveries,
        "success_rate": (successful_deliveries / max(total_processed, 1)) * 100,
        "average_delivery_time": "2.3 seconds",  # Placeholder
        "system_status": "operational",
        "queue_length": 0,  # Placeholder
        "error_rate": ((total_processed - successful_deliveries) / max(total_processed, 1)) * 100
    }


# Background task for processing notifications
async def process_notification(notification_id: str):
    """Background task to process and send notifications"""
    try:
        logger.info(f"Processing notification {notification_id}")
        
        # Get notification details
        from ..db import get_db
        db = get_db()
        notifications_collection = db["notifications"]
        notification = await notifications_collection.find_one({"_id": ObjectId(notification_id)})
        
        if not notification:
            logger.error(f"Notification {notification_id} not found")
            return
        
        # Determine recipients based on target criteria
        recipients = await get_notification_recipients(notification)
        
        # Create recipient records
        recipients_collection = db["notification_recipients"]
        recipient_records = []
        
        for recipient in recipients:
            recipient_record = NotificationRecipient(
                notification_id=notification_id,
                user_id=recipient["user_id"],
                user_name=recipient.get("full_name", recipient.get("email", "Unknown")),
                user_role=recipient.get("role", "unknown"),
                user_email=recipient.get("email"),
                user_phone=recipient.get("phone")
            )
            recipient_records.append(recipient_record.dict(exclude={"id"}))
        
        if recipient_records:
            await recipients_collection.insert_many(recipient_records)
        
        # Update notification status
        await notifications_collection.update_one(
            {"_id": ObjectId(notification_id)},
            {
                "$set": {
                    "status": NotificationStatus.SENT,
                    "sent_at": datetime.utcnow(),
                    "total_recipients": len(recipient_records),
                    "delivered_count": len(recipient_records)  # Assume immediate delivery for in-app
                }
            }
        )
        
        logger.info(f"Notification {notification_id} processed successfully to {len(recipient_records)} recipients")
        
    except Exception as e:
        logger.error(f"Error processing notification {notification_id}: {str(e)}")
        
        # Update notification with error status
        from ..db import get_db
        db = get_db()
        notifications_collection = db["notifications"]
        await notifications_collection.update_one(
            {"_id": ObjectId(notification_id)},
            {
                "$set": {
                    "status": NotificationStatus.FAILED,
                    "error_message": str(e)
                }
            }
        )


async def get_notification_recipients(notification: dict) -> List[dict]:
    """Get list of users who should receive the notification"""
    from ..db import get_db
    db = get_db()
    users_collection = db["users"]
    students_collection = db["students"]
    
    recipients = []
    
    if notification["recipient_type"] == RecipientType.ALL_USERS:
        # Get all users
        all_users = await users_collection.find({}).to_list(length=None)
        recipients.extend(all_users)
        
        # Get all students (who might not be users)
        all_students = await students_collection.find({}).to_list(length=None)
        for student in all_students:
            if student.get("email"):
                recipients.append({
                    "user_id": student.get("student_id", str(student["_id"])),
                    "full_name": student.get("full_name"),
                    "email": student.get("email"),
                    "role": "student"
                })
    
    elif notification["recipient_type"] == RecipientType.STUDENTS:
        all_students = await students_collection.find({}).to_list(length=None)
        for student in all_students:
            recipients.append({
                "user_id": student.get("student_id", str(student["_id"])),
                "full_name": student.get("full_name"),
                "email": student.get("email"),
                "role": "student"
            })
    
    elif notification["recipient_type"] == RecipientType.TEACHERS:
        teachers = await users_collection.find({"role": "teacher"}).to_list(length=None)
        recipients.extend(teachers)
    
    elif notification["recipient_type"] == RecipientType.ADMINS:
        admins = await users_collection.find({
            "role": {"$in": ["super_admin", "hq_admin", "branch_admin", "admin"]}
        }).to_list(length=None)
        recipients.extend(admins)
    
    elif notification["recipient_type"] == RecipientType.CUSTOM:
        if notification.get("target_users"):
            custom_users = await users_collection.find({
                "_id": {"$in": [ObjectId(uid) for uid in notification["target_users"]]}
            }).to_list(length=None)
            recipients.extend(custom_users)
    
    # Add user_id field for consistency
    for recipient in recipients:
        if "user_id" not in recipient:
            recipient["user_id"] = str(recipient["_id"])
    
    return recipients