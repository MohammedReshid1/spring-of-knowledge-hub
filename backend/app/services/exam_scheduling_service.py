"""
Exam Scheduling Integration Service
Connects exam scheduling with automated report generation and calendar management
"""
import asyncio
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from bson import ObjectId

from ..models.academic_calendar import ExamSchedule, ReportSchedule
from ..utils.websocket_manager import WebSocketManager
from .report_generation_service import ReportGenerationService
from .exam_grade_integration_service import ExamGradeIntegrationService, GradeUpdateTrigger

logger = logging.getLogger(__name__)

class ExamSchedulingService:
    """Service for integrating exam scheduling with report generation workflow"""
    
    @staticmethod
    async def schedule_exam_with_report_integration(
        exam_data: Dict[str, Any],
        exams_collection: Any,
        exam_schedules_collection: Any,
        report_schedules_collection: Any,
        classes_collection: Any,
        websocket_manager: WebSocketManager,
        auto_schedule_reports: bool = True
    ) -> Dict[str, Any]:
        """Schedule an exam and automatically set up report generation triggers"""
        try:
            # Create exam schedule entry
            schedule_data = {
                "exam_id": exam_data["id"],
                "scheduled_date": exam_data["exam_date"],
                "duration_minutes": exam_data["duration_minutes"],
                "room_number": exam_data.get("room_number"),
                "invigilator_ids": exam_data.get("invigilator_ids", []),
                "max_students": exam_data.get("max_students"),
                "special_instructions": exam_data.get("instructions"),
                "equipment_required": exam_data.get("equipment_required", []),
                "is_confirmed": False,
                "branch_id": exam_data.get("branch_id"),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": exam_data.get("created_by", "")
            }
            
            # Insert exam schedule
            schedule_result = await exam_schedules_collection.insert_one(schedule_data)
            schedule_id = str(schedule_result.inserted_id)
            
            result = {
                "exam_schedule_id": schedule_id,
                "exam_id": exam_data["id"],
                "scheduled_date": exam_data["exam_date"],
                "report_schedules": []
            }
            
            # Auto-schedule report generation if enabled
            if auto_schedule_reports:
                report_schedules = await ExamSchedulingService._schedule_post_exam_reports(
                    exam_data=exam_data,
                    exam_schedule_id=schedule_id,
                    report_schedules_collection=report_schedules_collection,
                    classes_collection=classes_collection
                )
                result["report_schedules"] = report_schedules
            
            # Send scheduling notification
            await websocket_manager.send_progress_update(
                user_ids=[exam_data.get("created_by", "")],
                operation_id=f"exam_schedule_{schedule_id}",
                progress=100,
                message=f"Exam '{exam_data['name']}' scheduled successfully"
            )
            
            logger.info(f"Exam scheduled with ID: {schedule_id}, auto-reports: {len(result['report_schedules'])}")
            return result
            
        except Exception as e:
            logger.error(f"Error scheduling exam with report integration: {e}")
            raise
    
    @staticmethod
    async def _schedule_post_exam_reports(
        exam_data: Dict[str, Any],
        exam_schedule_id: str,
        report_schedules_collection: Any,
        classes_collection: Any
    ) -> List[Dict[str, Any]]:
        """Schedule automatic report generation after exam completion"""
        try:
            # Get class information
            class_doc = await classes_collection.find_one({"_id": ObjectId(exam_data["class_id"])})
            if not class_doc:
                logger.warning(f"Class not found for exam: {exam_data['class_id']}")
                return []
            
            # Calculate report generation dates
            exam_date = exam_data["exam_date"]
            if isinstance(exam_date, str):
                exam_date = datetime.fromisoformat(exam_date.replace('Z', '+00:00'))
            
            # Schedule immediate progress report (1 day after exam)
            progress_report_date = exam_date + timedelta(days=1)
            
            # Schedule comprehensive report based on exam type
            comprehensive_delay = {
                "quiz": timedelta(days=2),
                "midterm": timedelta(days=7),
                "final": timedelta(days=14),
                "assignment": timedelta(days=3),
                "project": timedelta(days=7)
            }.get(exam_data.get("exam_type", "quiz"), timedelta(days=3))
            
            comprehensive_report_date = exam_date + comprehensive_delay
            
            report_schedules = []
            
            # Schedule progress report
            progress_schedule_data = {
                "term_id": exam_data.get("term_id", ""),
                "class_id": exam_data["class_id"],
                "scheduled_generation_date": progress_report_date,
                "report_type": "progress_report",
                "auto_publish_to_parents": True,
                "include_behavior_comments": False,
                "include_attendance_summary": False,
                "template_id": None,
                "branch_id": exam_data.get("branch_id"),
                "status": "scheduled",
                "exam_trigger_id": exam_data["id"],
                "exam_schedule_id": exam_schedule_id,
                "reports_generated": 0,
                "total_students": class_doc.get("student_count", 0),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": exam_data.get("created_by", "")
            }
            
            progress_result = await report_schedules_collection.insert_one(progress_schedule_data)
            report_schedules.append({
                "id": str(progress_result.inserted_id),
                "type": "progress_report",
                "scheduled_date": progress_report_date,
                "auto_publish": True
            })
            
            # Schedule comprehensive report for major exams
            if exam_data.get("exam_type") in ["midterm", "final"]:
                comprehensive_schedule_data = {
                    "term_id": exam_data.get("term_id", ""),
                    "class_id": exam_data["class_id"],
                    "scheduled_generation_date": comprehensive_report_date,
                    "report_type": "term_report" if exam_data.get("exam_type") == "final" else "mid_term_report",
                    "auto_publish_to_parents": True,
                    "include_behavior_comments": True,
                    "include_attendance_summary": True,
                    "template_id": None,
                    "branch_id": exam_data.get("branch_id"),
                    "status": "scheduled",
                    "exam_trigger_id": exam_data["id"],
                    "exam_schedule_id": exam_schedule_id,
                    "reports_generated": 0,
                    "total_students": class_doc.get("student_count", 0),
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "created_by": exam_data.get("created_by", "")
                }
                
                comprehensive_result = await report_schedules_collection.insert_one(comprehensive_schedule_data)
                report_schedules.append({
                    "id": str(comprehensive_result.inserted_id),
                    "type": comprehensive_schedule_data["report_type"],
                    "scheduled_date": comprehensive_report_date,
                    "auto_publish": True
                })
            
            return report_schedules
            
        except Exception as e:
            logger.error(f"Error scheduling post-exam reports: {e}")
            return []
    
    @staticmethod
    async def process_scheduled_reports(
        report_schedules_collection: Any,
        students_collection: Any,
        parents_collection: Any,
        exams_collection: Any,
        exam_results_collection: Any,
        classes_collection: Any,
        reports_collection: Any,
        websocket_manager: WebSocketManager,
        check_interval_minutes: int = 30
    ):
        """Background task to process scheduled report generation"""
        try:
            current_time = datetime.utcnow()
            
            # Find reports that are due for generation
            due_reports = []
            async for schedule in report_schedules_collection.find({
                "status": "scheduled",
                "scheduled_generation_date": {"$lte": current_time}
            }):
                due_reports.append(schedule)
            
            if not due_reports:
                return
            
            logger.info(f"Processing {len(due_reports)} scheduled reports")
            
            for schedule in due_reports:
                try:
                    # Update status to generating
                    await report_schedules_collection.update_one(
                        {"_id": schedule["_id"]},
                        {
                            "$set": {
                                "status": "generating",
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    
                    # Send progress notification
                    await websocket_manager.send_progress_update(
                        user_ids=[schedule.get("created_by", "")],
                        operation_id=f"report_schedule_{schedule['_id']}",
                        progress=10,
                        message=f"Starting {schedule['report_type']} generation"
                    )
                    
                    # Get students in the class
                    students = []
                    async for student in students_collection.find({"class_id": schedule["class_id"]}):
                        students.append(student)
                    
                    generated_count = 0
                    total_students = len(students)
                    
                    # Update total students count
                    await report_schedules_collection.update_one(
                        {"_id": schedule["_id"]},
                        {"$set": {"total_students": total_students}}
                    )
                    
                    # Generate reports for each student
                    for i, student in enumerate(students):
                        try:
                            # Create report generation request
                            report_request = {
                                "student_id": str(student["_id"]),
                                "class_id": schedule["class_id"],
                                "term_id": schedule["term_id"],
                                "report_type": schedule["report_type"],
                                "include_behavior_comments": schedule.get("include_behavior_comments", True),
                                "include_attendance_summary": schedule.get("include_attendance_summary", True),
                                "auto_publish_to_parents": schedule.get("auto_publish_to_parents", True),
                                "template_id": schedule.get("template_id"),
                                "branch_id": schedule.get("branch_id"),
                                "scheduled_generation_id": str(schedule["_id"])
                            }
                            
                            # Generate the report
                            report_result = await ReportGenerationService.generate_student_report(
                                request=report_request,
                                students_collection=students_collection,
                                parents_collection=parents_collection,
                                exams_collection=exams_collection,
                                exam_results_collection=exam_results_collection,
                                classes_collection=classes_collection,
                                reports_collection=reports_collection,
                                websocket_manager=websocket_manager
                            )
                            
                            if report_result.get("success"):
                                generated_count += 1
                            
                            # Update progress
                            progress = int((i + 1) / total_students * 90) + 10  # 10-100%
                            await websocket_manager.send_progress_update(
                                user_ids=[schedule.get("created_by", "")],
                                operation_id=f"report_schedule_{schedule['_id']}",
                                progress=progress,
                                message=f"Generated {generated_count}/{i + 1} reports"
                            )
                            
                            # Update progress in database
                            await report_schedules_collection.update_one(
                                {"_id": schedule["_id"]},
                                {
                                    "$set": {
                                        "reports_generated": generated_count,
                                        "updated_at": datetime.utcnow()
                                    }
                                }
                            )
                            
                        except Exception as student_error:
                            logger.error(f"Error generating report for student {student['_id']}: {student_error}")
                            continue
                    
                    # Mark as completed
                    completion_time = datetime.utcnow()
                    await report_schedules_collection.update_one(
                        {"_id": schedule["_id"]},
                        {
                            "$set": {
                                "status": "completed",
                                "generated_at": completion_time,
                                "published_at": completion_time if schedule.get("auto_publish_to_parents") else None,
                                "reports_generated": generated_count,
                                "updated_at": completion_time
                            }
                        }
                    )
                    
                    # Send completion notification
                    await websocket_manager.send_progress_update(
                        user_ids=[schedule.get("created_by", "")],
                        operation_id=f"report_schedule_{schedule['_id']}",
                        progress=100,
                        message=f"Completed: {generated_count}/{total_students} reports generated"
                    )
                    
                    logger.info(f"Completed scheduled report generation: {generated_count}/{total_students} reports")
                    
                except Exception as schedule_error:
                    # Mark as failed
                    await report_schedules_collection.update_one(
                        {"_id": schedule["_id"]},
                        {
                            "$set": {
                                "status": "failed",
                                "error_message": str(schedule_error),
                                "updated_at": datetime.utcnow()
                            }
                        }
                    )
                    
                    logger.error(f"Error processing scheduled report {schedule['_id']}: {schedule_error}")
                    continue
            
        except Exception as e:
            logger.error(f"Error in scheduled report processing: {e}")
    
    @staticmethod
    async def check_exam_completion_and_trigger_reports(
        exam_id: str,
        exams_collection: Any,
        exam_results_collection: Any,
        report_schedules_collection: Any,
        websocket_manager: WebSocketManager
    ):
        """Check if an exam is complete and trigger scheduled reports early if needed"""
        try:
            # Get exam details
            exam = await exams_collection.find_one({"_id": ObjectId(exam_id)})
            if not exam:
                return
            
            # Count total students and results
            total_students_cursor = exam_results_collection.find({"exam_id": exam_id})
            total_results = await exam_results_collection.count_documents({"exam_id": exam_id})
            
            # Get class student count for comparison
            from ..db import get_student_collection
            students_collection = get_student_collection()
            class_student_count = await students_collection.count_documents({"class_id": exam["class_id"]})
            
            # Calculate completion percentage
            completion_percentage = (total_results / class_student_count * 100) if class_student_count > 0 else 0
            
            # If exam is substantially complete (>80%), trigger early report generation
            if completion_percentage >= 80:
                # Find related scheduled reports
                related_schedules = []
                async for schedule in report_schedules_collection.find({
                    "exam_trigger_id": exam_id,
                    "status": "scheduled"
                }):
                    related_schedules.append(schedule)
                
                # Trigger early generation for progress reports
                for schedule in related_schedules:
                    if schedule["report_type"] == "progress_report":
                        # Update schedule to generate now
                        await report_schedules_collection.update_one(
                            {"_id": schedule["_id"]},
                            {
                                "$set": {
                                    "scheduled_generation_date": datetime.utcnow(),
                                    "updated_at": datetime.utcnow(),
                                    "early_trigger_reason": f"Exam {completion_percentage:.0f}% complete"
                                }
                            }
                        )
                        
                        logger.info(f"Triggered early report generation for schedule {schedule['_id']} - {completion_percentage:.0f}% exam completion")
            
        except Exception as e:
            logger.error(f"Error checking exam completion for report triggers: {e}")
    
    @staticmethod
    async def get_exam_schedule_summary(
        exam_schedules_collection: Any,
        report_schedules_collection: Any,
        exams_collection: Any,
        branch_id: Optional[str] = None,
        date_range_days: int = 30
    ) -> Dict[str, Any]:
        """Get summary of upcoming exam schedules and report generation"""
        try:
            current_time = datetime.utcnow()
            end_date = current_time + timedelta(days=date_range_days)
            
            # Build query
            query = {
                "scheduled_date": {"$gte": current_time, "$lte": end_date}
            }
            if branch_id:
                query["branch_id"] = branch_id
            
            # Get upcoming exam schedules
            upcoming_exams = []
            async for schedule in exam_schedules_collection.find(query).sort("scheduled_date", 1):
                # Get exam details
                exam = await exams_collection.find_one({"_id": ObjectId(schedule["exam_id"])})
                
                exam_info = {
                    "schedule_id": str(schedule["_id"]),
                    "exam_id": schedule["exam_id"],
                    "exam_name": exam["name"] if exam else "Unknown",
                    "subject_id": exam["subject_id"] if exam else None,
                    "class_id": exam["class_id"] if exam else None,
                    "scheduled_date": schedule["scheduled_date"],
                    "duration_minutes": schedule["duration_minutes"],
                    "room_number": schedule.get("room_number"),
                    "is_confirmed": schedule["is_confirmed"],
                    "total_marks": exam["total_marks"] if exam else 0
                }
                upcoming_exams.append(exam_info)
            
            # Get upcoming report generations
            report_query = {
                "scheduled_generation_date": {"$gte": current_time, "$lte": end_date},
                "status": {"$in": ["scheduled", "generating"]}
            }
            if branch_id:
                report_query["branch_id"] = branch_id
            
            upcoming_reports = []
            async for schedule in report_schedules_collection.find(report_query).sort("scheduled_generation_date", 1):
                report_info = {
                    "schedule_id": str(schedule["_id"]),
                    "class_id": schedule["class_id"],
                    "report_type": schedule["report_type"],
                    "scheduled_date": schedule["scheduled_generation_date"],
                    "status": schedule["status"],
                    "auto_publish": schedule.get("auto_publish_to_parents", False),
                    "progress": f"{schedule.get('reports_generated', 0)}/{schedule.get('total_students', 0)}",
                    "exam_trigger": schedule.get("exam_trigger_id") is not None
                }
                upcoming_reports.append(report_info)
            
            return {
                "upcoming_exams": upcoming_exams,
                "upcoming_reports": upcoming_reports,
                "total_exams": len(upcoming_exams),
                "total_reports": len(upcoming_reports),
                "date_range": {
                    "start": current_time.isoformat(),
                    "end": end_date.isoformat(),
                    "days": date_range_days
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting exam schedule summary: {e}")
            return {
                "upcoming_exams": [],
                "upcoming_reports": [],
                "total_exams": 0,
                "total_reports": 0,
                "error": str(e)
            }