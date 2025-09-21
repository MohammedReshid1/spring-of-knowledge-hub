"""
Automated attendance notification system
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, date
from ..db import get_db
from ..models.attendance import AttendanceNotification, AttendanceNotificationType, AttendanceAlert
from ..utils.calendar_notifications import calendar_notification_service

logger = logging.getLogger(__name__)

class AttendanceNotificationService:
    """Handles automated notifications for attendance events"""
    
    def __init__(self):
        self.db = get_db()
    
    async def process_attendance_notification(self, attendance_data: Dict[str, Any]) -> bool:
        """
        Process attendance record and trigger appropriate notifications
        """
        try:
            student_id = attendance_data.get('student_id')
            status = attendance_data.get('status')
            attendance_date = attendance_data.get('attendance_date')
            
            if not all([student_id, status, attendance_date]):
                logger.error("Missing required attendance data for notification processing")
                return False
            
            # Get student and parent information
            student_info = await self._get_student_info(student_id)
            if not student_info:
                logger.error(f"Student not found: {student_id}")
                return False
            
            notifications_sent = []
            
            # Process immediate notifications based on status
            if status == 'absent':
                notifications_sent.extend(await self._handle_absent_notification(attendance_data, student_info))
            elif status == 'late':
                notifications_sent.extend(await self._handle_late_notification(attendance_data, student_info))
            elif status == 'early_departure':
                notifications_sent.extend(await self._handle_early_departure_notification(attendance_data, student_info))
            
            # Check for attendance patterns and alerts
            await self._check_attendance_patterns(student_id, attendance_data)
            
            # Create calendar events if needed
            await self._create_attendance_calendar_events(attendance_data, student_info)
            
            logger.info(f"Processed {len(notifications_sent)} attendance notifications for student {student_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to process attendance notification: {str(e)}")
            return False
    
    async def _handle_absent_notification(self, attendance_data: Dict[str, Any], student_info: Dict[str, Any]) -> List[str]:
        """Handle notifications for student absence"""
        notifications = []
        
        try:
            # Get parent/guardian contacts
            parent_ids = await self._get_parent_contacts(student_info['_id'])
            
            if parent_ids:
                # Create immediate absence notification
                notification = AttendanceNotification(
                    student_id=str(student_info['_id']),
                    attendance_id=attendance_data.get('id'),
                    notification_type=AttendanceNotificationType.ABSENT_ALERT,
                    recipient_ids=parent_ids,
                    message=self._generate_absence_message(student_info, attendance_data),
                    priority="medium",
                    delivery_method=["email", "sms"],
                    metadata={
                        "attendance_date": attendance_data.get('attendance_date').isoformat() if attendance_data.get('attendance_date') else None,
                        "class_id": attendance_data.get('class_id'),
                        "branch_id": attendance_data.get('branch_id')
                    }
                )
                
                # Save and send notification
                result = await self.db.attendance_notifications.insert_one(notification.dict())
                notification_id = str(result.inserted_id)
                
                # Schedule for immediate sending
                await self._send_notification(notification_id)
                notifications.append(notification_id)
                
                # Notify teachers/admin as well
                staff_notification = await self._create_staff_absence_notification(attendance_data, student_info)
                if staff_notification:
                    notifications.append(staff_notification)
            
        except Exception as e:
            logger.error(f"Failed to handle absent notification: {str(e)}")
        
        return notifications
    
    async def _handle_late_notification(self, attendance_data: Dict[str, Any], student_info: Dict[str, Any]) -> List[str]:
        """Handle notifications for late arrival"""
        notifications = []
        
        try:
            # Get attendance settings to check if late notifications are enabled
            settings = await self._get_attendance_settings(attendance_data.get('branch_id'))
            
            if settings and settings.get('notification_settings', {}).get('late_immediate', True):
                parent_ids = await self._get_parent_contacts(student_info['_id'])
                
                if parent_ids:
                    notification = AttendanceNotification(
                        student_id=str(student_info['_id']),
                        attendance_id=attendance_data.get('id'),
                        notification_type=AttendanceNotificationType.LATE_ALERT,
                        recipient_ids=parent_ids,
                        message=self._generate_late_message(student_info, attendance_data),
                        priority="low",
                        delivery_method=["email"],
                        metadata={
                            "check_in_time": attendance_data.get('check_in_time').isoformat() if attendance_data.get('check_in_time') else None,
                            "minutes_late": self._calculate_minutes_late(attendance_data, settings)
                        }
                    )
                    
                    result = await self.db.attendance_notifications.insert_one(notification.dict())
                    notification_id = str(result.inserted_id)
                    
                    await self._send_notification(notification_id)
                    notifications.append(notification_id)
            
        except Exception as e:
            logger.error(f"Failed to handle late notification: {str(e)}")
        
        return notifications
    
    async def _handle_early_departure_notification(self, attendance_data: Dict[str, Any], student_info: Dict[str, Any]) -> List[str]:
        """Handle notifications for early departure"""
        notifications = []
        
        try:
            parent_ids = await self._get_parent_contacts(student_info['_id'])
            
            if parent_ids:
                notification = AttendanceNotification(
                    student_id=str(student_info['_id']),
                    attendance_id=attendance_data.get('id'),
                    notification_type=AttendanceNotificationType.IMPROVEMENT_NOTICE,
                    recipient_ids=parent_ids,
                    message=self._generate_early_departure_message(student_info, attendance_data),
                    priority="medium",
                    delivery_method=["email", "sms"],
                    metadata={
                        "check_out_time": attendance_data.get('check_out_time').isoformat() if attendance_data.get('check_out_time') else None
                    }
                )
                
                result = await self.db.attendance_notifications.insert_one(notification.dict())
                notification_id = str(result.inserted_id)
                
                await self._send_notification(notification_id)
                notifications.append(notification_id)
        
        except Exception as e:
            logger.error(f"Failed to handle early departure notification: {str(e)}")
        
        return notifications
    
    async def _check_attendance_patterns(self, student_id: str, current_attendance: Dict[str, Any]) -> bool:
        """Check for concerning attendance patterns"""
        try:
            # Get recent attendance history
            recent_attendance = await self._get_recent_attendance(student_id, days=30)
            
            # Check for consecutive absences
            consecutive_absences = await self._check_consecutive_absences(recent_attendance)
            if consecutive_absences >= 3:
                await self._create_pattern_alert(student_id, "consecutive_absence", {
                    "consecutive_days": consecutive_absences,
                    "severity": "high" if consecutive_absences >= 5 else "medium"
                })
            
            # Check attendance percentage
            attendance_percentage = await self._calculate_attendance_percentage(recent_attendance)
            if attendance_percentage < 85:
                await self._create_pattern_alert(student_id, "low_attendance", {
                    "percentage": attendance_percentage,
                    "period_days": 30,
                    "severity": "critical" if attendance_percentage < 75 else "high"
                })
            
            # Check for frequent lateness pattern
            late_frequency = await self._check_late_frequency(recent_attendance)
            if late_frequency > 20:  # More than 20% late arrivals
                await self._create_pattern_alert(student_id, "frequent_lateness", {
                    "late_percentage": late_frequency,
                    "severity": "medium"
                })
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to check attendance patterns: {str(e)}")
            return False
    
    async def _create_pattern_alert(self, student_id: str, pattern_type: str, pattern_data: Dict[str, Any]) -> str:
        """Create an attendance pattern alert"""
        try:
            alert = AttendanceAlert(
                student_id=student_id,
                alert_type=pattern_type,
                severity=pattern_data.get('severity', 'medium'),
                message=self._generate_pattern_alert_message(pattern_type, pattern_data),
                triggered_date=datetime.now(),
                metadata=pattern_data
            )
            
            result = await self.db.attendance_alerts.insert_one(alert.dict())
            alert_id = str(result.inserted_id)
            
            # Send pattern alert notification to parents and staff
            await self._send_pattern_alert_notifications(alert_id, student_id, pattern_type, pattern_data)
            
            logger.info(f"Created attendance pattern alert {pattern_type} for student {student_id}")
            return alert_id
            
        except Exception as e:
            logger.error(f"Failed to create pattern alert: {str(e)}")
            return ""
    
    async def _create_attendance_calendar_events(self, attendance_data: Dict[str, Any], student_info: Dict[str, Any]) -> bool:
        """Create calendar events for attendance-related items"""
        try:
            if attendance_data.get('status') in ['absent', 'late']:
                # Create calendar reminder for follow-up
                calendar_data = {
                    "id": f"attendance-followup-{attendance_data.get('id')}",
                    "title": f"Follow up on {student_info.get('full_name')} - {attendance_data.get('status')}",
                    "event_type": "attendance_followup",
                    "start_date": (datetime.now() + timedelta(days=1)).isoformat(),
                    "target_audience": "staff",
                    "visibility_roles": ["admin", "teacher"],
                    "send_notifications": True,
                    "metadata": {
                        "student_id": str(student_info.get('_id')),
                        "attendance_issue": attendance_data.get('status'),
                        "class_id": attendance_data.get('class_id')
                    }
                }
                
                await calendar_notification_service.schedule_event_notifications(calendar_data)
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to create attendance calendar events: {str(e)}")
            return False
    
    # Utility methods
    async def _get_student_info(self, student_id: str) -> Optional[Dict[str, Any]]:
        """Get student information from database"""
        try:
            from bson import ObjectId
            student = await self.db.students.find_one({"_id": ObjectId(student_id)})
            return student
        except Exception as e:
            logger.error(f"Failed to get student info: {str(e)}")
            return None
    
    async def _get_parent_contacts(self, student_id: str) -> List[str]:
        """Get parent/guardian contact IDs for notifications"""
        try:
            # Find parents linked to this student
            parents = await self.db.users.find({"role": "parent", "children_ids": str(student_id)}).to_list(None)
            return [str(parent["_id"]) for parent in parents]
        except Exception as e:
            logger.error(f"Failed to get parent contacts: {str(e)}")
            return []
    
    async def _get_attendance_settings(self, branch_id: str) -> Optional[Dict[str, Any]]:
        """Get attendance settings for branch"""
        try:
            settings = await self.db.attendance_settings.find_one({"branch_id": branch_id})
            return settings
        except Exception as e:
            logger.error(f"Failed to get attendance settings: {str(e)}")
            return None
    
    async def _send_notification(self, notification_id: str) -> bool:
        """Send a notification (placeholder for actual implementation)"""
        try:
            # This would integrate with your actual notification service
            # For now, just mark as sent
            await self.db.attendance_notifications.update_one(
                {"_id": notification_id},
                {"$set": {"status": "sent", "sent_time": datetime.now()}}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send notification: {str(e)}")
            return False
    
    def _generate_absence_message(self, student_info: Dict[str, Any], attendance_data: Dict[str, Any]) -> str:
        """Generate absence notification message"""
        student_name = student_info.get('full_name', 'Student')
        attendance_date = attendance_data.get('attendance_date')
        date_str = attendance_date.strftime('%Y-%m-%d') if attendance_date else 'today'
        
        return f"Attendance Alert: {student_name} was marked absent on {date_str}. If this is an error or if there are extenuating circumstances, please contact the school immediately."
    
    def _generate_late_message(self, student_info: Dict[str, Any], attendance_data: Dict[str, Any]) -> str:
        """Generate late arrival notification message"""
        student_name = student_info.get('full_name', 'Student')
        check_in_time = attendance_data.get('check_in_time')
        time_str = check_in_time.strftime('%H:%M') if check_in_time else 'late'
        
        return f"Late Arrival: {student_name} arrived at school at {time_str} today. Please ensure punctual arrival to avoid missing important class activities."
    
    def _generate_early_departure_message(self, student_info: Dict[str, Any], attendance_data: Dict[str, Any]) -> str:
        """Generate early departure notification message"""
        student_name = student_info.get('full_name', 'Student')
        check_out_time = attendance_data.get('check_out_time')
        time_str = check_out_time.strftime('%H:%M') if check_out_time else 'early'
        
        return f"Early Departure: {student_name} left school at {time_str} today. This has been recorded in their attendance record."
    
    def _generate_pattern_alert_message(self, pattern_type: str, pattern_data: Dict[str, Any]) -> str:
        """Generate pattern alert message"""
        if pattern_type == "consecutive_absence":
            days = pattern_data.get('consecutive_days', 0)
            return f"Attendance Concern: Student has been absent for {days} consecutive days. Please contact the school to discuss this pattern."
        elif pattern_type == "low_attendance":
            percentage = pattern_data.get('percentage', 0)
            return f"Attendance Warning: Student's attendance rate is {percentage:.1f}% over the last 30 days, which is below the required minimum."
        elif pattern_type == "frequent_lateness":
            late_percentage = pattern_data.get('late_percentage', 0)
            return f"Punctuality Concern: Student has been late {late_percentage:.1f}% of the time recently. Please help ensure timely arrival."
        else:
            return f"Attendance Pattern Alert: Please review student's recent attendance pattern."

# Global instance
attendance_notification_service = AttendanceNotificationService()