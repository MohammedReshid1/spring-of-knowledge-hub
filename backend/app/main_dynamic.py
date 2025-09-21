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

# Import routers - use dynamic branch management  
from .routers import (
    users,
    branches_dynamic as branches,  # Use dynamic branch router
    students, teachers, attendance, backup_logs, classes, 
    fees, grade_levels, grade_transitions, payment_mode, 
    student_enrollments, subjects, stats, uploads, 
    registration_payments, exams, exam_results, 
    academic_calendar, communication, discipline, 
    reports, notifications, inventory
)
from .utils.rate_limit import rate_limiter, periodic_cleanup

app = FastAPI(
    title="Spring of Knowledge Hub API - Dynamic Branch Management",
    version="2.0.0",
    description="Multi-branch school management system with dynamic branch creation",
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

# Include routers with dynamic branch management
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(branches.router, prefix="/branches", tags=["branches-dynamic"])  # Dynamic branch management
app.include_router(students.router, prefix="/students", tags=["students"])
app.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
app.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
app.include_router(backup_logs.router, prefix="/backup-logs", tags=["backup-logs"])
app.include_router(classes.router, prefix="/classes", tags=["classes"])
app.include_router(fees.router, prefix="/fees", tags=["fees"])
app.include_router(grade_levels.router, prefix="/grade-levels", tags=["grade-levels"])
app.include_router(grade_transitions.router, prefix="/grade-transitions", tags=["grade-transitions"])
app.include_router(payment_mode.router, prefix="/payment-mode", tags=["payment-mode"])
app.include_router(registration_payments.router, prefix="/registration-payments", tags=["registration-payments"])
app.include_router(student_enrollments.router, prefix="/student-enrollments", tags=["student-enrollments"])
app.include_router(subjects.router, prefix="/subjects", tags=["subjects"])
app.include_router(stats.router, prefix="/stats", tags=["statistics"])
app.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
app.include_router(exams.router, prefix="/exams", tags=["exams"])
app.include_router(exam_results.router, prefix="/exam-results", tags=["exam-results"])
app.include_router(academic_calendar.router, prefix="/academic-calendar", tags=["academic-calendar"])
app.include_router(communication.router, prefix="/communication", tags=["communication"])
app.include_router(discipline.router, prefix="/discipline", tags=["discipline"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])
app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
app.include_router(inventory.router, prefix="/inventory", tags=["inventory"])

@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    # Start periodic cleanup task
    asyncio.create_task(periodic_cleanup())
    print("✅ Dynamic branch management API server started successfully")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy", 
        "service": "Spring of Knowledge Hub API - Dynamic Branch Management",
        "version": "2.0.0",
        "features": ["dynamic_branches", "branch_isolation", "superadmin_control"]
    }

@app.get("/system-info")
async def system_info():
    """Get system information."""
    return {
        "system_name": "Spring of Knowledge Hub",
        "version": "2.0.0",
        "features": {
            "dynamic_branch_creation": True,
            "branch_isolation": True,
            "superadmin_management": True,
            "frontend_controlled": True
        },
        "management": {
            "branches": "Created and managed through frontend by superadmin",
            "users": "Branch-specific users created automatically",
            "data": "Fully isolated per branch"
        }
    }