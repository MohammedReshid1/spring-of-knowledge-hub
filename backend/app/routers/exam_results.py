from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime

from ..db import (
    get_exam_results_collection, get_exams_collection, get_grading_scales_collection,
    get_student_collection, get_parents_collection, get_classes_collection, get_reports_collection, 
    validate_student_id
)
from ..models.exam import ExamResultCreate, ExamResult, ExamResultUpdate
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import (
    sanitize_input, validate_amount, prevent_nosql_injection, validate_mongodb_id
)
from ..services.exam_grade_integration_service import ExamGradeIntegrationService, GradeUpdateTrigger
from ..utils.websocket_manager import WebSocketManager

router = APIRouter()

def calculate_grade_and_status(marks_obtained: float, total_marks: float, passing_marks: float, grading_scales: List[dict]) -> tuple:
    """Calculate grade and pass/fail status."""
    percentage = (marks_obtained / total_marks) * 100 if total_marks > 0 else 0
    
    # Determine grade
    grade = 'F'
    for scale in sorted(grading_scales, key=lambda x: x['min_percentage'], reverse=True):
        if percentage >= scale['min_percentage']:
            grade = scale['letter_grade']
            break
    
    # Determine pass/fail status
    status_result = 'pass' if marks_obtained >= passing_marks else 'fail'
    
    return grade, status_result, percentage

@router.post("/", response_model=ExamResult)
async def create_exam_result(
    result_in: ExamResultCreate,
    results_coll: Any = Depends(get_exam_results_collection),
    exams_coll: Any = Depends(get_exams_collection),
    grading_scales_coll: Any = Depends(get_grading_scales_collection),
    current_user: User = Depends(get_current_user),
):
    """Create or update exam result."""
    # Only admin and superadmin can create exam results
    if current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin can create exam results"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    # Sanitize input
    result_data = sanitize_input(result_in.dict(), [
        "exam_id", "student_id", "marks_obtained", "attendance_status",
        "submission_status", "graded_by", "graded_at", "feedback", "remarks"
    ])
    
    # Validate IDs
    if not validate_mongodb_id(result_data["exam_id"]):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    await validate_student_id(result_data["student_id"])
    
    # Check if exam exists
    exam = await exams_coll.find_one({"_id": ObjectId(result_data["exam_id"])})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Validate marks
    marks_obtained = validate_amount(result_data["marks_obtained"])
    if marks_obtained is None or marks_obtained < 0:
        raise HTTPException(status_code=400, detail="Invalid marks obtained")
    
    if marks_obtained > exam["total_marks"]:
        raise HTTPException(status_code=400, detail="Marks obtained cannot exceed total marks")
    
    # Check if result already exists
    existing_result = await results_coll.find_one({
        "exam_id": result_data["exam_id"],
        "student_id": result_data["student_id"]
    })
    
    if existing_result:
        raise HTTPException(status_code=400, detail="Result already exists for this student and exam")
    
    # Get grading scale
    grading_scales = []
    async for scale in grading_scales_coll.find({"is_active": True}):
        grading_scales.append(scale)
    
    # Calculate grade and status
    grade, result_status, percentage = calculate_grade_and_status(
        marks_obtained, exam["total_marks"], exam["passing_marks"], grading_scales
    )
    
    # Add calculated fields and branch isolation
    result_data.update({
        "marks_obtained": marks_obtained,
        "percentage": round(percentage, 2),
        "grade": grade,
        "status": result_status,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "graded_at": result_data.get("graded_at") or datetime.utcnow(),
        "branch_id": branch_id  # Add branch isolation
    })
    
    result = await results_coll.insert_one(result_data)
    result_data["id"] = str(result.inserted_id)
    
    # Trigger exam-grade integration
    try:
        websocket_manager = WebSocketManager()
        await ExamGradeIntegrationService.process_exam_result_update(
            exam_result=result_data,
            trigger=GradeUpdateTrigger.EXAM_RESULT_CREATED,
            exams_collection=exams_coll,
            exam_results_collection=results_coll,
            students_collection=get_student_collection(),
            parents_collection=get_parents_collection(),
            classes_collection=get_classes_collection(),
            reports_collection=get_reports_collection(),
            websocket_manager=websocket_manager,
            auto_generate_reports=True
        )
    except Exception as e:
        # Log error but don't fail the main operation
        logger.error(f"Error in exam-grade integration: {e}")
    
    return ExamResult(**result_data)

