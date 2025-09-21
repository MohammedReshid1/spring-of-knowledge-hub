"""
Grade Calculation and Transcript Management Service
Handles grade calculations, GPA calculations, transcripts, and grade analytics.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, date
from bson import ObjectId
import statistics
import asyncio

from ..models.exam import (
    StudentTranscript, GradeAnalytics, TermGrades, SubjectGrade,
    ReportCardStatus, GradePointScale
)
from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity

logger = logging.getLogger(__name__)

class GradeCalculationService:
    """Service for grade calculations, GPA management, and transcript generation."""
    
    def __init__(self):
        self.audit_logger = get_audit_logger()
    
    async def calculate_student_gpa(
        self,
        student_id: str,
        academic_year: Optional[str] = None,
        term: Optional[str] = None,
        grading_scale: GradePointScale = GradePointScale.FOUR_POINT,
        exam_results_collection: Any = None,
        exams_collection: Any = None,
        grading_scales_collection: Any = None,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Calculate GPA for a student for specific period or overall."""
        try:
            # Build filter for exam results
            result_filter = {"student_id": student_id}
            
            # Get all exam results for the student
            results = []
            async for result in exam_results_collection.find(result_filter):
                # Get exam details
                exam = await exams_collection.find_one({"_id": ObjectId(result["exam_id"])})
                if exam:
                    # Apply academic year/term filters if specified
                    if academic_year and exam.get("academic_year") != academic_year:
                        continue
                    if term and exam.get("term") != term:
                        continue
                    if branch_id and exam.get("branch_id") != branch_id:
                        continue
                    
                    result_data = {
                        **result,
                        "exam_info": exam
                    }
                    results.append(result_data)
            
            if not results:
                return {
                    "student_id": student_id,
                    "academic_year": academic_year,
                    "term": term,
                    "gpa": 0.0,
                    "total_credit_hours": 0,
                    "total_grade_points": 0.0,
                    "total_courses": 0,
                    "grading_scale": grading_scale.value
                }
            
            # Get grading scales
            grading_scales = []
            async for scale in grading_scales_collection.find(
                {"branch_id": branch_id} if branch_id else {}
            ):
                grading_scales.append(scale)
            grading_scales.sort(key=lambda x: x["min_percentage"], reverse=True)
            
            # Group by subject to calculate subject-wise GPAs
            subject_grades = {}
            for result in results:
                exam = result["exam_info"]
                subject_id = exam["subject_id"]
                
                if subject_id not in subject_grades:
                    subject_grades[subject_id] = {
                        "results": [],
                        "total_marks": 0,
                        "total_possible": 0,
                        "credit_hours": exam.get("credit_hours", 3)  # Default 3 credits
                    }
                
                subject_grades[subject_id]["results"].append(result)
                if result.get("attendance_status") == "present":
                    subject_grades[subject_id]["total_marks"] += result.get("marks_obtained", 0)
                    subject_grades[subject_id]["total_possible"] += exam.get("total_marks", 0)
            
            # Calculate GPA
            total_grade_points = 0.0
            total_credit_hours = 0
            subject_gpas = []
            
            for subject_id, subject_data in subject_grades.items():
                if subject_data["total_possible"] > 0:
                    percentage = (subject_data["total_marks"] / subject_data["total_possible"]) * 100
                    grade_points = self._calculate_grade_points_from_percentage(percentage, grading_scales)
                    credit_hours = subject_data["credit_hours"]
                    
                    subject_gpas.append({
                        "subject_id": subject_id,
                        "percentage": round(percentage, 2),
                        "grade_points": grade_points,
                        "credit_hours": credit_hours,
                        "weighted_points": grade_points * credit_hours
                    })
                    
                    total_grade_points += grade_points * credit_hours
                    total_credit_hours += credit_hours
            
            overall_gpa = total_grade_points / total_credit_hours if total_credit_hours > 0 else 0.0
            
            return {
                "student_id": student_id,
                "academic_year": academic_year,
                "term": term,
                "gpa": round(overall_gpa, 2),
                "total_credit_hours": total_credit_hours,
                "total_grade_points": round(total_grade_points, 2),
                "total_courses": len(subject_gpas),
                "subject_gpas": subject_gpas,
                "grading_scale": grading_scale.value,
                "calculated_at": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error calculating GPA for student {student_id}: {e}")
            raise
    
    async def generate_student_transcript(
        self,
        student_id: str,
        academic_years: List[str],
        students_collection: Any,
        classes_collection: Any,
        report_cards_collection: Any,
        transcripts_collection: Any,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        user_id: str,
        branch_id: Optional[str] = None
    ) -> StudentTranscript:
        """Generate comprehensive transcript for a student."""
        try:
            # Get student info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Get class info
            class_info = await classes_collection.find_one({"_id": ObjectId(student["class_id"])})
            if not class_info:
                raise ValueError(f"Class not found: {student['class_id']}")
            
            # Get academic years data
            academic_years_data = []
            total_gpa_points = 0
            total_terms = 0
            total_percentage_points = 0
            total_credits = 0
            
            for academic_year in academic_years:
                # Get terms for this academic year
                terms = ["1st_term", "2nd_term", "3rd_term"]  # Standard terms
                
                for term in terms:
                    # Calculate GPA for this term
                    gpa_data = await self.calculate_student_gpa(
                        student_id,
                        academic_year,
                        term,
                        GradePointScale.FOUR_POINT,
                        exam_results_collection,
                        exams_collection,
                        grading_scales_collection,
                        branch_id
                    )
                    
                    if gpa_data["total_courses"] > 0:
                        # Create TermGrades object
                        term_grade_data = {
                            "term": term,
                            "academic_year": academic_year,
                            "subjects": [],
                            "overall_percentage": 0,
                            "overall_grade": "N/A",
                            "overall_gpa": gpa_data["gpa"],
                            "total_marks_obtained": 0,
                            "total_marks_possible": 0
                        }
                        
                        # Add subject details
                        for subject_gpa in gpa_data["subject_gpas"]:
                            subject_grade = {
                                "subject_id": subject_gpa["subject_id"],
                                "subject_name": f"Subject {subject_gpa['subject_id'][:8]}",  # Would fetch actual name
                                "teacher_id": "",
                                "teacher_name": "Not Assigned",
                                "exams": [],
                                "total_marks_obtained": 0,
                                "total_marks_possible": 0,
                                "percentage": subject_gpa["percentage"],
                                "letter_grade": self._get_letter_grade_from_points(subject_gpa["grade_points"]),
                                "grade_points": subject_gpa["grade_points"]
                            }
                            term_grade_data["subjects"].append(subject_grade)
                        
                        # Calculate overall percentage
                        if term_grade_data["subjects"]:
                            avg_percentage = sum(s["percentage"] for s in term_grade_data["subjects"]) / len(term_grade_data["subjects"])
                            term_grade_data["overall_percentage"] = round(avg_percentage, 2)
                            term_grade_data["overall_grade"] = self._get_letter_grade_from_percentage(avg_percentage)
                        
                        academic_years_data.append(term_grade_data)
                        
                        total_gpa_points += gpa_data["gpa"]
                        total_percentage_points += term_grade_data["overall_percentage"]
                        total_credits += gpa_data["total_credit_hours"]
                        total_terms += 1
            
            # Calculate cumulative statistics
            cumulative_gpa = total_gpa_points / total_terms if total_terms > 0 else 0
            cumulative_percentage = total_percentage_points / total_terms if total_terms > 0 else 0
            
            # Create transcript
            now = datetime.utcnow()
            transcript_data = {
                "student_id": student_id,
                "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "class_id": student["class_id"],
                "class_name": class_info["name"],
                "section": class_info.get("section", ""),
                "academic_years": academic_years_data,
                "cumulative_gpa": round(cumulative_gpa, 2),
                "cumulative_percentage": round(cumulative_percentage, 2),
                "total_credits": total_credits,
                "generated_at": now,
                "generated_by": user_id,
                "status": ReportCardStatus.DRAFT,
                "branch_id": branch_id
            }
            
            # Save transcript
            result = await transcripts_collection.insert_one(transcript_data)
            transcript_data["id"] = str(result.inserted_id)
            
            # Log audit
            await self.audit_logger.log_user_action(
                user_id=user_id,
                action=AuditAction.CREATE,
                resource_type="student_transcript",
                resource_id=transcript_data["id"],
                details={
                    "student_id": student_id,
                    "academic_years": academic_years,
                    "cumulative_gpa": cumulative_gpa,
                    "total_terms": total_terms
                },
                severity=AuditSeverity.INFO
            )
            
            return StudentTranscript(**transcript_data)
            
        except Exception as e:
            logger.error(f"Error generating transcript for student {student_id}: {e}")
            raise
    
    async def calculate_class_rankings(
        self,
        class_id: str,
        academic_year: str,
        term: str,
        students_collection: Any,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        branch_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Calculate class rankings based on GPA/percentage."""
        try:
            # Get all students in the class
            students = []
            async for student in students_collection.find({
                "class_id": class_id,
                **({"branch_id": branch_id} if branch_id else {})
            }):
                students.append(student)
            
            if not students:
                return []
            
            # Calculate GPA for each student
            student_performances = []
            for student in students:
                student_id = str(student["_id"])
                
                gpa_data = await self.calculate_student_gpa(
                    student_id,
                    academic_year,
                    term,
                    GradePointScale.FOUR_POINT,
                    exam_results_collection,
                    exams_collection,
                    grading_scales_collection,
                    branch_id
                )
                
                if gpa_data["total_courses"] > 0:
                    # Calculate overall percentage
                    overall_percentage = 0
                    if gpa_data["subject_gpas"]:
                        overall_percentage = sum(s["percentage"] for s in gpa_data["subject_gpas"]) / len(gpa_data["subject_gpas"])
                    
                    student_performances.append({
                        "student_id": student_id,
                        "student_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                        "gpa": gpa_data["gpa"],
                        "overall_percentage": round(overall_percentage, 2),
                        "total_courses": gpa_data["total_courses"],
                        "total_credit_hours": gpa_data["total_credit_hours"]
                    })
            
            # Sort by GPA descending, then by percentage
            student_performances.sort(key=lambda x: (x["gpa"], x["overall_percentage"]), reverse=True)
            
            # Add rankings
            for i, performance in enumerate(student_performances):
                performance["rank"] = i + 1
                performance["total_students"] = len(student_performances)
            
            return student_performances
            
        except Exception as e:
            logger.error(f"Error calculating class rankings: {e}")
            raise
    
    async def generate_grade_analytics(
        self,
        student_id: str,
        subject_id: Optional[str] = None,
        academic_year: Optional[str] = None,
        term: Optional[str] = None,
        exam_results_collection: Any = None,
        exams_collection: Any = None,
        analytics_collection: Any = None,
        branch_id: Optional[str] = None
    ) -> GradeAnalytics:
        """Generate comprehensive grade analytics for a student."""
        try:
            # Build filters
            exam_filter = {}
            if academic_year:
                exam_filter["academic_year"] = academic_year
            if term:
                exam_filter["term"] = term
            if subject_id:
                exam_filter["subject_id"] = subject_id
            if branch_id:
                exam_filter["branch_id"] = branch_id
            
            # Get historical grade data
            grade_trend = []
            results = []
            
            async for result in exam_results_collection.find({"student_id": student_id}):
                # Get exam details
                exam = await exams_collection.find_one({"_id": ObjectId(result["exam_id"])})
                if exam and self._matches_filter(exam, exam_filter):
                    result_data = {
                        **result,
                        "exam_info": exam
                    }
                    results.append(result_data)
                    
                    grade_trend.append({
                        "exam_name": exam["name"],
                        "exam_date": exam.get("exam_date").isoformat() if exam.get("exam_date") else None,
                        "exam_type": exam.get("exam_type"),
                        "subject_id": exam["subject_id"],
                        "percentage": result.get("percentage", 0),
                        "grade": result.get("grade", "N/A"),
                        "academic_year": exam["academic_year"],
                        "term": exam["term"]
                    })
            
            # Sort by date
            grade_trend.sort(key=lambda x: x["exam_date"] if x["exam_date"] else "")
            
            # Analyze performance trends
            improvement_areas = []
            strengths = []
            performance_prediction = None
            
            if grade_trend:
                recent_scores = [g["percentage"] for g in grade_trend[-5:]]  # Last 5 exams
                older_scores = [g["percentage"] for g in grade_trend[:-5]] if len(grade_trend) > 5 else []
                
                recent_avg = sum(recent_scores) / len(recent_scores) if recent_scores else 0
                older_avg = sum(older_scores) / len(older_scores) if older_scores else recent_avg
                
                # Trend analysis
                if recent_avg > older_avg + 5:
                    strengths.append("Improving performance trend")
                elif recent_avg < older_avg - 5:
                    improvement_areas.append("Declining performance trend - needs attention")
                
                # Performance level analysis
                if recent_avg < 60:
                    improvement_areas.extend(["Basic concepts understanding", "Regular practice needed"])
                elif recent_avg < 75:
                    improvement_areas.append("Advanced problem solving")
                
                if recent_avg >= 85:
                    strengths.extend(["Excellent understanding", "Consistent high performance"])
                elif recent_avg >= 75:
                    strengths.append("Good grasp of fundamentals")
                
                # Simple prediction based on trend
                if len(recent_scores) >= 3:
                    trend_slope = (recent_scores[-1] - recent_scores[0]) / len(recent_scores)
                    predicted_next = recent_scores[-1] + trend_slope
                    
                    performance_prediction = {
                        "predicted_percentage": max(0, min(100, round(predicted_next, 2))),
                        "confidence": "medium" if abs(trend_slope) < 2 else "high",
                        "trend_direction": "improving" if trend_slope > 0 else "declining" if trend_slope < 0 else "stable"
                    }
            
            # Calculate comparison to class average (placeholder)
            compared_to_class_average = 0.0  # Would calculate actual class average
            
            analytics_data = {
                "student_id": student_id,
                "subject_id": subject_id or "all_subjects",
                "academic_year": academic_year or "all_years",
                "term": term or "all_terms",
                "grade_trend": grade_trend,
                "performance_prediction": performance_prediction,
                "improvement_areas": improvement_areas,
                "strengths": strengths,
                "compared_to_class_average": compared_to_class_average,
                "generated_at": datetime.utcnow()
            }
            
            # Save analytics
            result = await analytics_collection.insert_one(analytics_data)
            analytics_data["id"] = str(result.inserted_id)
            
            return GradeAnalytics(**analytics_data)
            
        except Exception as e:
            logger.error(f"Error generating grade analytics: {e}")
            raise
    
    def _calculate_grade_points_from_percentage(self, percentage: float, grading_scales: List[dict]) -> float:
        """Calculate grade points from percentage using grading scales."""
        for scale in grading_scales:
            if percentage >= scale["min_percentage"]:
                return scale["grade_point"]
        return 0.0
    
    def _get_letter_grade_from_points(self, grade_points: float) -> str:
        """Convert grade points to letter grade."""
        if grade_points >= 4.0:
            return "A"
        elif grade_points >= 3.7:
            return "A-"
        elif grade_points >= 3.3:
            return "B+"
        elif grade_points >= 3.0:
            return "B"
        elif grade_points >= 2.7:
            return "B-"
        elif grade_points >= 2.3:
            return "C+"
        elif grade_points >= 2.0:
            return "C"
        elif grade_points >= 1.7:
            return "C-"
        elif grade_points >= 1.0:
            return "D"
        else:
            return "F"
    
    def _get_letter_grade_from_percentage(self, percentage: float) -> str:
        """Convert percentage to letter grade."""
        if percentage >= 97:
            return "A+"
        elif percentage >= 93:
            return "A"
        elif percentage >= 90:
            return "A-"
        elif percentage >= 87:
            return "B+"
        elif percentage >= 83:
            return "B"
        elif percentage >= 80:
            return "B-"
        elif percentage >= 77:
            return "C+"
        elif percentage >= 73:
            return "C"
        elif percentage >= 70:
            return "C-"
        elif percentage >= 67:
            return "D+"
        elif percentage >= 60:
            return "D"
        else:
            return "F"
    
    def _matches_filter(self, exam: dict, filter_dict: dict) -> bool:
        """Check if exam matches the given filter criteria."""
        for key, value in filter_dict.items():
            if exam.get(key) != value:
                return False
        return True
    
    async def update_student_grades_real_time(
        self,
        student_id: str,
        exam_id: str,
        new_marks: float,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        websocket_manager: WebSocketManager,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update student grades and recalculate GPA in real-time."""
        try:
            # Get exam info
            exam = await exams_collection.find_one({"_id": ObjectId(exam_id)})
            if not exam:
                raise ValueError(f"Exam not found: {exam_id}")
            
            # Update exam result
            percentage = (new_marks / exam["total_marks"]) * 100 if exam["total_marks"] > 0 else 0
            
            # Get grading scales
            grading_scales = []
            async for scale in grading_scales_collection.find(
                {"branch_id": branch_id} if branch_id else {}
            ):
                grading_scales.append(scale)
            
            # Calculate grade
            letter_grade = self._calculate_grade_from_percentage(percentage, grading_scales)
            status = "pass" if new_marks >= exam.get("passing_marks", 0) else "fail"
            
            # Update result
            update_data = {
                "marks_obtained": new_marks,
                "percentage": round(percentage, 2),
                "grade": letter_grade,
                "status": status,
                "updated_at": datetime.utcnow()
            }
            
            await exam_results_collection.update_one(
                {"exam_id": exam_id, "student_id": student_id},
                {"$set": update_data}
            )
            
            # Recalculate GPA for the term
            gpa_data = await self.calculate_student_gpa(
                student_id,
                exam["academic_year"],
                exam["term"],
                GradePointScale.FOUR_POINT,
                exam_results_collection,
                exams_collection,
                grading_scales_collection,
                branch_id
            )
            
            # Send real-time update
            await websocket_manager.send_to_user(
                student_id,
                {
                    "type": "grade_updated",
                    "data": {
                        "exam_id": exam_id,
                        "exam_name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "new_marks": new_marks,
                        "percentage": percentage,
                        "grade": letter_grade,
                        "status": status,
                        "updated_gpa": gpa_data["gpa"]
                    }
                }
            )
            
            return {
                "success": True,
                "updated_result": update_data,
                "updated_gpa": gpa_data["gpa"],
                "message": "Grade updated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error updating student grades in real-time: {e}")
            raise
    
    def _calculate_grade_from_percentage(self, percentage: float, grading_scales: List[dict]) -> str:
        """Calculate letter grade based on percentage and grading scales."""
        grading_scales.sort(key=lambda x: x["min_percentage"], reverse=True)
        for scale in grading_scales:
            if percentage >= scale["min_percentage"]:
                return scale["letter_grade"]
        return "F"