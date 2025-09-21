from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime, timedelta
import statistics
import logging

logger = logging.getLogger(__name__)

from ..db import (
    get_exams_collection, get_exam_results_collection, get_grading_scales_collection,
    get_student_collection, get_classes_collection, get_academic_events_collection,
    validate_branch_id, validate_student_id, validate_class_id, validate_subject_id, validate_teacher_id
)
from ..models.exam import (
    ExamCreate, Exam, ExamUpdate, ExamResultCreate, ExamResult, 
    ExamResultUpdate, GradingScale, GradingScaleCreate, ExamStats,
    ReportCard, ReportCardCreate, ReportCardTemplate, ReportCardTemplateCreate,
    BulkReportGeneration, BulkReportGenerationCreate, StudentTranscript, GradeAnalytics
)
from ..utils.rbac import get_current_user, Permission, has_permission, is_hq_role
from ..models.user import User
from ..utils.validation import (
    sanitize_input, validate_amount, prevent_nosql_injection, validate_mongodb_id
)
from ..services.exam_scheduling_service import ExamSchedulingService
from ..services.report_generation_service import ReportGenerationService
from ..services.grade_calculation_service import GradeCalculationService
from ..services.parent_portal_service import ParentPortalService
from ..services.grade_notification_service import GradeNotificationService
from ..utils.calendar_events import calendar_event_generator
from ..utils.notification_integrations import notify
from ..services.realtime_grade_service import RealtimeGradeService
from ..utils.websocket_manager import WebSocketManager

router = APIRouter()

def calculate_grade(percentage: float, grading_scales: List[dict]) -> str:
    """Calculate letter grade based on percentage and grading scale."""
    for scale in sorted(grading_scales, key=lambda x: x['min_percentage'], reverse=True):
        if percentage >= scale['min_percentage']:
            return scale['letter_grade']
    return 'F'

def calculate_exam_stats(results: List[dict]) -> dict:
    """Calculate statistics for an exam."""
    if not results:
        return {
            "total_students": 0,
            "students_appeared": 0,
            "students_passed": 0,
            "students_failed": 0,
            "highest_marks": 0,
            "lowest_marks": 0,
            "average_marks": 0,
            "median_marks": 0,
            "standard_deviation": 0,
            "pass_percentage": 0
        }
    
    appeared_results = [r for r in results if r.get('attendance_status') == 'present']
    appeared_count = len(appeared_results)
    
    if appeared_count == 0:
        return {
            "total_students": len(results),
            "students_appeared": 0,
            "students_passed": 0,
            "students_failed": 0,
            "highest_marks": 0,
            "lowest_marks": 0,
            "average_marks": 0,
            "median_marks": 0,
            "standard_deviation": 0,
            "pass_percentage": 0
        }
    
    marks = [r['marks_obtained'] for r in appeared_results]
    passed_count = len([r for r in appeared_results if r.get('status') == 'pass'])
    
    return {
        "total_students": len(results),
        "students_appeared": appeared_count,
        "students_passed": passed_count,
        "students_failed": appeared_count - passed_count,
        "highest_marks": max(marks),
        "lowest_marks": min(marks),
        "average_marks": round(sum(marks) / len(marks), 2),
        "median_marks": round(statistics.median(marks), 2),
        "standard_deviation": round(statistics.stdev(marks) if len(marks) > 1 else 0, 2),
        "pass_percentage": round((passed_count / appeared_count) * 100, 2) if appeared_count > 0 else 0
    }

