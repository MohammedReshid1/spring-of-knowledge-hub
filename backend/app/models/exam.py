from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime, date
from enum import Enum

class ExamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    subject_id: str
    class_id: str
    teacher_id: str
    exam_type: str = Field(..., description="midterm, final, quiz, assignment, project")
    total_marks: float = Field(..., gt=0)
    passing_marks: float = Field(..., gt=0)
    exam_date: datetime
    duration_minutes: int = Field(..., gt=0)
    instructions: Optional[str] = None
    syllabus_topics: Optional[List[str]] = []
    academic_year: str
    term: str = Field(..., description="1st_term, 2nd_term, 3rd_term")
    branch_id: Optional[str] = None
    is_active: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Exam(ExamCreate):
    id: str
    created_at: datetime
    updated_at: datetime
    created_by: str

class ExamUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    subject_id: Optional[str] = None
    class_id: Optional[str] = None
    teacher_id: Optional[str] = None
    exam_type: Optional[str] = None
    total_marks: Optional[float] = Field(None, gt=0)
    passing_marks: Optional[float] = Field(None, gt=0)
    exam_date: Optional[datetime] = None
    duration_minutes: Optional[int] = Field(None, gt=0)
    instructions: Optional[str] = None
    syllabus_topics: Optional[List[str]] = None
    academic_year: Optional[str] = None
    term: Optional[str] = None
    is_active: Optional[bool] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ExamResultCreate(BaseModel):
    exam_id: str
    student_id: str
    marks_obtained: float = Field(..., ge=0)
    attendance_status: str = Field(..., description="present, absent, late")
    submission_status: str = Field(..., description="submitted, not_submitted, partial")
    graded_by: str
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None
    remarks: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class ExamResult(ExamResultCreate):
    id: str
    percentage: float
    grade: str
    status: str  # pass, fail
    created_at: datetime
    updated_at: datetime

class ExamResultUpdate(BaseModel):
    marks_obtained: Optional[float] = Field(None, ge=0)
    attendance_status: Optional[str] = None
    submission_status: Optional[str] = None
    feedback: Optional[str] = None
    remarks: Optional[str] = None
    graded_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class GradingScale(BaseModel):
    id: str
    name: str
    min_percentage: float
    max_percentage: float
    grade_point: float
    letter_grade: str
    description: Optional[str] = None
    branch_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

class GradingScaleCreate(BaseModel):
    name: str
    min_percentage: float = Field(..., ge=0, le=100)
    max_percentage: float = Field(..., ge=0, le=100)
    grade_point: float = Field(..., ge=0)
    letter_grade: str
    description: Optional[str] = None
    branch_id: Optional[str] = None

class ExamStats(BaseModel):
    exam_id: str
    total_students: int
    students_appeared: int
    students_passed: int
    students_failed: int
    highest_marks: float
    lowest_marks: float
    average_marks: float
    median_marks: float
    standard_deviation: float
    pass_percentage: float

# Enums for report generation
class ReportCardStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    SENT_TO_PARENTS = "sent_to_parents"
    ARCHIVED = "archived"

class GradePointScale(str, Enum):
    FOUR_POINT = "4.0"
    FIVE_POINT = "5.0"
    TEN_POINT = "10.0"
    HUNDRED_POINT = "100.0"

class ReportCardType(str, Enum):
    TERM_REPORT = "term_report"
    PROGRESS_REPORT = "progress_report"
    FINAL_REPORT = "final_report"
    TRANSCRIPT = "transcript"

# Enhanced models for report generation and transcripts
class SubjectGrade(BaseModel):
    subject_id: str
    subject_name: str
    teacher_id: str
    teacher_name: str
    exams: List[Dict[str, Any]]  # List of exam results for this subject
    total_marks_obtained: float
    total_marks_possible: float
    percentage: float
    letter_grade: str
    grade_points: float
    remarks: Optional[str] = None
    
