from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from bson import ObjectId
from datetime import datetime, date

from ..db import get_academic_events_collection
from ..models.academic_calendar import (
    AcademicEvent, AcademicEventCreate, AcademicEventUpdate,
    CalendarExportRequest, CalendarExportResponse, EventQueryParams
)
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import sanitize_input, validate_mongodb_id
from ..utils.calendar_events import calendar_event_generator
from ..utils.calendar_export import calendar_exporter

router = APIRouter(prefix="/calendar", tags=["Enhanced Calendar"])

@router.get("/upcoming-events", response_model=List[AcademicEvent])
async def get_upcoming_events(
    days_ahead: int = Query(7, ge=1, le=90, description="Number of days ahead to look for events"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of events to return"),
    event_types: Optional[str] = Query(None, description="Comma-separated list of event types to include"),
    include_auto_generated: bool = Query(True, description="Include auto-generated events"),
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Get upcoming calendar events for the next N days"""
    
    from datetime import datetime, timedelta
    
    # Calculate date range
    now = datetime.utcnow()
    end_date = now + timedelta(days=days_ahead)
    
    # Build query
    query = {
        "start_date": {
            "$gte": now,
            "$lte": end_date
        }
    }
    
    # Filter by event types if specified
    if event_types:
        event_type_list = [t.strip() for t in event_types.split(',')]
        query["event_type"] = {"$in": event_type_list}
    
    # Filter auto-generated events if requested
    if not include_auto_generated:
        query["auto_generated"] = {"$ne": True}
    
    # Add role-based filtering
    user_role = current_user.get('role', 'student')
    if user_role not in ['admin', 'superadmin', 'principal']:
        # Regular users only see public events or events they have access to
        query["$or"] = [
            {"is_public": True},
            {"visibility_roles": {"$in": [user_role]}}
        ]
    
    # Add branch filtering for branch-specific users
    if user_role == 'branch_admin' and current_user.get('branch_id'):
        query["branch_id"] = current_user.get('branch_id')
    
    # Get events
    events = []
    cursor = events_coll.find(query).sort("start_date", 1).limit(limit)
    async for event in cursor:
        event_data = {k: v for k, v in event.items() if k != "_id"}
        event_data['id'] = str(event['_id'])
        events.append(AcademicEvent(**event_data))
    
    return events

@router.get("/stats")
async def get_calendar_stats(
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Get calendar statistics"""
    
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    
    # Build base query with role-based filtering
    base_query = {}
    user_role = current_user.get('role', 'student')
    if user_role not in ['admin', 'superadmin', 'principal']:
        base_query["$or"] = [
            {"is_public": True},
            {"visibility_roles": {"$in": [user_role]}}
        ]
    
    # Add branch filtering
    if user_role == 'branch_admin' and current_user.get('branch_id'):
        base_query["branch_id"] = current_user.get('branch_id')
    
    # Count upcoming events (next 30 days)
    upcoming_query = base_query.copy()
    upcoming_query["start_date"] = {
        "$gte": now,
        "$lte": now + timedelta(days=30)
    }
    upcoming_count = await events_coll.count_documents(upcoming_query)
    
    # Count overdue events
    overdue_query = base_query.copy()
    overdue_query["start_date"] = {"$lt": now}
    overdue_query["event_type"] = {"$in": ["deadline", "payment_due", "report_due"]}
    overdue_count = await events_coll.count_documents(overdue_query)
    
    # Count this week's events
    week_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    week_query = base_query.copy()
    week_query["start_date"] = {"$gte": week_start, "$lte": week_end}
    this_week_count = await events_coll.count_documents(week_query)
    
    # Count this month's events
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        month_end = month_start.replace(year=now.year + 1, month=1)
    else:
        month_end = month_start.replace(month=now.month + 1)
    month_query = base_query.copy()
    month_query["start_date"] = {"$gte": month_start, "$lt": month_end}
    this_month_count = await events_coll.count_documents(month_query)
    
    return {
        "upcoming_events": upcoming_count,
        "overdue_events": overdue_count,
        "this_week_events": this_week_count,
        "this_month_events": this_month_count,
        "total_events": await events_coll.count_documents(base_query)
    }

@router.get("/events", response_model=List[AcademicEvent])
async def get_events(
    start_date: Optional[date] = Query(None, description="Filter events from this date"),
    end_date: Optional[date] = Query(None, description="Filter events until this date"),
    event_types: Optional[str] = Query(None, description="Comma-separated list of event types to include"),
    include_auto_generated: bool = Query(True, description="Include auto-generated events"),
    class_ids: Optional[str] = Query(None, description="Comma-separated list of class IDs to filter by"),
    branch_id: Optional[str] = Query(None, description="Filter events by branch ID"),
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Get calendar events with role-based filtering and advanced options"""
    
    print(f"🔍 CALENDAR DEBUG: branch_id={branch_id}, start_date={start_date}, end_date={end_date}, user_role={current_user.get('role')}")
    
    # Build MongoDB query directly
    query = {}
    
    # Date range filtering
    if start_date and end_date:
        query["start_date"] = {
            "$gte": datetime.combine(start_date, datetime.min.time()),
            "$lte": datetime.combine(end_date, datetime.max.time())
        }
    elif start_date:
        query["start_date"] = {"$gte": datetime.combine(start_date, datetime.min.time())}
    elif end_date:
        query["start_date"] = {"$lte": datetime.combine(end_date, datetime.max.time())}
    
    # Event type filtering
    if event_types:
        event_type_list = [t.strip() for t in event_types.split(',')]
        query["event_type"] = {"$in": event_type_list}
    
    # Auto-generated events filtering
    if not include_auto_generated:
        query["auto_generated"] = {"$ne": True}
    
    # Class ID filtering
    if class_ids:
        class_id_list = [c.strip() for c in class_ids.split(',')]
        query["class_ids"] = {"$in": class_id_list}
    
    # Branch filtering
    user_role = current_user.get('role', 'student')
    if user_role in ['superadmin', 'super_admin']:
        # Superadmin can filter by specific branch or see all
        if branch_id:
            query["branch_id"] = branch_id
        # If no branch_id specified, superadmin sees all events
    elif user_role == 'branch_admin' and current_user.get('branch_id'):
        # Branch admin sees only their branch's events
        query["branch_id"] = current_user.get('branch_id')
    
    # Role-based visibility filtering (only for non-admin users)
    if user_role not in ['admin', 'superadmin', 'super_admin', 'principal']:
        query["$or"] = [
            {"is_public": True},
            {"visibility_roles": {"$in": [user_role]}}
        ]
    
    # Get events from collection
    events = []
    async for event in events_coll.find(query).sort("start_date", 1):
        # Skip events with invalid data
        if event.get("academic_year_id") is None:
            continue
            
        events.append(AcademicEvent(
            id=str(event["_id"]),
            **{k: v for k, v in event.items() if k != "_id"}
        ))
    
    print(f"🔍 CALENDAR RESULT: query={query}, found={len(events)} events")
    return events

@router.post("/events/auto-generate/exam")
async def generate_exam_events(
    exam_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Generate calendar events automatically from exam data"""
    
    # Check user role authorization
    if current_user.get("role") not in ["admin", "principal", "teacher"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin, principal, or teacher can generate exam events"
        )
    
    try:
        # Add user context
        exam_data['branch_id'] = current_user.get('branch_id')
        exam_data['created_by'] = current_user.get('user_id')
        
        # Generate events
        generated_events = await calendar_event_generator.generate_exam_events(exam_data)
        
        return {
            "success": True,
            "message": f"Generated {len(generated_events)} events for exam",
            "events": [{"id": event.id, "title": event.title, "start_date": event.start_date} for event in generated_events]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate exam events: {str(e)}")

@router.post("/events/auto-generate/payment")
async def generate_payment_events(
    payment_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Generate calendar events automatically from payment data"""
    
    # Check user role authorization
    if current_user.get("role") not in ["admin", "principal"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or principal can generate payment events"
        )
    
    try:
        # Add user context
        payment_data['branch_id'] = current_user.get('branch_id')
        payment_data['created_by'] = current_user.get('user_id')
        
        # Generate events
        generated_events = await calendar_event_generator.generate_payment_events(payment_data)
        
        return {
            "success": True,
            "message": f"Generated {len(generated_events)} events for payment",
            "events": [{"id": event.id, "title": event.title, "start_date": event.start_date} for event in generated_events]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate payment events: {str(e)}")

@router.post("/events/auto-generate/report")
async def generate_report_events(
    report_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Generate calendar events automatically from report schedule data"""
    
    # Check user role authorization
    if current_user.get("role") not in ["admin", "principal"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or principal can generate report events"
        )
    
    try:
        # Add user context
        report_data['branch_id'] = current_user.get('branch_id')
        report_data['created_by'] = current_user.get('user_id')
        
        # Generate events
        generated_events = await calendar_event_generator.generate_report_events(report_data)
        
        return {
            "success": True,
            "message": f"Generated {len(generated_events)} events for report schedule",
            "events": [{"id": event.id, "title": event.title, "start_date": event.start_date} for event in generated_events]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report events: {str(e)}")

@router.put("/events/sync/{source_type}/{source_id}")
async def sync_events_from_source(
    source_type: str,
    source_id: str,
    updated_data: dict,
    current_user: User = Depends(get_current_user)
):
    """Update auto-generated events when source data changes"""
    
    # Check user role authorization
    if current_user.get("role") not in ["admin", "principal"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or principal can sync events"
        )
    
    valid_source_types = ['exam', 'payment', 'report']
    if source_type not in valid_source_types:
        raise HTTPException(status_code=400, detail=f"Invalid source type. Must be one of: {', '.join(valid_source_types)}")
    
    try:
        await calendar_event_generator.update_events_from_source(source_type, source_id, updated_data)
        
        return {
            "success": True,
            "message": f"Synchronized events for {source_type} {source_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to sync events: {str(e)}")

@router.delete("/events/source/{source_type}/{source_id}")
async def delete_events_from_source(
    source_type: str,
    source_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete auto-generated events when source is deleted"""
    
    # Check user role authorization
    if current_user.get("role") not in ["admin", "principal"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or principal can delete events"
        )
    
    valid_source_types = ['exam', 'payment', 'report']
    if source_type not in valid_source_types:
        raise HTTPException(status_code=400, detail=f"Invalid source type. Must be one of: {', '.join(valid_source_types)}")
    
    try:
        await calendar_event_generator.delete_events_from_source(source_type, source_id)
        
        return {
            "success": True,
            "message": f"Deleted events for {source_type} {source_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete events: {str(e)}")

@router.post("/export", response_model=CalendarExportResponse)
async def export_calendar(
    export_request: CalendarExportRequest,
    current_user: User = Depends(get_current_user)
):
    """Export calendar in various formats (iCal, Google Calendar, Outlook)"""
    
    try:
        # Set user context if not provided
        if not export_request.user_role:
            export_request.user_role = current_user.get('role', 'student')
        if not export_request.user_id:
            export_request.user_id = current_user.get('user_id')
        
        # Generate export
        export_result = await calendar_exporter.export_calendar(export_request)
        
        return export_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to export calendar: {str(e)}")

@router.get("/export/{format}")
async def download_calendar_export(
    format: str,
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    event_types: Optional[str] = Query(None, description="Comma-separated list of event types"),
    class_ids: Optional[str] = Query(None, description="Comma-separated list of class IDs"),
    include_private_events: bool = Query(False),
    current_user: User = Depends(get_current_user)
):
    """Download calendar export file directly"""
    
    # Validate format
    valid_formats = ['ical', 'google', 'outlook']
    if format.lower() not in valid_formats:
        raise HTTPException(status_code=400, detail=f"Invalid format. Must be one of: {', '.join(valid_formats)}")
    
    try:
        # Build export request
        export_request = CalendarExportRequest(
            format=format.lower(),
            date_range_start=start_date,
            date_range_end=end_date,
            include_event_types=event_types.split(',') if event_types else [],
            user_role=current_user.get('role', 'student'),
            user_id=current_user.get('user_id'),
            class_ids=class_ids.split(',') if class_ids else [],
            include_private_events=include_private_events
        )
        
        # Generate export
        export_result = await calendar_exporter.export_calendar(export_request)
        
        # Return as downloadable file
        return Response(
            content=export_result.content,
            media_type=export_result.mime_type,
            headers={
                "Content-Disposition": f"attachment; filename={export_result.filename}",
                "Content-Type": export_result.mime_type
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to download calendar: {str(e)}")

@router.get("/upcoming-events")
async def get_upcoming_events(
    days_ahead: int = Query(14, description="Number of days to look ahead"),
    limit: int = Query(10, description="Maximum number of events to return"),
    event_types: Optional[str] = Query(None, description="Comma-separated list of event types"),
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Get upcoming events within specified timeframe"""
    
    try:
        # Build query parameters
        query_params = {
            'days_ahead': days_ahead,
            'limit': limit,
            'event_types': event_types.split(',') if event_types else [],
            'branch_id': current_user.get('branch_id') if current_user.get('role') == 'branch_admin' else None
        }
        
        # Get upcoming events with role filtering
        events_data = await calendar_event_generator.get_upcoming_events_with_role_filter(
            query_params, 
            current_user.get('role', 'student'),
            current_user.get('user_id')
        )
        
        # Add calculated fields
        from datetime import datetime, timedelta
        now = datetime.now()
        
        for event in events_data:
            event_date = datetime.fromisoformat(event['start_date'].replace('Z', '+00:00'))
            days_until = (event_date.date() - now.date()).days
            event['days_until'] = max(0, days_until)
            event['is_overdue'] = days_until < 0
            event['id'] = str(event.get('_id', event.get('id')))
            if '_id' in event:
                del event['_id']
        
        return {"events": events_data}
        
    except Exception as e:
        # Fallback to basic query if specialized method fails
        from datetime import datetime, timedelta
        
        now = datetime.now()
        future_date = now + timedelta(days=days_ahead)
        
        query = {
            "start_date": {"$gte": now.isoformat(), "$lte": future_date.isoformat()}
        }
        
        if event_types:
            query["event_type"] = {"$in": event_types.split(',')}
        
        if current_user.get('role') == 'branch_admin':
            query["branch_id"] = current_user.get('branch_id')
        
        cursor = events_coll.find(query).sort("start_date", 1).limit(limit)
        events = []
        
        for event in cursor:
            event_date = datetime.fromisoformat(event['start_date'].replace('Z', '+00:00'))
            days_until = (event_date.date() - now.date()).days
            
            event['id'] = str(event['_id'])
            event['days_until'] = max(0, days_until)
            event['is_overdue'] = days_until < 0
            del event['_id']
            events.append(event)
        
        return {"events": events}

@router.get("/stats")
async def get_calendar_stats(
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Get calendar statistics and overview"""
    
    try:
        # Use specialized stats method if available
        stats_data = await calendar_event_generator.get_calendar_statistics(
            current_user.get('role', 'student'),
            current_user.get('user_id'),
            current_user.get('branch_id')
        )
        
        return stats_data
        
    except Exception as e:
        # Fallback to basic stats calculation
        from datetime import datetime, timedelta
        
        now = datetime.now()
        week_ahead = now + timedelta(days=7)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_end = (month_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
        
        # Build base query
        base_query = {}
        if current_user.get('role') == 'branch_admin':
            base_query["branch_id"] = current_user.get('branch_id')
        
        # Upcoming events (next 7 days)
        upcoming_query = {**base_query, "start_date": {"$gte": now.isoformat(), "$lte": week_ahead.isoformat()}}
        upcoming_count = events_coll.count_documents(upcoming_query)
        
        # Overdue events
        overdue_query = {**base_query, "start_date": {"$lt": now.isoformat()}, "event_type": {"$in": ["deadline", "payment_due"]}}
        overdue_count = events_coll.count_documents(overdue_query)
        
        # This month events by type
        month_query = {**base_query, "start_date": {"$gte": month_start.isoformat(), "$lte": month_end.isoformat()}}
        month_events = list(events_coll.find(month_query, {"event_type": 1}))
        
        # Count by event type
        event_type_counts = {}
        for event in month_events:
            event_type = event.get('event_type', 'unknown')
            event_type_counts[event_type] = event_type_counts.get(event_type, 0) + 1
        
        event_types = [{"type": k, "count": v} for k, v in event_type_counts.items()]
        
        # Event sources (auto vs manual)
        auto_generated_count = events_coll.count_documents({**base_query, "auto_generated": True})
        manual_count = events_coll.count_documents({**base_query, "auto_generated": {"$ne": True}})
        
        return {
            "upcoming_events_week": upcoming_count,
            "overdue_events": overdue_count,
            "current_month": {
                "event_types": event_types,
                "total_events": len(month_events)
            },
            "event_sources": {
                "auto_generated": auto_generated_count,
                "manual": manual_count
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get upcoming events: {str(e)}")

@router.post("/events", response_model=AcademicEvent)
async def create_calendar_event(
    event_data: AcademicEventCreate,
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Create a new calendar event"""
    
    # Check permissions - allow creation for admin, principal, teacher roles
    allowed_roles = ['admin', 'principal', 'teacher', 'super_admin', 'hq_admin', 'branch_admin']
    if current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized to create calendar events")
    
    try:
        # Sanitize and prepare event data
        event_dict = sanitize_input(event_data.dict(), [
            "title", "description", "event_type", "start_date", "end_date",
            "is_all_day", "academic_year_id", "term_id", "color", "is_recurring", "is_public"
        ])
        
        # Add metadata
        event_dict['created_by'] = current_user.get('user_id')
        event_dict['branch_id'] = current_user.get('branch_id')
        event_dict['created_at'] = datetime.now().isoformat()
        event_dict['auto_generated'] = False
        event_dict['metadata'] = {
            'created_by_role': current_user.get('role'),
            'source': 'manual_creation'
        }
        
        # Validate dates
        if event_dict.get('end_date') and event_dict['start_date'] >= event_dict['end_date']:
            raise HTTPException(status_code=400, detail="Start date must be before end date")
        
        # Insert the event
        result = events_coll.insert_one(event_dict)
        
        # Fetch the created event
        created_event = events_coll.find_one({'_id': result.inserted_id})
        if not created_event:
            raise HTTPException(status_code=500, detail="Failed to retrieve created event")
        
        # Convert for response
        created_event['id'] = str(created_event['_id'])
        del created_event['_id']
        
        return AcademicEvent(**created_event)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create calendar event: {str(e)}")

@router.get("/stats")
async def get_calendar_stats(
    current_user: User = Depends(get_current_user),
    events_coll: Any = Depends(get_academic_events_collection)
):
    """Get calendar statistics for dashboard"""
    
    try:
        # Build base query with user permissions
        base_query = {}
        if current_user.get('role') == 'branch_admin' and current_user.get('branch_id'):
            base_query['branch_id'] = current_user.get('branch_id')
        
        # Add role-based visibility
        base_query['visibility_roles'] = {"$in": [current_user.get('role', 'student')]}
        
        # Get current month events
        now = datetime.now()
        month_start = datetime(now.year, now.month, 1)
        month_end = datetime(now.year, now.month + 1, 1) if now.month < 12 else datetime(now.year + 1, 1, 1)
        
        # Count events by type for current month
        event_type_pipeline = [
            {"$match": {**base_query, "start_date": {"$gte": month_start, "$lt": month_end}}},
            {"$group": {"_id": "$event_type", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        
        event_types = []
        async for doc in events_coll.aggregate(event_type_pipeline):
            event_types.append({
                "type": doc["_id"],
                "count": doc["count"]
            })
        
        # Count upcoming events (next 7 days)
        week_start = now
        week_end = now + datetime.timedelta(days=7)
        
        upcoming_count = await events_coll.count_documents({
            **base_query,
            "start_date": {"$gte": week_start, "$lt": week_end}
        })
        
        # Count overdue events
        overdue_count = await events_coll.count_documents({
            **base_query,
            "start_date": {"$lt": now},
            "event_type": {"$in": ["deadline", "payment_due"]}
        })
        
        # Count auto-generated vs manual events
        auto_generated_count = await events_coll.count_documents({
            **base_query,
            "auto_generated": True
        })
        
        manual_count = await events_coll.count_documents({
            **base_query,
            "$or": [{"auto_generated": False}, {"auto_generated": {"$exists": False}}]
        })
        
        return {
            "current_month": {
                "year": now.year,
                "month": now.month,
                "event_types": event_types
            },
            "upcoming_events_week": upcoming_count,
            "overdue_events": overdue_count,
            "event_sources": {
                "auto_generated": auto_generated_count,
                "manual": manual_count
            },
            "generated_at": now.isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get calendar stats: {str(e)}")