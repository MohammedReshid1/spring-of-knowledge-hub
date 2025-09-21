"""
Real-time Grade Update Service
Handles real-time grade updates across all modules with WebSocket integration.
"""

import logging
from typing import List, Dict, Any, Optional, Set
from datetime import datetime, timedelta
from bson import ObjectId
import asyncio
import json

from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .grade_calculation_service import GradeCalculationService
from .grade_notification_service import GradeNotificationService
from .parent_portal_service import ParentPortalService

logger = logging.getLogger(__name__)

class RealtimeGradeService:
    """Service for managing real-time grade updates across all modules."""
    
    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.grade_calc_service = GradeCalculationService()
        self.notification_service = GradeNotificationService()
        self.parent_portal_service = ParentPortalService()
        self.active_connections: Set[str] = set()
        self.grade_update_queue = asyncio.Queue()
    
    async def initialize_realtime_connections(
        self,
        websocket_manager: WebSocketManager
    ) -> Dict[str, Any]:
        """Initialize real-time connections for grade updates."""
        try:
            # Start background task for processing grade updates
            asyncio.create_task(self._process_grade_update_queue(websocket_manager))
            
            logger.info("Real-time grade service initialized")
            return {
                "success": True,
                "message": "Real-time grade connections initialized",
                "active_connections": len(self.active_connections)
            }
            
        except Exception as e:
            logger.error(f"Error initializing real-time connections: {e}")
            raise
    
    async def update_grade_realtime(
        self,
        exam_id: str,
        student_id: str,
        new_marks: float,
        updated_by: str,
        exam_results_collection: Any,
        exams_collection: Any,
        students_collection: Any,
        parents_collection: Any,
        grading_scales_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        branch_id: Optional[str] = None,
        trigger_notifications: bool = True
    ) -> Dict[str, Any]:
        """Update grade in real-time with immediate propagation across all modules."""
        try:
            # Get exam info
            exam = await exams_collection.find_one({"_id": ObjectId(exam_id)})
            if not exam:
                raise ValueError(f"Exam not found: {exam_id}")
            
            # Get current exam result
            current_result = await exam_results_collection.find_one({
                "exam_id": exam_id,
                "student_id": student_id
            })
            
            old_marks = current_result.get("marks_obtained") if current_result else None
            old_percentage = current_result.get("percentage") if current_result else None
            
            # Calculate new grade data
            percentage = (new_marks / exam["total_marks"]) * 100 if exam["total_marks"] > 0 else 0
            
            # Get grading scales
            grading_scales = []
            async for scale in grading_scales_collection.find(
                {"branch_id": branch_id} if branch_id else {}
            ):
                grading_scales.append(scale)
            grading_scales.sort(key=lambda x: x["min_percentage"], reverse=True)
            
            # Calculate grade and status
            letter_grade = self._calculate_grade_from_scales(percentage, grading_scales)
            status = "pass" if new_marks >= exam.get("passing_marks", 0) else "fail"
            
            # Update exam result
            now = datetime.utcnow()
            update_data = {
                "marks_obtained": new_marks,
                "percentage": round(percentage, 2),
                "grade": letter_grade,
                "status": status,
                "updated_at": now,
                "updated_by": updated_by
            }
            
            if current_result:
                await exam_results_collection.update_one(
                    {"exam_id": exam_id, "student_id": student_id},
                    {"$set": update_data}
                )
            else:
                # Create new result if doesn't exist
                result_data = {
                    **update_data,
                    "exam_id": exam_id,
                    "student_id": student_id,
                    "attendance_status": "present",
                    "submission_status": "submitted",
                    "graded_by": updated_by,
                    "graded_at": now,
                    "created_at": now
                }
                await exam_results_collection.insert_one(result_data)
            
            # Recalculate student GPA for the term
            gpa_data = await self.grade_calc_service.calculate_student_gpa(
                student_id,
                exam["academic_year"],
                exam["term"],
                exam_results_collection=exam_results_collection,
                exams_collection=exams_collection,
                grading_scales_collection=grading_scales_collection,
                branch_id=branch_id
            )
            
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            
            # Prepare real-time update data
            realtime_update = {
                "type": "grade_updated",
                "timestamp": now.isoformat(),
                "data": {
                    "exam_id": exam_id,
                    "student_id": student_id,
                    "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip() if student else "Unknown",
                    "exam_name": exam["name"],
                    "subject_id": exam["subject_id"],
                    "class_id": exam["class_id"],
                    "academic_year": exam["academic_year"],
                    "term": exam["term"],
                    "old_marks": old_marks,
                    "new_marks": new_marks,
                    "old_percentage": old_percentage,
                    "new_percentage": round(percentage, 2),
                    "percentage_change": round(percentage - (old_percentage or 0), 2),
                    "grade": letter_grade,
                    "status": status,
                    "updated_gpa": gpa_data["gpa"],
                    "updated_by": updated_by,
                    "branch_id": branch_id
                }
            }
            
            # Add to real-time update queue
            await self.grade_update_queue.put(realtime_update)
            
            # Send immediate updates to connected users
            await self._broadcast_grade_update(
                realtime_update,
                student,
                exam,
                websocket_manager,
                parents_collection
            )
            
            # Trigger notifications if requested
            notification_results = {}
            if trigger_notifications:
                try:
                    # Send grade update notification
                    notification_result = await self.notification_service.notify_grade_updated(
                        student_id,
                        exam_id,
                        old_marks,
                        new_marks,
                        exam,
                        students_collection,
                        parents_collection,
                        notifications_collection,
                        websocket_manager,
                        updated_by,
                        branch_id
                    )
                    notification_results["grade_notification"] = notification_result
                    
                    # Check for alert conditions
                    if percentage < 60:
                        alert_result = await self.notification_service.send_low_grade_alert(
                            student_id,
                            exam,
                            update_data,
                            students_collection,
                            parents_collection,
                            notifications_collection,
                            websocket_manager,
                            60.0,
                            updated_by
                        )
                        notification_results["low_grade_alert"] = alert_result
                    
                    elif percentage >= 95:
                        achievement_data = {
                            "type": "high_score",
                            "title": "Outstanding Performance",
                            "description": f"Scored {percentage}% in {exam['name']}",
                            "exam_name": exam["name"],
                            "subject": exam.get("subject_id"),
                            "percentage": percentage,
                            "grade": letter_grade,
                            "academic_year": exam["academic_year"],
                            "term": exam["term"],
                            "branch_id": branch_id
                        }
                        
                        achievement_result = await self.notification_service.send_academic_achievement_notification(
                            student_id,
                            achievement_data,
                            students_collection,
                            parents_collection,
                            notifications_collection,
                            websocket_manager,
                            updated_by
                        )
                        notification_results["achievement_notification"] = achievement_result
                        
                except Exception as e:
                    logger.error(f"Error sending notifications for grade update: {e}")
                    notification_results["error"] = str(e)
            
            # Log audit
            await self.audit_logger.log_user_action(
                user_id=updated_by,
                action=AuditAction.UPDATE,
                resource_type="exam_result_realtime",
                resource_id=f"{exam_id}_{student_id}",
                details={
                    "exam_id": exam_id,
                    "student_id": student_id,
                    "old_marks": old_marks,
                    "new_marks": new_marks,
                    "percentage_change": round(percentage - (old_percentage or 0), 2),
                    "updated_gpa": gpa_data["gpa"],
                    "notifications_sent": len(notification_results)
                },
                severity=AuditSeverity.INFO
            )
            
            return {
                "success": True,
                "message": "Grade updated in real-time successfully",
                "grade_data": update_data,
                "gpa_data": gpa_data,
                "realtime_update": realtime_update,
                "notifications": notification_results,
                "percentage_change": round(percentage - (old_percentage or 0), 2)
            }
            
        except Exception as e:
            logger.error(f"Error updating grade in real-time: {e}")
            await self.audit_logger.log_system_event(
                event_type="realtime_grade_update_failed",
                component="realtime_grade_service",
                details={
                    "exam_id": exam_id,
                    "student_id": student_id,
                    "error": str(e)
                },
                severity=AuditSeverity.ERROR
            )
            raise
    
    async def bulk_update_grades_realtime(
        self,
        exam_id: str,
        grade_updates: List[Dict[str, Any]],  # [{"student_id": str, "marks": float}, ...]
        updated_by: str,
        exam_results_collection: Any,
        exams_collection: Any,
        students_collection: Any,
        parents_collection: Any,
        grading_scales_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update multiple grades in real-time with batch processing."""
        try:
            # Get exam info
            exam = await exams_collection.find_one({"_id": ObjectId(exam_id)})
            if not exam:
                raise ValueError(f"Exam not found: {exam_id}")
            
            successful_updates = 0
            failed_updates = 0
            results = []
            
            # Process updates in batches to avoid overwhelming the system
            batch_size = 10
            for i in range(0, len(grade_updates), batch_size):
                batch = grade_updates[i:i + batch_size]
                batch_tasks = []
                
                for update in batch:
                    task = self.update_grade_realtime(
                        exam_id,
                        update["student_id"],
                        update["marks"],
                        updated_by,
                        exam_results_collection,
                        exams_collection,
                        students_collection,
                        parents_collection,
                        grading_scales_collection,
                        notifications_collection,
                        websocket_manager,
                        branch_id,
                        trigger_notifications=False  # Batch notifications separately
                    )
                    batch_tasks.append(task)
                
                # Execute batch concurrently
                batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
                
                for j, result in enumerate(batch_results):
                    if isinstance(result, Exception):
                        failed_updates += 1
                        results.append({
                            "student_id": batch[j]["student_id"],
                            "status": "failed",
                            "error": str(result)
                        })
                    else:
                        successful_updates += 1
                        results.append({
                            "student_id": batch[j]["student_id"],
                            "status": "success",
                            "grade_data": result["grade_data"],
                            "gpa_data": result["gpa_data"]
                        })
                
                # Small delay between batches to prevent system overload
                if i + batch_size < len(grade_updates):
                    await asyncio.sleep(0.1)
            
            # Send bulk notification to all parents
            try:
                await self._send_bulk_grade_notification(
                    exam_id,
                    exam,
                    [r for r in results if r["status"] == "success"],
                    students_collection,
                    parents_collection,
                    notifications_collection,
                    websocket_manager,
                    updated_by
                )
            except Exception as e:
                logger.error(f"Error sending bulk grade notifications: {e}")
            
            return {
                "success": True,
                "message": f"Bulk grade update completed: {successful_updates} successful, {failed_updates} failed",
                "total_updates": len(grade_updates),
                "successful_updates": successful_updates,
                "failed_updates": failed_updates,
                "success_rate": round((successful_updates / len(grade_updates)) * 100, 2),
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error in bulk real-time grade update: {e}")
            raise
    
    async def subscribe_to_grade_updates(
        self,
        user_id: str,
        student_ids: List[str],
        websocket_manager: WebSocketManager
    ) -> Dict[str, Any]:
        """Subscribe a user to real-time grade updates for specific students."""
        try:
            # Store subscription info (in production, use Redis or similar)
            subscription_key = f"grade_updates_{user_id}"
            
            # Add to active connections
            self.active_connections.add(user_id)
            
            # Send confirmation
            await websocket_manager.send_to_user(
                user_id,
                {
                    "type": "subscription_confirmed",
                    "data": {
                        "subscription_type": "grade_updates",
                        "student_ids": student_ids,
                        "subscribed_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            logger.info(f"User {user_id} subscribed to grade updates for students: {student_ids}")
            
            return {
                "success": True,
                "message": "Subscribed to grade updates",
                "subscription_key": subscription_key,
                "student_ids": student_ids
            }
            
        except Exception as e:
            logger.error(f"Error subscribing to grade updates: {e}")
            raise
    
    async def unsubscribe_from_grade_updates(
        self,
        user_id: str,
        websocket_manager: WebSocketManager
    ) -> Dict[str, Any]:
        """Unsubscribe a user from real-time grade updates."""
        try:
            # Remove from active connections
            self.active_connections.discard(user_id)
            
            # Send confirmation
            await websocket_manager.send_to_user(
                user_id,
                {
                    "type": "subscription_cancelled",
                    "data": {
                        "subscription_type": "grade_updates",
                        "unsubscribed_at": datetime.utcnow().isoformat()
                    }
                }
            )
            
            logger.info(f"User {user_id} unsubscribed from grade updates")
            
            return {
                "success": True,
                "message": "Unsubscribed from grade updates"
            }
            
        except Exception as e:
            logger.error(f"Error unsubscribing from grade updates: {e}")
            raise
    
    async def get_realtime_grade_summary(
        self,
        student_id: str,
        academic_year: str,
        term: str,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get real-time grade summary for a student."""
        try:
            # Calculate current GPA
            gpa_data = await self.grade_calc_service.calculate_student_gpa(
                student_id,
                academic_year,
                term,
                exam_results_collection=exam_results_collection,
                exams_collection=exams_collection,
                grading_scales_collection=grading_scales_collection,
                branch_id=branch_id
            )
            
            # Get recent grade updates (last 7 days)
            recent_date = datetime.utcnow() - timedelta(days=7)
            recent_updates = []
            
            async for result in exam_results_collection.find({
                "student_id": student_id,
                "updated_at": {"$gte": recent_date}
            }).sort("updated_at", -1).limit(10):
                # Get exam info
                exam = await exams_collection.find_one({"_id": ObjectId(result["exam_id"])})
                if exam:
                    recent_updates.append({
                        "exam_id": result["exam_id"],
                        "exam_name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "marks_obtained": result.get("marks_obtained"),
                        "percentage": result.get("percentage"),
                        "grade": result.get("grade"),
                        "updated_at": result.get("updated_at").isoformat() if result.get("updated_at") else None
                    })
            
            return {
                "student_id": student_id,
                "academic_year": academic_year,
                "term": term,
                "current_gpa": gpa_data,
                "recent_updates": recent_updates,
                "summary_generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting real-time grade summary: {e}")
            raise
    
    async def _process_grade_update_queue(
        self,
        websocket_manager: WebSocketManager
    ):
        """Background task to process grade update queue."""
        while True:
            try:
                # Get update from queue (wait up to 5 seconds)
                try:
                    update = await asyncio.wait_for(self.grade_update_queue.get(), timeout=5.0)
                    
                    # Process the update (additional business logic can go here)
                    logger.info(f"Processing grade update: {update['data']['exam_id']} - {update['data']['student_id']}")
                    
                    # Mark task as done
                    self.grade_update_queue.task_done()
                    
                except asyncio.TimeoutError:
                    # No updates in queue, continue
                    continue
                    
            except Exception as e:
                logger.error(f"Error processing grade update queue: {e}")
                await asyncio.sleep(1)
    
    async def _broadcast_grade_update(
        self,
        realtime_update: Dict[str, Any],
        student: Dict[str, Any],
        exam: Dict[str, Any],
        websocket_manager: WebSocketManager,
        parents_collection: Any
    ):
        """Broadcast grade update to relevant users."""
        try:
            student_id = realtime_update["data"]["student_id"]
            
            # Send to student
            if student and student.get("user_id"):
                await websocket_manager.send_to_user(
                    student["user_id"],
                    realtime_update
                )
            
            # Send to parents
            async for parent in parents_collection.find({
                "$or": [
                    {"student_ids": {"$in": [student_id]}},
                    {"_id": ObjectId(student.get("parent_guardian_id", "000000000000000000000000"))}
                ]
            }):
                if parent.get("user_id"):
                    await websocket_manager.send_to_user(
                        parent["user_id"],
                        realtime_update
                    )
            
            # Send to teachers (exam's teacher)
            if exam.get("teacher_id"):
                # Would need teachers collection to get user_id
                pass
            
            # Send to class-level subscribers (admins, principals)
            class_id = exam.get("class_id")
            if class_id:
                class_update = {
                    **realtime_update,
                    "type": "class_grade_updated"
                }
                
                # Broadcast to class-level users
                await websocket_manager.broadcast_to_room(
                    f"class_{class_id}",
                    class_update
                )
            
        except Exception as e:
            logger.error(f"Error broadcasting grade update: {e}")
    
    async def _send_bulk_grade_notification(
        self,
        exam_id: str,
        exam: Dict[str, Any],
        successful_updates: List[Dict[str, Any]],
        students_collection: Any,
        parents_collection: Any,
        notifications_collection: Any,
        websocket_manager: WebSocketManager,
        updated_by: str
    ):
        """Send bulk notification for grade updates."""
        try:
            if not successful_updates:
                return
            
            # Group by parent
            parent_notifications = {}
            
            for update in successful_updates:
                student_id = update["student_id"]
                
                # Get student
                student = await students_collection.find_one({"_id": ObjectId(student_id)})
                if not student:
                    continue
                
                # Find parents
                async for parent in parents_collection.find({
                    "$or": [
                        {"student_ids": {"$in": [student_id]}},
                        {"_id": ObjectId(student.get("parent_guardian_id", "000000000000000000000000"))}
                    ]
                }):
                    parent_id = str(parent["_id"])
                    if parent_id not in parent_notifications:
                        parent_notifications[parent_id] = {
                            "parent": parent,
                            "students": []
                        }
                    
                    parent_notifications[parent_id]["students"].append({
                        "student_id": student_id,
                        "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                        "grade_data": update["grade_data"],
                        "gpa_data": update["gpa_data"]
                    })
            
            # Send notifications to parents
            for parent_id, notification_data in parent_notifications.items():
                parent = notification_data["parent"]
                students = notification_data["students"]
                
                bulk_notification = {
                    "type": "bulk_grades_updated",
                    "parent_id": parent_id,
                    "title": f"Multiple Grades Updated - {exam['name']}",
                    "content": {
                        "exam_name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "academic_year": exam["academic_year"],
                        "term": exam["term"],
                        "total_students": len(students),
                        "students": students
                    },
                    "priority": "normal",
                    "created_at": datetime.utcnow(),
                    "created_by": updated_by,
                    "branch_id": exam.get("branch_id"),
                    "read": False
                }
                
                # Save notification
                await notifications_collection.insert_one(bulk_notification)
                
                # Send via WebSocket
                if parent.get("user_id"):
                    await websocket_manager.send_to_user(
                        parent["user_id"],
                        {
                            "type": "notification",
                            "notification_type": "bulk_grades_updated",
                            "data": bulk_notification
                        }
                    )
            
        except Exception as e:
            logger.error(f"Error sending bulk grade notification: {e}")
    
    def _calculate_grade_from_scales(self, percentage: float, grading_scales: List[dict]) -> str:
        """Calculate letter grade based on percentage and grading scales."""
        for scale in grading_scales:
            if percentage >= scale["min_percentage"]:
                return scale["letter_grade"]
        return "F"