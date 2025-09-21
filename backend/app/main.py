from fastapi import FastAPI, WebSocket
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

from .routers import users, branches, students, teachers, attendance, backup_logs, classes, grade_levels, grade_transitions, student_enrollments, subjects, stats, uploads, exams, exam_results, academic_calendar, communication, discipline, reports, notifications, inventory, parents, timetable, enhanced_calendar, permissions, fee_categories, system_monitoring
from .routers import teachers_enhanced

# Payment routes - re-enabled after fixing import issues
try:
    from .routers import payments
    PAYMENTS_AVAILABLE = True
    print("✅ Payment routes enabled")
except ImportError as e:
    print(f"⚠️  Payment routes disabled: {e}")
    PAYMENTS_AVAILABLE = False
    
# Payment receipts routes
try:
    from .routers import payment_receipts
    PAYMENT_RECEIPTS_AVAILABLE = True
    print("✅ Payment receipts routes enabled")
except ImportError as e:
    print(f"⚠️  Payment receipts routes disabled: {e}")
    PAYMENT_RECEIPTS_AVAILABLE = False

# Payment reports routes
try:
    from .routers import payment_reports
    PAYMENT_REPORTS_AVAILABLE = True
    print("✅ Payment reports routes enabled")
except ImportError as e:
    print(f"⚠️  Payment reports routes disabled: {e}")
    PAYMENT_REPORTS_AVAILABLE = False
from .utils.rate_limit import rate_limiter, periodic_cleanup

app = FastAPI(
    title="Spring of Knowledge Hub API",
    version="1.0.0",
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
origins = os.getenv("CORS_ORIGINS", "http://localhost:8080,http://localhost:8081,http://localhost:8082,http://localhost:8083,http://localhost:5173,http://127.0.0.1:8080,http://127.0.0.1:8081,http://127.0.0.1:8082,http://127.0.0.1:8083,http://127.0.0.1:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin", "X-CSRF-Token"],
    expose_headers=["X-Total-Count", "X-Page", "X-Per-Page"],
)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory="public/lovable-uploads"), name="uploads")

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(branches.router, prefix="/branches", tags=["branches"])
app.include_router(students.router, prefix="/students", tags=["students"])
app.include_router(teachers.router, prefix="/teachers", tags=["teachers"])
app.include_router(teachers_enhanced.router, prefix="/teachers/enhanced", tags=["teachers"])
app.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
app.include_router(backup_logs.router, prefix="/backup-logs", tags=["backup-logs"])
app.include_router(classes.router, prefix="/classes", tags=["classes"])
app.include_router(grade_levels.router, prefix="/grade-levels", tags=["grade-levels"])
app.include_router(grade_transitions.router, prefix="/grade-transitions", tags=["grade-transitions"])
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
app.include_router(parents.router, prefix="/parents", tags=["parents"])
app.include_router(timetable.router, prefix="/timetable", tags=["timetable"])
app.include_router(enhanced_calendar.router, tags=["enhanced-calendar"])
app.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
app.include_router(fee_categories.router, prefix="/fee-categories", tags=["fee-categories"])
app.include_router(system_monitoring.router, prefix="/system-monitoring", tags=["system-monitoring"])

# Payment Management Routes
if PAYMENTS_AVAILABLE:
    app.include_router(payments.router, prefix="/payments", tags=["payments"])
    print("✅ Payment routes enabled")
else:
    print("❌ Payment routes disabled")

if PAYMENT_RECEIPTS_AVAILABLE:
    app.include_router(payment_receipts.router, prefix="/payment-receipts", tags=["payment-receipts"])
    print("✅ Payment receipts routes enabled")
else:
    print("❌ Payment receipts routes disabled")

if PAYMENT_REPORTS_AVAILABLE:
    app.include_router(payment_reports.router, prefix="/payment-reports", tags=["payment-reports"])
    print("✅ Payment reports routes enabled")
else:
    print("❌ Payment reports routes disabled")

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket):
    """WebSocket endpoint for real-time communication"""
    if not USE_MOCK_DB:
        from .utils.websocket_manager import get_websocket_manager
        from .db import db
        manager = get_websocket_manager(db)
        await manager.connect_client(websocket)
    else:
        await websocket.close(code=1011, reason="WebSocket not available in mock mode")

@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    # Start periodic cleanup task
    asyncio.create_task(periodic_cleanup())
    
    # Initialize data synchronization system
    if not USE_MOCK_DB:
        try:
            from .utils.data_sync import initialize_sync_system
            from .utils.websocket_manager import get_websocket_manager
            from .db import client, db
            
            sync_manager = await initialize_sync_system(client, db.name)
            
            # Start WebSocket manager and connect to sync system
            websocket_manager = get_websocket_manager(db)
            websocket_manager.connect_to_sync_manager(sync_manager)
            await websocket_manager.start()
            
            print("✅ Data synchronization system started")
            print("✅ WebSocket manager started")
        except Exception as e:
            print(f"⚠️  Warning: Could not start sync system: {e}")
    
    print("✅ API server started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Run shutdown tasks."""
    if not USE_MOCK_DB:
        try:
            from .utils.data_sync import shutdown_sync_system
            from .utils.websocket_manager import get_websocket_manager
            from .db import db
            
            # Stop WebSocket manager
            websocket_manager = get_websocket_manager(db)
            await websocket_manager.stop()
            
            # Shutdown sync system
            await shutdown_sync_system()
            
            print("✅ Data synchronization system stopped")
            print("✅ WebSocket manager stopped")
        except Exception as e:
            print(f"⚠️  Warning: Error during shutdown: {e}")
    
    print("✅ API server stopped")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "Spring of Knowledge Hub API"}
