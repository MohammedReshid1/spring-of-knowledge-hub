from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import HTTPException, status
import logging
import asyncio
from enum import Enum

from ..models.exam import ExamResult, Exam
from ..models.student import Student
from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity
from ..services.report_generation_service import ReportGenerationService, ReportGenerationRequest, ReportType

logger = logging.getLogger(__name__)

class GradeUpdateTrigger(str, Enum):
    EXAM_RESULT_CREATED = "exam_result_created"
    EXAM_RESULT_UPDATED = "exam_result_updated"
    TERM_COMPLETED = "term_completed"
    MANUAL_TRIGGER = "manual_trigger"

class ExamGradeIntegrationService:
    """Service for integrating exam results with automated grade processing and report generation"""
    
    @staticmethod
    async def process_exam_result_update(
        exam_result: Dict[str, Any],
        trigger: GradeUpdateTrigger,
        exams_collection: Any,
        exam_results_collection: Any,
        students_collection: Any,
        parents_collection: Any,
        classes_collection: Any,
        reports_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None,
        auto_generate_reports: bool = True
    ) -> Dict[str, Any]:
        """Process exam result changes and trigger appropriate actions"""
        audit_logger = get_audit_logger()
        
        try:
            student_id = exam_result.get("student_id")
            exam_id = exam_result.get("exam_id")
            
            # Get exam details
            exam = await exams_collection.find_one({"_id": ObjectId(exam_id)})
            if not exam:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Exam not found"
                )
            
            # Get student details
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Student not found"
                )
            
            # Update student's academic progress
            progress_update = await ExamGradeIntegrationService._update_student_progress(
                student_id, exam_result, exam, students_collection
            )
            
            # Check if term is completed for this student
            term_completed = await ExamGradeIntegrationService._check_term_completion(
                student_id, exam["academic_year"], exam["term"], 
                exams_collection, exam_results_collection
            )
            
            # Trigger parent notifications
            notification_sent = await ExamGradeIntegrationService._send_grade_notifications(
                student_id, exam_result, exam, student, 
                parents_collection, websocket_manager
            )
            
            # Auto-generate report if term is completed
            report_generated = False
            report_id = None
            
            if auto_generate_reports and (term_completed or trigger == GradeUpdateTrigger.MANUAL_TRIGGER):
                try:
                    report_request = ReportGenerationRequest(
                        student_id=student_id,
                        report_type=ReportType.TERM_REPORT,
                        academic_year=exam["academic_year"],
                        term=exam["term"],
                        class_id=student.get("class_id"),
                        include_parent_portal=True,
                        auto_publish=True,
                        requested_by="system_auto"
                    )
                    
                    report_result = await ReportGenerationService.generate_student_report(
                        report_request,
                        students_collection,
                        exams_collection,
                        exam_results_collection,
                        parents_collection,
                        classes_collection,
                        reports_collection,
                        websocket_manager
                    )
                    
                    report_generated = True
                    report_id = report_result["report_id"]
                    
                except Exception as e:
                    logger.error(f"Failed to auto-generate report for student {student_id}: {e}")
            
            # Update class performance metrics
            await ExamGradeIntegrationService._update_class_metrics(
                exam["class_id"], exam_id, exams_collection, exam_results_collection, classes_collection
            )
            
            # Log the integration action
            await audit_logger.log_event(
                user_id="system",
                action=AuditAction.GRADE_CREATED,
                resource_type="exam_result_integration",
                resource_id=exam_id,
                details={
                    "student_id": student_id,
                    "exam_id": exam_id,
                    "exam_name": exam.get("name"),
                    "trigger": trigger.value,
                    "term_completed": term_completed,
                    "report_generated": report_generated,
                    "report_id": report_id,
                    "notification_sent": notification_sent,
                    "grade": exam_result.get("grade"),
                    "percentage": exam_result.get("percentage")
                },
                severity=AuditSeverity.INFO
            )
            
            return {
                "success": True,
                "student_id": student_id,
                "exam_id": exam_id,
                "progress_updated": bool(progress_update),
                "term_completed": term_completed,
                "notification_sent": notification_sent,
                "report_generated": report_generated,
                "report_id": report_id,
                "trigger": trigger.value
            }
            
        except Exception as e:
            logger.error(f"Error in exam-grade integration: {e}")
            try:
                await audit_logger.log_event(
                    user_id="system",
                    action=AuditAction.SUSPICIOUS_ACTIVITY,
                    resource_type="exam_result_integration",
                    resource_id=exam_result.get("exam_id", "unknown"),
                    details={
                        "error": str(e),
                        "exam_result": exam_result,
                        "trigger": trigger.value
                    },
                    severity=AuditSeverity.ERROR
                )
            except Exception as audit_error:
                logger.error(f"Failed to log audit event: {audit_error}")
            raise
    
    @staticmethod
    async def _update_student_progress(
        student_id: str,
        exam_result: Dict[str, Any],
        exam: Dict[str, Any],
        students_collection: Any
    ) -> Dict[str, Any]:
        """Update student's academic progress tracking"""
        
        try:
            # Calculate progress metrics
            current_percentage = exam_result.get("percentage", 0)
            subject_id = exam.get("subject_id")
            academic_year = exam.get("academic_year")
            term = exam.get("term")
            
            # Update student record with latest academic data
            progress_update = {
                f"academic_progress.{academic_year}.{term}.{subject_id}": {
                    "latest_exam": str(exam["_id"]),
                    "latest_percentage": current_percentage,
                    "latest_grade": exam_result.get("grade"),
                    "exam_count": 1,  # This would be calculated properly in real implementation
                    "last_updated": datetime.utcnow()
                },
                f"academic_progress.{academic_year}.{term}.last_exam_date": exam.get("exam_date"),
                f"academic_progress.{academic_year}.{term}.total_exams": 1,  # Would be incremented
                "last_grade_update": datetime.utcnow()
            }
            
            # Add performance indicators
            if current_percentage >= 80:
                progress_update[f"academic_progress.{academic_year}.{term}.high_performers"] = True
            elif current_percentage < 50:
                progress_update[f"academic_progress.{academic_year}.{term}.needs_attention"] = True
            
            await students_collection.update_one(
                {"_id": ObjectId(student_id)},
                {"$set": progress_update}
            )
            
            return progress_update
            
        except Exception as e:
            logger.error(f"Error updating student progress: {e}")
            return {}
    
    @staticmethod
    async def _check_term_completion(
        student_id: str,
        academic_year: str,
        term: str,
        exams_collection: Any,
        exam_results_collection: Any
    ) -> bool:
        """Check if student has completed all exams for the term"""
        
        try:
            # Get all exams for this term
            term_exams = await exams_collection.find({
                "academic_year": academic_year,
                "term": term,
                "is_active": True
            }).to_list(None)
            
            if not term_exams:
                return False
            
            # Get student's results for this term
            exam_ids = [str(exam["_id"]) for exam in term_exams]
            student_results = await exam_results_collection.find({
                "student_id": student_id,
                "exam_id": {"$in": exam_ids}
            }).to_list(None)
            
            # Check if student has results for all exams
            student_exam_ids = [result["exam_id"] for result in student_results]
            completed_count = len(set(student_exam_ids))
            total_exams = len(term_exams)
            
            # Consider term completed if student has attempted 80% or more exams
            completion_threshold = 0.8
            is_completed = completed_count >= (total_exams * completion_threshold)
            
            logger.info(f"Term completion check for student {student_id}: {completed_count}/{total_exams} exams, completed: {is_completed}")
            
            return is_completed
            
        except Exception as e:
            logger.error(f"Error checking term completion: {e}")
            return False
    
    @staticmethod
    async def _send_grade_notifications(
        student_id: str,
        exam_result: Dict[str, Any],
        exam: Dict[str, Any],
        student: Dict[str, Any],
        parents_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> bool:
        """Send grade notifications to parents"""
        
        try:
            # Find parent for this student
            parent = await parents_collection.find_one({"student_ids": student_id})
            if not parent:
                return False
            
            # Determine notification priority based on performance
            percentage = exam_result.get("percentage", 0)
            grade = exam_result.get("grade", "")
            
            if percentage >= 90:
                notification_type = "excellent_performance"
                priority = "normal"
            elif percentage < 50:
                notification_type = "needs_attention"
                priority = "high"
            else:
                notification_type = "grade_update"
                priority = "normal"
            
            # Create notification
            notification_data = {
                "type": notification_type,
                "title": f"New Grade: {exam.get('name')} - {exam.get('subject_id')}",
                "message": f"{student.get('first_name', 'Your child')} scored {percentage}% ({grade}) in {exam.get('name')}",
                "data": {
                    "student_id": student_id,
                    "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                    "exam_id": str(exam["_id"]),
                    "exam_name": exam.get("name"),
                    "subject": exam.get("subject_id"),
                    "percentage": percentage,
                    "grade": grade,
                    "exam_date": exam.get("exam_date"),
                    "marks_obtained": exam_result.get("marks_obtained"),
                    "total_marks": exam.get("total_marks")
                },
                "priority": priority,
                "created_at": datetime.utcnow(),
                "is_read": False,
                "parent_portal": True
            }
            
            # Add to parent's notifications
            await parents_collection.update_one(
                {"_id": parent["_id"]},
                {
                    "$push": {"notifications": notification_data},
                    "$set": {"last_notification_date": datetime.utcnow()}
                }
            )
            
            # Send real-time notification if parent is online
            if websocket_manager and parent.get("user_id"):
                await websocket_manager.broadcast_to_user(
                    parent["user_id"],
                    {
                        "type": "new_grade_notification",
                        "data": notification_data
                    }
                )
            
            return True
            
        except Exception as e:
            logger.error(f"Error sending grade notifications: {e}")
            return False
    
    @staticmethod
    async def _update_class_metrics(
        class_id: str,
        exam_id: str,
        exams_collection: Any,
        exam_results_collection: Any,
        classes_collection: Any
    ) -> None:
        """Update class performance metrics"""
        
        try:
            if not class_id:
                return
            
            # Get all results for this exam
            exam_results = await exam_results_collection.find({"exam_id": exam_id}).to_list(None)
            
            if not exam_results:
                return
            
            # Calculate class statistics
            appeared_results = [r for r in exam_results if r.get("attendance_status") == "present"]
            if not appeared_results:
                return
            
            percentages = [r.get("percentage", 0) for r in appeared_results]
            passed_count = len([r for r in appeared_results if r.get("status") == "pass"])
            
            class_stats = {
                "total_students": len(exam_results),
                "appeared_students": len(appeared_results),
                "pass_count": passed_count,
                "pass_rate": round((passed_count / len(appeared_results)) * 100, 2),
                "average_percentage": round(sum(percentages) / len(percentages), 2),
                "highest_percentage": max(percentages),
                "lowest_percentage": min(percentages),
                "last_exam_stats_update": datetime.utcnow()
            }
            
            # Update class record
            await classes_collection.update_one(
                {"_id": ObjectId(class_id)},
                {
                    "$set": {
                        f"exam_performance.{exam_id}": class_stats,
                        "last_performance_update": datetime.utcnow()
                    }
                }
            )
            
        except Exception as e:
            logger.error(f"Error updating class metrics: {e}")
    
    @staticmethod
    async def trigger_term_report_generation(
        class_id: str,
        academic_year: str,
        term: str,
        requested_by: str,
        students_collection: Any,
        exams_collection: Any,
        exam_results_collection: Any,
        parents_collection: Any,
        classes_collection: Any,
        reports_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Dict[str, Any]:
        """Trigger report generation for all students in a class at term end"""
        
        try:
            # Generate reports for all students in the class
            batch_result = await ReportGenerationService.generate_batch_reports(
                class_id=class_id,
                academic_year=academic_year,
                term=term,
                report_type=ReportType.TERM_REPORT,
                requested_by=requested_by,
                students_collection=students_collection,
                exams_collection=exams_collection,
                exam_results_collection=exam_results_collection,
                parents_collection=parents_collection,
                classes_collection=classes_collection,
                reports_collection=reports_collection,
                websocket_manager=websocket_manager
            )
            
            # Update class with term completion status
            await classes_collection.update_one(
                {"_id": ObjectId(class_id)},
                {
                    "$set": {
                        f"term_completion.{academic_year}.{term}": {
                            "completed_at": datetime.utcnow(),
                            "reports_generated": batch_result["successful_reports"],
                            "total_students": batch_result["total_students"],
                            "completion_rate": batch_result["success_rate"]
                        }
                    }
                }
            )
            
            return batch_result
            
        except Exception as e:
            logger.error(f"Error in term report generation: {e}")
            raise
    
    @staticmethod
    async def get_student_grade_summary(
        student_id: str,
        academic_year: str,
        exams_collection: Any,
        exam_results_collection: Any,
        term: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get comprehensive grade summary for a student"""
        
        try:
            # Build exam filter
            exam_filter = {
                "academic_year": academic_year,
                "is_active": True
            }
            
            if term:
                exam_filter["term"] = term
            
            # Get all exams for the period
            exams = await exams_collection.find(exam_filter).to_list(None)
            exam_ids = [str(exam["_id"]) for exam in exams]
            
            if not exam_ids:
                return {"student_id": student_id, "exams": [], "summary": {}}
            
            # Get student's results
            results = await exam_results_collection.find({
                "student_id": student_id,
                "exam_id": {"$in": exam_ids}
            }).to_list(None)
            
            # Combine results with exam details
            detailed_results = []
            for result in results:
                exam = next((e for e in exams if str(e["_id"]) == result["exam_id"]), None)
                if exam:
                    detailed_results.append({
                        "exam_id": result["exam_id"],
                        "exam_name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "exam_type": exam["exam_type"],
                        "exam_date": exam["exam_date"],
                        "marks_obtained": result.get("marks_obtained"),
                        "total_marks": exam["total_marks"],
                        "percentage": result.get("percentage"),
                        "grade": result.get("grade"),
                        "status": result.get("status"),
                        "attendance_status": result.get("attendance_status")
                    })
            
            # Calculate summary
            appeared_results = [r for r in detailed_results if r["attendance_status"] == "present"]
            passed_results = [r for r in appeared_results if r["status"] == "pass"]
            
            summary = {
                "total_exams": len(detailed_results),
                "exams_appeared": len(appeared_results),
                "exams_passed": len(passed_results),
                "pass_rate": round((len(passed_results) / len(appeared_results)) * 100, 2) if appeared_results else 0,
                "average_percentage": round(sum(r["percentage"] for r in appeared_results) / len(appeared_results), 2) if appeared_results else 0,
                "highest_percentage": max((r["percentage"] for r in appeared_results), default=0),
                "lowest_percentage": min((r["percentage"] for r in appeared_results), default=0)
            }
            
            return {
                "student_id": student_id,
                "academic_year": academic_year,
                "term": term,
                "exams": detailed_results,
                "summary": summary
            }
            
        except Exception as e:
            logger.error(f"Error getting student grade summary: {e}")
            return {"student_id": student_id, "error": str(e)}