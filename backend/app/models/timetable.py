from pydantic import BaseModel, Field, validator
from datetime import time, datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum

class DayOfWeek(str, Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"

class PeriodType(str, Enum):
    REGULAR = "regular"
    BREAK = "break"
    LUNCH = "lunch"
    ASSEMBLY = "assembly"
    SPORTS = "sports"
    LIBRARY = "library"
    LAB = "lab"
    EXTRA_CURRICULAR = "extra_curricular"

class TimetableStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    SUSPENDED = "suspended"

class ConflictType(str, Enum):
    TEACHER_OVERLAP = "teacher_overlap"
    ROOM_OVERLAP = "room_overlap"
    CLASS_OVERLAP = "class_overlap"
    RESOURCE_OVERLAP = "resource_overlap"
    TIME_CONSTRAINT = "time_constraint"

# Time Slot Models
class TimeSlotBase(BaseModel):
    period_number: int = Field(..., ge=1, le=10, description="Period number in the day")
    start_time: time
    end_time: time
    period_type: PeriodType = PeriodType.REGULAR
    is_break: bool = False
    break_duration_minutes: Optional[int] = Field(None, ge=5, le=60)
    
    @validator('end_time')
    def end_after_start(cls, v, values):
        if 'start_time' in values and v <= values['start_time']:
            raise ValueError('End time must be after start time')
        return v
    
    @validator('break_duration_minutes')
    def break_duration_validation(cls, v, values):
        if values.get('is_break') and not v:
            raise ValueError('Break duration required for break periods')
        return v

class TimeSlotCreate(TimeSlotBase):
    pass

class TimeSlot(TimeSlotBase):
    id: str
    branch_id: str
    academic_year: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Timetable Entry Models
class TimetableEntryBase(BaseModel):
    class_id: str
    subject_id: Optional[str] = None
    teacher_id: Optional[str] = None
    room_number: Optional[str] = None
    day_of_week: DayOfWeek
    time_slot_id: str
    academic_year: str
    term: Optional[str] = None
    is_recurring: bool = True
    specific_date: Optional[date] = None  # For non-recurring entries
    notes: Optional[str] = None
    resources_needed: Optional[List[str]] = Field(default_factory=list)
    is_substitution: bool = False
    original_teacher_id: Optional[str] = None  # For substitutions
    
    @validator('specific_date')
    def specific_date_for_non_recurring(cls, v, values):
        if not values.get('is_recurring', True) and not v:
            raise ValueError('Specific date required for non-recurring entries')
        return v

class TimetableEntryCreate(TimetableEntryBase):
    pass

class TimetableEntry(TimetableEntryBase):
    id: str
    branch_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None
    last_modified_by: Optional[str] = None

    class Config:
        from_attributes = True

# Weekly Timetable Models
class WeeklyTimetableBase(BaseModel):
    name: str
    description: Optional[str] = None
    academic_year: str
    term: Optional[str] = None
    effective_from: date
    effective_to: Optional[date] = None
    status: TimetableStatus = TimetableStatus.DRAFT
    is_default: bool = False
    branch_id: str

class WeeklyTimetableCreate(WeeklyTimetableBase):
    pass

class WeeklyTimetable(WeeklyTimetableBase):
    id: str
    entries: Optional[List[TimetableEntry]] = Field(default_factory=list)
    time_slots: Optional[List[TimeSlot]] = Field(default_factory=list)
    created_at: datetime
    updated_at: Optional[datetime] = None
    created_by: Optional[str] = None

    class Config:
        from_attributes = True

# Conflict Detection Models
class TimetableConflict(BaseModel):
    id: Optional[str] = None
    conflict_type: ConflictType
    severity: str = Field(..., description="low, medium, high, critical")
    description: str
    affected_entries: List[str]  # List of entry IDs
    suggested_resolution: Optional[str] = None
    detected_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# Substitution Models
class SubstitutionBase(BaseModel):
    original_entry_id: str
    substitute_teacher_id: str
    substitution_date: date
    start_time: time
    end_time: time
    reason: str
    notes: Optional[str] = None
    notification_sent: bool = False
    approved_by: Optional[str] = None

class SubstitutionCreate(SubstitutionBase):
    pass

class Substitution(SubstitutionBase):
    id: str
    created_at: datetime
    created_by: str
    status: str = Field(default="pending", description="pending, approved, rejected, completed")

    class Config:
        from_attributes = True

# Room Models
class RoomBase(BaseModel):
    room_number: str
    room_name: Optional[str] = None
    room_type: str = Field(..., description="classroom, laboratory, auditorium, gym, library")
    capacity: int = Field(..., ge=1)
    equipment: Optional[List[str]] = Field(default_factory=list)
    is_available: bool = True
    branch_id: str
    floor: Optional[str] = None
    building: Optional[str] = None
    notes: Optional[str] = None

class RoomCreate(RoomBase):
    pass

class Room(RoomBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Timetable Template Models (for quick setup)
class TimetableTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: str = Field(..., description="primary, secondary, kindergarten, custom")
    total_periods: int = Field(..., ge=4, le=10)
    break_periods: List[int] = Field(default_factory=list)  # Which period numbers are breaks
    lunch_period: Optional[int] = None
    daily_start_time: time
    daily_end_time: time
    period_duration_minutes: int = Field(..., ge=30, le=90)
    break_duration_minutes: int = Field(default=15, ge=10, le=30)
    lunch_duration_minutes: int = Field(default=45, ge=30, le=60)
    working_days: List[DayOfWeek] = Field(default_factory=list)

class TimetableTemplateCreate(TimetableTemplateBase):
    pass

class TimetableTemplate(TimetableTemplateBase):
    id: str
    branch_id: Optional[str] = None  # Null means system-wide template
    created_at: datetime
    created_by: Optional[str] = None
    usage_count: int = 0

    class Config:
        from_attributes = True

# Comprehensive View Models for APIs
class ClassTimetableView(BaseModel):
    class_id: str
    class_name: str
    grade_level: str
    academic_year: str
    entries: List[Dict[str, Any]]  # Organized by day and period
    conflicts: Optional[List[TimetableConflict]] = Field(default_factory=list)

class TeacherTimetableView(BaseModel):
    teacher_id: str
    teacher_name: str
    total_periods_per_week: int
    entries: List[Dict[str, Any]]
    free_periods: List[Dict[str, Any]]
    conflicts: Optional[List[TimetableConflict]] = Field(default_factory=list)

class RoomTimetableView(BaseModel):
    room_id: str
    room_number: str
    room_type: str
    utilization_percentage: float
    entries: List[Dict[str, Any]]
    free_slots: List[Dict[str, Any]]

# Bulk Operations Models
class BulkTimetableCreate(BaseModel):
    timetable_id: str
    entries: List[TimetableEntryCreate]
    auto_resolve_conflicts: bool = False
    notify_affected_users: bool = True

class TimetableBulkUpdate(BaseModel):
    entry_ids: List[str]
    updates: Dict[str, Any]
    reason: Optional[str] = None
    notify_changes: bool = True

# Statistics and Analytics Models
class TimetableStats(BaseModel):
    total_periods_scheduled: int
    total_free_periods: int
    utilization_rate: float
    teacher_workload_stats: Dict[str, Any]
    room_utilization_stats: Dict[str, Any]
    conflict_count: int
    most_busy_day: DayOfWeek
    most_busy_period: int
    subject_distribution: Dict[str, int]

class TimetableExportRequest(BaseModel):
    format: str = Field(..., description="pdf, excel, ical, json")
    view_type: str = Field(..., description="class, teacher, room, master")
    target_id: Optional[str] = None  # Class ID, Teacher ID, or Room ID
    date_range_start: Optional[date] = None
    date_range_end: Optional[date] = None
    include_breaks: bool = True
    include_notes: bool = True
    custom_fields: Optional[List[str]] = Field(default_factory=list)

class TimetableImportRequest(BaseModel):
    source_format: str = Field(..., description="excel, csv, json")
    data: str  # Base64 encoded file content or JSON string
    mapping_config: Dict[str, str]  # Field mapping configuration
    validation_rules: Optional[Dict[str, Any]] = None
    auto_create_missing: bool = False  # Auto-create missing subjects, rooms, etc.

# Settings Models
class TimetableSettings(BaseModel):
    branch_id: str
    academic_year: str
    auto_conflict_detection: bool = True
    auto_conflict_resolution: bool = False
    notification_preferences: Dict[str, bool] = {
        "substitution_alerts": True,
        "conflict_alerts": True,
        "schedule_changes": True,
        "daily_reminders": False
    }
    default_period_duration: int = 45
    default_break_duration: int = 15
    max_periods_per_day: int = 8
    max_consecutive_periods_per_teacher: int = 3
    mandatory_break_after_periods: int = 3
    weekend_scheduling_allowed: bool = False
    substitution_auto_approval: bool = False
    advanced_conflict_detection: bool = True