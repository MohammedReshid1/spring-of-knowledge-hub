from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


class ReportType(str, Enum):
    ACADEMIC_PERFORMANCE = "academic_performance"
    ATTENDANCE = "attendance"
    DISCIPLINARY = "disciplinary"
    FINANCIAL = "financial"
    ENROLLMENT = "enrollment"
    TEACHER_PERFORMANCE = "teacher_performance"
    CLASS_ANALYSIS = "class_analysis"
    PARENT_ENGAGEMENT = "parent_engagement"
    EXAM_RESULTS = "exam_results"
    GRADE_DISTRIBUTION = "grade_distribution"


class ReportFormat(str, Enum):
    PDF = "pdf"
    EXCEL = "excel"
    CSV = "csv"
    HTML = "html"
    JSON = "json"


class ReportFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"
    CUSTOM = "custom"


class GradeRange(str, Enum):
    A_PLUS = "A+"
    A = "A"
    B_PLUS = "B+"
    B = "B"
    C_PLUS = "C+"
    C = "C"
    D = "D"
    F = "F"


class ReportMetrics(BaseModel):
    total_students: int = 0
    total_teachers: int = 0
    total_classes: int = 0
    average_grade: Optional[float] = None
    attendance_rate: Optional[float] = None
    pass_rate: Optional[float] = None
    fail_rate: Optional[float] = None
    improvement_rate: Optional[float] = None


