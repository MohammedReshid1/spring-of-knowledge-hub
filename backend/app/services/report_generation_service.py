from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from bson import ObjectId
from fastapi import HTTPException, status
import logging
import asyncio
from dataclasses import dataclass
from enum import Enum

from ..models.exam import (
    ExamResult, Exam, ReportCard, ReportCardCreate, ReportCardTemplate,
    StudentTranscript, BulkReportGeneration, BulkReportGenerationCreate,
    SubjectGrade, TermGrades, GradeAnalytics, ReportCardStatus
)
from ..models.student import Student
from ..models.parent import Parent
from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity

logger = logging.getLogger(__name__)

class ReportType(str, Enum):
    TERM_REPORT = "term_report"
    PROGRESS_REPORT = "progress_report" 
    SUBJECT_REPORT = "subject_report"
    COMPREHENSIVE_REPORT = "comprehensive_report"
    PARENT_SUMMARY = "parent_summary"

class ReportStatus(str, Enum):
    PENDING = "pending"
    GENERATING = "generating"
    COMPLETED = "completed"
    FAILED = "failed"
    PUBLISHED = "published"

@dataclass
class ReportGenerationRequest:
    student_id: str
    report_type: ReportType
    academic_year: str
    term: str
    class_id: Optional[str] = None
    subject_ids: Optional[List[str]] = None
    include_parent_portal: bool = True
    auto_publish: bool = False
    requested_by: str = None

