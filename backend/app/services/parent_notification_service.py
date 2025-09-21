"""
Parent Notification Service
Handles push notifications and real-time updates for parent portal users.
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import asyncio

from ..utils.websocket_manager import WebSocketManager, MessageType
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity
from ..db import get_notifications_collection, get_parents_collection, get_user_collection

logger = logging.getLogger(__name__)

class ParentNotificationService:
    """Service for managing parent-specific notifications and real-time updates."""
    
    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.websocket_manager = WebSocketManager()
    
    async def notify_parent_grade_update(
        self,
        parent_id: str,
        student_id: str,
        student_name: str,
        subject: str,
        grade: str,
        exam_name: str,
        parents_collection: Any,
        notifications_collection: Any
    ) -> bool:
        """Send notification when a student's grade is updated."""
        try:
            # Get parent info
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent or not parent.get("user_id"):
                return False
            
            # Create notification record
            notification_data = {
                "user_id": parent["user_id"],
                "title": f"New Grade Posted - {student_name}",
                "message": f"{student_name} received a grade of {grade} in {subject} for {exam_name}",
                "notification_type": "grade_update",
                "related_entity_type": "student_grade",
                "related_entity_id": student_id,
                "action_url": f"/parent-portal/students/{student_id}#academic",
                "is_read": False,
                "created_at": datetime.utcnow(),
                "metadata": {
                    "student_id": student_id,
                    "student_name": student_name,
                    "subject": subject,
                    "grade": grade,
                    "exam_name": exam_name
                }
            }
            
            # Save to database
            result = await notifications_collection.insert_one(notification_data)
            notification_id = str(result.inserted_id)
            
            # Send real-time notification via WebSocket
            await self._send_realtime_notification(
                user_id=parent["user_id"],
                notification_type="grade_update",
                payload={
                    "id": notification_id,
                    "title": notification_data["title"],
                    "message": notification_data["message"],
                    "student_name": student_name,
                    "subject": subject,
                    "grade": grade,
                    "timestamp": notification_data["created_at"].isoformat()
                }
            )
            
            # Log notification sent
            await self.audit_logger.log_async(
                action=AuditAction.CREATE,
                user_id=parent["user_id"],
                resource_type="parent_notification",
                resource_id=notification_id,
                details=f"Grade notification sent for student {student_name}",
                severity=AuditSeverity.LOW
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending grade notification: {e}")
            return False
    
    async def notify_parent_attendance_alert(
        self,
        parent_id: str,
        student_id: str,
        student_name: str,
        alert_type: str,  # 'absent', 'late', 'multiple_absences'
        attendance_percentage: float,
        parents_collection: Any,
        notifications_collection: Any
    ) -> bool:
        """Send notification for attendance-related alerts."""
        try:
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent or not parent.get("user_id"):
                return False
            
            # Generate appropriate message based on alert type
            if alert_type == "absent":
                title = f"Absence Alert - {student_name}"
                message = f"{student_name} was marked absent today. Current attendance: {attendance_percentage:.1f}%"
            elif alert_type == "late":
                title = f"Late Arrival - {student_name}"
                message = f"{student_name} arrived late to school today."
            elif alert_type == "multiple_absences":
                title = f"Multiple Absences - {student_name}"
                message = f"{student_name} has multiple recent absences. Current attendance: {attendance_percentage:.1f}%"
            else:
                title = f"Attendance Update - {student_name}"
                message = f"Attendance update for {student_name}. Current attendance: {attendance_percentage:.1f}%"
            
            notification_data = {
                "user_id": parent["user_id"],
                "title": title,
                "message": message,
                "notification_type": "attendance_alert",
                "related_entity_type": "student_attendance",
                "related_entity_id": student_id,
                "action_url": f"/parent-portal/students/{student_id}#attendance",
                "is_read": False,
                "created_at": datetime.utcnow(),
                "metadata": {
                    "student_id": student_id,
                    "student_name": student_name,
                    "alert_type": alert_type,
                    "attendance_percentage": attendance_percentage
                }
            }
            
            # Save notification
            result = await notifications_collection.insert_one(notification_data)
            notification_id = str(result.inserted_id)
            
            # Send real-time notification
            await self._send_realtime_notification(
                user_id=parent["user_id"],
                notification_type="attendance_alert",
                payload={
                    "id": notification_id,
                    "title": title,
                    "message": message,
                    "student_name": student_name,
                    "alert_type": alert_type,
                    "attendance_percentage": attendance_percentage,
                    "timestamp": notification_data["created_at"].isoformat()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending attendance notification: {e}")
            return False
    
    async def notify_parent_payment_due(
        self,
        parent_id: str,
        student_id: str,
        student_name: str,
        fee_type: str,
        amount: float,
        due_date: str,
        parents_collection: Any,
        notifications_collection: Any
    ) -> bool:
        """Send notification for payment due alerts."""
        try:
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent or not parent.get("user_id"):
                return False
            
            notification_data = {
                "user_id": parent["user_id"],
                "title": f"Payment Due - {student_name}",
                "message": f"Payment of ${amount:.2f} for {fee_type} is due on {due_date} for {student_name}",
                "notification_type": "payment_due",
                "related_entity_type": "student_fee",
                "related_entity_id": student_id,
                "action_url": f"/parent-portal/payments",
                "is_read": False,
                "created_at": datetime.utcnow(),
                "metadata": {
                    "student_id": student_id,
                    "student_name": student_name,
                    "fee_type": fee_type,
                    "amount": amount,
                    "due_date": due_date
                }
            }
            
            result = await notifications_collection.insert_one(notification_data)
            notification_id = str(result.inserted_id)
            
            await self._send_realtime_notification(
                user_id=parent["user_id"],
                notification_type="payment_due",
                payload={
                    "id": notification_id,
                    "title": notification_data["title"],
                    "message": notification_data["message"],
                    "student_name": student_name,
                    "amount": amount,
                    "due_date": due_date,
                    "timestamp": notification_data["created_at"].isoformat()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending payment notification: {e}")
            return False
    
    async def notify_parent_behavior_incident(
        self,
        parent_id: str,
        student_id: str,
        student_name: str,
        incident_type: str,
        description: str,
        points: int,
        parents_collection: Any,
        notifications_collection: Any
    ) -> bool:
        """Send notification for behavior incidents."""
        try:
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent or not parent.get("user_id"):
                return False
            
            # Determine notification tone based on points
            if points > 0:
                title = f"Positive Behavior - {student_name}"
                message = f"{student_name} earned {points} behavior points for {incident_type}: {description}"
            else:
                title = f"Behavior Alert - {student_name}"
                message = f"{student_name} received {abs(points)} negative points for {incident_type}: {description}"
            
            notification_data = {
                "user_id": parent["user_id"],
                "title": title,
                "message": message,
                "notification_type": "behavior_incident",
                "related_entity_type": "student_behavior",
                "related_entity_id": student_id,
                "action_url": f"/parent-portal/students/{student_id}#behavior",
                "is_read": False,
                "created_at": datetime.utcnow(),
                "metadata": {
                    "student_id": student_id,
                    "student_name": student_name,
                    "incident_type": incident_type,
                    "description": description,
                    "points": points
                }
            }
            
            result = await notifications_collection.insert_one(notification_data)
            notification_id = str(result.inserted_id)
            
            await self._send_realtime_notification(
                user_id=parent["user_id"],
                notification_type="behavior_incident",
                payload={
                    "id": notification_id,
                    "title": title,
                    "message": message,
                    "student_name": student_name,
                    "incident_type": incident_type,
                    "points": points,
                    "is_positive": points > 0,
                    "timestamp": notification_data["created_at"].isoformat()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending behavior notification: {e}")
            return False
    
    async def notify_parent_announcement(
        self,
        parent_id: str,
        announcement_title: str,
        announcement_content: str,
        announcement_type: str,
        target_grade_levels: List[str],
        parents_collection: Any,
        notifications_collection: Any
    ) -> bool:
        """Send notification for school announcements."""
        try:
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent or not parent.get("user_id"):
                return False
            
            notification_data = {
                "user_id": parent["user_id"],
                "title": f"School Announcement: {announcement_title}",
                "message": announcement_content[:200] + "..." if len(announcement_content) > 200 else announcement_content,
                "notification_type": "school_announcement",
                "related_entity_type": "announcement",
                "related_entity_id": parent_id,  # Use parent_id as we don't have announcement_id
                "action_url": "/parent-portal/communication",
                "is_read": False,
                "created_at": datetime.utcnow(),
                "metadata": {
                    "announcement_type": announcement_type,
                    "target_grade_levels": target_grade_levels
                }
            }
            
            result = await notifications_collection.insert_one(notification_data)
            notification_id = str(result.inserted_id)
            
            await self._send_realtime_notification(
                user_id=parent["user_id"],
                notification_type="school_announcement",
                payload={
                    "id": notification_id,
                    "title": notification_data["title"],
                    "message": notification_data["message"],
                    "announcement_type": announcement_type,
                    "timestamp": notification_data["created_at"].isoformat()
                }
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending announcement notification: {e}")
            return False
    
    async def _send_realtime_notification(
        self,
        user_id: str,
        notification_type: str,
        payload: Dict[str, Any]
    ):
        """Send real-time notification via WebSocket."""
        try:
            # Send to all connected sessions for this user
            await self.websocket_manager.send_to_user(
                user_id=user_id,
                message_type=MessageType.NOTIFICATION,
                data={
                    "type": notification_type,
                    "payload": payload
                }
            )
            
            logger.info(f"Real-time notification sent to user {user_id}: {notification_type}")
            
        except Exception as e:
            logger.error(f"Error sending real-time notification: {e}")
    
    async def get_parent_notification_preferences(
        self,
        parent_id: str,
        parents_collection: Any
    ) -> Dict[str, Any]:
        """Get notification preferences for a parent."""
        try:
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent:
                return {}
            
            # Return default preferences if not set
            return parent.get("notification_preferences", {
                "grade_updates": True,
                "attendance_alerts": True,
                "payment_reminders": True,
                "behavior_incidents": True,
                "school_announcements": True,
                "email_notifications": True,
                "push_notifications": True,
                "sms_notifications": False
            })
            
        except Exception as e:
            logger.error(f"Error getting notification preferences: {e}")
            return {}
    
    async def update_parent_notification_preferences(
        self,
        parent_id: str,
        preferences: Dict[str, Any],
        parents_collection: Any
    ) -> bool:
        """Update notification preferences for a parent."""
        try:
            result = await parents_collection.update_one(
                {"_id": ObjectId(parent_id)},
                {
                    "$set": {
                        "notification_preferences": preferences,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error updating notification preferences: {e}")
            return False