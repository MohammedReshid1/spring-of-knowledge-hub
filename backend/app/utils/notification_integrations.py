"""
Notification Integration Helpers
Provides easy integration points for all modules to send notifications
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta

from .notification_engine import notification_engine
from ..models.notifications import NotificationType, NotificationPriority, NotificationChannel, RecipientType

logger = logging.getLogger(__name__)

class NotificationIntegration:
    """Helper class for module notification integrations"""
    
    @staticmethod
    async def notify_grade_published(
        student_id: str,
        student_name: str,
        subject_name: str,
        grade: str,
        total_marks: str,
        teacher_comments: str = "",
        exam_name: str = "",
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify when new grade is published"""
        
        # Get student's parents
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="GRADE_PUBLISHED",
            recipients=recipients,
            variables={
                "student_name": student_name,
                "subject_name": subject_name,
                "grade": grade,
                "total_marks": total_marks,
                "teacher_comments": teacher_comments,
                "exam_name": exam_name
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_report_card_ready(
        student_id: str,
        student_name: str,
        term_name: str,
        overall_grade: str,
        download_url: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify when report card is ready"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="REPORT_CARD_READY",
            recipients=recipients,
            variables={
                "student_name": student_name,
                "term_name": term_name,
                "overall_grade": overall_grade,
                "download_url": download_url
            },
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
            action_url=download_url,
            action_text="Download Report",
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_student_absent(
        student_id: str,
        student_name: str,
        date: str,
        class_name: str,
        period: str = None,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify parents when student is absent"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        
        return await notification_engine.send_notification(
            template_code="ATTENDANCE_ALERT_ABSENT",
            recipients=parent_ids,
            variables={
                "student_name": student_name,
                "date": date,
                "class_name": class_name,
                "period": period or "Full Day"
            },
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_low_attendance(
        student_id: str,
        student_name: str,
        attendance_percentage: float,
        minimum_required: float,
        absent_days: int,
        total_days: int,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify when attendance falls below threshold"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="ATTENDANCE_LOW_WARNING",
            recipients=recipients,
            variables={
                "student_name": student_name,
                "attendance_percentage": f"{attendance_percentage:.1f}",
                "minimum_required": f"{minimum_required:.0f}",
                "absent_days": str(absent_days),
                "total_days": str(total_days)
            },
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_fee_due(
        student_id: str,
        student_name: str,
        fee_type: str,
        amount: float,
        due_date: str,
        payment_url: str = None,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about upcoming fee payment"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        
        return await notification_engine.send_notification(
            template_code="FEE_DUE_REMINDER",
            recipients=parent_ids,
            variables={
                "student_name": student_name,
                "fee_type": fee_type,
                "amount": f"{amount:.2f}",
                "due_date": due_date,
                "payment_url": payment_url or ""
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            action_url=payment_url,
            action_text="Pay Now",
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_payment_overdue(
        student_id: str,
        student_name: str,
        fee_type: str,
        amount: float,
        due_date: str,
        late_fee: float,
        days_overdue: int,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about overdue payment"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        
        return await notification_engine.send_notification(
            template_code="PAYMENT_OVERDUE",
            recipients=parent_ids,
            variables={
                "student_name": student_name,
                "fee_type": fee_type,
                "amount": f"{amount:.2f}",
                "due_date": due_date,
                "late_fee": f"{late_fee:.2f}",
                "days_overdue": str(days_overdue)
            },
            priority=NotificationPriority.URGENT,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_payment_received(
        student_id: str,
        student_name: str,
        fee_type: str,
        amount: float,
        receipt_number: str,
        payment_date: str,
        payment_method: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about successful payment"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="PAYMENT_CONFIRMATION",
            recipients=recipients,
            variables={
                "student_name": student_name,
                "fee_type": fee_type,
                "amount": f"{amount:.2f}",
                "receipt_number": receipt_number,
                "payment_date": payment_date,
                "payment_method": payment_method
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_exam_schedule_released(
        class_id: str,
        grade_level: str,
        exam_type: str,
        first_exam_subject: str,
        first_exam_date: str,
        schedule_url: str = None,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about exam schedule release"""
        
        # Get all students in the class
        student_ids = await NotificationIntegration._get_class_students(class_id)
        
        # Get parents of all students
        all_recipients = []
        for student_id in student_ids:
            parent_ids = await NotificationIntegration._get_student_parents(student_id)
            all_recipients.extend([student_id] + parent_ids)
        
        # Remove duplicates
        recipients = list(set(all_recipients))
        
        return await notification_engine.send_notification(
            template_code="EXAM_SCHEDULE_RELEASED",
            recipients=recipients,
            variables={
                "exam_type": exam_type,
                "grade_level": grade_level,
                "student_name": "{{student_name}}",  # Will be personalized per recipient
                "first_exam_subject": first_exam_subject,
                "first_exam_date": first_exam_date,
                "schedule_url": schedule_url or ""
            },
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            action_url=schedule_url,
            action_text="View Schedule",
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_exam_reminder(
        student_id: str,
        student_name: str,
        subject_name: str,
        exam_date: str,
        exam_time: str,
        duration: int,
        exam_room: str = None,
        instructions: str = None,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Send 24-hour exam reminder"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="EXAM_REMINDER_24H",
            recipients=recipients,
            variables={
                "student_name": student_name,
                "subject_name": subject_name,
                "exam_date": exam_date,
                "exam_time": exam_time,
                "duration": str(duration),
                "exam_room": exam_room or "TBA",
                "instructions": instructions or ""
            },
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_assignment_due(
        student_id: str,
        student_name: str,
        subject_name: str,
        assignment_title: str,
        due_date: str,
        remaining_days: int,
        teacher_name: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about upcoming assignment deadline"""
        
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="ASSIGNMENT_DUE_REMINDER",
            recipients=recipients,
            variables={
                "student_name": student_name,
                "subject_name": subject_name,
                "assignment_title": assignment_title,
                "due_date": due_date,
                "remaining_days": str(remaining_days),
                "teacher_name": teacher_name
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_timetable_updated(
        class_id: str,
        class_name: str,
        effective_date: str,
        changed_subjects: List[str],
        grade_level: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about timetable changes"""
        
        # Get all students in the class and their parents
        student_ids = await NotificationIntegration._get_class_students(class_id)
        all_recipients = []
        
        for student_id in student_ids:
            parent_ids = await NotificationIntegration._get_student_parents(student_id)
            all_recipients.extend([student_id] + parent_ids)
        
        recipients = list(set(all_recipients))
        
        return await notification_engine.send_notification(
            template_code="TIMETABLE_UPDATED",
            recipients=recipients,
            variables={
                "class_name": class_name,
                "effective_date": effective_date,
                "changed_subjects": ", ".join(changed_subjects),
                "grade_level": grade_level
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_class_cancelled(
        class_id: str,
        subject_name: str,
        class_name: str,
        date: str,
        time: str,
        reason: str,
        teacher_name: str,
        makeup_date: str = None,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify about class cancellation"""
        
        student_ids = await NotificationIntegration._get_class_students(class_id)
        all_recipients = []
        
        for student_id in student_ids:
            parent_ids = await NotificationIntegration._get_student_parents(student_id)
            all_recipients.extend([student_id] + parent_ids)
        
        recipients = list(set(all_recipients))
        
        return await notification_engine.send_notification(
            template_code="CLASS_CANCELLED",
            recipients=recipients,
            variables={
                "subject_name": subject_name,
                "class_name": class_name,
                "date": date,
                "time": time,
                "reason": reason,
                "teacher_name": teacher_name,
                "makeup_date": makeup_date or "TBA"
            },
            priority=NotificationPriority.HIGH,
            channels=[NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_emergency(
        alert_title: str,
        alert_message: str,
        emergency_contact: str,
        location: str = None,
        instructions: str = None,
        target_audience: RecipientType = RecipientType.ALL_USERS,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Send emergency notification"""
        
        return await notification_engine.send_notification(
            template_code="EMERGENCY_ALERT",
            recipients=target_audience,
            variables={
                "alert_title": alert_title,
                "alert_message": alert_message,
                "emergency_contact": emergency_contact,
                "location": location or "",
                "instructions": instructions or ""
            },
            priority=NotificationPriority.URGENT,
            channels=[
                NotificationChannel.IN_APP, 
                NotificationChannel.SMS, 
                NotificationChannel.EMAIL, 
                NotificationChannel.PUSH
            ],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_welcome_user(
        user_id: str,
        user_name: str,
        school_name: str,
        role: str,
        login_url: str,
        support_contact: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Welcome new user"""
        
        return await notification_engine.send_notification(
            template_code="WELCOME_NEW_USER",
            recipients=[user_id],
            variables={
                "user_name": user_name,
                "school_name": school_name,
                "role": role.title(),
                "login_url": login_url,
                "support_contact": support_contact
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            action_url=login_url,
            action_text="Login Now",
            branch_id=branch_id
        )
    
    # Helper methods
    @staticmethod
    async def _get_student_parents(student_id: str) -> List[str]:
        """Get parent IDs for a student"""
        try:
            from ..db import get_db
            from bson import ObjectId
            db = get_db()
            
            # Find student to get parent IDs
            student = await db.students.find_one({"_id": ObjectId(student_id)})
            if not student:
                return []
            
            parent_ids = []
            
            # Get primary parent
            if student.get("primary_parent_id"):
                parent_ids.append(str(student["primary_parent_id"]))
            
            # Get secondary parent
            if student.get("secondary_parent_id"):
                parent_ids.append(str(student["secondary_parent_id"]))
            
            return parent_ids
            
        except Exception as e:
            logger.error(f"Error getting student parents: {str(e)}")
            return []
    
    @staticmethod
    async def _get_class_students(class_id: str) -> List[str]:
        """Get all student IDs in a class"""
        try:
            from ..db import get_db
            from bson import ObjectId
            db = get_db()
            
            students_cursor = db.students.find({"current_class_id": class_id})
            student_ids = []
            
            async for student in students_cursor:
                student_ids.append(str(student["_id"]))
            
            return student_ids
            
        except Exception as e:
            logger.error(f"Error getting class students: {str(e)}")
            return []
    
    # Assignment notification helpers
    @staticmethod
    async def notify_assignment_created(
        assignment_id: str,
        assignment_title: str,
        subject_name: str,
        class_name: str,
        due_date: str,
        teacher_name: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify when new assignment is created"""
        
        # Get all students in the class
        from ..db import get_db
        from bson import ObjectId
        db = get_db()
        
        try:
            # Get assignment document to find class
            assignment = await db.assignments.find_one({"assignment_id": assignment_id})
            if not assignment:
                return {"success": False, "message": "Assignment not found"}
            
            class_id = assignment["class_id"]
            student_ids = await NotificationIntegration._get_class_students(class_id)
            
            # Get parents of all students
            all_recipients = []
            for student_id in student_ids:
                parent_ids = await NotificationIntegration._get_student_parents(student_id)
                all_recipients.extend([student_id] + parent_ids)
            
            # Remove duplicates
            recipients = list(set(all_recipients))
            
            return await notification_engine.send_notification(
                template_code="ASSIGNMENT_DUE_REMINDER",
                recipients=recipients,
                variables={
                    "assignment_title": assignment_title,
                    "subject_name": subject_name,
                    "class_name": class_name,
                    "due_date": due_date,
                    "teacher_name": teacher_name,
                    "student_name": "{{student_name}}"  # Will be personalized per recipient
                },
                priority=NotificationPriority.MEDIUM,
                channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                branch_id=branch_id
            )
            
        except Exception as e:
            logger.error(f"Error sending assignment creation notification: {str(e)}")
            return {"success": False, "message": str(e)}
    
    @staticmethod
    async def notify_assignment_submitted(
        assignment_id: str,
        assignment_title: str,
        student_id: str,
        student_name: str,
        subject_name: str,
        submission_date: str,
        is_late: bool,
        teacher_name: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify when assignment is submitted"""
        
        # Get student's parents
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        
        # Send to parents and teacher
        from ..db import get_db
        db = get_db()
        
        try:
            # Get teacher ID from assignment
            assignment = await db.assignments.find_one({"assignment_id": assignment_id})
            if not assignment:
                return {"success": False, "message": "Assignment not found"}
            
            teacher_id = assignment["teacher_id"]
            recipients = parent_ids + [teacher_id]
            
            return await notification_engine.send_notification(
                template_code="ASSIGNMENT_SUBMITTED",
                recipients=recipients,
                variables={
                    "assignment_title": assignment_title,
                    "student_name": student_name,
                    "subject_name": subject_name,
                    "submission_date": submission_date,
                    "teacher_name": teacher_name,
                    "is_late": "late" if is_late else "on time"
                },
                priority=NotificationPriority.LOW,
                channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                branch_id=branch_id
            )
            
        except Exception as e:
            logger.error(f"Error sending assignment submission notification: {str(e)}")
            return {"success": False, "message": str(e)}
    
    @staticmethod
    async def notify_assignment_graded(
        assignment_id: str,
        assignment_title: str,
        student_id: str,
        student_name: str,
        subject_name: str,
        marks_obtained: float,
        total_marks: float,
        grade: str,
        feedback: str,
        teacher_name: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Notify when assignment is graded"""
        
        # Get student's parents
        parent_ids = await NotificationIntegration._get_student_parents(student_id)
        recipients = [student_id] + parent_ids
        
        return await notification_engine.send_notification(
            template_code="GRADE_PUBLISHED",  # Reuse existing template
            recipients=recipients,
            variables={
                "student_name": student_name,
                "subject_name": subject_name,
                "grade": f"{marks_obtained}/{total_marks}" if total_marks else grade,
                "total_marks": str(total_marks) if total_marks else "N/A",
                "teacher_comments": feedback or "No feedback provided",
                "exam_name": assignment_title
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            branch_id=branch_id
        )
    
    @staticmethod
    async def notify_assignment_due_reminder(
        assignment_id: str,
        assignment_title: str,
        subject_name: str,
        due_date: str,
        remaining_days: int,
        teacher_name: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Send assignment due date reminder"""
        
        from ..db import get_db
        from bson import ObjectId
        db = get_db()
        
        try:
            # Get assignment and find students who haven't submitted
            assignment = await db.assignments.find_one({"assignment_id": assignment_id})
            if not assignment:
                return {"success": False, "message": "Assignment not found"}
            
            # Get pending submissions
            pending_submissions = db.assignment_submissions.find({
                "assignment_id": assignment_id,
                "is_submitted": False,
                "branch_id": branch_id
            })
            
            student_ids = []
            parent_ids = []
            
            async for submission in pending_submissions:
                student_id = submission["student_id"]
                student_ids.append(student_id)
                
                # Get parents
                student_parents = await NotificationIntegration._get_student_parents(student_id)
                parent_ids.extend(student_parents)
            
            recipients = student_ids + list(set(parent_ids))
            
            if not recipients:
                return {"success": True, "message": "No pending submissions found"}
            
            return await notification_engine.send_notification(
                template_code="ASSIGNMENT_DUE_REMINDER",
                recipients=recipients,
                variables={
                    "assignment_title": assignment_title,
                    "subject_name": subject_name,
                    "due_date": due_date,
                    "remaining_days": str(remaining_days),
                    "teacher_name": teacher_name,
                    "student_name": "{{student_name}}"  # Will be personalized
                },
                priority=NotificationPriority.HIGH if remaining_days <= 1 else NotificationPriority.MEDIUM,
                channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
                branch_id=branch_id
            )
            
        except Exception as e:
            logger.error(f"Error sending assignment reminder: {str(e)}")
            return {"success": False, "message": str(e)}

# Global instance for easy imports
notify = NotificationIntegration()