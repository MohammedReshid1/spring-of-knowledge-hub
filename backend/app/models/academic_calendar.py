from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date

class AcademicYearCreate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)  # e.g., "2023-2024"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_current: bool = False
    branch_id: Optional[str] = None
    description: Optional[str] = None
    
class AcademicYear(AcademicYearCreate):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

class TermCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)  # e.g., "1st Term"
    academic_year_id: str
    start_date: date
    end_date: date
    is_current: bool = False
    branch_id: Optional[str] = None
    description: Optional[str] = None

class Term(TermCreate):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class AcademicEventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: str = Field(..., description="holiday, exam, meeting, event, deadline, payment_due, report_due, attendance_reminder")
    start_date: datetime
    end_date: Optional[datetime] = None
    is_all_day: bool = True
    academic_year_id: str
    term_id: Optional[str] = None
    class_ids: Optional[List[str]] = []  # If specific to certain classes
    branch_id: Optional[str] = None
    color: Optional[str] = "#3498db"  # For calendar display
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None  # daily, weekly, monthly
    reminder_minutes: Optional[int] = None
    is_public: bool = True  # Visible to all or just staff
    
    # Multi-source event support
    source_type: Optional[str] = Field(None, description="manual, exam, payment, attendance, report")  # Source of auto-generated event
    source_id: Optional[str] = None  # ID of source record (exam_id, payment_id, etc.)
    auto_generated: bool = False  # True if auto-generated from other modules
    
    # Role-based visibility
    visibility_roles: Optional[List[str]] = Field(default=["admin", "principal", "teacher", "parent", "student"], description="Roles that can see this event")
    target_audience: Optional[str] = Field("all", description="all, staff, parents, students, specific_class")
    
    # Notification settings
    send_notifications: bool = True
    notification_recipients: Optional[List[str]] = []  # Specific user IDs to notify
    
    # Additional metadata
    metadata: Optional[dict] = {}  # For storing source-specific data
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

class AcademicEvent(AcademicEventCreate):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    
    # Additional computed fields
    days_until: Optional[int] = None
    is_overdue: Optional[bool] = None
    attendee_count: Optional[int] = None

class AcademicEventUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    term_id: Optional[str] = None
    class_ids: Optional[List[str]] = None
    color: Optional[str] = None
    is_recurring: Optional[bool] = None
    recurrence_pattern: Optional[str] = None
    reminder_minutes: Optional[int] = None
    is_public: Optional[bool] = None
    
    # Multi-source and role-based fields
    visibility_roles: Optional[List[str]] = None
    target_audience: Optional[str] = None
    send_notifications: Optional[bool] = None
    notification_recipients: Optional[List[str]] = None
    metadata: Optional[dict] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