class TermGrades(BaseModel):
    term: str
    academic_year: str
    subjects: List[SubjectGrade]
    overall_percentage: float
    overall_grade: str
    overall_gpa: float
    total_marks_obtained: float
    total_marks_possible: float
    rank_in_class: Optional[int] = None
    total_students_in_class: Optional[int] = None
    attendance_percentage: Optional[float] = None
    days_present: Optional[int] = None
    total_days: Optional[int] = None
    
class StudentTranscript(BaseModel):
    id: str
    student_id: str
    student_name: str
    class_id: str
    class_name: str
    section: str
    academic_years: List[TermGrades]
    cumulative_gpa: float
    cumulative_percentage: float
    total_credits: Optional[float] = None
    generated_at: datetime
    generated_by: str
    status: ReportCardStatus = ReportCardStatus.DRAFT
    branch_id: Optional[str] = None
    
class ReportCardTemplate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    template_type: ReportCardType
    grade_levels: List[str]
    includes_attendance: bool = True
    includes_behavior_grades: bool = False
    includes_extracurricular: bool = False
    includes_teacher_comments: bool = True
    includes_principal_comments: bool = False
    grading_scale: GradePointScale = GradePointScale.FOUR_POINT
    template_config: Dict[str, Any]  # JSON config for template customization
    branch_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: str

class ReportCardTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    template_type: ReportCardType
    grade_levels: List[str]
    includes_attendance: bool = True
    includes_behavior_grades: bool = False
    includes_extracurricular: bool = False
    includes_teacher_comments: bool = True
    includes_principal_comments: bool = False
    grading_scale: GradePointScale = GradePointScale.FOUR_POINT
    template_config: Dict[str, Any] = {}
    branch_id: Optional[str] = None

class ReportCard(BaseModel):
    id: str
    student_id: str
    student_name: str
    class_id: str
    class_name: str
    section: str
    academic_year: str
    term: str
    template_id: str
    grades: TermGrades
    teacher_comments: Optional[str] = None
    principal_comments: Optional[str] = None
    behavior_grades: Optional[Dict[str, Any]] = None
    extracurricular_activities: Optional[List[Dict[str, Any]]] = None
    generated_at: datetime
    generated_by: str
    published_at: Optional[datetime] = None
    published_by: Optional[str] = None
    sent_to_parents_at: Optional[datetime] = None
    status: ReportCardStatus = ReportCardStatus.DRAFT
    pdf_url: Optional[str] = None
    branch_id: Optional[str] = None
    parent_ids: List[str] = []

class ReportCardCreate(BaseModel):
    student_id: str
    class_id: str
    academic_year: str
    term: str
    template_id: str
    teacher_comments: Optional[str] = None
    principal_comments: Optional[str] = None
    behavior_grades: Optional[Dict[str, Any]] = None
    extracurricular_activities: Optional[List[Dict[str, Any]]] = None
    
class BulkReportGeneration(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    class_ids: List[str]
    academic_year: str
    term: str
    template_id: str
    include_unpublished_grades: bool = False
    auto_publish: bool = False
    auto_send_to_parents: bool = False
    total_students: int
    processed_students: int
    successful_reports: int
    failed_reports: int
    status: str  # pending, processing, completed, failed, cancelled
    error_details: Optional[List[Dict[str, Any]]] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    created_by: str
    branch_id: Optional[str] = None

class BulkReportGenerationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    class_ids: List[str]
    academic_year: str
    term: str
    template_id: str
    include_unpublished_grades: bool = False
    auto_publish: bool = False
    auto_send_to_parents: bool = False

class GradeAnalytics(BaseModel):
    student_id: str
    subject_id: str
    academic_year: str
    term: str
    grade_trend: List[Dict[str, Any]]  # Historical grade progression
    performance_prediction: Optional[Dict[str, Any]] = None
    improvement_areas: List[str] = []
    strengths: List[str] = []
    compared_to_class_average: float  # Percentage above/below class average
    generated_at: datetime