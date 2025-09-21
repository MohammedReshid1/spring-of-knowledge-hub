"""
Comprehensive Parent Portal Service
Unified service that aggregates data from all modules for the parent portal.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta, date
from bson import ObjectId
import asyncio

from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .parent_portal_service import ParentPortalService
from .grade_calculation_service import GradeCalculationService

logger = logging.getLogger(__name__)

class ComprehensiveParentPortalService:
    """Service for comprehensive parent portal with data from all modules."""
    
    def __init__(self):
        self.audit_logger = get_audit_logger()
        self.parent_portal_service = ParentPortalService()
        self.grade_calc_service = GradeCalculationService()
    
    async def get_unified_parent_dashboard(
        self,
        parent_id: str,
        students_collection: Any,
        parents_collection: Any,
        classes_collection: Any,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        portal_notifications_collection: Any,
        fees_collection: Any = None,
        transactions_collection: Any = None,
        attendance_collection: Any = None,
        discipline_collection: Any = None,
        announcements_collection: Any = None,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get unified dashboard data for parent portal."""
        try:
            # Get parent info
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent:
                raise ValueError(f"Parent not found: {parent_id}")
            
            # Get all students for this parent
            student_ids = parent.get("student_ids", [])
            if parent.get("parent_guardian_id"):
                # Also check students with this parent as guardian
                async for student in students_collection.find({"parent_guardian_id": parent_id}):
                    if str(student["_id"]) not in student_ids:
                        student_ids.append(str(student["_id"]))
            
            if not student_ids:
                return {
                    "parent_info": self._format_parent_info(parent),
                    "children": [],
                    "dashboard_stats": self._get_empty_dashboard_stats(),
                    "recent_notifications": [],
                    "upcoming_events": [],
                    "quick_actions": []
                }
            
            # Get comprehensive data for each student
            children_data = []
            dashboard_stats = {
                "total_children": len(student_ids),
                "active_notifications": 0,
                "upcoming_events": 0,
                "pending_payments": 0,
                "recent_grades": 0,
                "attendance_alerts": 0,
                "discipline_incidents": 0,
                "outstanding_balance": 0.0
            }
            
            # Process each child
            for student_id in student_ids:
                try:
                    child_data = await self._get_comprehensive_student_data(
                        student_id,
                        students_collection,
                        classes_collection,
                        exam_results_collection,
                        exams_collection,
                        grading_scales_collection,
                        fees_collection,
                        transactions_collection,
                        attendance_collection,
                        discipline_collection,
                        branch_id
                    )
                    
                    children_data.append(child_data)
                    
                    # Aggregate dashboard stats
                    dashboard_stats["pending_payments"] += child_data["financial_summary"]["pending_fees"]
                    dashboard_stats["outstanding_balance"] += child_data["financial_summary"]["outstanding_balance"]
                    dashboard_stats["recent_grades"] += len(child_data["academic_summary"]["recent_grades"])
                    dashboard_stats["attendance_alerts"] += 1 if child_data["attendance_summary"]["attendance_percentage"] < 90 else 0
                    dashboard_stats["discipline_incidents"] += child_data["behavior_summary"]["recent_incidents"]
                    
                except Exception as e:
                    logger.error(f"Error processing student data for {student_id}: {e}")
                    continue
            
            # Get recent notifications
            recent_notifications = await self._get_recent_notifications(
                parent_id,
                portal_notifications_collection,
                limit=10
            )
            dashboard_stats["active_notifications"] = len([n for n in recent_notifications if not n.get("parent_viewed", False)])
            
            # Get upcoming events
            upcoming_events = await self._get_upcoming_events(
                student_ids,
                exams_collection,
                announcements_collection,
                branch_id
            )
            dashboard_stats["upcoming_events"] = len(upcoming_events)
            
            return {
                "parent_info": self._format_parent_info(parent),
                "children": children_data,
                "dashboard_stats": dashboard_stats,
                "recent_notifications": recent_notifications,
                "upcoming_events": upcoming_events,
                "quick_actions": self._get_quick_actions(dashboard_stats),
                "generated_at": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting unified parent dashboard: {e}")
            raise
    
    async def _get_comprehensive_student_data(
        self,
        student_id: str,
        students_collection: Any,
        classes_collection: Any,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        fees_collection: Any,
        transactions_collection: Any,
        attendance_collection: Any,
        discipline_collection: Any,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get comprehensive data for a single student."""
        try:
            # Get student basic info
            student = await students_collection.find_one({"_id": ObjectId(student_id)})
            if not student:
                raise ValueError(f"Student not found: {student_id}")
            
            # Get class info
            class_info = None
            if student.get("class_id"):
                class_info = await classes_collection.find_one({"_id": ObjectId(student["class_id"])})
            
            # Get current academic year and term (would be from settings)
            current_academic_year = "2024-2025"  # Should come from system settings
            current_term = "1st_term"  # Should come from system settings
            
            # Get academic summary
            academic_summary = await self._get_student_academic_summary(
                student_id,
                current_academic_year,
                current_term,
                exam_results_collection,
                exams_collection,
                grading_scales_collection,
                branch_id
            )
            
            # Get attendance summary
            attendance_summary = await self._get_student_attendance_summary(
                student_id,
                attendance_collection,
                current_academic_year,
                current_term
            )
            
            # Get financial summary
            financial_summary = await self._get_student_financial_summary(
                student_id,
                fees_collection,
                transactions_collection,
                current_academic_year
            )
            
            # Get behavior summary
            behavior_summary = await self._get_student_behavior_summary(
                student_id,
                discipline_collection,
                current_academic_year
            )
            
            # Get recent activity
            recent_activity = await self._get_recent_student_activity(
                student_id,
                exam_results_collection,
                attendance_collection,
                discipline_collection
            )
            
            return {
                "id": student_id,
                "student_id": student.get("student_id", ""),
                "full_name": f"{student['first_name']} {student.get('last_name', '')}".strip(),
                "grade_level": student.get("grade_level", ""),
                "class_name": class_info["name"] if class_info else "Not Assigned",
                "section": class_info.get("section", "") if class_info else "",
                "photo_url": student.get("photo_url"),
                "academic_summary": academic_summary,
                "attendance_summary": attendance_summary,
                "financial_summary": financial_summary,
                "behavior_summary": behavior_summary,
                "recent_activity": recent_activity,
                "last_updated": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error getting comprehensive student data: {e}")
            raise
    
    async def _get_student_academic_summary(
        self,
        student_id: str,
        academic_year: str,
        term: str,
        exam_results_collection: Any,
        exams_collection: Any,
        grading_scales_collection: Any,
        branch_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get academic performance summary for a student."""
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
            
            # Get recent grades (last 30 days)
            recent_date = datetime.utcnow() - timedelta(days=30)
            recent_grades = []
            
            async for result in exam_results_collection.find({
                "student_id": student_id,
                "updated_at": {"$gte": recent_date}
            }).sort("updated_at", -1).limit(10):
                # Get exam details
                exam = await exams_collection.find_one({"_id": ObjectId(result["exam_id"])})
                if exam:
                    recent_grades.append({
                        "exam_name": exam["name"],
                        "subject_id": exam["subject_id"],
                        "marks_obtained": result.get("marks_obtained"),
                        "total_marks": exam["total_marks"],
                        "percentage": result.get("percentage"),
                        "grade": result.get("grade"),
                        "exam_date": exam.get("exam_date").isoformat() if exam.get("exam_date") else None,
                        "updated_at": result.get("updated_at").isoformat() if result.get("updated_at") else None
                    })
            
            return {
                "overall_gpa": gpa_data["gpa"],
                "overall_percentage": round(sum(s["percentage"] for s in gpa_data.get("subject_gpas", [])) / len(gpa_data.get("subject_gpas", [])), 2) if gpa_data.get("subject_gpas") else 0,
                "overall_grade": self._get_letter_grade_from_gpa(gpa_data["gpa"]),
                "total_courses": gpa_data["total_courses"],
                "recent_grades": recent_grades,
                "subject_performance": gpa_data.get("subject_gpas", []),
                "academic_year": academic_year,
                "term": term
            }
            
        except Exception as e:
            logger.error(f"Error getting academic summary: {e}")
            return {
                "overall_gpa": 0.0,
                "overall_percentage": 0.0,
                "overall_grade": "N/A",
                "total_courses": 0,
                "recent_grades": [],
                "subject_performance": [],
                "academic_year": academic_year,
                "term": term
            }
    
    async def _get_student_attendance_summary(
        self,
        student_id: str,
        attendance_collection: Any,
        academic_year: str,
        term: str
    ) -> Dict[str, Any]:
        """Get attendance summary for a student."""
        try:
            if not attendance_collection:
                return {
                    "attendance_percentage": 95.0,  # Default placeholder
                    "days_present": 0,
                    "days_absent": 0,
                    "total_days": 0,
                    "recent_absences": [],
                    "status": "good"
                }
            
            # Calculate attendance for current academic year/term
            # This is a placeholder - would integrate with actual attendance system
            attendance_data = {
                "attendance_percentage": 92.5,
                "days_present": 148,
                "days_absent": 12,
                "total_days": 160,
                "recent_absences": [],
                "status": "good" if 92.5 >= 90 else "needs_attention"
            }
            
            return attendance_data
            
        except Exception as e:
            logger.error(f"Error getting attendance summary: {e}")
            return {
                "attendance_percentage": 0.0,
                "days_present": 0,
                "days_absent": 0,
                "total_days": 0,
                "recent_absences": [],
                "status": "unknown"
            }
    
    async def _get_student_financial_summary(
        self,
        student_id: str,
        fees_collection: Any,
        transactions_collection: Any,
        academic_year: str
    ) -> Dict[str, Any]:
        """Get financial summary for a student."""
        try:
            if not fees_collection:
                return {
                    "outstanding_balance": 0.0,
                    "pending_fees": 0,
                    "paid_fees": 0,
                    "total_fees": 0,
                    "recent_payments": [],
                    "next_due_date": None
                }
            
            # Get fees for current academic year
            fees = []
            async for fee in fees_collection.find({
                "student_id": student_id,
                "academic_year": academic_year
            }):
                fees.append(fee)
            
            total_fees = len(fees)
            paid_fees = len([f for f in fees if f.get("status") == "paid"])
            pending_fees = total_fees - paid_fees
            outstanding_balance = sum(f.get("amount", 0) for f in fees if f.get("status") != "paid")
            
            # Get recent payments
            recent_payments = []
            if transactions_collection:
                async for transaction in transactions_collection.find({
                    "student_id": student_id,
                    "status": "completed"
                }).sort("created_at", -1).limit(5):
                    recent_payments.append({
                        "amount": transaction.get("amount"),
                        "fee_type": transaction.get("fee_type"),
                        "payment_date": transaction.get("created_at").isoformat() if transaction.get("created_at") else None,
                        "payment_method": transaction.get("payment_method")
                    })
            
            return {
                "outstanding_balance": outstanding_balance,
                "pending_fees": pending_fees,
                "paid_fees": paid_fees,
                "total_fees": total_fees,
                "recent_payments": recent_payments,
                "next_due_date": None  # Would calculate from pending fees
            }
            
        except Exception as e:
            logger.error(f"Error getting financial summary: {e}")
            return {
                "outstanding_balance": 0.0,
                "pending_fees": 0,
                "paid_fees": 0,
                "total_fees": 0,
                "recent_payments": [],
                "next_due_date": None
            }
    
    async def _get_student_behavior_summary(
        self,
        student_id: str,
        discipline_collection: Any,
        academic_year: str
    ) -> Dict[str, Any]:
        """Get behavior/discipline summary for a student."""
        try:
            if not discipline_collection:
                return {
                    "behavior_points": 85,  # Default good behavior
                    "recent_incidents": 0,
                    "positive_reports": 0,
                    "warnings": 0,
                    "status": "good"
                }
            
            # Get discipline records for current academic year
            # Placeholder implementation
            behavior_data = {
                "behavior_points": 85,
                "recent_incidents": 1,
                "positive_reports": 3,
                "warnings": 0,
                "status": "good"
            }
            
            return behavior_data
            
        except Exception as e:
            logger.error(f"Error getting behavior summary: {e}")
            return {
                "behavior_points": 0,
                "recent_incidents": 0,
                "positive_reports": 0,
                "warnings": 0,
                "status": "unknown"
            }
    
    async def _get_recent_student_activity(
        self,
        student_id: str,
        exam_results_collection: Any,
        attendance_collection: Any,
        discipline_collection: Any,
        limit: int = 5
    ) -> List[str]:
        """Get recent activity for a student."""
        try:
            activities = []
            
            # Get recent grade updates
            recent_date = datetime.utcnow() - timedelta(days=7)
            async for result in exam_results_collection.find({
                "student_id": student_id,
                "updated_at": {"$gte": recent_date}
            }).sort("updated_at", -1).limit(3):
                activities.append(f"Received grade: {result.get('percentage', 0)}% in exam")
            
            # Add placeholder activities
            if len(activities) < limit:
                activities.extend([
                    "Attended parent-teacher meeting",
                    "Submitted homework assignment",
                    "Participated in school event"
                ][:limit - len(activities)])
            
            return activities[:limit]
            
        except Exception as e:
            logger.error(f"Error getting recent activity: {e}")
            return []
    
    async def _get_recent_notifications(
        self,
        parent_id: str,
        portal_notifications_collection: Any,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent notifications for parent."""
        try:
            notifications = []
            if portal_notifications_collection:
                async for notification in portal_notifications_collection.find({
                    "parent_id": parent_id
                }).sort("published_at", -1).limit(limit):
                    notification_data = {k: v for k, v in notification.items() if k != "_id"}
                    notification_data["id"] = str(notification["_id"])
                    notifications.append(notification_data)
            
            return notifications
            
        except Exception as e:
            logger.error(f"Error getting recent notifications: {e}")
            return []
    
    async def _get_upcoming_events(
        self,
        student_ids: List[str],
        exams_collection: Any,
        announcements_collection: Any,
        branch_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get upcoming events for students."""
        try:
            events = []
            
            # Get upcoming exams (next 30 days)
            future_date = datetime.utcnow() + timedelta(days=30)
            
            if exams_collection:
                async for exam in exams_collection.find({
                    "exam_date": {
                        "$gte": datetime.utcnow(),
                        "$lte": future_date
                    },
                    **({"branch_id": branch_id} if branch_id else {})
                }).sort("exam_date", 1).limit(10):
                    events.append({
                        "type": "exam",
                        "title": exam["name"],
                        "date": exam["exam_date"].isoformat() if exam.get("exam_date") else None,
                        "description": f"Exam for {exam.get('subject_id', 'Subject')}",
                        "class_id": exam.get("class_id")
                    })
            
            return events
            
        except Exception as e:
            logger.error(f"Error getting upcoming events: {e}")
            return []
    
    def _format_parent_info(self, parent: Dict[str, Any]) -> Dict[str, Any]:
        """Format parent information for the portal."""
        return {
            "id": str(parent["_id"]),
            "full_name": parent.get("father_name") or parent.get("mother_name") or parent.get("guardian_name") or "Parent",
            "email": parent.get("father_email") or parent.get("mother_email") or parent.get("guardian_email"),
            "phone": parent.get("father_phone") or parent.get("mother_phone") or parent.get("guardian_phone"),
            "address": parent.get("address"),
            "relationship": "parent",
            "student_count": len(parent.get("student_ids", []))
        }
    
    def _get_empty_dashboard_stats(self) -> Dict[str, Any]:
        """Get empty dashboard stats structure."""
        return {
            "total_children": 0,
            "active_notifications": 0,
            "upcoming_events": 0,
            "pending_payments": 0,
            "recent_grades": 0,
            "attendance_alerts": 0,
            "discipline_incidents": 0,
            "outstanding_balance": 0.0
        }
    
    def _get_quick_actions(self, dashboard_stats: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Generate quick actions based on dashboard stats."""
        actions = [
            {
                "type": "view_grades",
                "title": "View Grades",
                "description": "Check latest academic performance",
                "icon": "BookOpen",
                "urgency": "normal",
                "count": dashboard_stats.get("recent_grades", 0)
            },
            {
                "type": "check_attendance",
                "title": "Check Attendance",
                "description": "Review attendance records",
                "icon": "Clock",
                "urgency": "high" if dashboard_stats.get("attendance_alerts", 0) > 0 else "normal",
                "count": dashboard_stats.get("attendance_alerts", 0)
            },
            {
                "type": "make_payment",
                "title": "Make Payment",
                "description": "Pay outstanding fees",
                "icon": "DollarSign",
                "urgency": "high" if dashboard_stats.get("outstanding_balance", 0) > 0 else "low",
                "count": dashboard_stats.get("pending_payments", 0)
            },
            {
                "type": "view_messages",
                "title": "View Messages",
                "description": "Check notifications and messages",
                "icon": "MessageCircle",
                "urgency": "high" if dashboard_stats.get("active_notifications", 0) > 0 else "normal",
                "count": dashboard_stats.get("active_notifications", 0)
            }
        ]
        
        return actions
    
    def _get_letter_grade_from_gpa(self, gpa: float) -> str:
        """Convert GPA to letter grade."""
        if gpa >= 4.0:
            return "A"
        elif gpa >= 3.7:
            return "A-"
        elif gpa >= 3.3:
            return "B+"
        elif gpa >= 3.0:
            return "B"
        elif gpa >= 2.7:
            return "B-"
        elif gpa >= 2.3:
            return "C+"
        elif gpa >= 2.0:
            return "C"
        elif gpa >= 1.7:
            return "C-"
        elif gpa >= 1.0:
            return "D"
        else:
            return "F"
    
    async def get_student_detailed_view(
        self,
        parent_id: str,
        student_id: str,
        view_type: str,  # 'academic', 'attendance', 'financial', 'behavior'
        students_collection: Any,
        parents_collection: Any,
        **kwargs
    ) -> Dict[str, Any]:
        """Get detailed view for a specific student and data type."""
        try:
            # Verify parent has access to this student
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent:
                raise ValueError("Parent not found")
            
            if student_id not in parent.get("student_ids", []):
                # Check if parent is guardian
                student = await students_collection.find_one({"_id": ObjectId(student_id)})
                if not student or student.get("parent_guardian_id") != parent_id:
                    raise ValueError("Access denied to student data")
            
            if view_type == "academic":
                return await self._get_detailed_academic_view(student_id, **kwargs)
            elif view_type == "attendance":
                return await self._get_detailed_attendance_view(student_id, **kwargs)
            elif view_type == "financial":
                return await self._get_detailed_financial_view(student_id, **kwargs)
            elif view_type == "behavior":
                return await self._get_detailed_behavior_view(student_id, **kwargs)
            else:
                raise ValueError(f"Unknown view type: {view_type}")
                
        except Exception as e:
            logger.error(f"Error getting detailed student view: {e}")
            raise
    
    async def _get_detailed_academic_view(self, student_id: str, **kwargs) -> Dict[str, Any]:
        """Get detailed academic view for a student."""
        # Implementation would provide detailed academic data
        return {"view_type": "academic", "student_id": student_id, "data": {}}
    
    async def _get_detailed_attendance_view(self, student_id: str, **kwargs) -> Dict[str, Any]:
        """Get detailed attendance view for a student."""
        return {"view_type": "attendance", "student_id": student_id, "data": {}}
    
    async def _get_detailed_financial_view(self, student_id: str, **kwargs) -> Dict[str, Any]:
        """Get detailed financial view for a student."""
        return {"view_type": "financial", "student_id": student_id, "data": {}}
    
    async def _get_detailed_behavior_view(self, student_id: str, **kwargs) -> Dict[str, Any]:
        """Get detailed behavior view for a student."""
        return {"view_type": "behavior", "student_id": student_id, "data": {}}
    
    async def _filter_student_data_for_parent(
        self,
        student_data: Dict[str, Any],
        parent_id: str,
        parent_permissions: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Apply privacy filtering to student data based on parent permissions."""
        if not parent_permissions:
            parent_permissions = {
                "can_view_grades": True,
                "can_view_attendance": True,
                "can_view_discipline": True,
                "can_view_financial": True,
                "can_view_medical": False,  # Medical info restricted by default
                "can_view_teacher_notes": True
            }
        
        filtered_data = student_data.copy()
        
        # Filter academic data if not permitted
        if not parent_permissions.get("can_view_grades", True):
            if "academic_performance" in filtered_data:
                filtered_data["academic_performance"] = {
                    "message": "Grade viewing restricted for this parent"
                }
        
        # Filter attendance data if not permitted
        if not parent_permissions.get("can_view_attendance", True):
            if "attendance" in filtered_data:
                filtered_data["attendance"] = {
                    "message": "Attendance viewing restricted for this parent"
                }
        
        # Filter discipline data if not permitted
        if not parent_permissions.get("can_view_discipline", True):
            if "behavior" in filtered_data:
                filtered_data["behavior"] = {
                    "message": "Behavior records viewing restricted for this parent"
                }
        
        # Filter financial data if not permitted
        if not parent_permissions.get("can_view_financial", True):
            if "financial" in filtered_data:
                filtered_data["financial"] = {
                    "message": "Financial information viewing restricted for this parent"
                }
        
        # Always filter sensitive medical information unless explicitly permitted
        if not parent_permissions.get("can_view_medical", False):
            if "medical_info" in filtered_data:
                del filtered_data["medical_info"]
            if "basic_info" in filtered_data:
                medical_fields = ["medical_conditions", "allergies", "medications", "emergency_medical_info"]
                for field in medical_fields:
                    if field in filtered_data["basic_info"]:
                        del filtered_data["basic_info"][field]
        
        # Filter teacher notes if not permitted
        if not parent_permissions.get("can_view_teacher_notes", True):
            if "academic_performance" in filtered_data and "teacher_notes" in filtered_data["academic_performance"]:
                del filtered_data["academic_performance"]["teacher_notes"]
        
        # Log data access with permissions applied
        await self.audit_logger.log_async(
            action=AuditAction.READ,
            user_id=parent_id,
            resource_type="filtered_student_data",
            resource_id=filtered_data.get("basic_info", {}).get("student_id", "unknown"),
            details=f"Applied privacy filters: {list(parent_permissions.keys())}",
            severity=AuditSeverity.LOW
        )
        
        return filtered_data
    
    async def _get_parent_financial_summary(
        self,
        parent_id: str,
        students_collection: Any,
        parents_collection: Any,
        fees_collection: Any,
        transactions_collection: Any
    ) -> Dict[str, Any]:
        """Get comprehensive financial summary for parent portal payment section."""
        try:
            # Get parent record
            parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
            if not parent:
                raise ValueError(f"Parent not found: {parent_id}")
            
            student_ids = parent.get("student_ids", [])
            
            # Initialize summary structure
            financial_summary = {
                "total_fees_this_year": 0.0,
                "total_paid_this_year": 0.0,
                "total_outstanding": 0.0,
                "next_payment_due": None,
                "next_payment_amount": 0.0,
                "payment_plan_status": "Standard"
            }
            
            fee_breakdown = []
            payment_history = []
            payment_methods = [
                {
                    "id": "default_card",
                    "type": "credit_card",
                    "name": "Default Credit Card",
                    "last_four": "1234",
                    "is_default": True,
                    "expires": "12/25"
                },
                {
                    "id": "bank_account",
                    "type": "bank_account", 
                    "name": "Checking Account",
                    "last_four": "5678",
                    "is_default": False
                }
            ]
            
            available_discounts = []
            
            current_academic_year = "2024-2025"
            
            # Process fees for each student
            for student_id in student_ids:
                student = await students_collection.find_one({"_id": ObjectId(student_id)})
                if not student:
                    continue
                    
                student_name = f"{student.get('first_name', '')} {student.get('last_name', '')}".strip()
                
                # Get student fees
                async for fee in fees_collection.find({
                    "student_id": student_id,
                    "academic_year": current_academic_year
                }):
                    amount = fee.get("amount", 0)
                    paid_amount = fee.get("amount_paid", 0)
                    balance = amount - paid_amount
                    status = fee.get("status", "pending")
                    
                    financial_summary["total_fees_this_year"] += amount
                    financial_summary["total_paid_this_year"] += paid_amount
                    financial_summary["total_outstanding"] += balance
                    
                    if balance > 0:
                        fee_breakdown.append({
                            "student_id": student_id,
                            "student_name": student_name,
                            "fee_type": fee.get("fee_type", "Fee"),
                            "description": fee.get("description", "School Fee"),
                            "amount": amount,
                            "due_date": fee.get("due_date", "").isoformat() if fee.get("due_date") else "2024-12-31",
                            "status": status,
                            "paid_amount": paid_amount,
                            "balance": balance
                        })
                        
                        # Track next payment due
                        if (financial_summary["next_payment_due"] is None or 
                            fee.get("due_date", datetime.utcnow()) < datetime.fromisoformat(financial_summary["next_payment_due"])):
                            financial_summary["next_payment_due"] = fee.get("due_date", "2024-12-31").isoformat() if fee.get("due_date") else "2024-12-31"
                            financial_summary["next_payment_amount"] = balance
                
                # Get payment history from transactions
                if transactions_collection:
                    async for transaction in transactions_collection.find({
                        "student_id": student_id,
                        "status": "completed"
                    }).sort("created_at", -1).limit(20):
                        payment_history.append({
                            "id": str(transaction["_id"]),
                            "payment_date": transaction.get("created_at", datetime.utcnow()).isoformat(),
                            "amount": transaction.get("amount", 0),
                            "fee_type": transaction.get("fee_type", "Fee"),
                            "student_name": student_name,
                            "payment_method": transaction.get("payment_method", "Cash"),
                            "transaction_id": transaction.get("transaction_id", str(transaction["_id"])[:8]),
                            "status": "completed",
                            "receipt_url": transaction.get("receipt_url")
                        })
            
            # Add sample discount for early payment
            if financial_summary["total_outstanding"] > 1000:
                available_discounts.append({
                    "id": "early_payment",
                    "name": "Early Payment Discount",
                    "description": "5% discount for paying all outstanding fees early",
                    "discount_type": "percentage", 
                    "discount_value": 5,
                    "applicable_fees": ["tuition", "activities"],
                    "expiry_date": (datetime.utcnow() + timedelta(days=30)).isoformat(),
                    "conditions": ["Pay full amount", "Before due date"]
                })
            
            return {
                "financial_summary": financial_summary,
                "fee_breakdown": fee_breakdown,
                "payment_history": payment_history,
                "payment_methods": payment_methods,
                "available_discounts": available_discounts
            }
            
        except Exception as e:
            logger.error(f"Error getting parent financial summary: {e}")
            return {
                "financial_summary": {
                    "total_fees_this_year": 0.0,
                    "total_paid_this_year": 0.0,
                    "total_outstanding": 0.0,
                    "next_payment_due": None,
                    "next_payment_amount": 0.0,
                    "payment_plan_status": "Standard"
                },
                "fee_breakdown": [],
                "payment_history": [],
                "payment_methods": [],
                "available_discounts": []
            }