@router.get("/", response_model=List[ExamResult])
async def list_exam_results(
    exam_id: Optional[str] = Query(None),
    student_id: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    results_coll: Any = Depends(get_exam_results_collection),
    exams_coll: Any = Depends(get_exams_collection),
    current_user: User = Depends(get_current_user),
):
    """List exam results with optional filters."""
    query = {}
    
    if exam_id:
        if not validate_mongodb_id(exam_id):
            raise HTTPException(status_code=400, detail="Invalid exam ID")
        query["exam_id"] = exam_id
    
    if student_id:
        query["student_id"] = student_id
    
    if class_id:
        # Find exams for this class and filter results
        exam_ids = []
        async for exam in exams_coll.find({"class_id": class_id}):
            exam_ids.append(str(exam["_id"]))
        if exam_ids:
            query["exam_id"] = {"$in": exam_ids}
        else:
            return []  # No exams for this class
    
    # Build query with mandatory branch filtering
    if current_user.get("role") == "superadmin":
        # Superadmin sees all exam results
        pass
    else:
        # Regular users see only their branch's exam results
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []  # No branch = no data
        query["branch_id"] = user_branch_id
    
    query = prevent_nosql_injection(query)
    
    results = []
    async for result in results_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        results.append(ExamResult(id=str(result["_id"]), **{k: v for k, v in result.items() if k != "_id"}))
    
    return results

@router.get("/{result_id}", response_model=ExamResult)
async def get_exam_result(
    result_id: str,
    results_coll: Any = Depends(get_exam_results_collection),
    current_user: User = Depends(get_current_user),
):
    """Get exam result by ID."""
    if not validate_mongodb_id(result_id):
        raise HTTPException(status_code=400, detail="Invalid result ID")
    
    # Build query with branch filtering
    query = {"_id": ObjectId(result_id)}
    if current_user.get("role") != "superadmin":
        # Regular users can only access their branch's exam results
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User must be assigned to a branch")
        query["branch_id"] = branch_id
    
    result = await results_coll.find_one(query)
    if not result:
        raise HTTPException(status_code=404, detail="Exam result not found")
    
    return ExamResult(id=str(result["_id"]), **{k: v for k, v in result.items() if k != "_id"})

