from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime
from enum import Enum
import hashlib
import json

class QuestionType(str, Enum):
    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    FILL_BLANK = "fill_blank"
    MATCHING = "matching"
    CODING = "coding"

class ExamStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class SecurityLevel(str, Enum):
    LOW = "low"  # Basic exam
    MEDIUM = "medium"  # Anti-cheating enabled
    HIGH = "high"  # Full proctoring and monitoring
    MAXIMUM = "maximum"  # Lockdown browser required

class Question(BaseModel):
    id: str
    question_text: str
    question_type: QuestionType
    marks: float = Field(..., gt=0)
    options: Optional[List[str]] = None  # For MCQ
    correct_answer: Optional[str] = None  # Encrypted
    answer_key: Optional[str] = None  # For matching questions
    time_limit_seconds: Optional[int] = None  # Per question time limit
    difficulty_level: int = Field(default=1, ge=1, le=5)
    topic_tags: List[str] = []
    media_urls: List[str] = []  # Images, videos for questions
    code_template: Optional[str] = None  # For coding questions
    test_cases: Optional[List[Dict]] = None  # For coding questions (encrypted)
    randomize_options: bool = True
    
class SecureExamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    subject_id: str
    class_id: str
    teacher_id: str
    exam_type: str
    total_marks: float = Field(..., gt=0)
    passing_marks: float = Field(..., gt=0)
    exam_date: datetime
    duration_minutes: int = Field(..., gt=0)
    
    # Security Settings
    security_level: SecurityLevel = SecurityLevel.MEDIUM
    randomize_questions: bool = True
    randomize_options: bool = True
    show_results_immediately: bool = False
    allow_review: bool = False
    require_webcam: bool = False
    require_screen_share: bool = False
    lockdown_browser: bool = False
    
    # Anti-cheating measures
    prevent_copy_paste: bool = True
    prevent_right_click: bool = True
    detect_tab_switch: bool = True
    max_tab_switches: int = 3
    detect_window_blur: bool = True
    take_snapshots: bool = False
    snapshot_interval_seconds: int = 60
    
    # Access control
    access_code: Optional[str] = None  # Exam access password
    ip_restrictions: List[str] = []  # Allowed IP addresses
    device_restrictions: List[str] = []  # Allowed device IDs
    
    # Question settings
    questions_per_page: int = 1
    allow_navigation: bool = True  # Allow going back to previous questions
    show_question_numbers: bool = True
    show_marks: bool = True
    
    # Time controls
    grace_period_minutes: int = 5
    auto_submit: bool = True
    warning_time_minutes: int = 10  # Warning before exam ends
    
    instructions: Optional[str] = None
    academic_year: str
    term: str
    branch_id: Optional[str] = None
    is_active: bool = True

class ExamSession(BaseModel):
    id: str
    exam_id: str
    student_id: str
    session_token: str  # JWT token for exam session
    start_time: datetime
    end_time: Optional[datetime] = None
    ip_address: str
    user_agent: str
    device_id: Optional[str] = None
    
    # Session tracking
    status: str = "active"  # active, completed, terminated, suspicious
    tab_switch_count: int = 0
    window_blur_count: int = 0
    copy_attempts: int = 0
    paste_attempts: int = 0
    right_click_attempts: int = 0
    
    # Question progress
    current_question_index: int = 0
    answered_questions: List[str] = []
    flagged_questions: List[str] = []
    time_spent_per_question: Dict[str, int] = {}  # question_id: seconds
    
    # Proctoring data
    webcam_enabled: bool = False
    screen_share_enabled: bool = False
    snapshots: List[Dict] = []  # List of snapshot metadata
    
    # Integrity checks
    submission_hash: Optional[str] = None
    integrity_score: float = 100.0  # Decreases with suspicious activity
    suspicious_activities: List[Dict] = []
    
class SecureAnswer(BaseModel):
    question_id: str
    answer_text: Optional[str] = None
    selected_options: Optional[List[str]] = None  # For MCQ
    code_submission: Optional[str] = None  # For coding questions
    time_spent_seconds: int
    submission_timestamp: datetime
    answer_hash: str  # Hash of the answer for integrity