class AcademicReport(BaseModel):
    id: Optional[str] = None
    report_code: str = Field(..., description="Auto-generated unique report code")
    report_type: ReportType
    title: str
    description: Optional[str] = None
    
    # Report Configuration
    branch_id: Optional[str] = None
    class_id: Optional[str] = None
    grade_level_id: Optional[str] = None
    subject_id: Optional[str] = None
    teacher_id: Optional[str] = None
    student_ids: Optional[List[str]] = []
    
    # Time Period
    start_date: date
    end_date: date
    academic_year: str
    term: Optional[str] = None
    
    # Report Content
    metrics: ReportMetrics
    grade_distribution: Dict[str, int] = {}
    subject_performance: Dict[str, float] = {}
    attendance_summary: Dict[str, Any] = {}
    behavioral_summary: Dict[str, Any] = {}
    
    # Report Generation
    generated_by: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    format: ReportFormat = ReportFormat.PDF
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    
    # Status and Distribution
    status: str = "generated"  # generated, distributed, archived
    recipients: List[str] = []
    sent_at: Optional[datetime] = None
    
    # Scheduling
    is_scheduled: bool = False
    frequency: Optional[ReportFrequency] = None
    next_generation: Optional[datetime] = None
    
    # Additional Data
    comparisons: Dict[str, Any] = {}  # Comparison with previous periods
    recommendations: List[str] = []
    charts_data: Dict[str, Any] = {}
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class StudentReport(BaseModel):
    id: Optional[str] = None
    report_code: str = Field(..., description="Auto-generated unique report code")
    student_id: str
    student_name: str
    class_id: str
    grade_level_id: str
    
    # Academic Performance
    overall_grade: Optional[str] = None
    overall_percentage: Optional[float] = None
    subject_grades: Dict[str, str] = {}
    subject_percentages: Dict[str, float] = {}
    
    # Attendance
    total_days: int = 0
    days_present: int = 0
    days_absent: int = 0
    attendance_percentage: float = 0.0
    late_arrivals: int = 0
    
    # Behavior and Discipline
    positive_points: int = 0
    negative_points: int = 0
    behavior_balance: int = 0
    incidents_count: int = 0
    rewards_count: int = 0
    
    # Academic Progress
    previous_grade: Optional[str] = None
    grade_improvement: Optional[str] = None
    strengths: List[str] = []
    areas_for_improvement: List[str] = []
    
    # Teacher Comments
    teacher_comments: Dict[str, str] = {}  # subject_id: comment
    principal_comment: Optional[str] = None
    
    # Parent Engagement
    parent_meetings_attended: int = 0
    communication_frequency: str = "low"  # low, medium, high
    
    # Report Period
    report_period: str
    academic_year: str
    start_date: date
    end_date: date
    
    # Generation Info
    generated_by: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    format: ReportFormat = ReportFormat.PDF
    file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ClassReport(BaseModel):
    id: Optional[str] = None
    report_code: str = Field(..., description="Auto-generated unique report code")
    class_id: str
    class_name: str
    teacher_id: str
    teacher_name: str
    grade_level_id: str
    
    # Class Statistics
    total_students: int
    male_students: int
    female_students: int
    average_age: float
    
    # Academic Performance
    class_average: float
    highest_score: float
    lowest_score: float
    pass_rate: float
    
    # Grade Distribution
    grade_distribution: Dict[str, int]
    subject_averages: Dict[str, float]
    
    # Attendance
    average_attendance: float
    best_attendance_student: Optional[str] = None
    concerning_attendance: List[str] = []
    
    # Behavioral Analysis
    total_positive_points: int
    total_negative_points: int
    behavioral_incidents: int
    star_students: List[str] = []
    
    # Progress Tracking
    improvement_trends: Dict[str, str]  # subject_id: trend (improving/declining/stable)
    top_performers: List[str] = []
    students_needing_support: List[str] = []
    
    # Report Period
    report_period: str
    academic_year: str
    start_date: date
    end_date: date
    
    # Generation Info
    generated_by: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    format: ReportFormat = ReportFormat.PDF
    file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ExamAnalysis(BaseModel):
    id: Optional[str] = None
    report_code: str = Field(..., description="Auto-generated unique report code")
    exam_id: str
    exam_name: str
    subject_id: str
    subject_name: str
    
    # Exam Statistics
    total_participants: int
    total_absent: int
    participation_rate: float
    
    # Score Analysis
    highest_score: float
    lowest_score: float
    average_score: float
    median_score: float
    standard_deviation: float
    
    # Grade Distribution
    grade_distribution: Dict[str, int]
    pass_rate: float
    fail_rate: float
    
    # Question Analysis
    question_difficulty: Dict[str, float]  # question_id: difficulty_percentage
    most_missed_questions: List[Dict[str, Any]]
    easiest_questions: List[Dict[str, Any]]
    
    # Performance by Class
    class_performance: Dict[str, float]  # class_id: average_score
    teacher_performance: Dict[str, float]  # teacher_id: class_average
    
    # Comparative Analysis
    comparison_with_previous: Optional[float] = None
    improvement_areas: List[str] = []
    
    # Recommendations
    teaching_recommendations: List[str] = []
    curriculum_suggestions: List[str] = []
    
    # Report Period
    exam_date: date
    academic_year: str
    
    # Generation Info
    generated_by: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    format: ReportFormat = ReportFormat.PDF
    file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class FinancialReport(BaseModel):
    id: Optional[str] = None
    report_code: str = Field(..., description="Auto-generated unique report code")
    report_type: str  # tuition, fees, expenses, revenue
    
    # Financial Summary
    total_revenue: float = 0.0
    total_expenses: float = 0.0
    net_income: float = 0.0
    
    # Revenue Breakdown
    tuition_fees: float = 0.0
    registration_fees: float = 0.0
    exam_fees: float = 0.0
    transport_fees: float = 0.0
    other_fees: float = 0.0
    
    # Payment Status
    total_outstanding: float = 0.0
    collection_rate: float = 0.0
    overdue_amount: float = 0.0
    
    # Student Payment Analysis
    students_paid_full: int = 0
    students_partial_payment: int = 0
    students_no_payment: int = 0
    
    # Branch Analysis
    branch_revenue: Dict[str, float] = {}
    branch_expenses: Dict[str, float] = {}
    
    # Monthly Trends
    monthly_revenue: Dict[str, float] = {}
    monthly_expenses: Dict[str, float] = {}
    
    # Report Period
    start_date: date
    end_date: date
    academic_year: str
    
    # Generation Info
    generated_by: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    format: ReportFormat = ReportFormat.PDF
    file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AttendanceReport(BaseModel):
    id: Optional[str] = None
    report_code: str = Field(..., description="Auto-generated unique report code")
    
    # Scope
    branch_id: Optional[str] = None
    class_id: Optional[str] = None
    grade_level_id: Optional[str] = None
    
    # Attendance Summary
    total_students: int
    average_attendance_rate: float
    total_absences: int
    total_late_arrivals: int
    
    # Daily Breakdown
    daily_attendance: Dict[str, Dict[str, int]]  # date: {present, absent, late}
    attendance_trends: Dict[str, float]  # week/month: attendance_rate
    
    # Student Analysis
    perfect_attendance: List[str] = []
    concerning_attendance: List[Dict[str, Any]] = []  # Students with low attendance
    most_improved: List[str] = []
    
    # Class Comparison
    class_attendance_rates: Dict[str, float]  # class_id: attendance_rate
    best_performing_class: Optional[str] = None
    
    # Patterns and Insights
    common_absence_days: List[str] = []  # Days of week with high absence
    seasonal_patterns: Dict[str, str] = {}
    
    # Report Period
    start_date: date
    end_date: date
    academic_year: str
    
    # Generation Info
    generated_by: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    format: ReportFormat = ReportFormat.PDF
    file_path: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReportTemplate(BaseModel):
    id: Optional[str] = None
    template_code: str = Field(..., description="Auto-generated unique template code")
    name: str
    description: Optional[str] = None
    report_type: ReportType
    
    # Template Configuration
    default_format: ReportFormat = ReportFormat.PDF
    sections: List[str] = []  # List of sections to include
    metrics: List[str] = []  # Metrics to calculate
    charts: List[str] = []  # Chart types to include
    
    # Customization
    header_logo: Optional[str] = None
    footer_text: Optional[str] = None
    color_scheme: str = "default"
    font_family: str = "Arial"
    
    # Access Control
    created_by: str
    branch_access: List[str] = []  # Branches that can use this template
    role_access: List[str] = []  # Roles that can use this template
    
    # Usage Statistics
    usage_count: int = 0
    last_used: Optional[datetime] = None
    
    # Status
    is_active: bool = True
    is_system_template: bool = False
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ReportSchedule(BaseModel):
    id: Optional[str] = None
    schedule_code: str = Field(..., description="Auto-generated unique schedule code")
    name: str
    description: Optional[str] = None
    
    # Report Configuration
    report_type: ReportType
    template_id: Optional[str] = None
    format: ReportFormat = ReportFormat.PDF
    
    # Scheduling
    frequency: ReportFrequency
    start_date: date
    end_date: Optional[date] = None
    next_run: datetime
    
    # Recipients
    email_recipients: List[str] = []
    auto_distribute: bool = True
    
    # Filters and Scope
    branch_filter: Optional[str] = None
    class_filter: Optional[str] = None
    grade_filter: Optional[str] = None
    
    # Status
    is_active: bool = True
    last_run: Optional[datetime] = None
    runs_completed: int = 0
    
    # Error Handling
    last_error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = 3
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)