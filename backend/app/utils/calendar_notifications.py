"""
Calendar event notification integration
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from ..db import get_db
from ..models.academic_calendar import EventNotification, EventNotificationCreate

logger = logging.getLogger(__name__)

class CalendarNotificationService:
    """Handles notifications for calendar events"""
    
    def __init__(self):
        self.db = get_db()
    
    async def schedule_event_notifications(self, event_data: Dict[str, Any]) -> List[str]:
        """
        Schedule notifications for a calendar event
        Returns list of notification IDs created
        """
        notification_ids = []
        
        try:
            event_start = datetime.fromisoformat(event_data['start_date'].replace('Z', '+00:00'))
            event_type = event_data.get('event_type', 'event')
            
            # Determine notification schedule based on event type
            notification_schedule = self._get_notification_schedule(event_type, event_start)
            
            # Get recipients based on event visibility and target audience
            recipients = await self._get_notification_recipients(event_data)
            
            # Create notifications
            for schedule_item in notification_schedule:
                notification_data = EventNotificationCreate(
                    event_id=str(event_data.get('id')),
                    notification_type=schedule_item['type'],
                    recipient_ids=recipients,
                    message_template=self._generate_message_template(event_data, schedule_item),
                    scheduled_time=schedule_item['send_time']
                )
                
                # Insert notification
                result = await self.db.event_notifications.insert_one(notification_data.dict())
                notification_ids.append(str(result.inserted_id))
                
                logger.info(f"Scheduled {schedule_item['type']} notification for event {event_data.get('title')}")
            
        except Exception as e:
            logger.error(f"Failed to schedule event notifications: {str(e)}")
        
        return notification_ids
    
    def _get_notification_schedule(self, event_type: str, event_start: datetime) -> List[Dict[str, Any]]:
        """
        Get notification schedule based on event type
        """
        now = datetime.now()
        schedule = []
        
        if event_type == 'exam':
            # Exam reminders: 7 days, 3 days, 1 day before
            for days_before in [7, 3, 1]:
                send_time = event_start - timedelta(days=days_before)
                if send_time > now:
                    schedule.append({
                        'type': 'reminder',
                        'send_time': send_time,
                        'days_before': days_before
                    })
        
        elif event_type == 'payment_due':
            # Payment reminders: 7 days, 3 days, 1 day before, and on due date
            for days_before in [7, 3, 1, 0]:
                send_time = event_start - timedelta(days=days_before)
                if send_time > now:
                    notification_type = 'reminder' if days_before > 0 else 'due_today'
                    schedule.append({
                        'type': notification_type,
                        'send_time': send_time,
                        'days_before': days_before
                    })
        
        elif event_type == 'deadline':
            # Deadline reminders: 3 days, 1 day before
            for days_before in [3, 1]:
                send_time = event_start - timedelta(days=days_before)
                if send_time > now:
                    schedule.append({
                        'type': 'reminder',
                        'send_time': send_time,
                        'days_before': days_before
                    })
        
        elif event_type == 'report_due':
            # Report generation reminders: 1 day before for staff
            send_time = event_start - timedelta(days=1)
            if send_time > now:
                schedule.append({
                    'type': 'reminder',
                    'send_time': send_time,
                    'days_before': 1
                })
        
        else:
            # General event reminder: 1 day before
            send_time = event_start - timedelta(days=1)
            if send_time > now:
                schedule.append({
                    'type': 'reminder',
                    'send_time': send_time,
                    'days_before': 1
                })
        
        return schedule
    
    async def _get_notification_recipients(self, event_data: Dict[str, Any]) -> List[str]:
        """
        Get list of user IDs who should receive notifications for this event
        """
        recipients = []
        
        try:
            target_audience = event_data.get('target_audience', 'all')
            visibility_roles = event_data.get('visibility_roles', ['admin', 'principal', 'teacher', 'parent', 'student'])
            class_ids = event_data.get('class_ids', [])
            branch_id = event_data.get('branch_id')
            
            # Build user query based on target audience and visibility
            user_query = {"role": {"$in": visibility_roles}}
            
            if branch_id:
                user_query["branch_id"] = branch_id
            
            # Refine based on target audience
            if target_audience == 'staff':
                user_query["role"] = {"$in": ["admin", "principal", "teacher"]}
            elif target_audience == 'parents':
                user_query["role"] = "parent"
            elif target_audience == 'students':
                user_query["role"] = "student"
            elif target_audience == 'specific_class' and class_ids:
                # For class-specific events, get students and parents of those classes
                # This would require additional logic to find users associated with specific classes
                pass
            
            # Get users from database
            users = await self.db.users.find(user_query, {"_id": 1}).to_list(None)
            recipients = [str(user["_id"]) for user in users]
            
            # Add specific notification recipients if provided
            if event_data.get('notification_recipients'):
                recipients.extend(event_data['notification_recipients'])
            
            # Remove duplicates
            recipients = list(set(recipients))
            
        except Exception as e:
            logger.error(f"Failed to get notification recipients: {str(e)}")
        
        return recipients
    
    def _generate_message_template(self, event_data: Dict[str, Any], schedule_item: Dict[str, Any]) -> str:
        """
        Generate notification message template
        """
        event_title = event_data.get('title', 'Event')
        event_type = event_data.get('event_type', 'event')
        notification_type = schedule_item['type']
        days_before = schedule_item.get('days_before', 0)
        
        if notification_type == 'reminder':
            if event_type == 'exam':
                if days_before == 1:
                    return f"Reminder: {event_title} is tomorrow. Please prepare accordingly."
                else:
                    return f"Reminder: {event_title} is in {days_before} days. Start your preparations."
            
            elif event_type == 'payment_due':
                if days_before == 1:
                    return f"Payment Reminder: {event_title} is due tomorrow. Please make your payment to avoid late fees."
                else:
                    return f"Payment Reminder: {event_title} is due in {days_before} days."
            
            elif event_type == 'deadline':
                return f"Deadline Reminder: {event_title} is in {days_before} day(s). Please complete your tasks."
            
            elif event_type == 'report_due':
                return f"Report Generation: {event_title} is scheduled for tomorrow. Please ensure all data is ready."
            
            else:
                return f"Reminder: {event_title} is in {days_before} day(s)."
        
        elif notification_type == 'due_today':
            if event_type == 'payment_due':
                return f"Payment Due Today: {event_title}. Please make your payment immediately."
            else:
                return f"Today: {event_title}"
        
        elif notification_type == 'overdue':
            if event_type == 'payment_due':
                return f"Payment Overdue: {event_title} was due and requires immediate attention."
            else:
                return f"Overdue: {event_title}"
        
        else:
            return f"Notification: {event_title}"
    
    async def send_pending_notifications(self) -> int:
        """
        Send all pending notifications that are due
        Called by a scheduled task
        """
        sent_count = 0
        
        try:
            now = datetime.now()
            
            # Find pending notifications that are due
            pending_notifications = await self.db.event_notifications.find({
                "status": "pending",
                "scheduled_time": {"$lte": now}
            }).to_list(None)
            
            for notification in pending_notifications:
                try:
                    # Here you would integrate with your actual notification system
                    # For now, we'll just mark as sent
                    success = await self._send_notification(notification)
                    
                    if success:
                        await self.db.event_notifications.update_one(
                            {"_id": notification["_id"]},
                            {
                                "$set": {
                                    "status": "sent",
                                    "sent_at": now
                                }
                            }
                        )
                        sent_count += 1
                    else:
                        await self.db.event_notifications.update_one(
                            {"_id": notification["_id"]},
                            {
                                "$set": {
                                    "status": "failed",
                                    "error_message": "Failed to send notification"
                                }
                            }
                        )
                
                except Exception as e:
                    logger.error(f"Failed to send notification {notification.get('_id')}: {str(e)}")
                    await self.db.event_notifications.update_one(
                        {"_id": notification["_id"]},
                        {
                            "$set": {
                                "status": "failed",
                                "error_message": str(e)
                            }
                        }
                    )
            
            logger.info(f"Sent {sent_count} calendar notifications")
            
        except Exception as e:
            logger.error(f"Failed to send pending notifications: {str(e)}")
        
        return sent_count
    
    async def _send_notification(self, notification: Dict[str, Any]) -> bool:
        """
        Send individual notification
        This is a placeholder - integrate with your actual notification system
        """
        try:
            # This is where you would integrate with:
            # - Email service
            # - SMS service  
            # - Push notification service
            # - In-app notification system
            # - WebSocket for real-time notifications
            
            logger.info(f"Sending notification: {notification.get('message_template')} to {len(notification.get('recipient_ids', []))} recipients")
            
            # For now, just return True to simulate successful sending
            return True
            
        except Exception as e:
            logger.error(f"Failed to send notification: {str(e)}")
            return False
    
    async def cancel_event_notifications(self, event_id: str) -> bool:
        """
        Cancel all pending notifications for an event
        """
        try:
            result = await self.db.event_notifications.delete_many({
                "event_id": event_id,
                "status": "pending"
            })
            
            logger.info(f"Cancelled {result.deleted_count} notifications for event {event_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to cancel notifications for event {event_id}: {str(e)}")
            return False

# Global instance
calendar_notification_service = CalendarNotificationService()