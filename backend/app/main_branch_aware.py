from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.sessions import SessionMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
import asyncio

load_dotenv()

# Choose database implementation based on environment
USE_MOCK_DB = os.getenv("USE_MOCK_DB", "false").lower() == "true"

if USE_MOCK_DB:
    print("🔧 Using mock database for development")
    from .db_mock import get_db
else:
    print("🗄️ Using MongoDB database")
    from .db import get_db

# Import branch-aware routers
from .routers import (
    users, branches, 
    students_branch_aware as students,
    teachers_branch_aware as teachers,
    classes_branch_aware as classes,
    subjects_branch_aware as subjects,
    grade_levels_branch_aware as grade_levels,
    fees_branch_aware as fees,
    attendance_branch_aware as attendance,
    exams_branch_aware as exams,
    exam_results_branch_aware as exam_results,
    inventory_branch_aware as inventory,
    notifications_branch_aware as notifications,
    discipline_branch_aware as discipline,
    reports_branch_aware as reports,
    academic_calendar_branch_aware as academic_calendar,
    communication_branch_aware as communication,
    # Keep non-branch specific routers as they are
    backup_logs, grade_transitions, payment_mode, 
    student_enrollments, stats, uploads, registration_payments
)
from .utils.rate_limit import rate_limiter, periodic_cleanup

app = FastAPI(
    title="Spring of Knowledge Hub API - Branch Aware",
    version="2.0.0",
    description="Multi-branch school management system with data isolation",
    docs_url="/docs" if os.getenv("ENVIRONMENT", "development") == "development" else None,
    redoc_url="/redoc" if os.getenv("ENVIRONMENT", "development") == "development" else None,
)

# Security middleware - Trusted Host
allowed_hosts = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
if allowed_hosts and allowed_hosts[0]:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=allowed_hosts
    )

# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Session middleware for CSRF protection
session_secret = os.getenv("SESSION_SECRET_KEY")
if not session_secret:
    session_secret = os.urandom(32).hex()
    print("⚠️  SESSION_SECRET_KEY not set, using generated key")

app.add_middleware(
    SessionMiddleware,
    secret_key=session_secret
)

# CORS configuration with stricter settings
origins = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:8081,http://127.0.0.1:8082,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
    expose_headers=["X-Total-Count", "X-Page", "X-Per-Page"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory="public/lovable-uploads"), name="uploads")

# Include branch-aware routers
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(branches.router, prefix="/branches", tags=["branches"])
app.include_router(students.router, prefix="/students", tags=["students-branch-aware"])
app.include_router(teachers.router, prefix="/teachers", tags=["teachers-branch-aware"])
app.include_router(classes.router, prefix="/classes", tags=["classes-branch-aware"])
app.include_router(subjects.router, prefix="/subjects", tags=["subjects-branch-aware"])
app.include_router(grade_levels.router, prefix="/grade-levels", tags=["grade-levels-branch-aware"])
app.include_router(fees.router, prefix="/fees", tags=["fees-branch-aware"])
app.include_router(attendance.router, prefix="/attendance", tags=["attendance-branch-aware"])
app.include_router(exams.router, prefix="/exams", tags=["exams-branch-aware"])
app.include_router(exam_results.router, prefix="/exam-results", tags=["exam-results-branch-aware"])
app.include_router(inventory.router, prefix="/inventory", tags=["inventory-branch-aware"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications-branch-aware"])
app.include_router(discipline.router, prefix="/discipline", tags=["discipline-branch-aware"])
app.include_router(reports.router, prefix="/reports", tags=["reports-branch-aware"])
app.include_router(academic_calendar.router, prefix="/academic-calendar", tags=["academic-calendar-branch-aware"])
app.include_router(communication.router, prefix="/communication", tags=["communication-branch-aware"])

# Include non-branch specific routers
app.include_router(backup_logs.router, prefix="/backup-logs", tags=["backup-logs"])
app.include_router(grade_transitions.router, prefix="/grade-transitions", tags=["grade-transitions"])
app.include_router(payment_mode.router, prefix="/payment-mode", tags=["payment-mode"])
app.include_router(registration_payments.router, prefix="/registration-payments", tags=["registration-payments"])
app.include_router(student_enrollments.router, prefix="/student-enrollments", tags=["student-enrollments"])
app.include_router(stats.router, prefix="/stats", tags=["statistics"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])

@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    # Start periodic cleanup task
    asyncio.create_task(periodic_cleanup())
    print("✅ Branch-aware API server started successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy", 
        "service": "Spring of Knowledge Hub API - Branch Aware",
        "version": "2.0.0",
        "features": ["branch_isolation", "data_security", "multi_tenant"]
    }

@app.get("/branch-status")
async def branch_status():
    """Check branch isolation status."""
    return {
        "branch_isolation": "enabled",
        "data_isolation": "per_branch",
        "cross_branch_access": "superadmin_only",
        "security_level": "high"
    }
