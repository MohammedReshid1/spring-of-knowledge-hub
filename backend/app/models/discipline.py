from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime, date

class IncidentCreate(BaseModel):
    student_id: str
    reported_by: str  # teacher/admin user ID
    incident_type: str = Field(..., description="behavioral, academic, attendance, safety, property_damage, bullying, violence, substance, other")
    severity: str = Field(..., description="minor, moderate, major, severe")
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    location: str = Field(..., min_length=1, max_length=100)
    incident_date: datetime
    witnesses: Optional[List[str]] = []  # List of user IDs who witnessed
    evidence_files: Optional[List[str]] = []  # File URLs/paths
    immediate_action_taken: Optional[str] = None
    parent_contacted: bool = False
    parent_contact_method: Optional[str] = None  # phone, email, meeting, letter
    parent_contact_date: Optional[datetime] = None
    is_resolved: bool = False
    follow_up_required: bool = False
    follow_up_date: Optional[date] = None
    class_id: Optional[str] = None
    subject_id: Optional[str] = None
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

class Incident(IncidentCreate):
    id: str
    incident_code: str  # Auto-generated unique code
    status: str = "open"  # open, under_investigation, resolved, closed
    assigned_to: Optional[str] = None  # counselor/admin assigned
    resolution_summary: Optional[str] = None
    lessons_learned: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str

class IncidentUpdate(BaseModel):
    incident_type: Optional[str] = None
    severity: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    location: Optional[str] = Field(None, min_length=1, max_length=100)
    incident_date: Optional[datetime] = None
    witnesses: Optional[List[str]] = None
    evidence_files: Optional[List[str]] = None
    immediate_action_taken: Optional[str] = None
    parent_contacted: Optional[bool] = None
    parent_contact_method: Optional[str] = None
    parent_contact_date: Optional[datetime] = None
    is_resolved: Optional[bool] = None
    follow_up_required: Optional[bool] = None
    follow_up_date: Optional[date] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_summary: Optional[str] = None
    lessons_learned: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat(),
            date: lambda v: v.isoformat()
        }

class DisciplinaryActionCreate(BaseModel):
    incident_id: str
    student_id: str
    action_type: str = Field(..., description="warning, detention, suspension, expulsion, counseling, community_service, parent_meeting, behavior_contract, other")
    severity_level: str = Field(..., description="level_1, level_2, level_3, level_4")
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    start_date: date
    end_date: Optional[date] = None
    duration_days: Optional[int] = Field(None, ge=1)
    conditions: Optional[List[str]] = []
    assigned_by: str  # admin/principal user ID
    supervised_by: Optional[str] = None  # teacher/counselor user ID
    location: Optional[str] = None  # where action is served
    appeal_allowed: bool = True
    appeal_deadline: Optional[date] = None
    make_up_work_allowed: bool = True
    extracurricular_restriction: bool = False
    parent_notification_required: bool = True
    is_completed: bool = False
    completion_notes: Optional[str] = None
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class DisciplinaryAction(DisciplinaryActionCreate):
    id: str
    action_code: str  # Auto-generated unique code
    status: str = "pending"  # pending, active, completed, appealed, cancelled
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    appeal_submitted: bool = False
    appeal_date: Optional[date] = None
    appeal_reason: Optional[str] = None
    appeal_decision: Optional[str] = None
    appeal_decided_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: str

class BehaviorPointCreate(BaseModel):
    student_id: str
    awarded_by: str  # teacher/admin user ID
    point_type: str = Field(..., description="positive, negative")
    category: str = Field(..., description="academic, behavioral, attendance, participation, leadership, respect, responsibility, safety, other")
    points: int = Field(..., description="Points awarded/deducted")
    reason: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    date_awarded: date
    class_id: Optional[str] = None
    subject_id: Optional[str] = None
    activity_id: Optional[str] = None
    is_visible_to_student: bool = True
    is_visible_to_parent: bool = True
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class BehaviorPoint(BehaviorPointCreate):
    id: str
    point_code: str  # Auto-generated unique code
    created_at: datetime
    updated_at: datetime

