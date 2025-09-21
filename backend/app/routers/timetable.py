from typing import List, Any, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from bson import ObjectId
from datetime import datetime, time, date, timedelta
import logging

from ..db import get_db
from ..models.timetable import (
    TimeSlotCreate, TimeSlot, TimetableEntryCreate, TimetableEntry,
    WeeklyTimetableCreate, WeeklyTimetable, SubstitutionCreate, Substitution,
    RoomCreate, Room, TimetableTemplateCreate, TimetableTemplate,
    ClassTimetableView, TeacherTimetableView, RoomTimetableView,
    BulkTimetableCreate, TimetableBulkUpdate, TimetableStats,
    TimetableExportRequest, TimetableConflict, DayOfWeek, TimetableStatus,
    ConflictType, TimetableSettings
)
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.timetable_conflicts import TimetableConflictDetector
from ..utils.timetable_export import TimetableExporter
from ..utils.calendar_events import calendar_event_generator

logger = logging.getLogger(__name__)

router = APIRouter()
db = get_db()
conflict_detector = TimetableConflictDetector()
timetable_exporter = TimetableExporter()

# Time Slots Management
@router.post("/time-slots", response_model=TimeSlot)
async def create_time_slot(
    time_slot: TimeSlotCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new time slot"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create time slots"
        )
    
    # Get user's branch
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    # Check for existing time slot conflicts
    existing_slots = await db.time_slots.find({
        "branch_id": branch_id,
        "period_number": time_slot.period_number,
        "academic_year": current_user.get("academic_year", "2024-2025")
    }).to_list(None)
    
    if existing_slots:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Time slot for period {time_slot.period_number} already exists"
        )
    
    now = datetime.utcnow()
    doc = time_slot.dict()
    doc.update({
        "branch_id": branch_id,
        "academic_year": current_user.get("academic_year", "2024-2025"),
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.time_slots.insert_one(doc)
    return TimeSlot(id=str(result.inserted_id), **doc)

@router.get("/time-slots", response_model=List[TimeSlot])
async def list_time_slots(
    academic_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """List all time slots for the branch"""
    query = {}
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if not branch_id:
            return []
        query["branch_id"] = branch_id
    
    if academic_year:
        query["academic_year"] = academic_year
    else:
        query["academic_year"] = current_user.get("academic_year", "2024-2025")
    
    slots = await db.time_slots.find(query).sort("period_number", 1).to_list(None)
    return [TimeSlot(id=str(slot["_id"]), **slot) for slot in slots]

# Timetable Entries Management
@router.post("/entries", response_model=TimetableEntry)
async def create_timetable_entry(
    entry: TimetableEntryCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Create a new timetable entry with conflict detection"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create timetable entries"
        )
    
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    now = datetime.utcnow()
    doc = entry.dict()
    doc.update({
        "branch_id": branch_id,
        "created_at": now,
        "updated_at": now,
        "created_by": str(current_user.get("user_id"))
    })
    
    # Detect conflicts before creating
    conflicts = await conflict_detector.detect_entry_conflicts(doc, db)
    if conflicts:
        # Store conflicts for resolution
        for conflict in conflicts:
            await db.timetable_conflicts.insert_one(conflict.dict())
        
        # If there are critical conflicts, prevent creation
        critical_conflicts = [c for c in conflicts if c.severity == "critical"]
        if critical_conflicts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Critical conflicts detected: {[c.description for c in critical_conflicts]}"
            )
    
    result = await db.timetable_entries.insert_one(doc)
    entry_obj = TimetableEntry(id=str(result.inserted_id), **doc)
    
    # Schedule background notification for conflicts
    if conflicts:
        background_tasks.add_task(
            _notify_timetable_conflicts,
            conflicts,
            current_user.get("user_id")
        )
    
    # Generate calendar event for this timetable entry
    background_tasks.add_task(
        _generate_calendar_event_from_timetable,
        [doc],
        entry.academic_year,
        branch_id
    )
    
    return entry_obj

@router.post("/entries/bulk", response_model=List[TimetableEntry])
async def create_bulk_timetable_entries(
    bulk_data: BulkTimetableCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Create multiple timetable entries at once"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions for bulk timetable operations"
        )
    
    branch_id = current_user.get("branch_id")
    created_entries = []
    all_conflicts = []
    
    for entry_data in bulk_data.entries:
        now = datetime.utcnow()
        doc = entry_data.dict()
        doc.update({
            "branch_id": branch_id,
            "created_at": now,
            "updated_at": now,
            "created_by": str(current_user.get("user_id"))
        })
        
        # Detect conflicts
        conflicts = await conflict_detector.detect_entry_conflicts(doc, db)
        all_conflicts.extend(conflicts)
        
        # Auto-resolve if requested and possible
        if bulk_data.auto_resolve_conflicts and conflicts:
            doc = await conflict_detector.auto_resolve_conflicts(doc, conflicts, db)
        
        result = await db.timetable_entries.insert_one(doc)
        created_entries.append(TimetableEntry(id=str(result.inserted_id), **doc))
    
    # Store conflicts
    if all_conflicts:
        for conflict in all_conflicts:
            await db.timetable_conflicts.insert_one(conflict.dict())
        
        if bulk_data.notify_affected_users:
            background_tasks.add_task(
                _notify_bulk_conflicts,
                all_conflicts,
                current_user.get("user_id")
            )
    
    # Generate calendar events for all created entries
    if created_entries:
        entry_docs = [entry.dict() for entry in created_entries]
        background_tasks.add_task(
            _generate_calendar_event_from_timetable,
            entry_docs,
            bulk_data.entries[0].academic_year if bulk_data.entries else "2024-2025",
            branch_id
        )
    
    return created_entries

@router.get("/entries", response_model=List[TimetableEntry])
async def list_timetable_entries(
    class_id: Optional[str] = Query(None),
    teacher_id: Optional[str] = Query(None),
    day_of_week: Optional[DayOfWeek] = Query(None),
    academic_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """List timetable entries with filtering"""
    query = {}
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if branch_id:
            query["branch_id"] = branch_id
    
    # Apply filters
    if class_id:
        query["class_id"] = class_id
    if teacher_id:
        query["teacher_id"] = teacher_id
    if day_of_week:
        query["day_of_week"] = day_of_week
    if academic_year:
        query["academic_year"] = academic_year
    else:
        query["academic_year"] = current_user.get("academic_year", "2024-2025")
    
    entries = await db.timetable_entries.find(query).to_list(None)
    return [TimetableEntry(id=str(entry["_id"]), **entry) for entry in entries]

# Timetable Views
@router.get("/class/{class_id}", response_model=ClassTimetableView)
async def get_class_timetable(
    class_id: str,
    week_start: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get complete timetable view for a class"""
    # Get class information
    class_info = await db.classes.find_one({"_id": ObjectId(class_id)})
    if not class_info:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Get timetable entries
    query = {
        "class_id": class_id,
        "academic_year": current_user.get("academic_year", "2024-2025")
    }
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if branch_id:
            query["branch_id"] = branch_id
    
    entries = await db.timetable_entries.find(query).to_list(None)
    
    # Organize entries by day and period
    organized_entries = await _organize_entries_by_schedule(entries, db)
    
    # Get conflicts
    conflicts = await db.timetable_conflicts.find({
        "affected_entries": {"$in": [str(entry["_id"]) for entry in entries]},
        "resolved": False
    }).to_list(None)
    
    conflict_objects = [TimetableConflict(**conflict) for conflict in conflicts]
    
    return ClassTimetableView(
        class_id=class_id,
        class_name=class_info.get("class_name", "Unknown"),
        grade_level=class_info.get("grade_level", "Unknown"),
        academic_year=current_user.get("academic_year", "2024-2025"),
        entries=organized_entries,
        conflicts=conflict_objects
    )

@router.get("/teacher/{teacher_id}", response_model=TeacherTimetableView)
async def get_teacher_timetable(
    teacher_id: str,
    week_start: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get complete timetable view for a teacher.

    Accepts either the teacher document ID or, for logged-in teachers, allows
    resolving via the user's mapping/email to avoid confusion between user.id and teacher.id.
    """
    # Resolve teacher record by id (supports both ObjectId and string ids)
    tid_filter = {"_id": ObjectId(teacher_id)} if ObjectId.is_valid(teacher_id) else {"_id": teacher_id}
    teacher_info = await db.teachers.find_one(tid_filter)

    # If not found, and the requester is a teacher, try resolving by email/user mapping
    if not teacher_info and current_user.get("role") == "teacher":
        # Try by user mapping: users.teacher_id → teachers._id
        try:
            user_doc = await db.users.find_one({
                "_id": ObjectId(current_user.get("user_id"))
            })
        except Exception:
            user_doc = await db.users.find_one({"_id": current_user.get("user_id")})

        mapped_tid = user_doc.get("teacher_id") if user_doc else None
        if mapped_tid:
            try:
                teacher_info = await db.teachers.find_one({"_id": ObjectId(mapped_tid)})
            except Exception:
                teacher_info = await db.teachers.find_one({"_id": mapped_tid})

        # Fallback: resolve by email match
        if not teacher_info and current_user.get("email"):
            teacher_info = await db.teachers.find_one({"email": current_user.get("email")})

        # If resolved, update teacher_id to canonical string id for queries below
        if teacher_info:
            teacher_id = str(teacher_info.get("_id"))

    if not teacher_info:
        raise HTTPException(status_code=404, detail="Teacher not found")
    
    # Get timetable entries (teacher_id stored as string in entries)
    query = {
        "teacher_id": teacher_id,
        "academic_year": current_user.get("academic_year", "2024-2025")
    }
    
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if branch_id:
            query["branch_id"] = branch_id
    
    entries = await db.timetable_entries.find(query).to_list(None)
    organized_entries = await _organize_entries_by_schedule(entries, db)
    
    # Calculate free periods
    free_periods = await _calculate_free_periods(teacher_id, entries, db)
    
    # Get conflicts
    conflicts = await db.timetable_conflicts.find({
        "affected_entries": {"$in": [str(entry["_id"]) for entry in entries]},
        "resolved": False
    }).to_list(None)
    
    return TeacherTimetableView(
        teacher_id=teacher_id,
        teacher_name=f"{teacher_info.get('first_name', '')} {teacher_info.get('last_name', '')}".strip(),
        total_periods_per_week=len(entries),
        entries=organized_entries,
        free_periods=free_periods,
        conflicts=[TimetableConflict(**conflict) for conflict in conflicts]
    )

# Conflict Management
@router.get("/conflicts", response_model=List[TimetableConflict])
async def list_timetable_conflicts(
    severity: Optional[str] = Query(None),
    resolved: Optional[bool] = Query(False),
    current_user: User = Depends(get_current_user)
):
    """List timetable conflicts"""
    query = {"resolved": resolved}
    
    if severity:
        query["severity"] = severity
    
    conflicts = await db.timetable_conflicts.find(query).sort("detected_at", -1).to_list(50)
    return [TimetableConflict(id=str(c["_id"]), **c) for c in conflicts]

@router.patch("/conflicts/{conflict_id}/resolve")
async def resolve_conflict(
    conflict_id: str,
    resolution_notes: str,
    current_user: User = Depends(get_current_user)
):
    """Mark a conflict as resolved"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to resolve conflicts"
        )
    
    result = await db.timetable_conflicts.update_one(
        {"_id": ObjectId(conflict_id)},
        {
            "$set": {
                "resolved": True,
                "resolved_at": datetime.utcnow(),
                "resolved_by": str(current_user.get("user_id")),
                "suggested_resolution": resolution_notes
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Conflict not found")
    
    return {"message": "Conflict resolved successfully"}

# Room Management
@router.post("/rooms", response_model=Room)
async def create_room(
    room: RoomCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new room"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create rooms"
        )
    
    now = datetime.utcnow()
    doc = room.dict()
    doc.update({
        "created_at": now,
        "updated_at": now
    })
    
    result = await db.rooms.insert_one(doc)
    return Room(id=str(result.inserted_id), **doc)

@router.get("/rooms", response_model=List[Room])
async def list_rooms(
    room_type: Optional[str] = Query(None),
    is_available: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """List all rooms"""
    query = {}
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if branch_id:
            query["branch_id"] = branch_id
    
    if room_type:
        query["room_type"] = room_type
    if is_available is not None:
        query["is_available"] = is_available
    
    rooms = await db.rooms.find(query).sort("room_number", 1).to_list(None)
    return [Room(id=str(room["_id"]), **room) for room in rooms]

# Substitutions
@router.post("/substitutions", response_model=Substitution)
async def create_substitution(
    substitution: SubstitutionCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a substitution request"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create substitutions"
        )
    
    now = datetime.utcnow()
    doc = substitution.dict()
    doc.update({
        "created_at": now,
        "created_by": str(current_user.get("user_id")),
        "status": "pending"
    })
    
    result = await db.substitutions.insert_one(doc)
    return Substitution(id=str(result.inserted_id), **doc)

# Statistics and Analytics
@router.get("/stats", response_model=TimetableStats)
async def get_timetable_statistics(
    academic_year: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get comprehensive timetable statistics"""
    if academic_year is None:
        academic_year = current_user.get("academic_year", "2024-2025")
    
    query = {"academic_year": academic_year}
    
    # Apply branch filtering
    if current_user.get("role") != "superadmin":
        branch_id = current_user.get("branch_id")
        if branch_id:
            query["branch_id"] = branch_id
    
    # Calculate various statistics
    stats = await _calculate_timetable_statistics(query, db)
    
    return TimetableStats(**stats)

# Calendar Integration
@router.post("/sync-to-calendar")
async def sync_timetable_to_calendar(
    academic_year: Optional[str] = Query(None),
    class_id: Optional[str] = Query(None),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user)
):
    """Sync existing timetable entries to calendar system"""
    if current_user.get("role") not in ["admin", "superadmin", "branch_admin", "hq_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to sync calendar"
        )
    
    branch_id = current_user.get("branch_id")
    if not branch_id and current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User must be assigned to a branch"
        )
    
    # Build query
    query = {}
    if academic_year:
        query["academic_year"] = academic_year
    else:
        query["academic_year"] = current_user.get("academic_year", "2024-2025")
    
    if class_id:
        query["class_id"] = class_id
    
    if current_user.get("role") != "superadmin" and branch_id:
        query["branch_id"] = branch_id
    
    # Get timetable entries
    entries = await db.timetable_entries.find(query).to_list(None)
    
    if not entries:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No timetable entries found for the specified criteria"
        )
    
    # Schedule background sync
    background_tasks.add_task(
        _sync_timetable_to_calendar,
        entries,
        query["academic_year"],
        branch_id
    )
    
    return {
        "message": f"Started syncing {len(entries)} timetable entries to calendar",
        "entries_count": len(entries),
        "academic_year": query["academic_year"]
    }

# Export functionality
@router.post("/export")
async def export_timetable(
    export_request: TimetableExportRequest,
    current_user: User = Depends(get_current_user)
):
    """Export timetable in various formats"""
    try:
        # Apply branch filtering
        branch_filter = None
        if current_user.get("role") != "superadmin":
            branch_filter = current_user.get("branch_id")
        
        result = await timetable_exporter.export_timetable(
            export_request, 
            db, 
            branch_filter
        )
        
        return {
            "download_url": result.get("download_url"),
            "filename": result.get("filename"),
            "format": export_request.format,
            "generated_at": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )

# Helper functions
async def _organize_entries_by_schedule(entries: List[Dict], db) -> List[Dict[str, Any]]:
    """Organize timetable entries by day and period"""
    # Get time slots for period information
    time_slots = await db.time_slots.find({}).to_list(None)
    time_slot_map = {str(slot["_id"]): slot for slot in time_slots}
    
    # Initialize schedule structure
    days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
    schedule = {day: {} for day in days}
    
    for entry in entries:
        day = entry["day_of_week"]
        time_slot = time_slot_map.get(entry["time_slot_id"])
        
        if time_slot:
            period_num = time_slot["period_number"]
            schedule[day][period_num] = {
                "entry_id": str(entry["_id"]),
                "subject_id": entry.get("subject_id"),
                "teacher_id": entry.get("teacher_id"),
                "room_number": entry.get("room_number"),
                "start_time": time_slot["start_time"].isoformat(),
                "end_time": time_slot["end_time"].isoformat(),
                "notes": entry.get("notes")
            }
    
    return [{"day": day, "periods": periods} for day, periods in schedule.items()]

async def _calculate_free_periods(teacher_id: str, entries: List[Dict], db) -> List[Dict[str, Any]]:
    """Calculate free periods for a teacher"""
    # Get all time slots
    time_slots = await db.time_slots.find({}).sort("period_number", 1).to_list(None)
    
    # Get occupied periods
    occupied_periods = set()
    for entry in entries:
        time_slot = next((slot for slot in time_slots if str(slot["_id"]) == entry["time_slot_id"]), None)
        if time_slot:
            occupied_periods.add((entry["day_of_week"], time_slot["period_number"]))
    
    # Calculate free periods
    free_periods = []
    days = ["monday", "tuesday", "wednesday", "thursday", "friday"]
    
    for day in days:
        for time_slot in time_slots:
            if (day, time_slot["period_number"]) not in occupied_periods and not time_slot.get("is_break", False):
                free_periods.append({
                    "day": day,
                    "period": time_slot["period_number"],
                    "start_time": time_slot["start_time"].isoformat(),
                    "end_time": time_slot["end_time"].isoformat()
                })
    
    return free_periods

async def _calculate_timetable_statistics(query: Dict[str, Any], db) -> Dict[str, Any]:
    """Calculate comprehensive timetable statistics"""
    entries = await db.timetable_entries.find(query).to_list(None)
    time_slots = await db.time_slots.find({}).to_list(None)
    
    total_possible_periods = len(time_slots) * 5 * len(await db.classes.find(query).to_list(None))  # 5 working days
    total_scheduled = len(entries)
    
    # Calculate various statistics
    stats = {
        "total_periods_scheduled": total_scheduled,
        "total_free_periods": max(0, total_possible_periods - total_scheduled),
        "utilization_rate": (total_scheduled / total_possible_periods * 100) if total_possible_periods > 0 else 0,
        "teacher_workload_stats": {},
        "room_utilization_stats": {},
        "conflict_count": await db.timetable_conflicts.count_documents({"resolved": False}),
        "most_busy_day": "monday",  # Placeholder - would calculate from actual data
        "most_busy_period": 1,      # Placeholder - would calculate from actual data
        "subject_distribution": {}   # Placeholder - would calculate from actual data
    }
    
    return stats

async def _notify_timetable_conflicts(conflicts: List[TimetableConflict], user_id: str):
    """Background task to notify about timetable conflicts"""
    # Implementation would integrate with notification system
    pass

async def _notify_bulk_conflicts(conflicts: List[TimetableConflict], user_id: str):
    """Background task to notify about bulk operation conflicts"""
    # Implementation would integrate with notification system
    pass

async def _generate_calendar_event_from_timetable(entry_docs: List[Dict[str, Any]], academic_year: str, branch_id: str):
    """Background task to generate calendar events from timetable entries"""
    try:
        await calendar_event_generator.generate_timetable_events(entry_docs, academic_year, branch_id)
    except Exception as e:
        logger.error(f"Failed to generate calendar events from timetable: {str(e)}")

async def _sync_timetable_to_calendar(entries: List[Dict[str, Any]], academic_year: str, branch_id: str):
    """Background task to sync existing timetable entries to calendar"""
    try:
        # First, clean up existing timetable-generated events for this academic year and branch
        await db.academic_events.delete_many({
            "source_type": "timetable",
            "academic_year_id": academic_year,
            "branch_id": branch_id,
            "auto_generated": True
        })
        
        # Generate new calendar events
        await calendar_event_generator.generate_timetable_events(entries, academic_year, branch_id)
        logger.info(f"Successfully synced {len(entries)} timetable entries to calendar for {academic_year}")
        
    except Exception as e:
        logger.error(f"Failed to sync timetable to calendar: {str(e)}")