class ExamSubmission(BaseModel):
    id: str
    exam_session_id: str
    student_id: str
    exam_id: str
    answers: List[SecureAnswer]
    
    # Submission metadata
    submission_time: datetime
    time_taken_minutes: int
    auto_submitted: bool = False
    
    # Integrity verification
    submission_hash: str  # Overall submission hash
    client_timestamp: datetime
    server_timestamp: datetime
    
    # Security events during exam
    security_violations: List[Dict] = []
    integrity_score: float
    
    # Grading
    marks_obtained: Optional[float] = None
    percentage: Optional[float] = None
    grade: Optional[str] = None
    status: Optional[str] = None  # pending, graded, under_review
    
    # Anti-plagiarism
    plagiarism_check_completed: bool = False
    plagiarism_score: Optional[float] = None
    similar_submissions: List[str] = []

class QuestionBank(BaseModel):
    id: str
    subject_id: str
    grade_level_id: str
    questions: List[Question]
    created_by: str
    created_at: datetime
    last_modified: datetime
    is_encrypted: bool = True
    encryption_key_id: str  # Reference to encryption key
    tags: List[str] = []
    difficulty_distribution: Dict[int, int] = {}  # difficulty_level: count

class ExamMonitoring(BaseModel):
    exam_id: str
    monitoring_data: List[Dict]  # Real-time monitoring events
    active_sessions: List[str]  # Active session IDs
    suspicious_sessions: List[str]  # Sessions flagged for review
    terminated_sessions: List[str]  # Forcefully terminated sessions
    
    # Statistics
    total_students: int
    students_started: int
    students_completed: int
    average_integrity_score: float
    
    # Alerts
    alerts: List[Dict] = []  # Real-time alerts for teachers
    
class ProctorEvent(BaseModel):
    session_id: str
    event_type: str  # tab_switch, copy_attempt, webcam_disabled, etc.
    timestamp: datetime
    details: Dict[str, Any]
    severity: str  # low, medium, high, critical
    action_taken: Optional[str] = None  # warning_shown, session_terminated, etc.

class ExamAuditLog(BaseModel):
    id: str
    exam_id: str
    action: str  # created, modified, accessed, submitted, graded, etc.
    performed_by: str
    timestamp: datetime
    ip_address: str
    user_agent: str
    details: Dict[str, Any]
    
    @validator('details')
    def sanitize_details(cls, v):
        # Remove sensitive information from logs
        if isinstance(v, dict):
            sensitive_keys = ['password', 'token', 'correct_answer', 'answer_key']
            return {k: '***' if k in sensitive_keys else val for k, val in v.items()}
        return v

class ExamIntegrityReport(BaseModel):
    exam_id: str
    session_id: str
    student_id: str
    
    # Overall scores
    integrity_score: float
    confidence_level: str  # high, medium, low
    
    # Behavioral analysis
    typing_pattern_score: float
    answer_pattern_score: float
    time_distribution_score: float
    
    # Security violations
    total_violations: int
    critical_violations: int
    violation_details: List[Dict]
    
    # Recommendations
    review_required: bool
    review_reasons: List[str]
    recommended_actions: List[str]
    
    # Evidence
    evidence_snapshots: List[str]  # URLs to stored snapshots
    activity_timeline: List[Dict]
    
    generated_at: datetime
    reviewed: bool = False
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None

def generate_submission_hash(submission_data: dict) -> str:
    """Generate a cryptographic hash of submission data for integrity verification."""
    # Sort keys for consistent hashing
    sorted_data = json.dumps(submission_data, sort_keys=True, default=str)
    return hashlib.sha256(sorted_data.encode()).hexdigest()

def verify_submission_integrity(submission: ExamSubmission, original_hash: str) -> bool:
    """Verify the integrity of an exam submission."""
    submission_dict = submission.dict(exclude={'submission_hash'})
    calculated_hash = generate_submission_hash(submission_dict)
    return calculated_hash == original_hash