class BehaviorPointUpdate(BaseModel):
    point_type: Optional[str] = None
    category: Optional[str] = None
    points: Optional[int] = None
    reason: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    date_awarded: Optional[date] = None
    class_id: Optional[str] = None
    subject_id: Optional[str] = None
    activity_id: Optional[str] = None
    is_visible_to_student: Optional[bool] = None
    is_visible_to_parent: Optional[bool] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class RewardCreate(BaseModel):
    student_id: str
    awarded_by: str  # teacher/admin user ID
    reward_type: str = Field(..., description="certificate, badge, prize, privilege, recognition, points, gift, trip, other")
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    criteria_met: str = Field(..., min_length=1)  # What the student did to earn this
    date_awarded: date
    date_earned: Optional[date] = None  # When the behavior/achievement occurred
    points_required: Optional[int] = None
    monetary_value: Optional[float] = Field(None, ge=0)
    is_public: bool = True  # Should this be announced publicly
    category: str = Field(..., description="academic_excellence, perfect_attendance, good_behavior, leadership, community_service, sports, arts, other")
    certificate_template: Optional[str] = None
    presentation_date: Optional[date] = None
    presented_by: Optional[str] = None
    photo_url: Optional[str] = None
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class Reward(RewardCreate):
    id: str
    reward_code: str  # Auto-generated unique code
    status: str = "awarded"  # awarded, presented, claimed, expired
    expiry_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

class RewardUpdate(BaseModel):
    reward_type: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    criteria_met: Optional[str] = Field(None, min_length=1)
    date_awarded: Optional[date] = None
    date_earned: Optional[date] = None
    points_required: Optional[int] = None
    monetary_value: Optional[float] = Field(None, ge=0)
    is_public: Optional[bool] = None
    category: Optional[str] = None
    certificate_template: Optional[str] = None
    presentation_date: Optional[date] = None
    presented_by: Optional[str] = None
    photo_url: Optional[str] = None
    status: Optional[str] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class CounselingSessionCreate(BaseModel):
    student_id: str
    counselor_id: str  # counselor/psychologist user ID
    session_type: str = Field(..., description="individual, group, family, crisis, assessment, follow_up")
    reason: str = Field(..., description="behavioral, academic, emotional, social, family, trauma, bullying, substance, career, other")
    title: str = Field(..., min_length=1, max_length=200)
    session_date: datetime
    duration_minutes: int = Field(..., gt=0)
    location: str = Field(..., min_length=1, max_length=100)
    participants: Optional[List[str]] = []  # Other participants (parents, teachers, etc.)
    goals: List[str] = Field(..., min_items=1)
    intervention_strategies: Optional[List[str]] = []
    homework_assigned: Optional[str] = None
    next_session_date: Optional[datetime] = None
    risk_level: str = Field(..., description="low, moderate, high, critical")
    confidentiality_level: str = Field(..., description="standard, restricted, confidential")
    parent_involvement_required: bool = False
    teacher_notification_required: bool = False
    follow_up_required: bool = True
    referral_needed: bool = False
    referral_type: Optional[str] = None  # external_counselor, psychiatrist, social_worker, medical
    emergency_contact_made: bool = False
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class CounselingSession(CounselingSessionCreate):
    id: str
    session_code: str  # Auto-generated unique code
    status: str = "scheduled"  # scheduled, completed, cancelled, no_show
    attendance_status: Optional[str] = None  # present, late, absent
    session_notes: Optional[str] = None
    progress_assessment: Optional[str] = None
    concerns_identified: Optional[List[str]] = []
    recommendations: Optional[List[str]] = []
    action_items: Optional[List[str]] = []
    parent_feedback: Optional[str] = None
    teacher_feedback: Optional[str] = None
    crisis_intervention_needed: bool = False
    created_at: datetime
    updated_at: datetime
    created_by: str