class TimetableSlotCreate(BaseModel):
    class_id: str
    subject_id: str
    teacher_id: str
    day_of_week: int = Field(..., ge=0, le=6)  # 0=Monday, 6=Sunday
    start_time: str = Field(..., pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')  # HH:MM format
    end_time: str = Field(..., pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    room_number: Optional[str] = None
    academic_year_id: str
    term_id: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool = True

class TimetableSlot(TimetableSlotCreate):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class TimetableSlotUpdate(BaseModel):
    subject_id: Optional[str] = None
    teacher_id: Optional[str] = None
    day_of_week: Optional[int] = Field(None, ge=0, le=6)
    start_time: Optional[str] = Field(None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    end_time: Optional[str] = Field(None, pattern=r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$')
    room_number: Optional[str] = None
    term_id: Optional[str] = None
    is_active: Optional[bool] = None

class HolidayCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    start_date: date
    end_date: date
    holiday_type: str = Field(..., description="national, religious, school, exam_break")
    description: Optional[str] = None
    academic_year_id: str
    branch_id: Optional[str] = None
    is_recurring: bool = False
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class Holiday(HolidayCreate):
    id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class AcademicCalendarSummary(BaseModel):
    academic_year: AcademicYear
    current_term: Optional[Term] = None
    upcoming_events: List[AcademicEvent]
    upcoming_holidays: List[Holiday]
    total_school_days: int
    days_completed: int
    days_remaining: int

class ExamScheduleCreate(BaseModel):
    exam_id: str
    scheduled_date: datetime
    duration_minutes: int = Field(..., gt=0)
    room_number: Optional[str] = None
    invigilator_ids: Optional[List[str]] = []
    max_students: Optional[int] = None
    special_instructions: Optional[str] = None
    equipment_required: Optional[List[str]] = []
    is_confirmed: bool = False
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ExamSchedule(ExamScheduleCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str

class ExamScheduleUpdate(BaseModel):
    scheduled_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    room_number: Optional[str] = None
    invigilator_ids: Optional[List[str]] = None
    max_students: Optional[int] = None
    special_instructions: Optional[str] = None
    equipment_required: Optional[List[str]] = None
    is_confirmed: Optional[bool] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ReportScheduleCreate(BaseModel):
    term_id: str
    class_id: str
    scheduled_generation_date: datetime
    report_type: str = Field(..., description="term_report, mid_term_report, progress_report")
    auto_publish_to_parents: bool = True
    include_behavior_comments: bool = True
    include_attendance_summary: bool = True
    template_id: Optional[str] = None
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ReportSchedule(ReportScheduleCreate):
    id: str
    status: str = Field(default="scheduled", description="scheduled, generating, completed, failed")
    generated_at: Optional[datetime] = None
    published_at: Optional[datetime] = None
    reports_generated: int = 0
    total_students: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str

class ReportScheduleUpdate(BaseModel):
    scheduled_generation_date: Optional[datetime] = None
    report_type: Optional[str] = None
    auto_publish_to_parents: Optional[bool] = None
    include_behavior_comments: Optional[bool] = None
    include_attendance_summary: Optional[bool] = None
    template_id: Optional[str] = None
    status: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Event Generation Rules
class EventGenerationRule(BaseModel):
    id: str
    rule_name: str = Field(..., description="Name of the rule")
    source_type: str = Field(..., description="exam, payment, attendance, report")
    event_template: dict = Field(..., description="Template for generating events")
    is_active: bool = True
    conditions: Optional[dict] = {}  # Conditions for when to generate events
    advance_days: Optional[int] = 0  # Days before source event to create calendar event
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

class EventGenerationRuleCreate(BaseModel):
    rule_name: str
    source_type: str
    event_template: dict
    is_active: bool = True
    conditions: Optional[dict] = {}
    advance_days: Optional[int] = 0

# Calendar Export Models
class CalendarExportRequest(BaseModel):
    format: str = Field(..., description="ical, google, outlook")
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    include_event_types: Optional[List[str]] = []
    user_role: str = Field(..., description="For role-based filtering")
    user_id: Optional[str] = None
    class_ids: Optional[List[str]] = []  # For class-specific exports
    include_private_events: bool = False

class CalendarExportResponse(BaseModel):
    format: str
    content: str  # The actual calendar content
    filename: str
    mime_type: str
    events_count: int
    generated_at: datetime

# Notification Integration Models
class EventNotification(BaseModel):
    id: str
    event_id: str
    notification_type: str = Field(..., description="reminder, created, updated, cancelled")
    recipient_ids: List[str]
    message_template: str
    scheduled_time: datetime
    status: str = Field(default="pending", description="pending, sent, failed")
    sent_at: Optional[datetime] = None
    error_message: Optional[str] = None
    created_at: datetime
    
class EventNotificationCreate(BaseModel):
    event_id: str
    notification_type: str
    recipient_ids: List[str]
    message_template: str
    scheduled_time: datetime

# Role-based Event Query Models
class EventQueryParams(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    event_types: Optional[List[str]] = []
    user_role: Optional[str] = None
    user_id: Optional[str] = None
    class_ids: Optional[List[str]] = []
    branch_id: Optional[str] = None
    include_auto_generated: bool = True
    visibility_filter: bool = True  # Apply role-based visibility filtering