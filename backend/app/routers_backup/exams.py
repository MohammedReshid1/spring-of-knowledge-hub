from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime
import statistics

from ..db import (
    get_exams_collection, get_exam_results_collection, get_grading_scales_collection,
    get_student_collection, get_classes_collection, validate_branch_id,
    validate_student_id, validate_class_id, validate_subject_id, validate_teacher_id
)
from ..models.exam import (
    ExamCreate, Exam, ExamUpdate, ExamResultCreate, ExamResult, 
    ExamResultUpdate, GradingScale, GradingScaleCreate, ExamStats
)
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import (
    sanitize_input, validate_amount, prevent_nosql_injection, validate_mongodb_id
)

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
    # Check permissions
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to create exams")
    
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
    
    # Add metadata
    now = datetime.utcnow()
    exam_data.update({
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("user_id")
    })
    
    result = await exams_coll.insert_one(exam_data)
    exam_data["id"] = str(result.inserted_id)
    
    return Exam(**exam_data)

@router.get("/", response_model=List[Exam])
async def list_exams(
    class_id: Optional[str] = Query(None),
    subject_id: Optional[str] = Query(None),
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    exam_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    exams_coll: Any = Depends(get_exams_collection),
    current_user: User = Depends(get_current_user),
):
    """List exams with optional filters."""
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
    
    # Add branch filter for non-admin users
    if current_user.get('role') in ['branch_admin'] and current_user.get('branch_id'):
        query["branch_id"] = current_user.get('branch_id')
    
    query = prevent_nosql_injection(query)
    
    exams = []
    async for exam in exams_coll.find(query).skip(skip).limit(limit).sort("exam_date", -1):
        exam_data = {k: v for k, v in exam.items() if k != "_id"}
        # Handle None values for required fields
        if exam_data.get("created_by") is None:
            exam_data["created_by"] = ""
        exams.append(Exam(id=str(exam["_id"]), **exam_data))
    
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
    
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
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
    return Exam(id=str(updated_exam["_id"]), **exam_data)

@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: str,
    exams_coll: Any = Depends(get_exams_collection),
    results_coll: Any = Depends(get_exam_results_collection),
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
    
    # Delete exam results first
    await results_coll.delete_many({"exam_id": exam_id})
    
    # Delete exam
    result = await exams_coll.delete_one({"_id": ObjectId(exam_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam not found")

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