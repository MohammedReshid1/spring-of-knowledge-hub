"""
Grade Notification Service
Handles automated notifications for grade updates, report card publishing, and academic alerts.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from bson import ObjectId
import asyncio
from enum import Enum
from jinja2 import Environment, BaseLoader

from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity

logger = logging.getLogger(__name__)

class NotificationType(str, Enum):
    GRADE_UPDATED = "grade_updated"
    REPORT_CARD_PUBLISHED = "report_card_published"
    LOW_GRADE_ALERT = "low_grade_alert"
    MISSING_EXAM_ALERT = "missing_exam_alert"
    IMPROVEMENT_NEEDED = "improvement_needed"
    ACADEMIC_ACHIEVEMENT = "academic_achievement"
    GRADE_SUMMARY = "grade_summary"

class NotificationChannel(str, Enum):
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WEBSOCKET = "websocket"
    IN_APP = "in_app"

class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"

class GradeNotificationService:
    """Service for automated grade-related notifications."""
    
    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.jinja_env = Environment(loader=BaseLoader())
    
    async def notify_grade_updated(
        self,
        student_id: str,
        exam_id: str,
        old_marks: Optional[float],
        new_marks: float,
        exam_data: Dict[str, Any],
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        updated_by: str,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send notifications when a student's grade is updated."""
        try:
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Calculate percentage and grade change
            total_marks = exam_data.get("total_marks", 100)
            old_percentage = (old_marks / total_marks * 100) if old_marks and total_marks > 0 else 0
            new_percentage = (new_marks / total_marks * 100) if total_marks > 0 else 0
            percentage_change = new_percentage - old_percentage
            
            # Determine notification priority
            priority = NotificationPriority.NORMAL
            if new_percentage < 50:
                priority = NotificationPriority.HIGH
            elif percentage_change > 10:
                priority = NotificationPriority.HIGH
            
            # Find parents/guardians
            recipients = await self._get_notification_recipients(
                student_id,
                student,
                parents_collection,
                include_student=True
            )
            
            if not recipients:
                return {"success": False, "message": "No recipients found"}
            
            # Create notification content
            notification_data = {
                "type": NotificationType.GRADE_UPDATED,
                "student_id": student_id,
                "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "title": f"Grade Updated - {exam_data.get('name', 'Exam')}",
                "content": {
                    "exam_name": exam_data.get("name"),
                    "subject_id": exam_data.get("subject_id"),
                    "exam_type": exam_data.get("exam_type"),
                    "exam_date": exam_data.get("exam_date").isoformat() if exam_data.get("exam_date") else None,
                    "old_marks": old_marks,
                    "new_marks": new_marks,
                    "total_marks": total_marks,
                    "old_percentage": round(old_percentage, 2) if old_marks else None,
                    "new_percentage": round(new_percentage, 2),
                    "percentage_change": round(percentage_change, 2),
                    "grade": exam_data.get("grade"),
                    "status": "pass" if new_marks >= exam_data.get("passing_marks", 0) else "fail"
                },
                "priority": priority,
                "created_at": datetime.utcnow(),
                "created_by": updated_by,
                "branch_id": branch_id,
                "channels": [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP, NotificationChannel.EMAIL]
            }
            
            # Send notifications to all recipients
            notifications_sent = []
            for recipient in recipients:
                notification_id = await self._send_notification(
                    recipient,
                    notification_data,
                    notifications_collection,
                    websocket_manager
                )
                notifications_sent.append(notification_id)
            
            # Log audit
            await self.audit_logger.log_user_action(
                user_id=updated_by,
                action=AuditAction.CREATE,
                resource_type="grade_notification",
                resource_id=exam_id,
                details={
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "old_marks": old_marks,
                    "new_marks": new_marks,
                    "percentage_change": percentage_change,
                    "recipients_count": len(recipients),
                    "priority": priority.value
                },
                severity=AuditSeverity.INFO
            )
            
            return {
                "success": True,
                "message": "Grade update notifications sent successfully",
                "recipients_notified": len(recipients),
                "notifications_sent": notifications_sent,
                "priority": priority.value,
                "percentage_change": round(percentage_change, 2)
            }
            
        except Exception as e:
            logger.error(f"Error sending grade update notification: {e}")
            await self.audit_logger.log_system_event(
                event_type="grade_notification_failed",
                component="grade_notification_service",
                details={
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "error": str(e)
                },
                severity=AuditSeverity.ERROR
            )
            raise
    
    async def notify_report_card_published(
        self,
        report_card_id: str,
        report_card_data: Dict[str, Any],
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        published_by: str
    ) -> Dict[str, Any]:
        """Send notifications when a report card is published."""
        try:
            student_id = report_card_data["student_id"]
            
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Find parents/guardians
            recipients = await self._get_notification_recipients(
                student_id,
                student,
                parents_collection,
                include_student=True
            )
            
            # Create notification content
            overall_gpa = report_card_data["grades"]["overall_gpa"]
            overall_percentage = report_card_data["grades"]["overall_percentage"]
            
            # Determine priority based on performance
            priority = NotificationPriority.NORMAL
            if overall_percentage >= 90:
                priority = NotificationPriority.HIGH  # Achievement notification
            elif overall_percentage < 60:
                priority = NotificationPriority.HIGH  # Needs attention
            
            notification_data = {
                "type": NotificationType.REPORT_CARD_PUBLISHED,
                "student_id": student_id,
                "student_name": report_card_data["student_name"],
                "title": f"Report Card Published - {report_card_data['term']} {report_card_data['academic_year']}",
                "content": {
                    "report_card_id": report_card_id,
                    "academic_year": report_card_data["academic_year"],
                    "term": report_card_data["term"],
                    "class_name": report_card_data["class_name"],
                    "section": report_card_data["section"],
                    "overall_gpa": overall_gpa,
                    "overall_percentage": overall_percentage,
                    "overall_grade": report_card_data["grades"]["overall_grade"],
                    "total_subjects": len(report_card_data["grades"]["subjects"]),
                    "pdf_url": report_card_data.get("pdf_url"),
                    "teacher_comments": report_card_data.get("teacher_comments"),
                    "principal_comments": report_card_data.get("principal_comments"),
                    "performance_level": self._get_performance_level(overall_percentage)
                },
                "priority": priority,
                "created_at": datetime.utcnow(),
                "created_by": published_by,
                "branch_id": report_card_data.get("branch_id"),
                "channels": [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH]
            }
            
            # Send notifications
            notifications_sent = []
            for recipient in recipients:
                notification_id = await self._send_notification(
                    recipient,
                    notification_data,
                    notifications_collection,
                    websocket_manager
                )
                notifications_sent.append(notification_id)
            
            return {
                "success": True,
                "message": "Report card notifications sent successfully",
                "recipients_notified": len(recipients),
                "notifications_sent": notifications_sent,
                "overall_gpa": overall_gpa,
                "overall_percentage": overall_percentage
            }
            
        except Exception as e:
            logger.error(f"Error sending report card notification: {e}")
            raise
    
    async def send_low_grade_alert(
        self,
        student_id: str,
        exam_data: Dict[str, Any],
        grade_data: Dict[str, Any],
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        threshold_percentage: float = 60.0,
        triggered_by: str = "system"
    ) -> Dict[str, Any]:
        """Send alert for low grades."""
        try:
            percentage = grade_data.get("percentage", 0)
            
            # Only send alert if below threshold
            if percentage >= threshold_percentage:
                return {"success": False, "message": "Grade above alert threshold"}
            
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Find recipients (parents only for alerts)
            recipients = await self._get_notification_recipients(
                student_id,
                student,
                parents_collection,
                include_student=False  # Don't notify student of their own low grades
            )
            
            notification_data = {
                "type": NotificationType.LOW_GRADE_ALERT,
                "student_id": student_id,
                "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "title": f"Low Grade Alert - {exam_data.get('name', 'Exam')}",
                "content": {
                    "exam_name": exam_data.get("name"),
                    "subject_id": exam_data.get("subject_id"),
                    "exam_type": exam_data.get("exam_type"),
                    "marks_obtained": grade_data.get("marks_obtained"),
                    "total_marks": exam_data.get("total_marks"),
                    "percentage": percentage,
                    "threshold_percentage": threshold_percentage,
                    "grade": grade_data.get("grade"),
                    "recommendations": [
                        "Schedule a parent-teacher conference",
                        "Consider additional tutoring support",
                        "Review study habits and schedule",
                        "Monitor homework completion"
                    ],
                    "next_exam_date": self._get_next_exam_date(exam_data),
                    "improvement_areas": self._identify_improvement_areas(percentage)
                },
                "priority": NotificationPriority.HIGH,
                "created_at": datetime.utcnow(),
                "created_by": triggered_by,
                "branch_id": exam_data.get("branch_id"),
                "channels": [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS]
            }
            
            # Send alert notifications
            notifications_sent = []
            for recipient in recipients:
                notification_id = await self._send_notification(
                    recipient,
                    notification_data,
                    notifications_collection,
                    websocket_manager
                )
                notifications_sent.append(notification_id)
            
            return {
                "success": True,
                "message": "Low grade alerts sent successfully",
                "recipients_notified": len(recipients),
                "notifications_sent": notifications_sent,
                "alert_percentage": percentage,
                "threshold": threshold_percentage
            }
            
        except Exception as e:
            logger.error(f"Error sending low grade alert: {e}")
            raise
    
    async def send_missing_exam_alert(
        self,
        student_id: str,
        exam_data: Dict[str, Any],
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        triggered_by: str = "system"
    ) -> Dict[str, Any]:
        """Send alert for missing/absent exams."""
        try:
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Find recipients
            recipients = await self._get_notification_recipients(
                student_id,
                student,
                parents_collection,
                include_student=False
            )
            
            notification_data = {
                "type": NotificationType.MISSING_EXAM_ALERT,
                "student_id": student_id,
                "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "title": f"Missing Exam Alert - {exam_data.get('name', 'Exam')}",
                "content": {
                    "exam_name": exam_data.get("name"),
                    "subject_id": exam_data.get("subject_id"),
                    "exam_type": exam_data.get("exam_type"),
                    "exam_date": exam_data.get("exam_date").isoformat() if exam_data.get("exam_date") else None,
                    "total_marks": exam_data.get("total_marks"),
                    "reason": "Student was absent or did not submit the exam",
                    "actions_needed": [
                        "Contact the school immediately",
                        "Check for valid absence reason",
                        "Inquire about makeup exam opportunities",
                        "Provide medical certificate if applicable"
                    ],
                    "contact_info": {
                        "class_teacher": "Contact class teacher",
                        "subject_teacher": "Contact subject teacher",
                        "office_hours": "8:00 AM - 3:00 PM"
                    },
                    "makeup_exam_policy": "Makeup exams may be available for valid absences with proper documentation"
                },
                "priority": NotificationPriority.URGENT,
                "created_at": datetime.utcnow(),
                "created_by": triggered_by,
                "branch_id": exam_data.get("branch_id"),
                "channels": [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS, NotificationChannel.PUSH]
            }
            
            # Send notifications
            notifications_sent = []
            for recipient in recipients:
                notification_id = await self._send_notification(
                    recipient,
                    notification_data,
                    notifications_collection,
                    websocket_manager
                )
                notifications_sent.append(notification_id)
            
            return {
                "success": True,
                "message": "Missing exam alerts sent successfully",
                "recipients_notified": len(recipients),
                "notifications_sent": notifications_sent
            }
            
        except Exception as e:
            logger.error(f"Error sending missing exam alert: {e}")
            raise
    
    async def send_academic_achievement_notification(
        self,
        student_id: str,
        achievement_data: Dict[str, Any],
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        triggered_by: str = "system"
    ) -> Dict[str, Any]:
        """Send notification for academic achievements."""
        try:
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Find recipients (include student for positive achievements)
            recipients = await self._get_notification_recipients(
                student_id,
                student,
                parents_collection,
                include_student=True
            )
            
            notification_data = {
                "type": NotificationType.ACADEMIC_ACHIEVEMENT,
                "student_id": student_id,
                "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "title": f"Academic Achievement - {achievement_data.get('title', 'Excellence')}",
                "content": {
                    "achievement_type": achievement_data.get("type", "excellence"),
                    "description": achievement_data.get("description", "Outstanding academic performance"),
                    "exam_name": achievement_data.get("exam_name"),
                    "subject": achievement_data.get("subject"),
                    "percentage": achievement_data.get("percentage"),
                    "grade": achievement_data.get("grade"),
                    "rank": achievement_data.get("rank"),
                    "total_students": achievement_data.get("total_students"),
                    "academic_year": achievement_data.get("academic_year"),
                    "term": achievement_data.get("term"),
                    "recognition": achievement_data.get("recognition", "Keep up the excellent work!"),
                    "celebration_message": self._get_celebration_message(achievement_data.get("type", "excellence"))
                },
                "priority": NotificationPriority.HIGH,
                "created_at": datetime.utcnow(),
                "created_by": triggered_by,
                "branch_id": achievement_data.get("branch_id"),
                "channels": [NotificationChannel.WEBSOCKET, NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.PUSH]
            }
            
            # Send notifications
            notifications_sent = []
            for recipient in recipients:
                notification_id = await self._send_notification(
                    recipient,
                    notification_data,
                    notifications_collection,
                    websocket_manager
                )
                notifications_sent.append(notification_id)
            
            return {
                "success": True,
                "message": "Achievement notifications sent successfully",
                "recipients_notified": len(recipients),
                "notifications_sent": notifications_sent,
                "achievement_type": achievement_data.get("type")
            }
            
        except Exception as e:
            logger.error(f"Error sending achievement notification: {e}")
            raise
    
    async def process_automated_grade_notifications(
        self,
        exam_results_collection: Any,
        exams_collection: Any,
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        branch_id: Optional[str] = None,
        hours_since_last_check: int = 24
    ) -> Dict[str, Any]:
        """Process automated notifications based on recent grade updates."""
        try:
            # Get recent exam results (last 24 hours by default)
            since_time = datetime.utcnow() - timedelta(hours=hours_since_last_check)
            
            recent_results = []
            async for result in exam_results_collection.find({
                "updated_at": {"$gte": since_time},
                **({"branch_id": branch_id} if branch_id else {})
            }):
                recent_results.append(result)
            
            if not recent_results:
                return {
                    "success": True,
                    "message": "No recent grade updates found",
                    "processed": 0
                }
            
            # Process each result
            notifications_sent = 0
            alerts_sent = 0
            achievements_sent = 0
            
            for result in recent_results:
                try:
                    # Get exam data
                    exam = await exams_collection.find_one({"_id": ObjectId(result["exam_id"])})
                    if not exam:
                        continue
                    
                    student_id = result["student_id"]
                    percentage = result.get("percentage", 0)
                    
                    # Check for low grade alert
                    if percentage < 60 and result.get("attendance_status") == "present":
                        await self.send_low_grade_alert(
                            student_id,
                            exam,
                            result,
                            students_collection,
                            parents_collection,
                            notifications_collection,
                            websocket_manager,
                            60.0,
                            "automated_system"
                        )
                        alerts_sent += 1
                    
                    # Check for achievement (high grade)
                    elif percentage >= 95:
                        achievement_data = {
                            "type": "high_score",
                            "title": "Outstanding Performance",
                            "description": f"Scored {percentage}% in {exam['name']}",
                            "exam_name": exam["name"],
                            "subject": exam.get("subject_id"),
                            "percentage": percentage,
                            "grade": result.get("grade"),
                            "academic_year": exam["academic_year"],
                            "term": exam["term"],
                            "branch_id": exam.get("branch_id")
                        }
                        
                        await self.send_academic_achievement_notification(
                            student_id,
                            achievement_data,
                            students_collection,
                            parents_collection,
                            notifications_collection,
                            websocket_manager,
                            "automated_system"
                        )
                        achievements_sent += 1
                    
                    # Check for missing exam
                    elif result.get("attendance_status") == "absent":
                        await self.send_missing_exam_alert(
                            student_id,
                            exam,
                            students_collection,
                            parents_collection,
                            notifications_collection,
                            websocket_manager,
                            "automated_system"
                        )
                        alerts_sent += 1
                    
                    notifications_sent += 1
                    
                except Exception as e:
                    logger.error(f"Error processing automated notification for result {result.get('_id')}: {e}")
                    continue
            
            return {
                "success": True,
                "message": "Automated grade notifications processed successfully",
                "processed": len(recent_results),
                "notifications_sent": notifications_sent,
                "alerts_sent": alerts_sent,
                "achievements_sent": achievements_sent,
                "hours_checked": hours_since_last_check
            }
            
        except Exception as e:
            logger.error(f"Error processing automated grade notifications: {e}")
            raise
    
    async def _get_notification_recipients(
        self,
        student_id: str,
        student_data: Dict[str, Any],
        parents_collection: Any,
        include_student: bool = True
    ) -> List[Dict[str, Any]]:
        """Get list of notification recipients for a student."""
        recipients = []
        
        # Add student if requested
        if include_student and student_data.get("user_id"):
            recipients.append({
                "type": "student",
                "user_id": student_data["user_id"],
                "name": f"{student_data['first_name']} {student_data.get('last_name', '')}".strip(),
                "email": student_data.get("email"),
                "phone": student_data.get("phone")
            })
        
        # Find parents
        parent_filter = {
            "$or": [
                {"student_ids": {"$in": [student_id]}},
                {"_id": ObjectId(student_data.get("parent_guardian_id", "000000000000000000000000"))}
            ]
        }
        
        async for parent in parents_collection.find(parent_filter):
            recipients.append({
                "type": "parent",
                "user_id": parent.get("user_id"),
                "parent_id": str(parent["_id"]),
                "name": parent.get("name", "Parent"),
                "email": parent.get("email"),
                "phone": parent.get("phone")
            })
        
        return recipients
    
    async def _send_notification(
        self,
        recipient: Dict[str, Any],
        notification_data: Dict[str, Any],
        notifications_collection: Any,
        websocket_manager: WebSocketManager
    ) -> str:
        """Send notification to a specific recipient."""
        try:
            # Create notification record
            notification_record = {
                **notification_data,
                "recipient": recipient,
                "read": False,
                "read_at": None,
                "delivery_status": {
                    "websocket": "pending",
                    "email": "pending",
                    "sms": "pending",
                    "push": "pending"
                }
            }
            
            # Save to database
            result = await notifications_collection.insert_one(notification_record)
            notification_id = str(result.inserted_id)
            
            # Send via WebSocket if recipient has user_id
            if recipient.get("user_id") and NotificationChannel.WEBSOCKET in notification_data.get("channels", []):
                try:
                    await websocket_manager.send_to_user(
                        recipient["user_id"],
                        {
                            "type": "notification",
                            "notification_type": notification_data["type"],
                            "data": {
                                "notification_id": notification_id,
                                "title": notification_data["title"],
                                "content": notification_data["content"],
                                "priority": notification_data["priority"],
                                "created_at": notification_data["created_at"].isoformat(),
                                "student_name": notification_data.get("student_name")
                            }
                        }
                    )
                    
                    # Update delivery status
                    await notifications_collection.update_one(
                        {"_id": result.inserted_id},
                        {"$set": {"delivery_status.websocket": "delivered"}}
                    )
                    
                except Exception as e:
                    logger.error(f"Failed to send WebSocket notification: {e}")
                    await notifications_collection.update_one(
                        {"_id": result.inserted_id},
                        {"$set": {"delivery_status.websocket": "failed"}}
                    )
            
            # TODO: Implement email, SMS, and push notification delivery
            
            return notification_id
            
        except Exception as e:
            logger.error(f"Error sending notification: {e}")
            raise
    
    def _get_performance_level(self, percentage: float) -> str:
        """Get performance level description from percentage."""
        if percentage >= 95:
            return "Outstanding"
        elif percentage >= 85:
            return "Excellent"
        elif percentage >= 75:
            return "Very Good"
        elif percentage >= 65:
            return "Good"
        elif percentage >= 50:
            return "Satisfactory"
        else:
            return "Needs Improvement"
    
    def _get_next_exam_date(self, exam_data: Dict[str, Any]) -> Optional[str]:
        """Get next exam date for the same subject (placeholder)."""
        # This would query for upcoming exams in the same subject
        return None
    
    def _identify_improvement_areas(self, percentage: float) -> List[str]:
        """Identify areas for improvement based on performance."""
        if percentage < 40:
            return ["Fundamental concepts", "Basic problem solving", "Regular study habits"]
        elif percentage < 60:
            return ["Problem solving techniques", "Regular practice", "Time management"]
        elif percentage < 75:
            return ["Advanced concepts", "Application skills"]
        else:
            return ["Maintaining current performance"]
    
    def _get_celebration_message(self, achievement_type: str) -> str:
        """Get celebration message for achievement type."""
        messages = {
            "high_score": "Congratulations on your outstanding performance! Keep up the excellent work!",
            "improvement": "Great job on improving your grades! Your hard work is paying off!",
            "consistency": "Excellent consistent performance! You're setting a great example!",
            "excellence": "Outstanding academic achievement! We're proud of your dedication!"
        }
        return messages.get(achievement_type, "Congratulations on your academic achievement!")