class ReportGenerationService:
    """Service for automated report card generation from exam results"""
    
    @staticmethod
    async def generate_student_report(
        request: ReportGenerationRequest,
        students_collection: Any,
        exams_collection: Any,
        exam_results_collection: Any,
        parents_collection: Any,
        classes_collection: Any,
        reports_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Dict[str, Any]:
        """Generate comprehensive report card for a student"""
        audit_logger = get_audit_logger()
        
        try:
            # Get student information
            student = await students_collection.find_one({"_id": ObjectId(request.student_id)})
            if not student:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Student not found"
                )
            
            # Get class information
            class_info = None
            if request.class_id or student.get("class_id"):
                class_id = request.class_id or student.get("class_id")
                class_info = await classes_collection.find_one({"_id": ObjectId(class_id)})
            
            # Get all exam results for the student in specified term
            exam_results = await ReportGenerationService._get_student_exam_results(
                request.student_id,
                request.academic_year,
                request.term,
                exams_collection,
                exam_results_collection,
                request.subject_ids
            )
            
            # Calculate academic metrics
            academic_summary = await ReportGenerationService._calculate_academic_summary(
                exam_results, exams_collection
            )
            
            # Generate subject-wise performance
            subject_performance = await ReportGenerationService._generate_subject_performance(
                exam_results, exams_collection
            )
            
            # Get grading comments and recommendations
            performance_analysis = ReportGenerationService._analyze_performance(
                academic_summary, subject_performance
            )
            
            # Generate report data
            report_data = {
                "report_id": str(ObjectId()),
                "student_id": request.student_id,
                "student_info": {
                    "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                    "student_id": student.get("student_id"),
                    "class": class_info.get("class_name") if class_info else "N/A",
                    "grade_level": student.get("grade_level"),
                    "branch_id": student.get("branch_id")
                },
                "academic_period": {
                    "academic_year": request.academic_year,
                    "term": request.term,
                    "report_date": datetime.utcnow()
                },
                "academic_summary": academic_summary,
                "subject_performance": subject_performance,
                "performance_analysis": performance_analysis,
                "exam_results_count": len(exam_results),
                "report_type": request.report_type.value,
                "status": ReportStatus.COMPLETED.value,
                "generated_by": request.requested_by,
                "generated_at": datetime.utcnow(),
                "parent_portal_ready": request.include_parent_portal
            }
            
            # Save report to database
            result = await reports_collection.insert_one(report_data)
            report_id = str(result.inserted_id)
            report_data["id"] = report_id
            
            # Publish to parent portal if requested
            if request.include_parent_portal:
                await ReportGenerationService._publish_to_parent_portal(
                    request.student_id,
                    report_data,
                    students_collection,
                    parents_collection,
                    websocket_manager
                )
            
            # Log report generation
            await audit_logger.log_user_action(
                user_id=request.requested_by,
                action=AuditAction.CREATE,
                resource_type="student_report",
                resource_id=report_id,
                details={
                    "student_id": request.student_id,
                    "report_type": request.report_type.value,
                    "academic_year": request.academic_year,
                    "term": request.term,
                    "subjects_count": len(subject_performance),
                    "overall_percentage": academic_summary.get("overall_percentage")
                },
                severity=AuditSeverity.INFO
            )
            
            # Real-time notification
            if websocket_manager:
                await websocket_manager.broadcast_to_user(
                    request.requested_by,
                    {
                        "type": "report_generated",
                        "data": {
                            "report_id": report_id,
                            "student_name": report_data["student_info"]["name"],
                            "report_type": request.report_type.value,
                            "status": "completed"
                        }
                    }
                )
            
            return {
                "success": True,
                "report_id": report_id,
                "report_data": report_data,
                "message": "Report generated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error generating student report: {e}")
            await audit_logger.log_system_event(
                event_type="report_generation_failed",
                component="report_generation_service",
                details={
                    "student_id": request.student_id,
                    "error": str(e),
                    "requested_by": request.requested_by
                },
                severity=AuditSeverity.ERROR
            )
            raise
    
    @staticmethod
    async def _get_student_exam_results(
        student_id: str,
        academic_year: str,
        term: str,
        exams_collection: Any,
        exam_results_collection: Any,
        subject_ids: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """Get all exam results for a student in specified period"""
        
        # Build exam filter
        exam_filter = {
            "academic_year": academic_year,
            "term": term,
            "is_active": True
        }
        
        if subject_ids:
            exam_filter["subject_id"] = {"$in": subject_ids}
        
        # Get all exams for the period
        exams = await exams_collection.find(exam_filter).to_list(None)
        exam_ids = [str(exam["_id"]) for exam in exams]
        
        if not exam_ids:
            return []
        
        # Get results for this student
        results_cursor = exam_results_collection.find({
            "student_id": student_id,
            "exam_id": {"$in": exam_ids}
        })
        
        results = []
        async for result in results_cursor:
            # Find corresponding exam
            exam = next((e for e in exams if str(e["_id"]) == result["exam_id"]), None)
            if exam:
                result_data = {
                    **result,
                    "exam_info": {
                        "name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "exam_type": exam["exam_type"],
                        "total_marks": exam["total_marks"],
                        "passing_marks": exam["passing_marks"],
                        "exam_date": exam["exam_date"]
                    }
                }
                results.append(result_data)
        
        return results
    
    @staticmethod
    async def _calculate_academic_summary(
        exam_results: List[Dict[str, Any]],
        exams_collection: Any
    ) -> Dict[str, Any]:
        """Calculate overall academic performance summary"""
        
        if not exam_results:
            return {
                "total_exams": 0,
                "exams_appeared": 0,
                "exams_passed": 0,
                "exams_failed": 0,
                "overall_percentage": 0,
                "overall_grade": "N/A",
                "total_marks_obtained": 0,
                "total_marks_possible": 0,
                "pass_rate": 0
            }
        
        appeared_results = [r for r in exam_results if r.get("attendance_status") == "present"]
        passed_results = [r for r in appeared_results if r.get("status") == "pass"]
        
        total_marks_obtained = sum(r.get("marks_obtained", 0) for r in appeared_results)
        total_marks_possible = sum(r.get("exam_info", {}).get("total_marks", 0) for r in appeared_results)
        
        overall_percentage = (total_marks_obtained / total_marks_possible * 100) if total_marks_possible > 0 else 0
        
        # Determine overall grade
        overall_grade = ReportGenerationService._calculate_overall_grade(overall_percentage)
        
        return {
            "total_exams": len(exam_results),
            "exams_appeared": len(appeared_results),
            "exams_passed": len(passed_results),
            "exams_failed": len(appeared_results) - len(passed_results),
            "overall_percentage": round(overall_percentage, 2),
            "overall_grade": overall_grade,
            "total_marks_obtained": total_marks_obtained,
            "total_marks_possible": total_marks_possible,
            "pass_rate": round((len(passed_results) / len(appeared_results) * 100), 2) if appeared_results else 0
        }
    
    @staticmethod
    async def _generate_subject_performance(
        exam_results: List[Dict[str, Any]],
        exams_collection: Any
    ) -> List[Dict[str, Any]]:
        """Generate subject-wise performance analysis"""
        
        # Group results by subject
        subject_groups = {}
        for result in exam_results:
            subject_id = result.get("exam_info", {}).get("subject_id")
            if subject_id:
                if subject_id not in subject_groups:
                    subject_groups[subject_id] = []
                subject_groups[subject_id].append(result)
        
        subject_performance = []
        for subject_id, subject_results in subject_groups.items():
            appeared_results = [r for r in subject_results if r.get("attendance_status") == "present"]
            
            if not appeared_results:
                continue
            
            total_marks = sum(r.get("marks_obtained", 0) for r in appeared_results)
            possible_marks = sum(r.get("exam_info", {}).get("total_marks", 0) for r in appeared_results)
            percentage = (total_marks / possible_marks * 100) if possible_marks > 0 else 0
            
            passed_count = len([r for r in appeared_results if r.get("status") == "pass"])
            
            # Get exam types for this subject
            exam_types = list(set(r.get("exam_info", {}).get("exam_type") for r in appeared_results))
            
            subject_performance.append({
                "subject_id": subject_id,
                "total_exams": len(subject_results),
                "exams_appeared": len(appeared_results),
                "exams_passed": passed_count,
                "percentage": round(percentage, 2),
                "grade": ReportGenerationService._calculate_overall_grade(percentage),
                "total_marks": total_marks,
                "possible_marks": possible_marks,
                "exam_types": exam_types,
                "strongest_area": max(appeared_results, key=lambda x: x.get("percentage", 0), default={}).get("exam_info", {}).get("exam_type"),
                "needs_improvement": percentage < 60
            })
        
        return sorted(subject_performance, key=lambda x: x["percentage"], reverse=True)
    
    @staticmethod
    def _analyze_performance(
        academic_summary: Dict[str, Any],
        subject_performance: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze overall performance and generate insights"""
        
        overall_percentage = academic_summary.get("overall_percentage", 0)
        
        # Performance level
        if overall_percentage >= 90:
            performance_level = "Excellent"
            performance_comment = "Outstanding academic performance across all subjects."
        elif overall_percentage >= 80:
            performance_level = "Very Good"
            performance_comment = "Strong academic performance with consistent results."
        elif overall_percentage >= 70:
            performance_level = "Good"
            performance_comment = "Good academic performance with room for improvement."
        elif overall_percentage >= 60:
            performance_level = "Satisfactory"
            performance_comment = "Satisfactory performance, focus needed on weaker areas."
        else:
            performance_level = "Needs Improvement"
            performance_comment = "Significant improvement needed across multiple subjects."
        
        # Strong subjects
        strong_subjects = [s for s in subject_performance if s["percentage"] >= 80][:3]
        
        # Weak subjects
        weak_subjects = [s for s in subject_performance if s["percentage"] < 60]
        
        # Recommendations
        recommendations = []
        if weak_subjects:
            recommendations.extend([
                f"Focus on improving performance in {s['subject_id']}" for s in weak_subjects[:2]
            ])
        
        if academic_summary.get("pass_rate", 0) < 80:
            recommendations.append("Consistent study schedule and regular practice recommended")
        
        if not recommendations:
            recommendations.append("Continue excellent work and maintain current performance level")
        
        return {
            "performance_level": performance_level,
            "performance_comment": performance_comment,
            "strong_subjects": [s["subject_id"] for s in strong_subjects],
            "weak_subjects": [s["subject_id"] for s in weak_subjects],
            "recommendations": recommendations,
            "improvement_areas": len(weak_subjects),
            "consistent_performer": len([s for s in subject_performance if 70 <= s["percentage"] <= 85]) >= len(subject_performance) * 0.7
        }
    
    @staticmethod
    def _calculate_overall_grade(percentage: float) -> str:
        """Calculate overall grade from percentage"""
        if percentage >= 90:
            return "A+"
        elif percentage >= 85:
            return "A"
        elif percentage >= 80:
            return "A-"
        elif percentage >= 75:
            return "B+"
        elif percentage >= 70:
            return "B"
        elif percentage >= 65:
            return "B-"
        elif percentage >= 60:
            return "C+"
        elif percentage >= 55:
            return "C"
        elif percentage >= 50:
            return "C-"
        else:
            return "F"
    
    @staticmethod
    async def _publish_to_parent_portal(
        student_id: str,
        report_data: Dict[str, Any],
        students_collection: Any,
        parents_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> None:
        """Publish report to parent portal"""
        
        try:
            # Find parent for this student
            parent = await parents_collection.find_one({"student_ids": student_id})
            
            if parent:
                # Create parent portal entry
                portal_data = {
                    "type": "academic_report",
                    "student_id": student_id,
                    "report_id": report_data["report_id"],
                    "title": f"{report_data['academic_period']['term']} Report - {report_data['student_info']['name']}",
                    "summary": {
                        "overall_percentage": report_data["academic_summary"]["overall_percentage"],
                        "overall_grade": report_data["academic_summary"]["overall_grade"],
                        "performance_level": report_data["performance_analysis"]["performance_level"]
                    },
                    "published_at": datetime.utcnow(),
                    "is_new": True,
                    "parent_viewed": False
                }
                
                # Add to parent's portal notifications
                await parents_collection.update_one(
                    {"_id": parent["_id"]},
                    {
                        "$push": {"portal_notifications": portal_data},
                        "$set": {"last_notification_date": datetime.utcnow()}
                    }
                )
                
                # Send real-time notification to parent
                if websocket_manager and parent.get("user_id"):
                    await websocket_manager.broadcast_to_user(
                        parent["user_id"],
                        {
                            "type": "new_report_available",
                            "data": {
                                "student_name": report_data["student_info"]["name"],
                                "report_type": report_data["report_type"],
                                "overall_grade": report_data["academic_summary"]["overall_grade"],
                                "report_id": report_data["report_id"]
                            }
                        }
                    )
                
                logger.info(f"Report published to parent portal for student {student_id}")
                
        except Exception as e:
            logger.error(f"Error publishing to parent portal: {e}")
    
    @staticmethod
    async def generate_batch_reports(
        class_id: str,
        academic_year: str,
        term: str,
        report_type: ReportType,
        requested_by: str,
        students_collection: Any,
        exams_collection: Any,
        exam_results_collection: Any,
        parents_collection: Any,
        classes_collection: Any,
        reports_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Dict[str, Any]:
        """Generate reports for all students in a class"""
        
        try:
            # Get all students in the class
            students = await students_collection.find({"class_id": class_id}).to_list(None)
            
            total_students = len(students)
            successful_reports = 0
            failed_reports = 0
            
            results = []
            
            for student in students:
                try:
                    request = ReportGenerationRequest(
                        student_id=str(student["_id"]),
                        report_type=report_type,
                        academic_year=academic_year,
                        term=term,
                        class_id=class_id,
                        include_parent_portal=True,
                        requested_by=requested_by
                    )
                    
                    result = await ReportGenerationService.generate_student_report(
                        request,
                        students_collection,
                        exams_collection,
                        exam_results_collection,
                        parents_collection,
                        classes_collection,
                        reports_collection,
                        websocket_manager
                    )
                    
                    successful_reports += 1
                    results.append({
                        "student_id": str(student["_id"]),
                        "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                        "status": "success",
                        "report_id": result["report_id"]
                    })
                    
                except Exception as e:
                    failed_reports += 1
                    results.append({
                        "student_id": str(student["_id"]),
                        "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                        "status": "failed",
                        "error": str(e)
                    })
                    logger.error(f"Failed to generate report for student {student['_id']}: {e}")
            
            return {
                "total_students": total_students,
                "successful_reports": successful_reports,
                "failed_reports": failed_reports,
                "success_rate": round((successful_reports / total_students * 100), 2) if total_students > 0 else 0,
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error in batch report generation: {e}")
            raise

    # New enhanced methods for comprehensive report generation
    @staticmethod
    async def generate_enhanced_report_card(
        report_data: ReportCardCreate,
        report_cards_collection: Any,
        templates_collection: Any,
        exams_collection: Any,
        exam_results_collection: Any,
        students_collection: Any,
        classes_collection: Any,
        subjects_collection: Any,
        grading_scales_collection: Any,
        user_id: str,
        branch_id: Optional[str] = None
    ) -> ReportCard:
        """Generate enhanced report card with templates and comprehensive grading."""
        audit_logger = get_audit_logger()
        
        try:
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(report_data.student_id)})
            if not student:
                raise HTTPException(status_code=404, detail="Student not found")
            
            # Get class info
            class_info = await classes_collection.find_one({"_id": ObjectId(report_data.class_id)})
            if not class_info:
                raise HTTPException(status_code=404, detail="Class not found")
            
            # Get template
            template = await templates_collection.find_one({"_id": ObjectId(report_data.template_id)})
            if not template:
                raise HTTPException(status_code=404, detail="Template not found")
            
            # Calculate subject grades using existing logic but enhanced
            subject_grades = await ReportGenerationService._calculate_enhanced_subject_grades(
                report_data.student_id,
                report_data.class_id,
                report_data.academic_year,
                report_data.term,
                exams_collection,
                exam_results_collection,
                subjects_collection,
                grading_scales_collection,
                branch_id
            )
            
            # Calculate term grades
            term_grades = await ReportGenerationService._calculate_enhanced_term_grades(
                subject_grades,
                report_data.academic_year,
                report_data.term,
                grading_scales_collection,
                branch_id
            )
            
            # Get parent IDs
            parent_ids = []
            if student.get("parent_guardian_id"):
                parent_ids.append(student["parent_guardian_id"])
            
            # Create report card
            now = datetime.utcnow()
            report_card_data = {
                "student_id": report_data.student_id,
                "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "class_id": report_data.class_id,
                "class_name": class_info["name"],
                "section": class_info.get("section", ""),
                "academic_year": report_data.academic_year,
                "term": report_data.term,
                "template_id": report_data.template_id,
                "grades": term_grades,
                "teacher_comments": report_data.teacher_comments,
                "principal_comments": report_data.principal_comments,
                "behavior_grades": report_data.behavior_grades,
                "extracurricular_activities": report_data.extracurricular_activities,
                "generated_at": now,
                "generated_by": user_id,
                "status": ReportCardStatus.DRAFT,
                "branch_id": branch_id,
                "parent_ids": parent_ids
            }
            
            result = await report_cards_collection.insert_one(report_card_data)
            report_card_data["id"] = str(result.inserted_id)
            
            # Log audit
            await audit_logger.log_user_action(
                user_id=user_id,
                action=AuditAction.CREATE,
                resource_type="enhanced_report_card",
                resource_id=report_card_data["id"],
                details={
                    "student_id": report_data.student_id,
                    "class_id": report_data.class_id,
                    "academic_year": report_data.academic_year,
                    "term": report_data.term,
                    "overall_gpa": term_grades.get("overall_gpa"),
                    "overall_percentage": term_grades.get("overall_percentage")
                },
                severity=AuditSeverity.INFO
            )
            
            return ReportCard(**report_card_data)
            
        except Exception as e:
            logger.error(f"Error generating enhanced report card: {e}")
            await audit_logger.log_system_event(
                event_type="enhanced_report_generation_failed",
                component="report_generation_service",
                details={
                    "student_id": report_data.student_id,
                    "error": str(e)
                },
                severity=AuditSeverity.ERROR
            )
            raise

    @staticmethod
    async def _calculate_enhanced_subject_grades(
        student_id: str,
        class_id: str,
        academic_year: str,
        term: str,
        exams_collection: Any,
        exam_results_collection: Any,
        subjects_collection: Any,
        grading_scales_collection: Any,
        branch_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Calculate enhanced subject grades with detailed analysis."""
        
        # Get all exams for the class in the specified term/academic year
        exam_filter = {
            "class_id": class_id,
            "academic_year": academic_year,
            "term": term,
            "is_active": True
        }
        if branch_id:
            exam_filter["branch_id"] = branch_id
        
        exams = []
        async for exam in exams_collection.find(exam_filter):
            exams.append(exam)
        
        # Group exams by subject
        subjects_exams = {}
        for exam in exams:
            subject_id = exam["subject_id"]
            if subject_id not in subjects_exams:
                subjects_exams[subject_id] = []
            subjects_exams[subject_id].append(exam)
        
        # Get grading scales
        grading_scales = []
        async for scale in grading_scales_collection.find(
            {"branch_id": branch_id} if branch_id else {}
        ):
            grading_scales.append(scale)
        grading_scales.sort(key=lambda x: x["min_percentage"], reverse=True)
        
        subject_grades = []
        
        for subject_id, subject_exams in subjects_exams.items():
            # Get subject info
            subject_info = await subjects_collection.find_one({"_id": ObjectId(subject_id)})
            if not subject_info:
                continue
            
            # Get exam results for this student in this subject
            exam_results = []
            total_marks_obtained = 0
            total_marks_possible = 0
            
            for exam in subject_exams:
                exam_id = str(exam["_id"])
                result = await exam_results_collection.find_one({
                    "exam_id": exam_id,
                    "student_id": student_id
                })
                
                exam_data = {
                    "exam_id": exam_id,
                    "exam_name": exam["name"],
                    "exam_type": exam["exam_type"],
                    "total_marks": exam["total_marks"],
                    "marks_obtained": result["marks_obtained"] if result else 0,
                    "percentage": (result["marks_obtained"] / exam["total_marks"] * 100) if result and exam["total_marks"] > 0 else 0,
                    "grade": result.get("grade", "N/A") if result else "N/A",
                    "status": result.get("status", "absent") if result else "absent"
                }
                exam_results.append(exam_data)
                
                if result:
                    total_marks_obtained += result["marks_obtained"]
                total_marks_possible += exam["total_marks"]
            
            # Calculate overall percentage and grade for subject
            percentage = (total_marks_obtained / total_marks_possible * 100) if total_marks_possible > 0 else 0
            letter_grade = ReportGenerationService._calculate_grade_from_scales(percentage, grading_scales)
            grade_points = ReportGenerationService._calculate_grade_points_from_scales(percentage, grading_scales)
            
            subject_grade = {
                "subject_id": subject_id,
                "subject_name": subject_info["name"],
                "teacher_id": subject_exams[0].get("teacher_id", ""),
                "teacher_name": "Not Assigned",  # Would fetch from teachers collection
                "exams": exam_results,
                "total_marks_obtained": total_marks_obtained,
                "total_marks_possible": total_marks_possible,
                "percentage": round(percentage, 2),
                "letter_grade": letter_grade,
                "grade_points": grade_points
            }
            subject_grades.append(subject_grade)
        
        return subject_grades

    @staticmethod
    async def _calculate_enhanced_term_grades(
        subject_grades: List[Dict[str, Any]],
        academic_year: str,
        term: str,
        grading_scales_collection: Any,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate enhanced term grades with comprehensive statistics."""
        
        if not subject_grades:
            return {
                "term": term,
                "academic_year": academic_year,
                "subjects": [],
                "overall_percentage": 0,
                "overall_grade": "N/A",
                "overall_gpa": 0,
                "total_marks_obtained": 0,
                "total_marks_possible": 0
            }
        
        # Calculate overall totals
        total_marks_obtained = sum(sg["total_marks_obtained"] for sg in subject_grades)
        total_marks_possible = sum(sg["total_marks_possible"] for sg in subject_grades)
        overall_percentage = (total_marks_obtained / total_marks_possible * 100) if total_marks_possible > 0 else 0
        
        # Calculate GPA
        total_grade_points = sum(sg["grade_points"] for sg in subject_grades)
        overall_gpa = total_grade_points / len(subject_grades) if subject_grades else 0
        
        # Get overall grade
        grading_scales = []
        async for scale in grading_scales_collection.find(
            {"branch_id": branch_id} if branch_id else {}
        ):
            grading_scales.append(scale)
        
        overall_grade = ReportGenerationService._calculate_grade_from_scales(overall_percentage, grading_scales)
        
        return {
            "term": term,
            "academic_year": academic_year,
            "subjects": subject_grades,
            "overall_percentage": round(overall_percentage, 2),
            "overall_grade": overall_grade,
            "overall_gpa": round(overall_gpa, 2),
            "total_marks_obtained": total_marks_obtained,
            "total_marks_possible": total_marks_possible
        }

    @staticmethod
    def _calculate_grade_from_scales(percentage: float, grading_scales: List[dict]) -> str:
        """Calculate letter grade based on percentage and grading scales."""
        for scale in grading_scales:
            if percentage >= scale["min_percentage"]:
                return scale["letter_grade"]
        return "F"

    @staticmethod
    def _calculate_grade_points_from_scales(percentage: float, grading_scales: List[dict]) -> float:
        """Calculate grade points based on percentage and grading scales."""
        for scale in grading_scales:
            if percentage >= scale["min_percentage"]:
                return scale["grade_point"]
        return 0.0

    @staticmethod
    async def generate_bulk_enhanced_reports(
        bulk_data: BulkReportGenerationCreate,
        bulk_generations_collection: Any,
        report_cards_collection: Any,
        templates_collection: Any,
        students_collection: Any,
        classes_collection: Any,
        exams_collection: Any,
        exam_results_collection: Any,
        subjects_collection: Any,
        grading_scales_collection: Any,
        websocket_manager: WebSocketManager,
        user_id: str,
        branch_id: Optional[str] = None
    ) -> BulkReportGeneration:
        """Generate enhanced report cards for multiple students in bulk."""
        audit_logger = get_audit_logger()
        
        try:
            # Get all students in the specified classes
            students = []
            for class_id in bulk_data.class_ids:
                async for student in students_collection.find({
                    "class_id": class_id,
                    **({"branch_id": branch_id} if branch_id else {})
                }):
                    students.append(student)
            
            # Create bulk generation record
            now = datetime.utcnow()
            bulk_generation_data = {
                "name": bulk_data.name,
                "description": bulk_data.description,
                "class_ids": bulk_data.class_ids,
                "academic_year": bulk_data.academic_year,
                "term": bulk_data.term,
                "template_id": bulk_data.template_id,
                "include_unpublished_grades": bulk_data.include_unpublished_grades,
                "auto_publish": bulk_data.auto_publish,
                "auto_send_to_parents": bulk_data.auto_send_to_parents,
                "total_students": len(students),
                "processed_students": 0,
                "successful_reports": 0,
                "failed_reports": 0,
                "status": "processing",
                "error_details": [],
                "started_at": now,
                "created_at": now,
                "created_by": user_id,
                "branch_id": branch_id
            }
            
            result = await bulk_generations_collection.insert_one(bulk_generation_data)
            bulk_id = str(result.inserted_id)
            
            # Process students
            successful_reports = 0
            failed_reports = 0
            error_details = []
            
            for i, student in enumerate(students):
                try:
                    # Create report card data
                    report_create = ReportCardCreate(
                        student_id=str(student["_id"]),
                        class_id=student["class_id"],
                        academic_year=bulk_data.academic_year,
                        term=bulk_data.term,
                        template_id=bulk_data.template_id
                    )
                    
                    # Generate enhanced report card
                    report_card = await ReportGenerationService.generate_enhanced_report_card(
                        report_create,
                        report_cards_collection,
                        templates_collection,
                        exams_collection,
                        exam_results_collection,
                        students_collection,
                        classes_collection,
                        subjects_collection,
                        grading_scales_collection,
                        user_id,
                        branch_id
                    )
                    
                    successful_reports += 1
                    
                    # Auto-publish if requested
                    if bulk_data.auto_publish:
                        await ReportGenerationService.publish_report_card(
                            report_card.id,
                            report_cards_collection,
                            user_id
                        )
                    
                except Exception as e:
                    failed_reports += 1
                    error_details.append({
                        "student_id": str(student["_id"]),
                        "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                        "error": str(e)
                    })
                
                # Update progress
                processed_students = i + 1
                await bulk_generations_collection.update_one(
                    {"_id": ObjectId(bulk_id)},
                    {
                        "$set": {
                            "processed_students": processed_students,
                            "successful_reports": successful_reports,
                            "failed_reports": failed_reports,
                            "error_details": error_details
                        }
                    }
                )
                
                # Send progress update
                if websocket_manager:
                    await websocket_manager.broadcast_to_user(
                        user_id,
                        {
                            "type": "bulk_report_progress",
                            "bulk_id": bulk_id,
                            "progress": {
                                "processed": processed_students,
                                "total": len(students),
                                "successful": successful_reports,
                                "failed": failed_reports,
                                "percentage": round((processed_students / len(students)) * 100, 1)
                            }
                        }
                    )
            
            # Mark as completed
            status = "completed" if failed_reports == 0 else "completed_with_errors"
            await bulk_generations_collection.update_one(
                {"_id": ObjectId(bulk_id)},
                {
                    "$set": {
                        "status": status,
                        "completed_at": datetime.utcnow(),
                        "processed_students": len(students),
                        "successful_reports": successful_reports,
                        "failed_reports": failed_reports,
                        "error_details": error_details
                    }
                }
            )
            
            # Get final record
            updated_record = await bulk_generations_collection.find_one({"_id": ObjectId(bulk_id)})
            bulk_data_final = {k: v for k, v in updated_record.items() if k != "_id"}
            bulk_data_final["id"] = bulk_id
            
            return BulkReportGeneration(**bulk_data_final)
            
        except Exception as e:
            logger.error(f"Error in bulk enhanced report generation: {e}")
            await audit_logger.log_system_event(
                event_type="bulk_enhanced_report_generation_failed",
                component="report_generation_service",
                details={"error": str(e)},
                severity=AuditSeverity.ERROR
            )
            raise

    @staticmethod
    async def publish_report_card(
        report_card_id: str,
        report_cards_collection: Any,
        user_id: str
    ) -> bool:
        """Publish a report card to make it visible to parents."""
        try:
            now = datetime.utcnow()
            result = await report_cards_collection.update_one(
                {"_id": ObjectId(report_card_id)},
                {
                    "$set": {
                        "status": ReportCardStatus.PUBLISHED,
                        "published_at": now,
                        "published_by": user_id
                    }
                }
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Error publishing report card {report_card_id}: {e}")
            raise