@router.post("/", response_model=Exam)
async def create_exam(
    exam_in: ExamCreate,
    exams_coll: Any = Depends(get_exams_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new exam."""
    # Check permission using RBAC
    if not has_permission(current_user.get("role"), Permission.CREATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission 'CREATE_GRADE' required to create exams"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and not is_hq_role(current_user.get("role")):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    # Sanitize and validate input
    exam_data = sanitize_input(exam_in.dict(), [
        "name", "subject_id", "class_id", "teacher_id", "exam_type", 
        "total_marks", "passing_marks", "exam_date", "duration_minutes",
        "instructions", "syllabus_topics", "academic_year", "term", "branch_id"
    ])
    
    # Validate IDs
    await validate_subject_id(exam_data["subject_id"])
    await validate_class_id(exam_data["class_id"])
    await validate_teacher_id(exam_data["teacher_id"])
    if exam_data.get("branch_id"):
        await validate_branch_id(exam_data["branch_id"])
    
    # Validate amounts
    if not validate_amount(exam_data["total_marks"]) or exam_data["total_marks"] <= 0:
        raise HTTPException(status_code=400, detail="Invalid total marks")
    
    if not validate_amount(exam_data["passing_marks"]) or exam_data["passing_marks"] <= 0:
        raise HTTPException(status_code=400, detail="Invalid passing marks")
    
    if exam_data["passing_marks"] > exam_data["total_marks"]:
        raise HTTPException(status_code=400, detail="Passing marks cannot exceed total marks")
    
    # Add metadata and branch isolation
    now = datetime.utcnow()
    # For superadmin/HQ roles, use the branch_id from the request if provided
    # For branch-level users, always use their assigned branch_id
    if is_hq_role(current_user.get("role")):
        # HQ roles can specify branch_id, or it might be None
        final_branch_id = exam_data.get("branch_id") or branch_id
    else:
        # Branch users must use their assigned branch
        final_branch_id = branch_id
    
    exam_data.update({
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("user_id"),
        "branch_id": final_branch_id  # Add branch isolation
    })
    
    result = await exams_coll.insert_one(exam_data)
    exam_data["id"] = str(result.inserted_id)
    
    # Integrate with exam scheduling service
    try:
        websocket_manager = WebSocketManager(None)  # Will be properly initialized in production
        from ..db import get_exam_schedules_collection, get_report_schedules_collection
        
        await ExamSchedulingService.schedule_exam_with_report_integration(
            exam_data=exam_data,
            exams_collection=exams_coll,
            exam_schedules_collection=get_exam_schedules_collection(),
            report_schedules_collection=get_report_schedules_collection(),
            classes_collection=get_classes_collection(),
            websocket_manager=websocket_manager,
            auto_schedule_reports=True
        )
    except Exception as e:
        logger.error(f"Error in exam scheduling integration: {e}")
    
    # Generate calendar events for the exam directly
    try:
        from ..db import get_db
        
        db = get_db()
        events_coll = db["academic_events"]
        calendar_events = []
        
        # Main exam event
        exam_date_value = exam_data.get('exam_date')
        if isinstance(exam_date_value, datetime):
            exam_date = exam_date_value
        elif isinstance(exam_date_value, str):
            exam_date = datetime.fromisoformat(exam_date_value)
            # If the time is 00:00:00, set a default exam time (e.g., 9:00 AM)
            if exam_date.time().replace(microsecond=0) == datetime.min.time():
                exam_date = exam_date.replace(hour=9, minute=0, second=0)
        else:
            exam_date = datetime.now()
        
        # Calculate end time based on duration
        duration_minutes = exam_data.get('duration_minutes', 60)  # Default 60 minutes
        end_date = exam_date + timedelta(minutes=duration_minutes)
        
        exam_event_data = {
            "title": f"Exam: {exam_data.get('name', 'Unknown Exam')}",
            "description": f"{exam_data.get('exam_type', 'Exam')} - {exam_data.get('total_marks', 0)} marks ({duration_minutes} mins)",
            "event_type": "exam",
            "start_date": exam_date,
            "end_date": end_date,
            "is_all_day": False,
            "academic_year_id": exam_data.get('academic_year', ''),
            "term_id": exam_data.get('term', ''),
            "class_ids": [exam_data.get('class_id')] if exam_data.get('class_id') else [],
            "branch_id": final_branch_id,
            "color": "#ff9800",  # Orange for exams
            "source_type": "exam",
            "source_id": exam_data.get('id'),
            "auto_generated": True,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "is_public": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": current_user.get("user_id"),
            "metadata": {
                "exam_type": exam_data.get('exam_type'),
                "total_marks": exam_data.get('total_marks'),
                "passing_marks": exam_data.get('passing_marks'),
                "duration_minutes": exam_data.get('duration_minutes'),
                "subject_id": exam_data.get('subject_id'),
                "teacher_id": exam_data.get('teacher_id'),
                "instructions": exam_data.get('instructions', '')
            }
        }
        
        # Insert exam event
        result = await events_coll.insert_one(exam_event_data)
        logger.info(f"Created exam calendar event with ID: {result.inserted_id}")
        calendar_events.append(str(result.inserted_id))
        
        # Generate reminder event (3 days before exam)
        reminder_date = exam_date - timedelta(days=3)
        
        if reminder_date > datetime.utcnow():
            reminder_event_data = {
                "title": f"Exam Reminder: {exam_data.get('name', 'Unknown Exam')}",
                "description": f"Reminder: {exam_data.get('exam_type', 'Exam')} in 3 days",
                "event_type": "deadline",
                "start_date": reminder_date,
                "end_date": None,
                "is_all_day": True,
                "academic_year_id": exam_data.get('academic_year', ''),
                "term_id": exam_data.get('term', ''),
                "class_ids": [exam_data.get('class_id')] if exam_data.get('class_id') else [],
                "branch_id": exam_data.get('branch_id'),
                "color": "#f44336",  # Red for reminders
                "source_type": "exam",
                "source_id": exam_data.get('id'),
                "auto_generated": True,
                "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
                "target_audience": "all",
                "send_notifications": True,
                "is_public": True,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "created_by": current_user.get("user_id"),
                "metadata": {
                    "reminder_type": "exam_reminder",
                    "original_exam_id": exam_data.get('id'),
                    "days_before": 3
                }
            }
            
            result = await events_coll.insert_one(reminder_event_data)
            logger.info(f"Created exam reminder calendar event with ID: {result.inserted_id}")
            calendar_events.append(str(result.inserted_id))
        
        logger.info(f"Generated {len(calendar_events)} calendar events for exam {exam_data['id']}")
        
    except Exception as e:
        logger.error(f"Error generating calendar events for exam: {e}")
        # Don't let calendar event generation failure block exam creation
    
    return Exam(**exam_data)

@router.get("/", response_model=List[Exam])
async def list_exams(
    class_id: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    exam_type: Optional[str] = Query(None),
    branch_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    exams_coll: Any = Depends(get_exams_collection),
    current_user: User = Depends(get_current_user),
):
    """List exams with optional filters."""
    print(f"🔍 EXAMS DEBUG: branch_id={branch_id}, class_id={class_id}, user_role={current_user.get('role')}")
    
    query = {}
    
    if class_id:
        query["class_id"] = class_id
    if subject_id:
        query["subject_id"] = subject_id
    if academic_year:
        query["academic_year"] = academic_year
    if term:
        query["term"] = term
    if exam_type:
        query["exam_type"] = exam_type
    
    # Build query with branch filtering
    if current_user.get("role") in ["superadmin", "super_admin"]:
        # Superadmin can filter by specific branch or see all
        if branch_id:
            query["branch_id"] = branch_id
        # If no branch_id specified, superadmin sees all exams
    else:
        # Regular users see only their branch's exams
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []  # No branch = no data
        query["branch_id"] = user_branch_id
    
    query = prevent_nosql_injection(query)
    
    exams = []
    async for exam in exams_coll.find(query).skip(skip).limit(limit).sort("exam_date", -1):
        exam_data = {k: v for k, v in exam.items() if k != "_id"}
        # Handle None values for required fields
        if exam_data.get("created_by") is None:
            exam_data["created_by"] = ""
        exams.append(Exam(id=str(exam["_id"]), **exam_data))
    
    print(f"🔍 EXAMS RESULT: query={query}, found={len(exams)} exams")
    return exams

@router.get("/{exam_id}", response_model=Exam)
async def get_exam(
    exam_id: str,
    exams_coll: Any = Depends(get_exams_collection),
    current_user: User = Depends(get_current_user),
):
    """Get exam by ID."""
    if not validate_mongodb_id(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    # Build query with branch filtering
    query = {"_id": ObjectId(exam_id)}
    if current_user.get("role") not in ["superadmin", "super_admin"]:
        # Regular users can only access their branch's exams
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User must be assigned to a branch")
        query["branch_id"] = branch_id
    
    exam = await exams_coll.find_one(query)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    exam_data = {k: v for k, v in exam.items() if k != "_id"}
    # Handle None values for required fields
    if exam_data.get("created_by") is None:
        exam_data["created_by"] = ""
    return Exam(id=str(exam["_id"]), **exam_data)

@router.put("/{exam_id}", response_model=Exam)
async def update_exam(
    exam_id: str,
    exam_update: ExamUpdate,
    exams_coll: Any = Depends(get_exams_collection),
    events_coll: Any = Depends(get_academic_events_collection),
    current_user: User = Depends(get_current_user),
):
    """Update exam."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update exams")
    
    if not validate_mongodb_id(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    # Check if exam exists
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Prepare update data
    update_data = exam_update.dict(exclude_unset=True)
    update_data = sanitize_input(update_data, list(update_data.keys()))
    
    # Validate IDs if provided
    if "subject_id" in update_data:
        await validate_subject_id(update_data["subject_id"])
    if "class_id" in update_data:
        await validate_class_id(update_data["class_id"])
    if "teacher_id" in update_data:
        await validate_teacher_id(update_data["teacher_id"])
    if "branch_id" in update_data:
        await validate_branch_id(update_data["branch_id"])
    
    # Validate marks
    total_marks = update_data.get("total_marks", exam.get("total_marks"))
    passing_marks = update_data.get("passing_marks", exam.get("passing_marks"))
    
    if "total_marks" in update_data and (not validate_amount(total_marks) or total_marks <= 0):
        raise HTTPException(status_code=400, detail="Invalid total marks")
    
    if "passing_marks" in update_data and (not validate_amount(passing_marks) or passing_marks <= 0):
        raise HTTPException(status_code=400, detail="Invalid passing marks")
    
    if passing_marks > total_marks:
        raise HTTPException(status_code=400, detail="Passing marks cannot exceed total marks")
    
    update_data["updated_at"] = datetime.utcnow()
    
    await exams_coll.update_one({"_id": ObjectId(exam_id)}, {"$set": update_data})
    
    updated_exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    exam_data = {k: v for k, v in updated_exam.items() if k != "_id"}
    # Handle None values for required fields
    if exam_data.get("created_by") is None:
        exam_data["created_by"] = ""
    
    # Update calendar events if relevant fields were changed
    try:
        # Check if we need to update calendar events
        calendar_relevant_fields = ['name', 'exam_date', 'exam_type', 'duration_minutes', 'subject_id', 'teacher_id']
        should_update_calendar = any(field in update_data for field in calendar_relevant_fields)
        
        if should_update_calendar:
            # First, delete existing calendar events for this exam
            calendar_delete_result = await events_coll.delete_many({
                "source_type": "exam",
                "source_id": exam_id,
                "auto_generated": True
            })
            logger.info(f"Deleted {calendar_delete_result.deleted_count} existing calendar events for exam {exam_id}")
            
            # Then create new calendar events with updated information
            # Prepare exam data for calendar event generation
            exam_date_value = exam_data.get('exam_date')
            if isinstance(exam_date_value, datetime):
                exam_date = exam_date_value
            elif isinstance(exam_date_value, str):
                exam_date = datetime.fromisoformat(exam_date_value)
                # If the time is 00:00:00, set a default exam time (e.g., 9:00 AM)
                if exam_date.time().replace(microsecond=0) == datetime.min.time():
                    exam_date = exam_date.replace(hour=9, minute=0, second=0)
            else:
                exam_date = datetime.now()
            
            # Get academic year and term IDs - handle both formats
            academic_year_id = exam_data.get('academic_year_id') or exam_data.get('academic_year')
            term_id = exam_data.get('term_id') or exam_data.get('term')
            
            # If we still don't have academic year/term, get the current ones
            if not academic_year_id:
                from ..db import get_db
                db = get_db()
                academic_years_coll = db["academic_years"]
                current_year = await academic_years_coll.find_one({"is_current": True})
                if current_year:
                    academic_year_id = str(current_year["_id"])
            
            if not term_id:
                from ..db import get_db
                db = get_db()
                terms_coll = db["terms"]
                if academic_year_id:
                    current_term = await terms_coll.find_one({
                        "academic_year_id": academic_year_id,
                        "is_current": True
                    })
                    if current_term:
                        term_id = str(current_term["_id"])
            
            # Calculate end time based on duration
            duration_minutes = exam_data.get('duration_minutes', 60)  # Default 60 minutes
            end_date = exam_date + timedelta(minutes=duration_minutes)
            
            # Create main exam event
            exam_event = {
                "_id": ObjectId(),
                "title": f"Exam: {exam_data.get('name', 'Unknown Exam')}",
                "description": f"{exam_data.get('exam_type', 'Exam')} - {exam_data.get('total_marks', 0)} marks ({duration_minutes} mins)",
                "event_type": "exam",
                "start_date": exam_date,
                "end_date": end_date,
                "is_all_day": False,
                "academic_year_id": academic_year_id or "",
                "term_id": term_id or "",
                "class_ids": [exam_data.get('class_id')] if exam_data.get('class_id') else [],
                "branch_id": exam_data.get('branch_id'),
                "color": "#ff9800",
                "source_type": "exam",
                "source_id": exam_id,
                "auto_generated": True,
                "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
                "target_audience": "all",
                "send_notifications": True,
                "is_public": False,
                "created_at": datetime.now(),
                "updated_at": datetime.now(),
                "created_by": current_user.get('id', 'system'),
                "metadata": {
                    "exam_type": exam_data.get('exam_type'),
                    "total_marks": exam_data.get('total_marks'),
                    "subject_id": exam_data.get('subject_id'),
                    "teacher_id": exam_data.get('teacher_id')
                }
            }
            
            # Insert the new calendar event
            await events_coll.insert_one(exam_event)
            logger.info(f"Created updated calendar event for exam {exam_id}")
        
    except Exception as e:
        logger.error(f"Error updating calendar events for exam {exam_id}: {e}")
    
    return Exam(id=str(updated_exam["_id"]), **exam_data)

@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: str,
    exams_coll: Any = Depends(get_exams_collection),
    results_coll: Any = Depends(get_exam_results_collection),
    events_coll: Any = Depends(get_academic_events_collection),
    current_user: User = Depends(get_current_user),
):
    """Delete exam and its results."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to delete exams")
    
    if not validate_mongodb_id(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    # Check if exam exists
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Delete related calendar events first
    try:
        # Delete events that were auto-generated for this exam
        calendar_delete_result = await events_coll.delete_many({
            "source_type": "exam",
            "source_id": exam_id,
            "auto_generated": True
        })
        logger.info(f"Deleted {calendar_delete_result.deleted_count} calendar events for exam {exam_id}")
    except Exception as e:
        logger.warning(f"Failed to delete calendar events for exam {exam_id}: {str(e)}")
        # Continue with exam deletion even if calendar cleanup fails
    
    # Delete exam results
    await results_coll.delete_many({"exam_id": exam_id})
    
    # Delete exam
    result = await exams_coll.delete_one({"_id": ObjectId(exam_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    logger.info(f"Successfully deleted exam {exam_id} and related data")

@router.get("/{exam_id}/stats", response_model=ExamStats)
async def get_exam_statistics(
    exam_id: str,
    exams_coll: Any = Depends(get_exams_collection),
    results_coll: Any = Depends(get_exam_results_collection),
    current_user: User = Depends(get_current_user),
):
    """Get exam statistics."""
    if not validate_mongodb_id(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    # Check if exam exists
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get all results for this exam
    results = []
    async for result in results_coll.find({"exam_id": exam_id}):
        results.append(result)
    
    stats = calculate_exam_stats(results)
    stats["exam_id"] = exam_id
    
    return ExamStats(**stats)

# Report Generation Endpoints

@router.post("/report-cards", response_model=ReportCard)
async def generate_report_card(
    report_data: ReportCardCreate,
    current_user: User = Depends(get_current_user),
):
    """Generate a comprehensive report card for a student."""
    if not has_permission(current_user.get("role"), Permission.CREATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to generate report cards"
        )
    
    try:
        from ..db import (
            get_report_cards_collection, get_report_card_templates_collection,
            get_subjects_collection, get_teachers_collection
        )
        
        report_card = await ReportGenerationService.generate_enhanced_report_card(
            report_data,
            get_report_cards_collection(),
            get_report_card_templates_collection(),
            get_exams_collection(),
            get_exam_results_collection(),
            get_student_collection(),
            get_classes_collection(),
            get_subjects_collection(),
            get_grading_scales_collection(),
            current_user.get("user_id"),
            current_user.get("branch_id")
        )
        
        return report_card
        
    except Exception as e:
        logger.error(f"Error generating report card: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report card")

@router.post("/report-cards/bulk", response_model=BulkReportGeneration)
async def generate_bulk_report_cards(
    bulk_data: BulkReportGenerationCreate,
    current_user: User = Depends(get_current_user),
):
    """Generate report cards in bulk for multiple students."""
    if not has_permission(current_user.get("role"), Permission.CREATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to generate bulk reports"
        )
    
    try:
        from ..db import (
            get_report_cards_collection, get_report_card_templates_collection,
            get_bulk_generations_collection, get_subjects_collection
        )
        
        websocket_manager = WebSocketManager(None)
        
        bulk_generation = await ReportGenerationService.generate_bulk_enhanced_reports(
            bulk_data,
            get_bulk_generations_collection(),
            get_report_cards_collection(),
            get_report_card_templates_collection(),
            get_student_collection(),
            get_classes_collection(),
            get_exams_collection(),
            get_exam_results_collection(),
            get_subjects_collection(),
            get_grading_scales_collection(),
            websocket_manager,
            current_user.get("user_id"),
            current_user.get("branch_id")
        )
        
        return bulk_generation
        
    except Exception as e:
        logger.error(f"Error generating bulk report cards: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate bulk reports")

@router.put("/report-cards/{report_card_id}/publish")
async def publish_report_card(
    report_card_id: str,
    current_user: User = Depends(get_current_user),
):
    """Publish a report card to parent portal."""
    if not has_permission(current_user.get("role"), Permission.UPDATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to publish report cards"
        )
    
    try:
        from ..db import get_report_cards_collection
        
        published = await ReportGenerationService.publish_report_card(
            report_card_id,
            get_report_cards_collection(),
            current_user.get("user_id")
        )
        
        if not published:
            raise HTTPException(status_code=404, detail="Report card not found")
        
        return {"success": True, "message": "Report card published successfully"}
        
    except Exception as e:
        logger.error(f"Error publishing report card: {e}")
        raise HTTPException(status_code=500, detail="Failed to publish report card")

@router.get("/students/{student_id}/gpa")
async def get_student_gpa(
    student_id: str,
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Calculate and return student's GPA."""
    if not has_permission(current_user.get("role"), Permission.READ_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to view grades"
        )
    
    try:
        grade_calc_service = GradeCalculationService()
        
        gpa_data = await grade_calc_service.calculate_student_gpa(
            student_id,
            academic_year,
            term,
            exam_results_collection=get_exam_results_collection(),
            exams_collection=get_exams_collection(),
            grading_scales_collection=get_grading_scales_collection(),
            branch_id=current_user.get("branch_id")
        )
        
        return gpa_data
        
    except Exception as e:
        logger.error(f"Error calculating student GPA: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate GPA")

@router.get("/students/{student_id}/transcript")
async def get_student_transcript(
    student_id: str,
    academic_years: List[str] = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Generate comprehensive transcript for a student."""
    if not has_permission(current_user.get("role"), Permission.READ_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to view transcripts"
        )
    
    try:
        from ..db import get_transcripts_collection
        
        grade_calc_service = GradeCalculationService()
        
        transcript = await grade_calc_service.generate_student_transcript(
            student_id,
            academic_years,
            get_student_collection(),
            get_classes_collection(),
            get_report_cards_collection() if 'get_report_cards_collection' in dir() else None,
            get_transcripts_collection(),
            get_exam_results_collection(),
            get_exams_collection(),
            get_grading_scales_collection(),
            current_user.get("user_id"),
            current_user.get("branch_id")
        )
        
        return transcript
        
    except Exception as e:
        logger.error(f"Error generating transcript: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate transcript")

@router.get("/classes/{class_id}/rankings")
async def get_class_rankings(
    class_id: str,
    academic_year: str = Query(...),
    term: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Get class rankings based on GPA/performance."""
    if not has_permission(current_user.get("role"), Permission.READ_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to view class rankings"
        )
    
    try:
        grade_calc_service = GradeCalculationService()
        
        rankings = await grade_calc_service.calculate_class_rankings(
            class_id,
            academic_year,
            term,
            get_student_collection(),
            get_exam_results_collection(),
            get_exams_collection(),
            get_grading_scales_collection(),
            current_user.get("branch_id")
        )
        
        return {
            "class_id": class_id,
            "academic_year": academic_year,
            "term": term,
            "rankings": rankings,
            "total_students": len(rankings)
        }
        
    except Exception as e:
        logger.error(f"Error calculating class rankings: {e}")
        raise HTTPException(status_code=500, detail="Failed to calculate rankings")

@router.put("/exam-results/{exam_id}/{student_id}/realtime")
async def update_grade_realtime(
    exam_id: str,
    student_id: str,
    new_marks: float = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Update grade in real-time with immediate propagation."""
    if not has_permission(current_user.get("role"), Permission.UPDATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to update grades"
        )
    
    try:
        from ..db import get_parents_collection, get_notifications_collection
        
        realtime_service = RealtimeGradeService()
        websocket_manager = WebSocketManager(None)
        
        result = await realtime_service.update_grade_realtime(
            exam_id,
            student_id,
            new_marks,
            current_user.get("user_id"),
            get_exam_results_collection(),
            get_exams_collection(),
            get_student_collection(),
            get_parents_collection(),
            get_grading_scales_collection(),
            get_notifications_collection(),
            websocket_manager,
            current_user.get("branch_id")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error updating grade in real-time: {e}")
        raise HTTPException(status_code=500, detail="Failed to update grade")

@router.post("/grades/publish-to-parents")
async def publish_grades_to_parents(
    student_id: str = Query(...),
    academic_year: str = Query(...),
    term: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    """Publish grades to parent portal."""
    if not has_permission(current_user.get("role"), Permission.UPDATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to publish grades"
        )
    
    try:
        from ..db import get_parents_collection, get_portal_notifications_collection
        
        parent_portal_service = ParentPortalService()
        websocket_manager = WebSocketManager(None)
        
        result = await parent_portal_service.publish_grades_to_parent_portal(
            student_id,
            academic_year,
            term,
            get_exam_results_collection(),
            get_exams_collection(),
            get_student_collection(),
            get_parents_collection(),
            get_portal_notifications_collection(),
            websocket_manager,
            current_user.get("user_id"),
            current_user.get("branch_id")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error publishing grades to parents: {e}")
        raise HTTPException(status_code=500, detail="Failed to publish grades")

@router.post("/grades/send-alert")
async def send_grade_alert(
    alert_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
):
    """Send automated grade alert to parents."""
    if not has_permission(current_user.get("role"), Permission.CREATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to send alerts"
        )
    
    try:
        from ..db import get_parents_collection, get_portal_notifications_collection
        
        parent_portal_service = ParentPortalService()
        websocket_manager = WebSocketManager(None)
        
        result = await parent_portal_service.send_grade_alert_to_parents(
            alert_data["student_id"],
            alert_data["alert_type"],
            alert_data,
            get_parents_collection(),
            get_portal_notifications_collection(),
            websocket_manager,
            current_user.get("user_id")
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error sending grade alert: {e}")
        raise HTTPException(status_code=500, detail="Failed to send alert")

@router.get("/students/{student_id}/grade-analytics")
async def get_grade_analytics(
    student_id: str,
    subject_id: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """Get comprehensive grade analytics for a student."""
    if not has_permission(current_user.get("role"), Permission.READ_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to view grade analytics"
        )
    
    try:
        from ..db import get_analytics_collection
        
        grade_calc_service = GradeCalculationService()
        
        analytics = await grade_calc_service.generate_grade_analytics(
            student_id,
            subject_id,
            academic_year,
            term,
            get_exam_results_collection(),
            get_exams_collection(),
            get_analytics_collection(),
            current_user.get("branch_id")
        )
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error generating grade analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate analytics")

@router.post("/process-automated-notifications")
async def process_automated_notifications(
    hours_since_last_check: int = Query(24, ge=1, le=168),  # 1 hour to 1 week
    current_user: User = Depends(get_current_user),
):
    """Process automated grade notifications for recent updates."""
    if not has_permission(current_user.get("role"), Permission.CREATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to process notifications"
        )
    
    try:
        from ..db import get_parents_collection, get_notifications_collection
        
        notification_service = GradeNotificationService()
        websocket_manager = WebSocketManager(None)
        
        result = await notification_service.process_automated_grade_notifications(
            get_exam_results_collection(),
            get_exams_collection(),
            get_student_collection(),
            get_parents_collection(),
            get_notifications_collection(),
            websocket_manager,
            current_user.get("branch_id"),
            hours_since_last_check
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error processing automated notifications: {e}")
        raise HTTPException(status_code=500, detail="Failed to process notifications")

# Report Card Template Management

@router.post("/report-templates", response_model=ReportCardTemplate)
async def create_report_template(
    template_data: ReportCardTemplateCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new report card template."""
    if not has_permission(current_user.get("role"), Permission.CREATE_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to create report templates"
        )
    
    try:
        from ..db import get_report_card_templates_collection
        
        template_dict = template_data.dict()
        template_dict.update({
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": current_user.get("user_id"),
            "branch_id": current_user.get("branch_id")
        })
        
        result = await get_report_card_templates_collection().insert_one(template_dict)
        template_dict["id"] = str(result.inserted_id)
        
        return ReportCardTemplate(**template_dict)
        
    except Exception as e:
        logger.error(f"Error creating report template: {e}")
        raise HTTPException(status_code=500, detail="Failed to create template")

@router.get("/report-templates", response_model=List[ReportCardTemplate])
async def list_report_templates(
    template_type: Optional[str] = Query(None),
    grade_level: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """List available report card templates."""
    if not has_permission(current_user.get("role"), Permission.READ_GRADE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Permission required to view templates"
        )
    
    try:
        from ..db import get_report_card_templates_collection
        
        query = {"is_active": True}
        if current_user.get("role") not in ["superadmin", "super_admin"]:
            query["branch_id"] = current_user.get("branch_id")
        if template_type:
            query["template_type"] = template_type
        if grade_level:
            query["grade_levels"] = {"$in": [grade_level]}
        
        templates = []
        async for template in get_report_card_templates_collection().find(query):
            template_data = {k: v for k, v in template.items() if k != "_id"}
            template_data["id"] = str(template["_id"])
            templates.append(ReportCardTemplate(**template_data))
        
        return templates
        
    except Exception as e:
        logger.error(f"Error listing report templates: {e}")
        raise HTTPException(status_code=500, detail="Failed to list templates")