@router.put("/{result_id}", response_model=ExamResult)
async def update_exam_result(
    result_id: str,
    result_update: ExamResultUpdate,
    results_coll: Any = Depends(get_exam_results_collection),
    exams_coll: Any = Depends(get_exams_collection),
    grading_scales_coll: Any = Depends(get_grading_scales_collection),
    current_user: User = Depends(get_current_user),
):
    """Update exam result."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to update exam results")
    
    if not validate_mongodb_id(result_id):
        raise HTTPException(status_code=400, detail="Invalid result ID")
    
    # Check if result exists
    existing_result = await results_coll.find_one({"_id": ObjectId(result_id)})
    if not existing_result:
        raise HTTPException(status_code=404, detail="Exam result not found")
    
    # Get exam details
    exam = await exams_coll.find_one({"_id": ObjectId(existing_result["exam_id"])})
    if not exam:
        raise HTTPException(status_code=404, detail="Associated exam not found")
    
    # Prepare update data
    update_data = result_update.dict(exclude_unset=True)
    update_data = sanitize_input(update_data, list(update_data.keys()))
    
    # Validate marks if being updated
    if "marks_obtained" in update_data:
        marks_obtained = validate_amount(update_data["marks_obtained"])
        if marks_obtained is None or marks_obtained < 0:
            raise HTTPException(status_code=400, detail="Invalid marks obtained")
        
        if marks_obtained > exam["total_marks"]:
            raise HTTPException(status_code=400, detail="Marks obtained cannot exceed total marks")
        
        # Recalculate grade and status
        grading_scales = []
        async for scale in grading_scales_coll.find({"is_active": True}):
            grading_scales.append(scale)
        
        grade, result_status, percentage = calculate_grade_and_status(
            marks_obtained, exam["total_marks"], exam["passing_marks"], grading_scales
        )
        
        update_data.update({
            "marks_obtained": marks_obtained,
            "percentage": round(percentage, 2),
            "grade": grade,
            "status": result_status
        })
    
    update_data["updated_at"] = datetime.utcnow()
    
    await results_coll.update_one({"_id": ObjectId(result_id)}, {"$set": update_data})
    
    updated_result = await results_coll.find_one({"_id": ObjectId(result_id)})
    return ExamResult(id=str(updated_result["_id"]), **{k: v for k, v in updated_result.items() if k != "_id"})

@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam_result(
    result_id: str,
    results_coll: Any = Depends(get_exam_results_collection),
    current_user: User = Depends(get_current_user),
):
    """Delete exam result."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to delete exam results")
    
    if not validate_mongodb_id(result_id):
        raise HTTPException(status_code=400, detail="Invalid result ID")
    
    result = await results_coll.delete_one({"_id": ObjectId(result_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Exam result not found")

@router.get("/student/{student_id}/summary")
async def get_student_exam_summary(
    student_id: str,
    academic_year: Optional[str] = Query(None),
    term: Optional[str] = Query(None),
    results_coll: Any = Depends(get_exam_results_collection),
    exams_coll: Any = Depends(get_exams_collection),
    current_user: User = Depends(get_current_user),
):
    """Get exam summary for a student."""
    await validate_student_id(student_id)
    
    # Build query for exams
    exam_query = {}
    if academic_year:
        exam_query["academic_year"] = academic_year
    if term:
        exam_query["term"] = term
    
    # Get exam IDs
    exam_ids = []
    async for exam in exams_coll.find(exam_query):
        exam_ids.append(str(exam["_id"]))
    
    if not exam_ids:
        return {"student_id": student_id, "results": [], "summary": {}}
    
    # Get results for this student
    results = []
    async for result in results_coll.find({
        "student_id": student_id,
        "exam_id": {"$in": exam_ids}
    }):
        # Get exam details
        exam = await exams_coll.find_one({"_id": ObjectId(result["exam_id"])})
        result_data = {
            "id": str(result["_id"]),
            "exam_name": exam["name"] if exam else "Unknown",
            "subject_id": exam["subject_id"] if exam else None,
            "exam_type": exam["exam_type"] if exam else None,
            "marks_obtained": result["marks_obtained"],
            "total_marks": exam["total_marks"] if exam else 0,
            "percentage": result["percentage"],
            "grade": result["grade"],
            "status": result["status"],
            "exam_date": exam["exam_date"] if exam else None
        }
        results.append(result_data)
    
    # Calculate summary
    total_exams = len(results)
    passed_exams = len([r for r in results if r["status"] == "pass"])
    failed_exams = total_exams - passed_exams
    
    avg_percentage = sum(r["percentage"] for r in results) / total_exams if total_exams > 0 else 0
    
    summary = {
        "total_exams": total_exams,
        "passed_exams": passed_exams,
        "failed_exams": failed_exams,
        "pass_rate": round((passed_exams / total_exams) * 100, 2) if total_exams > 0 else 0,
        "average_percentage": round(avg_percentage, 2)
    }
    
    return {
        "student_id": student_id,
        "results": results,
        "summary": summary
    }