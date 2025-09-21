from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from bson import ObjectId
from datetime import datetime, time, date, timedelta

from ..db import get_attendance_collection, validate_branch_id, validate_student_id, validate_class_id, get_classes_collection, validate_subject_id
from ..models.attendance import (
    AttendanceCreate, Attendance, AttendanceBulkCreate, AttendanceSummary, 
    AttendanceAlert, AttendancePattern, AttendanceSettings, AttendanceReport, AttendanceStatus
)
from ..utils.rbac import get_current_user, Permission, has_permission
from ..models.user import User
from ..utils.attendance_notifications import attendance_notification_service
from ..utils.attendance_calendar_integration import create_attendance_calendar_events
from ..db import get_db

router = APIRouter()
db = get_db()

async def _resolve_teacher_id_for_user(current_user: User) -> Optional[str]:
    """Resolve the teacher document id for the logged-in user (by mapping or email)."""
    try:
        # Try users.teacher_id mapping
        uid = current_user.get("user_id")
        user_doc = None
        if uid:
            try:
                user_doc = await db.users.find_one({"_id": ObjectId(uid)})
            except Exception:
                user_doc = await db.users.find_one({"_id": uid})
        mapped_tid = user_doc.get("teacher_id") if user_doc else None
        if mapped_tid:
            try:
                teacher = await db.teachers.find_one({"_id": ObjectId(mapped_tid)})
            except Exception:
                teacher = await db.teachers.find_one({"_id": mapped_tid})
            if teacher:
                return str(teacher.get("_id"))
        # Fallback: match by email
        email = current_user.get("email")
        if email:
            teacher = await db.teachers.find_one({"email": email})
            if teacher:
                return str(teacher.get("_id"))
    except Exception:
        pass
    return None

