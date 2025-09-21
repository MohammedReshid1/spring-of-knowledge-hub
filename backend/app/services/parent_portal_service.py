"""
Parent Portal Service for Grade Publishing
Handles publishing grades, report cards, and academic information to parent portals.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, date
from bson import ObjectId
import asyncio

from ..models.exam import ReportCard, ReportCardStatus, StudentTranscript
from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity

logger = logging.getLogger(__name__)

class ParentPortalService:
    """Service for managing parent portal grade and report card publishing."""
    
    def __init__(self):
        self.audit_logger = get_audit_logger()
    
    async def publish_grades_to_parent_portal(
        self,
        student_id: str,
        academic_year: str,
        term: str,
        exam_results_collection: Any,
        exams_collection: Any,
        students_collection: Any,
        parents_collection: Any,
        portal_notifications_collection: Any,
        websocket_manager: WebSocketManager,
        published_by: str,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Publish individual exam grades to parent portal."""
        try:
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Find parent(s) for this student
            parents = []
            if student.get("parent_guardian_id"):
                parent = await parents_collection.find_one({"_id": ObjectId(student["parent_guardian_id"])})
                if parent:
                    parents.append(parent)
            
            # Also check for parents with student_ids array
            async for parent in parents_collection.find({"student_ids": {"$in": [student_id]}}):
                parents.append(parent)
            
            if not parents:
                logger.warning(f"No parents found for student {student_id}")
                return {"success": False, "message": "No parents found for student"}
            
            # Get exam results for the specified term
            exam_results = []
            async for result in exam_results_collection.find({
                "student_id": student_id,
                **({"branch_id": branch_id} if branch_id else {})
            }):
                # Get exam details
                exam = await exams_collection.find_one({"_id": ObjectId(result["exam_id"])})
                if exam and exam.get("academic_year") == academic_year and exam.get("term") == term:
                    result_data = {
                        **result,
                        "exam_name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "exam_type": exam["exam_type"],
                        "exam_date": exam.get("exam_date").isoformat() if exam.get("exam_date") else None,
                        "total_marks": exam["total_marks"],
                        "passing_marks": exam["passing_marks"]
                    }
                    exam_results.append(result_data)
            
            if not exam_results:
                return {"success": False, "message": "No exam results found for specified term"}
            
            # Calculate summary statistics
            total_exams = len(exam_results)
            passed_exams = len([r for r in exam_results if r.get("status") == "pass"])
            total_marks_obtained = sum(r.get("marks_obtained", 0) for r in exam_results if r.get("attendance_status") == "present")
            total_marks_possible = sum(r.get("total_marks", 0) for r in exam_results if r.get("attendance_status") == "present")
            overall_percentage = (total_marks_obtained / total_marks_possible * 100) if total_marks_possible > 0 else 0
            
            # Create portal notification for each parent
            notifications_created = []
            
            for parent in parents:
                portal_data = {
                    "parent_id": str(parent["_id"]),
                    "student_id": student_id,
                    "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                    "notification_type": "grade_results",
                    "title": f"Exam Results - {term} {academic_year}",
                    "content": {
                        "academic_period": {
                            "academic_year": academic_year,
                            "term": term
                        },
                        "summary": {
                            "total_exams": total_exams,
                            "exams_appeared": len([r for r in exam_results if r.get("attendance_status") == "present"]),
                            "exams_passed": passed_exams,
                            "overall_percentage": round(overall_percentage, 2),
                            "grade_level": self._calculate_grade_level(overall_percentage)
                        },
                        "exam_results": exam_results
                    },
                    "published_at": datetime.utcnow(),
                    "published_by": published_by,
                    "is_new": True,
                    "parent_viewed": False,
                    "branch_id": branch_id,
                    "priority": "high" if overall_percentage < 60 else "normal"
                }
                
                # Save notification
                result = await portal_notifications_collection.insert_one(portal_data)
                portal_data["id"] = str(result.inserted_id)
                notifications_created.append(portal_data["id"])
                
                # Update parent's last notification date
                await parents_collection.update_one(
                    {"_id": parent["_id"]},
                    {"$set": {"last_notification_date": datetime.utcnow()}}
                )
                
                # Send real-time notification to parent
                if parent.get("user_id"):
                    await websocket_manager.send_to_user(
                        parent["user_id"],
                        {
                            "type": "new_grades_available",
                            "data": {
                                "student_name": portal_data["student_name"],
                                "academic_year": academic_year,
                                "term": term,
                                "overall_percentage": round(overall_percentage, 2),
                                "total_exams": total_exams,
                                "exams_passed": passed_exams,
                                "notification_id": portal_data["id"],
                                "priority": portal_data["priority"]
                            }
                        }
                    )
            
            # Log audit
            await self.audit_logger.log_user_action(
                user_id=published_by,
                action=AuditAction.CREATE,
                resource_type="parent_portal_grades",
                resource_id=student_id,
                details={
                    "student_id": student_id,
                    "academic_year": academic_year,
                    "term": term,
                    "total_exams": total_exams,
                    "overall_percentage": overall_percentage,
                    "parents_notified": len(parents),
                    "notifications_created": notifications_created
                },
                severity=AuditSeverity.INFO
            )
            
            return {
                "success": True,
                "message": "Grades published to parent portal successfully",
                "parents_notified": len(parents),
                "total_exams": total_exams,
                "overall_percentage": round(overall_percentage, 2),
                "notifications_created": notifications_created
            }
            
        except Exception as e:
            logger.error(f"Error publishing grades to parent portal: {e}")
            await self.audit_logger.log_system_event(
                event_type="parent_portal_grade_publish_failed",
                component="parent_portal_service",
                details={
                    "student_id": student_id,
                    "error": str(e)
                },
                severity=AuditSeverity.ERROR
            )
            raise
    
    async def publish_report_card_to_parent_portal(
        self,
        report_card_id: str,
        report_cards_collection: Any,
        parents_collection: Any,
        portal_notifications_collection: Any,
        websocket_manager: WebSocketManager,
        published_by: str
    ) -> Dict[str, Any]:
        """Publish report card to parent portal."""
        try:
            # Get report card
            report_card = await report_cards_collection.find_one({"_id": ObjectId(report_card_id)})
            if not report_card:
                raise ValueError(f"Report card not found: {report_card_id}")
            
            # Update report card status
            await report_cards_collection.update_one(
                {"_id": ObjectId(report_card_id)},
                {
                    "$set": {
                        "status": ReportCardStatus.SENT_TO_PARENTS,
                        "sent_to_parents_at": datetime.utcnow(),
                        "published_by": published_by
                    }
                }
            )
            
            # Create notifications for parents
            notifications_created = []
            
            for parent_id in report_card.get("parent_ids", []):
                parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
                if parent:
                    portal_data = {
                        "parent_id": parent_id,
                        "student_id": report_card["student_id"],
                        "student_name": report_card["student_name"],
                        "notification_type": "report_card",
                        "title": f"Report Card - {report_card['term']} {report_card['academic_year']}",
                        "content": {
                            "report_card_id": report_card_id,
                            "academic_year": report_card["academic_year"],
                            "term": report_card["term"],
                            "class_name": report_card["class_name"],
                            "section": report_card["section"],
                            "summary": {
                                "overall_gpa": report_card["grades"]["overall_gpa"],
                                "overall_percentage": report_card["grades"]["overall_percentage"],
                                "overall_grade": report_card["grades"]["overall_grade"],
                                "total_subjects": len(report_card["grades"]["subjects"])
                            },
                            "pdf_url": report_card.get("pdf_url"),
                            "teacher_comments": report_card.get("teacher_comments"),
                            "principal_comments": report_card.get("principal_comments")
                        },
                        "published_at": datetime.utcnow(),
                        "published_by": published_by,
                        "is_new": True,
                        "parent_viewed": False,
                        "branch_id": report_card.get("branch_id"),
                        "priority": "high"
                    }
                    
                    # Save notification
                    result = await portal_notifications_collection.insert_one(portal_data)
                    notifications_created.append(str(result.inserted_id))
                    
                    # Send real-time notification
                    if parent.get("user_id"):
                        await websocket_manager.send_to_user(
                            parent["user_id"],
                            {
                                "type": "new_report_card_available",
                                "data": {
                                    "student_name": report_card["student_name"],
                                    "report_card_id": report_card_id,
                                    "academic_year": report_card["academic_year"],
                                    "term": report_card["term"],
                                    "overall_gpa": report_card["grades"]["overall_gpa"],
                                    "overall_grade": report_card["grades"]["overall_grade"],
                                    "class_name": report_card["class_name"],
                                    "notification_id": str(result.inserted_id)
                                }
                            }
                        )
            
            # Log audit
            await self.audit_logger.log_user_action(
                user_id=published_by,
                action=AuditAction.UPDATE,
                resource_type="report_card_published",
                resource_id=report_card_id,
                details={
                    "student_id": report_card["student_id"],
                    "academic_year": report_card["academic_year"],
                    "term": report_card["term"],
                    "overall_gpa": report_card["grades"]["overall_gpa"],
                    "parents_notified": len(notifications_created)
                },
                severity=AuditSeverity.INFO
            )
            
            return {
                "success": True,
                "message": "Report card published to parent portal successfully",
                "report_card_id": report_card_id,
                "parents_notified": len(notifications_created),
                "notifications_created": notifications_created
            }
            
        except Exception as e:
            logger.error(f"Error publishing report card to parent portal: {e}")
            raise
    
    async def get_parent_portal_data(
        self,
        parent_id: str,
        student_id: Optional[str] = None,
        include_archived: bool = False,
        portal_notifications_collection: Any = None,
        students_collection: Any = None,
        parents_collection: Any = None,
        limit: int = 50,
        skip: int = 0
    ) -> Dict[str, Any]:
        """Get parent portal data including grades, report cards, and notifications."""
        try:
            # Get parent info
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent:
                raise ValueError(f"Parent not found: {parent_id}")
            
            # Get students for this parent
            student_ids = []
            if student_id:
                student_ids = [student_id]
            else:
                # Get all students for this parent
                if parent.get("student_ids"):
                    student_ids = parent["student_ids"]
                
                # Also check students with this parent as guardian
                async for student in students_collection.find({"parent_guardian_id": parent_id}):
                    if str(student["_id"]) not in student_ids:
                        student_ids.append(str(student["_id"]))
            
            if not student_ids:
                return {
                    "parent_id": parent_id,
                    "students": [],
                    "notifications": [],
                    "summary": {
                        "total_notifications": 0,
                        "unread_notifications": 0,
                        "recent_grades": 0,
                        "recent_reports": 0
                    }
                }
            
            # Build notification filter
            notification_filter = {
                "parent_id": parent_id,
                "student_id": {"$in": student_ids}
            }
            
            if not include_archived:
                notification_filter["archived"] = {"$ne": True}
            
            # Get notifications
            notifications = []
            async for notification in portal_notifications_collection.find(notification_filter).sort("published_at", -1).skip(skip).limit(limit):
                notification_data = {k: v for k, v in notification.items() if k != "_id"}
                notification_data["id"] = str(notification["_id"])
                notifications.append(notification_data)
            
            # Get students info
            students_info = []
            for sid in student_ids:
                student = await students_collection.find_one({"_id": ObjectId(sid)})
                if student:
                    student_data = {
                        "student_id": str(student["_id"]),
                        "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                        "class_id": student.get("class_id"),
                        "grade_level": student.get("grade_level"),
                        "student_id_number": student.get("student_id")
                    }
                    students_info.append(student_data)
            
            # Calculate summary statistics
            total_notifications = len(notifications)
            unread_notifications = len([n for n in notifications if not n.get("parent_viewed", False)])
            recent_grades = len([n for n in notifications if n.get("notification_type") == "grade_results"])
            recent_reports = len([n for n in notifications if n.get("notification_type") == "report_card"])
            
            return {
                "parent_id": parent_id,
                "parent_name": parent.get("name", ""),
                "students": students_info,
                "notifications": notifications,
                "summary": {
                    "total_notifications": total_notifications,
                    "unread_notifications": unread_notifications,
                    "recent_grades": recent_grades,
                    "recent_reports": recent_reports
                },
                "pagination": {
                    "limit": limit,
                    "skip": skip,
                    "has_more": total_notifications == limit  # Simple check
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting parent portal data: {e}")
            raise
    
    async def mark_notification_as_viewed(
        self,
        notification_id: str,
        parent_id: str,
        portal_notifications_collection: Any
    ) -> bool:
        """Mark a parent portal notification as viewed."""
        try:
            result = await portal_notifications_collection.update_one(
                {
                    "_id": ObjectId(notification_id),
                    "parent_id": parent_id
                },
                {
                    "$set": {
                        "parent_viewed": True,
                        "viewed_at": datetime.utcnow(),
                        "is_new": False
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error marking notification as viewed: {e}")
            raise
    
    async def bulk_publish_grades_to_parents(
        self,
        class_id: str,
        academic_year: str,
        term: str,
        students_collection: Any,
        exam_results_collection: Any,
        exams_collection: Any,
        parents_collection: Any,
        portal_notifications_collection: Any,
        websocket_manager: WebSocketManager,
        published_by: str,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Bulk publish grades for all students in a class to parent portals."""
        try:
            # Get all students in the class
            students = []
            async for student in students_collection.find({
                "class_id": class_id,
                **({"branch_id": branch_id} if branch_id else {})
            }):
                students.append(student)
            
            if not students:
                return {"success": False, "message": "No students found in class"}
            
            # Process each student
            successful_publishes = 0
            failed_publishes = 0
            results = []
            
            for student in students:
                try:
                    result = await self.publish_grades_to_parent_portal(
                        str(student["_id"]),
                        academic_year,
                        term,
                        exam_results_collection,
                        exams_collection,
                        students_collection,
                        parents_collection,
                        portal_notifications_collection,
                        websocket_manager,
                        published_by,
                        branch_id
                    )
                    
                    if result["success"]:
                        successful_publishes += 1
                        results.append({
                            "student_id": str(student["_id"]),
                            "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                            "status": "success",
                            "parents_notified": result["parents_notified"]
                        })
                    else:
                        failed_publishes += 1
                        results.append({
                            "student_id": str(student["_id"]),
                            "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                            "status": "failed",
                            "error": result["message"]
                        })
                        
                except Exception as e:
                    failed_publishes += 1
                    results.append({
                        "student_id": str(student["_id"]),
                        "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                        "status": "failed",
                        "error": str(e)
                    })
            
            return {
                "success": True,
                "message": f"Bulk grade publishing completed",
                "total_students": len(students),
                "successful_publishes": successful_publishes,
                "failed_publishes": failed_publishes,
                "success_rate": round((successful_publishes / len(students)) * 100, 2),
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error in bulk grade publishing: {e}")
            raise
    
    def _calculate_grade_level(self, percentage: float) -> str:
        """Calculate grade level from percentage."""
        if percentage >= 90:
            return "Excellent"
        elif percentage >= 80:
            return "Very Good"
        elif percentage >= 70:
            return "Good"
        elif percentage >= 60:
            return "Satisfactory"
        else:
            return "Needs Improvement"
    
    async def send_grade_alert_to_parents(
        self,
        student_id: str,
        alert_type: str,  # "low_grade", "missing_exam", "improvement_needed"
        alert_data: Dict[str, Any],
        parents_collection: Any,
        portal_notifications_collection: Any,
        websocket_manager: WebSocketManager,
        triggered_by: str
    ) -> Dict[str, Any]:
        """Send automated grade alerts to parents."""
        try:
            # Find parents for student
            parents = []
            async for parent in parents_collection.find({
                "$or": [
                    {"student_ids": {"$in": [student_id]}},
                    {"_id": ObjectId(alert_data.get("parent_guardian_id", ""))}
                ]
            }):
                parents.append(parent)
            
            if not parents:
                return {"success": False, "message": "No parents found"}
            
            # Create alert notifications
            alerts_sent = 0
            
            for parent in parents:
                alert_notification = {
                    "parent_id": str(parent["_id"]),
                    "student_id": student_id,
                    "student_name": alert_data.get("student_name", ""),
                    "notification_type": "grade_alert",
                    "alert_type": alert_type,
                    "title": self._get_alert_title(alert_type, alert_data),
                    "content": {
                        "alert_type": alert_type,
                        "message": self._get_alert_message(alert_type, alert_data),
                        "action_required": self._get_required_action(alert_type),
                        "alert_data": alert_data
                    },
                    "published_at": datetime.utcnow(),
                    "published_by": triggered_by,
                    "is_new": True,
                    "parent_viewed": False,
                    "priority": "high" if alert_type in ["low_grade", "missing_exam"] else "normal"
                }
                
                # Save alert
                await portal_notifications_collection.insert_one(alert_notification)
                
                # Send real-time alert
                if parent.get("user_id"):
                    await websocket_manager.send_to_user(
                        parent["user_id"],
                        {
                            "type": "grade_alert",
                            "data": {
                                "alert_type": alert_type,
                                "student_name": alert_data.get("student_name", ""),
                                "title": alert_notification["title"],
                                "message": alert_notification["content"]["message"],
                                "priority": alert_notification["priority"]
                            }
                        }
                    )
                
                alerts_sent += 1
            
            return {
                "success": True,
                "message": f"Grade alert sent to {alerts_sent} parents",
                "alert_type": alert_type,
                "parents_notified": alerts_sent
            }
            
        except Exception as e:
            logger.error(f"Error sending grade alert: {e}")
            raise
    
    def _get_alert_title(self, alert_type: str, alert_data: Dict[str, Any]) -> str:
        """Generate alert title based on type."""
        student_name = alert_data.get("student_name", "Student")
        
        if alert_type == "low_grade":
            return f"Low Grade Alert - {student_name}"
        elif alert_type == "missing_exam":
            return f"Missing Exam Alert - {student_name}"
        elif alert_type == "improvement_needed":
            return f"Academic Improvement Needed - {student_name}"
        else:
            return f"Academic Alert - {student_name}"
    
    def _get_alert_message(self, alert_type: str, alert_data: Dict[str, Any]) -> str:
        """Generate alert message based on type."""
        if alert_type == "low_grade":
            return f"Your child scored {alert_data.get('percentage', 0)}% in {alert_data.get('subject_name', 'a subject')}, which is below the expected performance level."
        elif alert_type == "missing_exam":
            return f"Your child missed the {alert_data.get('exam_name', 'exam')} scheduled for {alert_data.get('exam_date', 'recently')}."
        elif alert_type == "improvement_needed":
            return f"Your child's recent performance shows a declining trend. Consider additional support in {alert_data.get('subject_name', 'relevant subjects')}."
        else:
            return "Please check your child's academic progress."
    
    def _get_required_action(self, alert_type: str) -> str:
        """Get recommended action for alert type."""
        if alert_type == "low_grade":
            return "Consider meeting with the teacher to discuss improvement strategies."
        elif alert_type == "missing_exam":
            return "Contact the school to discuss makeup exam opportunities."
        elif alert_type == "improvement_needed":
            return "Schedule a parent-teacher conference to create an improvement plan."
        else:
            return "Please contact the school for more information."