class CounselingSessionUpdate(BaseModel):
    session_type: Optional[str] = None
    reason: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    session_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    location: Optional[str] = Field(None, min_length=1, max_length=100)
    participants: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    intervention_strategies: Optional[List[str]] = None
    homework_assigned: Optional[str] = None
    next_session_date: Optional[datetime] = None
    risk_level: Optional[str] = None
    confidentiality_level: Optional[str] = None
    parent_involvement_required: Optional[bool] = None
    teacher_notification_required: Optional[bool] = None
    follow_up_required: Optional[bool] = None
    referral_needed: Optional[bool] = None
    referral_type: Optional[str] = None
    emergency_contact_made: Optional[bool] = None
    status: Optional[str] = None
    session_notes: Optional[str] = None
    progress_assessment: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class BehaviorContractCreate(BaseModel):
    student_id: str
    created_by: str  # counselor/admin user ID
    contract_type: str = Field(..., description="behavioral, academic, attendance, safety, social")
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    goals: List[str] = Field(..., min_items=1)
    expectations: List[str] = Field(..., min_items=1)
    consequences: List[str] = Field(..., min_items=1)
    rewards: List[str] = Field(..., min_items=1)
    start_date: date
    end_date: date
    review_frequency: str = Field(..., description="daily, weekly, biweekly, monthly")
    success_criteria: List[str] = Field(..., min_items=1)
    monitoring_method: str = Field(..., description="teacher_observation, self_monitoring, peer_monitoring, parent_monitoring, point_system")
    parent_signature_required: bool = True
    student_signature_required: bool = True
    teacher_signatures_required: Optional[List[str]] = []  # List of teacher IDs
    is_active: bool = True
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class BehaviorContract(BehaviorContractCreate):
    id: str
    contract_code: str  # Auto-generated unique code
    status: str = "draft"  # draft, active, completed, violated, terminated
    signed_by_student: bool = False
    student_signature_date: Optional[date] = None
    signed_by_parent: bool = False
    parent_signature_date: Optional[date] = None
    teacher_signatures: Optional[dict] = {}  # {teacher_id: signature_date}
    progress_reviews: Optional[List[dict]] = []  # Review history
    completion_percentage: float = 0.0
    violation_count: int = 0
    last_violation_date: Optional[date] = None
    renewal_count: int = 0
    termination_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class BehaviorContractUpdate(BaseModel):
    contract_type: Optional[str] = None
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    goals: Optional[List[str]] = None
    expectations: Optional[List[str]] = None
    consequences: Optional[List[str]] = None
    rewards: Optional[List[str]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    review_frequency: Optional[str] = None
    success_criteria: Optional[List[str]] = None
    monitoring_method: Optional[str] = None
    parent_signature_required: Optional[bool] = None
    student_signature_required: Optional[bool] = None
    teacher_signatures_required: Optional[List[str]] = None
    is_active: Optional[bool] = None
    status: Optional[str] = None
    signed_by_student: Optional[bool] = None
    signed_by_parent: Optional[bool] = None
    completion_percentage: Optional[float] = None
    
    class Config:
        json_encoders = {
            date: lambda v: v.isoformat()
        }

class BehaviorRubricCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(..., min_length=1)
    category: str = Field(..., description="classroom_behavior, academic_behavior, social_behavior, safety_behavior")
    grade_levels: List[str] = Field(..., min_items=1)
    criteria: List[dict] = Field(..., min_items=1)  # [{name, description, levels: [{score, description}]}]
    point_scale: dict = Field(..., description="Point values for each level")
    is_active: bool = True
    created_by: str
    branch_id: Optional[str] = None

class BehaviorRubric(BehaviorRubricCreate):
    id: str
    rubric_code: str
    usage_count: int = 0
    created_at: datetime
    updated_at: datetime

class ParentMeetingCreate(BaseModel):
    student_id: str
    incident_id: Optional[str] = None
    meeting_type: str = Field(..., description="disciplinary, behavioral, academic, counseling, iep, 504, emergency")
    title: str = Field(..., min_length=1, max_length=200)
    purpose: str = Field(..., min_length=1)
    requested_by: str  # user ID who requested the meeting
    scheduled_date: datetime
    duration_minutes: int = Field(..., gt=0)
    location: str = Field(..., min_length=1, max_length=100)
    attendees_required: List[str] = Field(..., min_items=1)  # List of user IDs (parents, teachers, admin)
    agenda_items: List[str] = Field(..., min_items=1)
    preparation_notes: Optional[str] = None
    interpreter_needed: bool = False
    interpreter_language: Optional[str] = None
    special_accommodations: Optional[str] = None
    priority: str = Field(..., description="low, medium, high, urgent")
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ParentMeeting(ParentMeetingCreate):
    id: str
    meeting_code: str
    status: str = "scheduled"  # scheduled, confirmed, completed, cancelled, rescheduled
    confirmation_sent: bool = False
    confirmation_received: bool = False
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    attendees_present: Optional[List[str]] = []
    meeting_notes: Optional[str] = None
    action_items: Optional[List[dict]] = []  # [{item, assigned_to, due_date, status}]
    follow_up_required: bool = False
    follow_up_date: Optional[date] = None
    parent_satisfaction_rating: Optional[int] = Field(None, ge=1, le=5)
    parent_feedback: Optional[str] = None
    documents_shared: Optional[List[str]] = []
    created_at: datetime
    updated_at: datetime

class DisciplinaryStats(BaseModel):
    total_incidents: int
    open_incidents: int
    resolved_incidents: int
    incidents_by_type: dict
    incidents_by_severity: dict
    most_common_violations: List[dict]
    repeat_offenders: List[dict]
    positive_behavior_points: int
    negative_behavior_points: int
    rewards_given: int
    counseling_sessions_held: int
    behavior_contracts_active: int
    parent_meetings_scheduled: int
    disciplinary_actions_pending: int
    trend_analysis: dict
    class_behavior_summary: dict
    grade_level_analysis: dict