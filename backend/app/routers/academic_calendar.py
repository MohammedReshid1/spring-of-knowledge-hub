from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime, date

from ..db import (
    get_academic_years_collection, get_terms_collection, get_academic_events_collection,
    get_timetable_slots_collection, get_holidays_collection, validate_branch_id,
    validate_class_id, validate_subject_id, validate_teacher_id
)
from ..models.academic_calendar import (
    AcademicYearCreate, AcademicYear, TermCreate, Term,
    AcademicEventCreate, AcademicEvent, AcademicEventUpdate,
    TimetableSlotCreate, TimetableSlot, TimetableSlotUpdate,
    HolidayCreate, Holiday, AcademicCalendarSummary
)
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import (
    sanitize_input, prevent_nosql_injection, validate_mongodb_id
)

router = APIRouter()

# Academic Years
@router.post("/academic-years", response_model=AcademicYear)
async def create_academic_year(
    academic_year_in: AcademicYearCreate,
    academic_years_coll: Any = Depends(get_academic_years_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new academic year."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create academic years")
    
    # Sanitize input
    academic_year_data = sanitize_input(academic_year_in.dict(), [
        "name", "start_date", "end_date", "is_current", "branch_id", "description"
    ])
    
    # Validate branch_id if provided
    if academic_year_data.get("branch_id"):
        await validate_branch_id(academic_year_data["branch_id"])
    
    # Validate dates
    if academic_year_data["start_date"] >= academic_year_data["end_date"]:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # If this is set as current, unset other current academic years
    if academic_year_data.get("is_current"):
        await academic_years_coll.update_many(
            {"is_current": True},
            {"$set": {"is_current": False}}
        )
    
    # Add metadata
    now = datetime.utcnow()
    academic_year_data.update({
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("user_id")
    })
    
    result = await academic_years_coll.insert_one(academic_year_data)
    academic_year_data["id"] = str(result.inserted_id)
    
    return AcademicYear(**academic_year_data)

@router.get("/academic-years", response_model=List[AcademicYear])
async def list_academic_years(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    academic_years_coll: Any = Depends(get_academic_years_collection),
    current_user: User = Depends(get_current_user),
):
    """List academic years."""
    query = {}
    
    # Add branch filter for branch admins
    if current_user.get("role") == 'branch_admin' and current_user.get("branch_id"):
        query["branch_id"] = current_user.get("branch_id")
    
    academic_years = []
    async for academic_year in academic_years_coll.find(query).skip(skip).limit(limit).sort("start_date", -1):
        academic_years.append(AcademicYear(
            id=str(academic_year["_id"]),
            **{k: v for k, v in academic_year.items() if k != "_id"}
        ))
    
    return academic_years

@router.get("/academic-years/current", response_model=AcademicYear)
async def get_current_academic_year(
    academic_years_coll: Any = Depends(get_academic_years_collection),
    current_user: User = Depends(get_current_user),
):
    """Get current academic year."""
    query = {"is_current": True}
    
    # Add branch filter for branch admins
    if current_user.get("role") == 'branch_admin' and current_user.get("branch_id"):
        query["branch_id"] = current_user.get("branch_id")
    
    academic_year = await academic_years_coll.find_one(query)
    if not academic_year:
        raise HTTPException(status_code=404, detail="No current academic year found")
    
    return AcademicYear(
        id=str(academic_year["_id"]),
        **{k: v for k, v in academic_year.items() if k != "_id"}
    )

# Terms
@router.post("/terms", response_model=Term)
async def create_term(
    term_in: TermCreate,
    terms_coll: Any = Depends(get_terms_collection),
    academic_years_coll: Any = Depends(get_academic_years_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new term."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create terms")
    
    # Sanitize input
    term_data = sanitize_input(term_in.dict(), [
        "name", "academic_year_id", "start_date", "end_date", "is_current", "branch_id", "description"
    ])
    
    # Validate academic year exists
    if not validate_mongodb_id(term_data["academic_year_id"]):
        raise HTTPException(status_code=400, detail="Invalid academic year ID")
    
    academic_year = await academic_years_coll.find_one({"_id": ObjectId(term_data["academic_year_id"])})
    if not academic_year:
        raise HTTPException(status_code=404, detail="Academic year not found")
    
    # Validate branch_id if provided
    if term_data.get("branch_id"):
        await validate_branch_id(term_data["branch_id"])
    
    # Validate dates
    if term_data["start_date"] >= term_data["end_date"]:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # Check if dates are within academic year
    if (term_data["start_date"] < academic_year["start_date"] or 
        term_data["end_date"] > academic_year["end_date"]):
        raise HTTPException(status_code=400, detail="Term dates must be within academic year")
    
    # If this is set as current, unset other current terms for this academic year
    if term_data.get("is_current"):
        await terms_coll.update_many(
            {"academic_year_id": term_data["academic_year_id"], "is_current": True},
            {"$set": {"is_current": False}}
        )
    
    # Add metadata
    now = datetime.utcnow()
    term_data.update({
        "created_at": now,
        "updated_at": now
    })
    
    result = await terms_coll.insert_one(term_data)
    term_data["id"] = str(result.inserted_id)
    
    return Term(**term_data)

@router.get("/terms", response_model=List[Term])
async def list_terms(
    academic_year_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    terms_coll: Any = Depends(get_terms_collection),
    current_user: User = Depends(get_current_user),
):
    """List terms."""
    query = {}
    
    if academic_year_id:
        if not validate_mongodb_id(academic_year_id):
            raise HTTPException(status_code=400, detail="Invalid academic year ID")
        query["academic_year_id"] = academic_year_id
    
    # Add branch filter for branch admins
    if current_user.get("role") == 'branch_admin' and current_user.get("branch_id"):
        query["branch_id"] = current_user.get("branch_id")
    
    terms = []
    async for term in terms_coll.find(query).skip(skip).limit(limit).sort("start_date", 1):
        terms.append(Term(
            id=str(term["_id"]),
            **{k: v for k, v in term.items() if k != "_id"}
        ))
    
    return terms

# Academic Events
@router.post("/events", response_model=AcademicEvent)
async def create_academic_event(
    event_in: AcademicEventCreate,
    events_coll: Any = Depends(get_academic_events_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a new academic event."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to create events")
    
    # Sanitize input
    event_data = sanitize_input(event_in.dict(), [
        "title", "description", "event_type", "start_date", "end_date",
        "is_all_day", "academic_year_id", "term_id", "class_ids", "branch_id",
        "color", "is_recurring", "recurrence_pattern", "reminder_minutes", "is_public"
    ])
    
    # Validate IDs
    if not validate_mongodb_id(event_data["academic_year_id"]):
        raise HTTPException(status_code=400, detail="Invalid academic year ID")
    
    if event_data.get("term_id") and not validate_mongodb_id(event_data["term_id"]):
        raise HTTPException(status_code=400, detail="Invalid term ID")
    
    if event_data.get("branch_id"):
        await validate_branch_id(event_data["branch_id"])
    
    # Validate class IDs if provided
    if event_data.get("class_ids"):
        for class_id in event_data["class_ids"]:
            await validate_class_id(class_id)
    
    # Validate dates
    if event_data.get("end_date") and event_data["start_date"] > event_data["end_date"]:
        raise HTTPException(status_code=400, detail="Start date must be before end date")
    
    # Add metadata
    now = datetime.utcnow()
    event_data.update({
        "created_at": now,
        "updated_at": now,
        "created_by": current_user.get("user_id")
    })
    
    result = await events_coll.insert_one(event_data)
    event_data["id"] = str(result.inserted_id)
    
    return AcademicEvent(**event_data)

@router.get("/events", response_model=List[AcademicEvent])
async def list_academic_events(
    academic_year_id: Optional[str] = Query(None),
    term_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    events_coll: Any = Depends(get_academic_events_collection),
    current_user: User = Depends(get_current_user),
):
    """List academic events with optional filters."""
    query = {}
    
    if academic_year_id:
        if not validate_mongodb_id(academic_year_id):
            raise HTTPException(status_code=400, detail="Invalid academic year ID")
        query["academic_year_id"] = academic_year_id
    
    if term_id:
        if not validate_mongodb_id(term_id):
            raise HTTPException(status_code=400, detail="Invalid term ID")
        query["term_id"] = term_id
    
    if event_type:
        query["event_type"] = event_type
    
    if start_date and end_date:
        query["start_date"] = {"$gte": datetime.combine(start_date, datetime.min.time())}
        query["$or"] = [
            {"end_date": {"$lte": datetime.combine(end_date, datetime.max.time())}},
            {"end_date": None}
        ]
    
    # Add branch filter for branch admins
    if current_user.get("role") == 'branch_admin' and current_user.get("branch_id"):
        query["branch_id"] = current_user.get("branch_id")
    
    query = prevent_nosql_injection(query)
    
    events = []
    async for event in events_coll.find(query).skip(skip).limit(limit).sort("start_date", 1):
        events.append(AcademicEvent(
            id=str(event["_id"]),
            **{k: v for k, v in event.items() if k != "_id"}
        ))
    
    return events

@router.get("/summary", response_model=AcademicCalendarSummary)
async def get_academic_calendar_summary(
    academic_years_coll: Any = Depends(get_academic_years_collection),
    terms_coll: Any = Depends(get_terms_collection),
    events_coll: Any = Depends(get_academic_events_collection),
    holidays_coll: Any = Depends(get_holidays_collection),
    current_user: User = Depends(get_current_user),
):
    """Get academic calendar summary."""
    # Get current academic year
    query = {"is_current": True}
    if current_user.get("role") == 'branch_admin' and current_user.get("branch_id"):
        query["branch_id"] = current_user.get("branch_id")
    
    academic_year = await academic_years_coll.find_one(query)
    if not academic_year:
        raise HTTPException(status_code=404, detail="No current academic year found")
    
    # Get current term
    current_term = await terms_coll.find_one({
        "academic_year_id": str(academic_year["_id"]),
        "is_current": True
    })
    
    # Get upcoming events (next 30 days)
    from_date = datetime.now()
    to_date = datetime.now().replace(day=datetime.now().day + 30)
    
    upcoming_events = []
    async for event in events_coll.find({
        "academic_year_id": str(academic_year["_id"]),
        "start_date": {"$gte": from_date, "$lte": to_date}
    }).sort("start_date", 1).limit(10):
        upcoming_events.append(AcademicEvent(
            id=str(event["_id"]),
            **{k: v for k, v in event.items() if k != "_id"}
        ))
    
    # Get upcoming holidays
    upcoming_holidays = []
    async for holiday in holidays_coll.find({
        "academic_year_id": str(academic_year["_id"]),
        "start_date": {"$gte": from_date.date(), "$lte": to_date.date()}
    }).sort("start_date", 1).limit(5):
        upcoming_holidays.append(Holiday(
            id=str(holiday["_id"]),
            **{k: v for k, v in holiday.items() if k != "_id"}
        ))
    
    # Calculate school days (simplified - you might want more complex logic)
    total_days = (academic_year["end_date"] - academic_year["start_date"]).days
    # Rough estimate: exclude weekends and holidays
    total_school_days = int(total_days * 5/7)  # Rough weekday estimate
    
    today = date.today()
    if today < academic_year["start_date"]:
        days_completed = 0
    elif today > academic_year["end_date"]:
        days_completed = total_school_days
    else:
        completed_days = (today - academic_year["start_date"]).days
        days_completed = int(completed_days * 5/7)  # Rough estimate
    
    days_remaining = max(0, total_school_days - days_completed)
    
    return AcademicCalendarSummary(
        academic_year=AcademicYear(
            id=str(academic_year["_id"]),
            **{k: v for k, v in academic_year.items() if k != "_id"}
        ),
        current_term=Term(
            id=str(current_term["_id"]),
            **{k: v for k, v in current_term.items() if k != "_id"}
        ) if current_term else None,
        upcoming_events=upcoming_events,
        upcoming_holidays=upcoming_holidays,
        total_school_days=total_school_days,
        days_completed=days_completed,
        days_remaining=days_remaining
    )