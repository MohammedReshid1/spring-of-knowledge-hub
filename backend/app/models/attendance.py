from pydantic import BaseModel, Field, validator
from datetime import date, datetime, time
from typing import Optional, List, Dict, Any
from enum import Enum

class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    LATE = "late"
    EXCUSED = "excused"
    TARDY = "tardy"
    EARLY_DEPARTURE = "early_departure"

class AttendanceNotificationType(str, Enum):
    ABSENT_ALERT = "absent_alert"
    LATE_ALERT = "late_alert"
    CONSECUTIVE_ABSENCE = "consecutive_absence"
    PATTERN_CONCERN = "pattern_concern"
    IMPROVEMENT_NOTICE = "improvement_notice"

class AttendanceBase(BaseModel):
    student_id: str
    class_id: str
    subject_id: Optional[str] = None
    teacher_id: Optional[str] = None
    attendance_date: Optional[date] = None
    status: AttendanceStatus = Field(..., description="Attendance status")
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    location: Optional[str] = None
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    branch_id: Optional[str] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    
    @validator('check_out_time')
    def check_out_after_check_in(cls, v, values):
        if v and values.get('check_in_time') and v <= values['check_in_time']:
            raise ValueError('Check-out time must be after check-in time')
        return v

class AttendanceCreate(AttendanceBase):
    send_notifications: Optional[bool] = True

class AttendanceBulkCreate(BaseModel):
    attendance_records: List[AttendanceCreate]
    class_id: str
    subject_id: Optional[str] = None
    attendance_date: date
    recorded_by: str
    send_notifications: Optional[bool] = True

class Attendance(AttendanceBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    notification_sent: Optional[bool] = False
    parent_notified: Optional[bool] = False

    class Config:
        orm_mode = True

class AttendancePattern(BaseModel):
    student_id: str
    pattern_type: str  # consecutive_absence, frequent_lateness, irregular_pattern
    pattern_details: Dict[str, Any]
    severity: str = Field(..., description="low, medium, high, critical")
    detected_date: datetime
    resolved: bool = False
    action_taken: Optional[str] = None

class AttendanceNotification(BaseModel):
    id: Optional[str] = None
    student_id: str
    attendance_id: Optional[str] = None
    notification_type: AttendanceNotificationType
    recipient_ids: List[str]  # Parent/guardian IDs
    message: str
    priority: str = Field(..., description="low, medium, high, urgent")
    scheduled_time: Optional[datetime] = None
    sent_time: Optional[datetime] = None
    status: str = Field(default="pending", description="pending, sent, failed, cancelled")
    delivery_method: List[str] = Field(default=["email"], description="email, sms, push, in_app")
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

class AttendanceSummary(BaseModel):
    student_id: str
    period_start: date
    period_end: date
    total_days: int
    days_present: int
    days_absent: int
    days_late: int
    days_excused: int
    attendance_percentage: float
    punctuality_percentage: float
    consecutive_absences: int
    longest_absence_streak: int
    current_streak: int
    longest_streak: int
    late_arrivals_count: int
    early_departures_count: int
    patterns_detected: List[str]
    improvement_trend: str = Field(..., description="improving, stable, declining")

class AttendanceAlert(BaseModel):
    id: Optional[str] = None
    student_id: str
    alert_type: str
    severity: str
    message: str
    triggered_date: datetime
    acknowledged: bool = False
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved: bool = False
    resolution_notes: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class AttendanceSettings(BaseModel):
    branch_id: str
    school_start_time: time
    school_end_time: time
    late_threshold_minutes: int = 15  # Minutes after start time to mark as late
    notification_settings: Dict[str, Any] = {
        "absent_immediate": True,
        "late_immediate": True,
        "consecutive_absence_threshold": 3,
        "pattern_detection_enabled": True,
        "parent_notification_methods": ["email", "sms"],
        "staff_notification_methods": ["email", "in_app"]
    }
    absence_patterns: Dict[str, Any] = {
        "consecutive_absence_alert": 2,
        "frequent_absence_threshold": 0.85,  # Below 85% triggers alert
        "pattern_analysis_period_days": 30
    }
    auto_mark_settings: Dict[str, Any] = {
        "auto_mark_absent_after_hours": 2,
        "require_manual_confirmation": True
    }

class AttendanceReport(BaseModel):
    report_type: str
    period_start: date
    period_end: date
    filters: Dict[str, Any]
    generated_by: str
    generated_at: datetime
    summary_stats: Dict[str, Any]
    detailed_data: List[Dict[str, Any]]
    charts_data: Optional[Dict[str, Any]] = None