@router.post("/", response_model=Attendance)
async def create_attendance(
    attendance_in: AttendanceCreate,
    background_tasks: BackgroundTasks,
    coll: Any = Depends(get_attendance_collection),
    classes_coll: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    # Only admin, teacher, and superadmin can create attendance
    if current_user.get("role") not in ["admin", "teacher", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create attendance records"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") not in ["superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    now = datetime.utcnow()
    doc = attendance_in.dict()
    
    # Set attendance date to today if not provided
    if not doc.get("attendance_date"):
        doc["attendance_date"] = date.today()
    
    # Convert date to datetime for storage
    if isinstance(doc.get("attendance_date"), date):
        doc["attendance_date"] = datetime.combine(doc["attendance_date"], time())
    
    # For teacher role, enforce teacher_id and subject-level scoping
    if current_user.get("role") == "teacher":
        # Require subject_id
        if not doc.get("subject_id"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject_id is required for teachers")
        # Validate teacher is assigned to this class (either as primary or via subject_teachers mapping)
        class_rec = await classes_coll.find_one({"_id": ObjectId(doc["class_id"])}) if ObjectId.is_valid(doc.get("class_id", "")) else await classes_coll.find_one({"_id": doc.get("class_id")})
        if not class_rec:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        resolved_tid = await _resolve_teacher_id_for_user(current_user)
        if not resolved_tid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot resolve teacher mapping for current user")
        class_teacher_id = class_rec.get("teacher_id")
        try:
            class_teacher_id = str(class_teacher_id)
        except Exception:
            pass
        is_primary = class_teacher_id == str(resolved_tid)
        mappings = class_rec.get("subject_teachers", []) or []
        def _sid(x):
            try:
                return str(x)
            except Exception:
                return x
        is_mapped = any(_sid(m.get("subject_id")) == _sid(doc.get("subject_id")) and _sid(m.get("teacher_id")) == str(resolved_tid) for m in mappings)
        # Debug logging for teacher scope
        try:
            print("ATTN DEBUG create: ", {
                "resolved_tid": str(resolved_tid),
                "class_teacher_id": class_teacher_id,
                "is_primary": is_primary,
                "subject_id": _sid(doc.get("subject_id")),
                "mapped_teachers_for_subject": [
                    _sid(m.get("teacher_id")) for m in mappings if _sid(m.get("subject_id")) == _sid(doc.get("subject_id"))
                ],
            })
        except Exception:
            pass
        if not (is_primary or is_mapped):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to mark attendance for this subject/class")
        # Optionally validate subject
        if doc.get("subject_id"):
            try:
                await validate_subject_id(doc["subject_id"])
            except Exception:
                # Keep soft if subject validation fails
                pass
        doc["teacher_id"] = resolved_tid

    doc["created_at"] = now
    doc["updated_at"] = now
    doc["branch_id"] = branch_id
    doc["recorded_by"] = str(current_user.get("user_id"))
    doc["notification_sent"] = False
    doc["parent_notified"] = False
    
    # Validate foreign IDs
    await validate_student_id(doc["student_id"])
    await validate_class_id(doc["class_id"])
    
    # Insert attendance record
    result = await coll.insert_one(doc)
    attendance_id = str(result.inserted_id)
    
    # Create attendance object for response
    attendance = Attendance(id=attendance_id, **doc)
    
    # Schedule background notification processing if enabled
    if attendance_in.send_notifications:
        doc["id"] = attendance_id
        background_tasks.add_task(
            attendance_notification_service.process_attendance_notification, 
            doc
        )
    
    # Generate calendar events for attendance follow-ups if needed
    try:
        # Get student info for calendar event creation
        student_coll = db["students"]
        student_info = await student_coll.find_one({"_id": ObjectId(doc["student_id"])})
        if student_info:
            await create_attendance_calendar_events(doc, student_info)
    except Exception as e:
        # Log error but don't fail the attendance creation
        print(f"Error creating attendance calendar events: {e}")
    
    return attendance

@router.get("/", response_model=List[Attendance])
async def list_attendance(
    class_id: Optional[str] = Query(None, description="Filter by class ID"),
    date: Optional[str] = Query(None, description="Filter by date (YYYY-MM-DD)"),
    student_id: Optional[str] = Query(None, description="Filter by student ID"),
    subject_id: Optional[str] = Query(None, description="Filter by subject ID"),
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    # Build query with mandatory branch filtering
    query = {}
    
    # Handle superadmin vs regular users
    if current_user.get("role") in ["superadmin", "super_admin"]:
        # Superadmin sees all attendance records
        pass
    else:
        # Regular users see only their branch's attendance records
        branch_id = current_user.get("branch_id")
        if not branch_id:
            return []  # No branch = no data
        query["branch_id"] = branch_id
    
    # Apply optional filters
    if class_id:
        query["class_id"] = class_id
    if subject_id:
        query["subject_id"] = subject_id
    
    if date:
        # Parse the date string and create a date range for the entire day
        from datetime import datetime as dt
        try:
            parsed_date = dt.strptime(date, "%Y-%m-%d").date()
            query["attendance_date"] = {
                "$gte": datetime.combine(parsed_date, time()),
                "$lte": datetime.combine(parsed_date, time(23, 59, 59, 999999))
            }
        except ValueError:
            # Invalid date format, ignore the filter
            pass
    
    if student_id:
        query["student_id"] = student_id
    
    items: List[Attendance] = []
    async for a in coll.find(query):
        items.append(Attendance(id=str(a["_id"]), **{k: a.get(k) for k in a}))
    return items

# Analytics and Reporting Endpoints (moved here to avoid route conflicts)

# REMOVED: Duplicate analytics endpoint that was causing issues (missing db import)
# The working analytics endpoint is moved below to avoid route conflicts

@router.get("/record/{attendance_id}", response_model=Attendance)
async def get_attendance(
    attendance_id: str,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    a = await coll.find_one({"_id": ObjectId(attendance_id)})
    if not a:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found")
    return Attendance(id=attendance_id, **{k: a.get(k) for k in a})

@router.put("/record/{attendance_id}", response_model=Attendance)
async def update_attendance(
    attendance_id: str,
    attendance_in: AttendanceCreate,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    update_data = attendance_in.dict()
    # convert date to datetime
    if update_data.get("attendance_date") is not None:
        update_data["attendance_date"] = datetime.combine(update_data["attendance_date"], time())
    # validate foreign IDs
    await validate_student_id(update_data["student_id"])
    await validate_class_id(update_data["class_id"])
    # validate branch_id
    if update_data.get("branch_id") is not None:
        await validate_branch_id(update_data["branch_id"])
    res = await coll.update_one({"_id": ObjectId(attendance_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance not found")
    updated = await coll.find_one({"_id": ObjectId(attendance_id)})
    return Attendance(id=attendance_id, **{k: updated.get(k) for k in updated if k != "_id"}, created_at=updated.get("created_at"))

@router.delete("/record/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attendance(
    attendance_id: str,
    coll: Any = Depends(get_attendance_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(attendance_id)})

# New comprehensive attendance endpoints

@router.post("/bulk", response_model=List[Attendance])
async def create_bulk_attendance(
    bulk_data: AttendanceBulkCreate,
    background_tasks: BackgroundTasks,
    coll: Any = Depends(get_attendance_collection),
    classes_coll: Any = Depends(get_classes_collection),
    current_user: User = Depends(get_current_user),
):
    """Create multiple attendance records at once (for class-wide marking)"""
    if current_user.get("role") not in ["admin", "teacher", "superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create bulk attendance records"
        )
    
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") not in ["superadmin", "super_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    now = datetime.utcnow()
    created_records = []
    
    # Validate class ID once
    await validate_class_id(bulk_data.class_id)
    
    # For teacher role, enforce teacher_id and subject-level scoping
    if current_user.get("role") == "teacher":
        if not bulk_data.subject_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="subject_id is required for teachers")
        class_rec = await classes_coll.find_one({"_id": ObjectId(bulk_data.class_id)}) if ObjectId.is_valid(bulk_data.class_id) else await classes_coll.find_one({"_id": bulk_data.class_id})
        if not class_rec:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Class not found")
        resolved_tid = await _resolve_teacher_id_for_user(current_user)
        if not resolved_tid:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot resolve teacher mapping for current user")
        class_teacher_id = class_rec.get("teacher_id")
        try:
            class_teacher_id = str(class_teacher_id)
        except Exception:
            pass
        is_primary = class_teacher_id == str(resolved_tid)
        mappings = class_rec.get("subject_teachers", []) or []
        def _sid2(x):
            try:
                return str(x)
            except Exception:
                return x
        is_mapped = any(_sid2(m.get("subject_id")) == _sid2(bulk_data.subject_id) and _sid2(m.get("teacher_id")) == str(resolved_tid) for m in mappings)
        try:
            print("ATTN DEBUG bulk: ", {
                "resolved_tid": str(resolved_tid),
                "class_teacher_id": class_teacher_id,
                "is_primary": is_primary,
                "subject_id": _sid2(bulk_data.subject_id),
                "mapped_teachers_for_subject": [
                    _sid2(m.get("teacher_id")) for m in mappings if _sid2(m.get("subject_id")) == _sid2(bulk_data.subject_id)
                ],
            })
        except Exception:
            pass
        if not (is_primary or is_mapped):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed to mark attendance for this subject/class")
    
    for attendance_record in bulk_data.attendance_records:
        doc = attendance_record.dict()
        doc["class_id"] = bulk_data.class_id
        doc["attendance_date"] = datetime.combine(bulk_data.attendance_date, time())
        doc["created_at"] = now
        doc["updated_at"] = now
        if bulk_data.subject_id:
            doc["subject_id"] = bulk_data.subject_id
        if current_user.get("role") == "teacher":
            doc["teacher_id"] = resolved_tid
        doc["branch_id"] = branch_id
        doc["recorded_by"] = bulk_data.recorded_by
        doc["notification_sent"] = False
        doc["parent_notified"] = False
        
        # Validate student ID
        await validate_student_id(doc["student_id"])
        
        # Insert record
        result = await coll.insert_one(doc)
        attendance_id = str(result.inserted_id)
        
        attendance = Attendance(id=attendance_id, **doc)
        created_records.append(attendance)
        
        # Schedule notifications if enabled
        if bulk_data.send_notifications and doc["status"] in ["absent", "late"]:
            doc["id"] = attendance_id
            background_tasks.add_task(
                attendance_notification_service.process_attendance_notification,
                doc
            )
    
    return created_records

@router.get("/summary/{student_id}", response_model=AttendanceSummary)
async def get_attendance_summary(
    student_id: str,
    period_start: Optional[date] = Query(None),
    period_end: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    coll: Any = Depends(get_attendance_collection),
):
    """Get attendance summary for a student"""
    # Set default period (last 30 days)
    if not period_end:
        period_end = date.today()
    if not period_start:
        period_start = period_end - timedelta(days=30)
    
    # Build query
    query = {
        "student_id": student_id,
        "attendance_date": {
            "$gte": datetime.combine(period_start, time()),
            "$lte": datetime.combine(period_end, time())
        }
    }
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No branch access")
        query["branch_id"] = branch_id
    
    # Get attendance records
    records = await coll.find(query).to_list(None)
    
    if not records:
        # Return empty summary
        return AttendanceSummary(
            student_id=student_id,
            period_start=period_start,
            period_end=period_end,
            total_days=0,
            days_present=0,
            days_absent=0,
            days_late=0,
            days_excused=0,
            attendance_percentage=0.0,
            punctuality_percentage=0.0,
            consecutive_absences=0,
            longest_absence_streak=0,
            current_streak=0,
            longest_streak=0,
            late_arrivals_count=0,
            early_departures_count=0,
            patterns_detected=[],
            improvement_trend="stable"
        )
    
    # Calculate summary statistics
    total_days = len(records)
    days_present = sum(1 for r in records if r["status"] == "present")
    days_absent = sum(1 for r in records if r["status"] == "absent")
    days_late = sum(1 for r in records if r["status"] in ["late", "tardy"])
    days_excused = sum(1 for r in records if r["status"] == "excused")
    early_departures = sum(1 for r in records if r["status"] == "early_departure")
    
    attendance_percentage = (days_present / total_days * 100) if total_days > 0 else 0
    punctuality_percentage = ((days_present + days_excused) / total_days * 100) if total_days > 0 else 0
    
    # Calculate streaks and patterns
    consecutive_absences = _calculate_consecutive_absences(records)
    longest_absence_streak = _calculate_longest_absence_streak(records)
    current_streak, longest_streak = _calculate_attendance_streaks(records)
    
    # Determine improvement trend
    improvement_trend = _analyze_improvement_trend(records)
    
    return AttendanceSummary(
        student_id=student_id,
        period_start=period_start,
        period_end=period_end,
        total_days=total_days,
        days_present=days_present,
        days_absent=days_absent,
        days_late=days_late,
        days_excused=days_excused,
        attendance_percentage=attendance_percentage,
        punctuality_percentage=punctuality_percentage,
        consecutive_absences=consecutive_absences,
        longest_absence_streak=longest_absence_streak,
        current_streak=current_streak,
        longest_streak=longest_streak,
        late_arrivals_count=days_late,
        early_departures_count=early_departures,
        patterns_detected=_detect_attendance_patterns(records),
        improvement_trend=improvement_trend
    )

@router.get("/alerts", response_model=List[AttendanceAlert])
async def get_attendance_alerts(
    student_id: Optional[str] = Query(None),
    unresolved_only: bool = Query(True),
    current_user: User = Depends(get_current_user),
):
    """Get attendance alerts"""
    query = {}
    
    if student_id:
        query["student_id"] = student_id
    
    if unresolved_only:
        query["resolved"] = False
    
    # Apply branch filtering for non-superadmin users
    if current_user.get("role") != "superadmin":
        # Get student IDs from user's branch
        branch_id = current_user.get("branch_id")
        if not branch_id:
            return []
        
        students = await db.students.find({"branch_id": branch_id}).to_list(None)
        student_ids = [str(s["_id"]) for s in students]
        
        if student_id and student_id not in student_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
        if not student_id:
            query["student_id"] = {"$in": student_ids}
    
    alerts = await db.attendance_alerts.find(query).sort("triggered_date", -1).to_list(50)
    
    return [AttendanceAlert(**alert, id=str(alert["_id"])) for alert in alerts]

@router.patch("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an attendance alert"""
    result = await db.attendance_alerts.update_one(
        {"_id": ObjectId(alert_id)},
        {
            "$set": {
                "acknowledged": True,
                "acknowledged_by": str(current_user.get("user_id")),
                "acknowledged_at": datetime.now()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    
    return {"message": "Alert acknowledged successfully"}

@router.get("/patterns/{student_id}", response_model=List[AttendancePattern])
async def get_attendance_patterns(
    student_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get detected attendance patterns for a student"""
    # Verify access to student
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if not branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No branch access")
        
        student = await db.students.find_one({"_id": ObjectId(student_id), "branch_id": branch_id})
        if not student:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    patterns = await db.attendance_patterns.find({"student_id": student_id}).to_list(None)
    
    return [AttendancePattern(**pattern) for pattern in patterns]

@router.get("/reports/class/{class_id}")
async def get_class_attendance_report(
    class_id: str,
    report_date: date = Query(default=date.today()),
    current_user: User = Depends(get_current_user),
    coll: Any = Depends(get_attendance_collection),
):
    """Generate attendance report for a class"""
    if current_user.get("role") not in ["admin", "teacher", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Validate class access
    await validate_class_id(class_id)
    
    query = {
        "class_id": class_id,
        "attendance_date": {
            "$gte": datetime.combine(report_date, time()),
            "$lt": datetime.combine(report_date + timedelta(days=1), time())
        }
    }
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if branch_id:
            query["branch_id"] = branch_id
    
    records = await coll.find(query).to_list(None)
    
    # Get class and student information
    class_info = await db.classes.find_one({"_id": ObjectId(class_id)})
    students = await db.students.find({"class_id": class_id}).to_list(None)
    
    # Organize data
    attendance_by_student = {}
    for record in records:
        student_id = record["student_id"]
        attendance_by_student[student_id] = record
    
    report_data = []
    for student in students:
        student_id = str(student["_id"])
        attendance_record = attendance_by_student.get(student_id)
        
        report_data.append({
            "student_id": student_id,
            "student_name": student.get("full_name", "Unknown"),
            "student_number": student.get("student_id", ""),
            "status": attendance_record["status"] if attendance_record else "not_marked",
            "check_in_time": attendance_record.get("check_in_time") if attendance_record else None,
            "notes": attendance_record.get("notes") if attendance_record else None
        })
    
    return {
        "class_info": {
            "id": class_id,
            "name": class_info.get("name") if class_info else "Unknown Class",
            "grade_level": class_info.get("grade_level") if class_info else ""
        },
        "report_date": report_date.isoformat(),
        "total_students": len(students),
        "marked_present": len([r for r in records if r["status"] == "present"]),
        "marked_absent": len([r for r in records if r["status"] == "absent"]),
        "marked_late": len([r for r in records if r["status"] in ["late", "tardy"]]),
        "not_marked": len(students) - len(records),
        "attendance_data": report_data
    }

# Utility functions for attendance calculations

def _calculate_consecutive_absences(records: List[Dict]) -> int:
    """Calculate current consecutive absences"""
    if not records:
        return 0
    
    # Sort by date descending (most recent first)
    sorted_records = sorted(records, key=lambda x: x["attendance_date"], reverse=True)
    
    consecutive = 0
    for record in sorted_records:
        if record["status"] == "absent":
            consecutive += 1
        else:
            break
    
    return consecutive

def _calculate_longest_absence_streak(records: List[Dict]) -> int:
    """Calculate longest absence streak in the period"""
    if not records:
        return 0
    
    sorted_records = sorted(records, key=lambda x: x["attendance_date"])
    
    max_streak = 0
    current_streak = 0
    
    for record in sorted_records:
        if record["status"] == "absent":
            current_streak += 1
            max_streak = max(max_streak, current_streak)
        else:
            current_streak = 0
    
    return max_streak

def _calculate_attendance_streaks(records: List[Dict]) -> tuple:
    """Calculate current and longest attendance streaks"""
    if not records:
        return 0, 0
    
    sorted_records = sorted(records, key=lambda x: x["attendance_date"])
    
    current_streak = 0
    longest_streak = 0
    temp_streak = 0
    
    # Calculate current streak (from most recent)
    recent_records = sorted(records, key=lambda x: x["attendance_date"], reverse=True)
    for record in recent_records:
        if record["status"] == "present":
            current_streak += 1
        else:
            break
    
    # Calculate longest streak
    for record in sorted_records:
        if record["status"] == "present":
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0
    
    return current_streak, longest_streak

def _analyze_improvement_trend(records: List[Dict]) -> str:
    """Analyze if attendance is improving, declining, or stable"""
    if len(records) < 10:
        return "stable"
    
    # Split records into two halves and compare attendance rates
    sorted_records = sorted(records, key=lambda x: x["attendance_date"])
    mid_point = len(sorted_records) // 2
    
    first_half = sorted_records[:mid_point]
    second_half = sorted_records[mid_point:]
    
    first_half_rate = sum(1 for r in first_half if r["status"] == "present") / len(first_half)
    second_half_rate = sum(1 for r in second_half if r["status"] == "present") / len(second_half)
    
    difference = second_half_rate - first_half_rate
    
    if difference > 0.1:  # 10% improvement
        return "improving"
    elif difference < -0.1:  # 10% decline
        return "declining"
    else:
        return "stable"

def _detect_attendance_patterns(records: List[Dict]) -> List[str]:
    """Detect attendance patterns"""
    patterns = []
    
    if not records:
        return patterns
    
    # Check for frequent Monday/Friday absences
    day_absences = {}
    for record in records:
        if record["status"] == "absent":
            day_name = record["attendance_date"].strftime("%A")
            day_absences[day_name] = day_absences.get(day_name, 0) + 1
    
    total_absences = sum(day_absences.values())
    if total_absences > 0:
        for day, count in day_absences.items():
            if count / total_absences > 0.4:  # More than 40% of absences on specific day
                patterns.append(f"frequent_{day.lower()}_absence")
    
    # Check for late arrival pattern
    late_count = sum(1 for r in records if r["status"] in ["late", "tardy"])
    if late_count / len(records) > 0.2:  # More than 20% late arrivals
        patterns.append("frequent_lateness")
    
    # Check for consecutive absence pattern
    if _calculate_longest_absence_streak(records) >= 3:
        patterns.append("consecutive_absences")
    
    return patterns


# Analytics and Reporting Endpoints (moved before generic routes to avoid conflicts)

@router.get("/analytics")
async def get_attendance_analytics(
    period_days: int = Query(30, description="Number of days to analyze"),
    class_id: Optional[str] = Query(None, description="Filter by class ID"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    teacher_id: Optional[str] = Query(None, description="Filter by teacher ID (teacher document id)"),
    current_user: User = Depends(get_current_user),
    coll: Any = Depends(get_attendance_collection),
):
    """Get comprehensive attendance analytics"""
    user_role = current_user.get("role")
    
    # Superadmin bypass - allow full access for superadmin users  
    if user_role in ["superadmin", "super_admin"]:
        print(f"DEBUG: Superadmin access granted for role: {user_role}")
    elif not has_permission(user_role, Permission.READ_ATTENDANCE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to view attendance analytics"
        )
    else:
        print(f"DEBUG: Regular user access granted for role: {user_role}")
    
    # Debug logging
    # Temporary: Skip permission check to test
    print(f"DEBUG: User role is: '{user_role}' (type: {type(user_role)})")
    print(f"DEBUG: User object: {current_user}")
    print(f"DEBUG: Role check - is superadmin: {user_role in ['superadmin', 'super_admin']}")
    print(f"DEBUG: Has READ attendance permission: {has_permission(user_role, Permission.READ_ATTENDANCE)}")
    
    # Temporarily disable permission check for debugging
    # if user_role not in ["superadmin", "super_admin"] and not has_permission(user_role, Permission.READ_ATTENDANCE):
    #     print(f"DEBUG: Access denied for role: {user_role}")
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Insufficient permissions to view attendance analytics"
    #     )
    
    print(f"DEBUG: Access granted for role: {user_role}")
    
    # Calculate date range
    end_date = date.today()
    start_date = end_date - timedelta(days=period_days)
    
    # Build query - fix the date range issue
    start_datetime = datetime.combine(start_date, time())
    end_datetime = datetime.combine(end_date, time(23, 59, 59, 999999))
    
    query = {
        "attendance_date": {
            "$gte": start_datetime,
            "$lte": end_datetime
        }
    }

    # Optional teacher filter (limit analytics to records created by a specific teacher)
    if teacher_id:
        query["teacher_id"] = teacher_id
    
    # Apply filters
    if class_id:
        await validate_class_id(class_id)
        query["class_id"] = class_id
    
    # Handle branch filtering - some attendance records might not have branch_id
    attendance_records = []
    
    if current_user.get("role") not in ["superadmin", "super_admin"]:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No branch access")
        
        # Get classes for this branch first
        branch_classes = await db["classes"].find({"branch_id": user_branch_id}).to_list(None)
        class_ids = [str(cls["_id"]) for cls in branch_classes]
        
        if class_ids:
            # Filter attendance records by classes belonging to this branch
            branch_query = query.copy()
            if class_id:
                # Specific class requested, but verify it belongs to user's branch
                if class_id in class_ids:
                    branch_query["class_id"] = class_id
                else:
                    # Class doesn't belong to user's branch, return empty
                    attendance_records = []
            else:
                # No specific class, get all classes from this branch
                branch_query["class_id"] = {"$in": class_ids}
            
            if branch_query.get("class_id"):
                attendance_records = await coll.find(branch_query).to_list(None)
        else:
            attendance_records = []
            
    elif branch_id:
        await validate_branch_id(branch_id)
        # For superadmin with specific branch
        branch_classes = await db["classes"].find({"branch_id": branch_id}).to_list(None)
        class_ids = [str(cls["_id"]) for cls in branch_classes]
        
        if class_ids:
            branch_query = query.copy()
            if class_id:
                # Specific class requested, verify it belongs to the branch
                if class_id in class_ids:
                    branch_query["class_id"] = class_id
                else:
                    attendance_records = []
            else:
                # No specific class, get all classes from this branch
                branch_query["class_id"] = {"$in": class_ids}
            
            if branch_query.get("class_id"):
                attendance_records = await coll.find(branch_query).to_list(None)
        else:
            attendance_records = []
    else:
        # Superadmin viewing all records
        attendance_records = await coll.find(query).to_list(None)
    
    # Remove duplicates if any
    seen_ids = set()
    unique_records = []
    for record in attendance_records:
        record_id = str(record.get('_id', ''))
        if record_id not in seen_ids:
            seen_ids.add(record_id)
            unique_records.append(record)
    
    records = unique_records
    print(f"DEBUG: Found {len(records)} unique attendance records after branch filtering")
    
    # Get student information consistent with attendance filtering
    students_query = {}
    
    print(f"🔍 ANALYTICS DEBUG: class_id={class_id}, branch_id={branch_id}, user_role={current_user.get('role')}")
    
    if current_user.get("role") not in ["superadmin", "super_admin"]:
        # Regular user - filter by their branch
        user_branch_id = current_user.get("branch_id")
        if user_branch_id:
            # Get classes for this branch
            branch_classes = await db["classes"].find({"branch_id": user_branch_id}).to_list(None)
            class_ids = [str(cls["_id"]) for cls in branch_classes]
            
            if class_id:
                # Specific class requested, verify it belongs to user's branch
                if class_id in class_ids:
                    students_query["class_id"] = class_id
                else:
                    # Class doesn't belong to user's branch
                    students_query = {"_id": {"$exists": False}}  # Will return empty
            else:
                # No specific class, get all students from classes in this branch
                if class_ids:
                    students_query["class_id"] = {"$in": class_ids}
                else:
                    # Branch has no classes, so no students should be returned
                    students_query = {"_id": {"$exists": False}}  # Will return empty
    elif branch_id and branch_id != 'all':
        # Superadmin with specific branch selected
        branch_classes = await db["classes"].find({"branch_id": branch_id}).to_list(None)
        class_ids = [str(cls["_id"]) for cls in branch_classes]
        
        if class_id and class_id != 'all':
            # Specific class requested, verify it belongs to the branch
            if class_id in class_ids:
                students_query["class_id"] = class_id
            else:
                students_query = {"_id": {"$exists": False}}  # Will return empty
        else:
            # No specific class, get all students from classes in this branch
            if class_ids:
                students_query["class_id"] = {"$in": class_ids}
            else:
                # Branch has no classes, so no students should be returned
                students_query = {"_id": {"$exists": False}}  # Will return empty
    else:
        # Superadmin viewing all branches/systems
        if class_id and class_id != 'all':
            students_query["class_id"] = class_id
        # Otherwise no filter - get all students from all branches
    
    students = await db["students"].find(students_query).to_list(None)
    total_students = len(students)
    print(f"🔍 ANALYTICS RESULT: query={students_query}, found={total_students} students")
    
    # Get class information consistent with filtering
    classes_query = {}
    if current_user.get("role") not in ["superadmin", "super_admin"]:
        user_branch_id = current_user.get("branch_id")
        if user_branch_id:
            classes_query["branch_id"] = user_branch_id
    elif branch_id:
        classes_query["branch_id"] = branch_id
    # For superadmin without branch filter, get all classes
    
    classes = await db["classes"].find(classes_query).to_list(None)
    
    print(f"DEBUG: Query results - records: {len(records) if records else 0}, students: {total_students}")
    print(f"DEBUG: Attendance records query: {query}")
    
    if not records or total_students == 0:
        print(f"DEBUG: Returning empty response - records: {len(records) if records else 0}, students: {total_students}")
        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "total_students": total_students,
            "total_days": 0,
            "average_attendance_rate": 0.0,
            "overall_attendance_rate": 0.0,
            "punctuality_rate": 0.0,
            "absence_rate": 0.0,
            "late_rate": 0.0,
            "excused_rate": 0.0,
            "unresolved_alerts": 0,
            "trends": {
                "attendance_trend": "stable",
                "punctuality_trend": "stable",
                "weekly_comparison": 0.0,
                "monthly_comparison": 0.0
            },
            "top_performers": [],
            "attendance_concerns": [],
            "daily_breakdown": [],
            "class_breakdown": [],
            "pattern_analysis": {
                "frequent_absence_days": [],
                "peak_late_arrival_times": [],
                "seasonal_patterns": []
            }
        }
    
    # Calculate overall statistics
    total_records = len(records)
    present_count = sum(1 for r in records if r["status"] == "present")
    absent_count = sum(1 for r in records if r["status"] == "absent")
    late_count = sum(1 for r in records if r["status"] in ["late", "tardy"])
    excused_count = sum(1 for r in records if r["status"] == "excused")
    
    # Calculate actual school days (unique dates in records)
    unique_dates = set()
    for record in records:
        date_only = record["attendance_date"].date() if hasattr(record["attendance_date"], 'date') else record["attendance_date"]
        unique_dates.add(date_only)
    actual_school_days = len(unique_dates) if unique_dates else 0
    
    # Use actual school days for display, but keep period_days for context
    total_days_display = actual_school_days if actual_school_days > 0 else 0
    
    overall_attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
    punctuality_rate = ((present_count + excused_count) / total_records * 100) if total_records > 0 else 0
    absence_rate = (absent_count / total_records * 100) if total_records > 0 else 0
    late_rate = (late_count / total_records * 100) if total_records > 0 else 0
    excused_rate = (excused_count / total_records * 100) if total_records > 0 else 0
    
    # Calculate trends (comparing first half vs second half of period)
    mid_date = start_date + timedelta(days=period_days // 2)
    first_half = [r for r in records if r["attendance_date"] < datetime.combine(mid_date, time())]
    second_half = [r for r in records if r["attendance_date"] >= datetime.combine(mid_date, time())]
    
    first_half_rate = (sum(1 for r in first_half if r["status"] == "present") / len(first_half) * 100) if first_half else 0
    second_half_rate = (sum(1 for r in second_half if r["status"] == "present") / len(second_half) * 100) if second_half else 0
    
    attendance_trend = "improving" if second_half_rate > first_half_rate + 5 else "declining" if second_half_rate < first_half_rate - 5 else "stable"
    
    # Calculate daily breakdown
    daily_stats = {}
    for record in records:
        date_key = record["attendance_date"].date().isoformat()
        if date_key not in daily_stats:
            daily_stats[date_key] = {"present": 0, "absent": 0, "late": 0, "total": 0}
        
        daily_stats[date_key]["total"] += 1
        if record["status"] == "present":
            daily_stats[date_key]["present"] += 1
        elif record["status"] == "absent":
            daily_stats[date_key]["absent"] += 1
        elif record["status"] in ["late", "tardy"]:
            daily_stats[date_key]["late"] += 1
    
    daily_breakdown = []
    for date_str, stats in sorted(daily_stats.items()):
        daily_breakdown.append({
            "date": date_str,
            "total_present": stats["present"],
            "total_absent": stats["absent"],
            "total_late": stats["late"],
            "attendance_rate": (stats["present"] / stats["total"] * 100) if stats["total"] > 0 else 0
        })
    
    # Calculate class breakdown
    class_stats = {}
    for record in records:
        class_id = record["class_id"]
        if class_id not in class_stats:
            class_stats[class_id] = {"present": 0, "absent": 0, "late": 0, "total": 0}
        
        class_stats[class_id]["total"] += 1
        if record["status"] == "present":
            class_stats[class_id]["present"] += 1
        elif record["status"] == "absent":
            class_stats[class_id]["absent"] += 1
        elif record["status"] in ["late", "tardy"]:
            class_stats[class_id]["late"] += 1
    
    class_breakdown = []
    for class_id, stats in class_stats.items():
        class_info = next((c for c in classes if str(c["_id"]) == class_id), None)
        class_students = [s for s in students if s.get("class_id") == class_id]
        
        class_breakdown.append({
            "class_id": class_id,
            "class_name": class_info.get("name", "Unknown Class") if class_info else "Unknown Class",
            "total_students": len(class_students),
            "present_count": stats["present"],
            "absent_count": stats["absent"],
            "late_count": stats["late"],
            "attendance_rate": (stats["present"] / stats["total"] * 100) if stats["total"] > 0 else 0
        })
    
    # Get top performers and concerns (limit to students in filtered set)
    student_summaries = []
    for student in students:
        student_id = str(student["_id"])
        student_records = [r for r in records if r["student_id"] == student_id]
        
        if student_records:
            present_days = sum(1 for r in student_records if r["status"] == "present")
            total_days = len(student_records)
            attendance_rate = (present_days / total_days * 100) if total_days > 0 else 0
            consecutive_absences = _calculate_consecutive_absences(student_records)
            
            student_summaries.append({
                "student_id": student_id,
                "student_name": student.get("full_name", "Unknown"),
                "attendance_rate": attendance_rate,
                "perfect_days": present_days,
                "consecutive_absences": consecutive_absences,
                "total_records": total_days
            })
    
    # Top performers (highest attendance rates)
    top_performers = sorted(student_summaries, key=lambda x: x["attendance_rate"], reverse=True)[:10]
    top_performers = [{
        "student_id": s["student_id"],
        "student_name": s["student_name"],
        "attendance_rate": s["attendance_rate"],
        "perfect_days": s["perfect_days"]
    } for s in top_performers if s["attendance_rate"] >= 90]
    
    # Attendance concerns (low attendance or high consecutive absences)
    attendance_concerns = []
    for s in student_summaries:
        concern_level = "low"
        if s["attendance_rate"] < 75:
            concern_level = "critical"
        elif s["attendance_rate"] < 85:
            concern_level = "high"
        elif s["consecutive_absences"] >= 3:
            concern_level = "medium"
        
        if concern_level != "low":
            attendance_concerns.append({
                "student_id": s["student_id"],
                "student_name": s["student_name"],
                "attendance_rate": s["attendance_rate"],
                "consecutive_absences": s["consecutive_absences"],
                "concern_level": concern_level
            })
    
    attendance_concerns = sorted(attendance_concerns, key=lambda x: x["attendance_rate"])[:20]
    
    # Pattern analysis
    day_absences = {}
    for record in records:
        if record["status"] == "absent":
            day_name = record["attendance_date"].strftime("%A")
            day_absences[day_name] = day_absences.get(day_name, 0) + 1
    
    frequent_absence_days = [day for day, count in day_absences.items() if count > len(records) * 0.1]
    
    # Count unresolved alerts (students with low attendance)
    unresolved_alerts = len([c for c in attendance_concerns if c["attendance_rate"] < 75])
    
    return {
        "period_start": start_date.isoformat(),
        "period_end": end_date.isoformat(),
        "total_students": total_students,
        "total_days": total_days_display,
        "average_attendance_rate": round(overall_attendance_rate, 2),
        "overall_attendance_rate": round(overall_attendance_rate, 2),
        "punctuality_rate": round(punctuality_rate, 2),
        "absence_rate": round(absence_rate, 2),
        "late_rate": round(late_rate, 2),
        "excused_rate": round(excused_rate, 2),
        "unresolved_alerts": unresolved_alerts,
        "trends": {
            "attendance_trend": attendance_trend,
            "punctuality_trend": "stable",  # Would need more complex calculation
            "weekly_comparison": round(second_half_rate - first_half_rate, 2),
            "monthly_comparison": 0.0  # Would need historical data
        },
        "top_performers": top_performers,
        "attendance_concerns": attendance_concerns,
        "daily_breakdown": daily_breakdown,
        "class_breakdown": class_breakdown,
        "pattern_analysis": {
            "frequent_absence_days": frequent_absence_days,
            "peak_late_arrival_times": [],  # Would need time analysis
            "seasonal_patterns": []  # Would need longer historical data
        }
    }


@router.get("/reports/monthly")
async def get_monthly_attendance_reports(
    months: int = Query(12, description="Number of months to include"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    current_user: User = Depends(get_current_user),
    coll: Any = Depends(get_attendance_collection),
):
    """Get monthly attendance reports"""
    if current_user.get("role") not in ["admin", "teacher", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # Apply branch filtering
    query = {}
    if current_user.get("role") != "superadmin":
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No branch access")
        query["branch_id"] = user_branch_id
    elif branch_id:
        await validate_branch_id(branch_id)
        query["branch_id"] = branch_id
    
    monthly_reports = []
    current_date = date.today()
    
    for i in range(months):
        # Calculate month range
        if i == 0:
            month_start = current_date.replace(day=1)
            month_end = current_date
        else:
            temp_date = current_date.replace(day=1) - timedelta(days=i * 30)
            month_start = temp_date.replace(day=1)
            # Get last day of month
            if month_start.month == 12:
                month_end = month_start.replace(year=month_start.year + 1, month=1) - timedelta(days=1)
            else:
                month_end = month_start.replace(month=month_start.month + 1) - timedelta(days=1)
        
        # Query attendance for this month
        month_query = {
            **query,
            "attendance_date": {
                "$gte": datetime.combine(month_start, time()),
                "$lte": datetime.combine(month_end, time())
            }
        }
        
        records = await coll.find(month_query).to_list(None)
        
        # Get student count for this period
        students = await db.students.find({"branch_id": query.get("branch_id")} if query.get("branch_id") else {}).to_list(None)
        total_students = len(students)
        
        # Calculate statistics
        if records and total_students > 0:
            present_count = sum(1 for r in records if r["status"] == "present")
            late_count = sum(1 for r in records if r["status"] in ["late", "tardy"])
            total_records = len(records)
            school_days = len(set(r["attendance_date"].date() for r in records))
            
            attendance_rate = (present_count / total_records * 100) if total_records > 0 else 0
            punctuality_rate = ((present_count) / total_records * 100) if total_records > 0 else 0
            
            # Count perfect attendance students (students with 100% present records)
            student_records = {}
            for record in records:
                student_id = record["student_id"]
                if student_id not in student_records:
                    student_records[student_id] = []
                student_records[student_id].append(record)
            
            perfect_attendance_count = 0
            for student_id, student_recs in student_records.items():
                if all(r["status"] == "present" for r in student_recs):
                    perfect_attendance_count += 1
            
        else:
            attendance_rate = 0
            punctuality_rate = 0
            school_days = 0
            late_count = 0
            perfect_attendance_count = 0
        
        monthly_reports.append({
            "month": month_start.strftime("%B"),
            "year": month_start.year,
            "attendance_rate": round(attendance_rate, 2),
            "punctuality_rate": round(punctuality_rate, 2),
            "total_students": total_students,
            "school_days": school_days,
            "absent_days": len(records) - sum(1 for r in records if r["status"] == "present"),
            "late_arrivals": late_count,
            "perfect_attendance_count": perfect_attendance_count
        })
    
    return monthly_reports


@router.get("/reports/export")
async def export_attendance_report(
    type: str = Query(..., description="Report type: daily, weekly, monthly, comprehensive"),
    period_days: int = Query(30, description="Number of days for daily/comprehensive reports"),
    class_id: Optional[str] = Query(None, description="Filter by class ID"),
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    format: str = Query("pdf", description="Export format: pdf, excel"),
    current_user: User = Depends(get_current_user),
    coll: Any = Depends(get_attendance_collection),
):
    """Export attendance reports in various formats"""
    if current_user.get("role") not in ["admin", "teacher", "superadmin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    # For now, return a placeholder response
    # In a real implementation, this would generate actual PDF/Excel files
    return {
        "message": f"Export functionality for {type} report in {format} format would be implemented here",
        "report_type": type,
        "format": format,
        "parameters": {
            "period_days": period_days,
            "class_id": class_id,
            "branch_id": branch_id
        },
        "status": "pending_implementation"
    }
