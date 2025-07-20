from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

load_dotenv()

# Choose database implementation based on environment
USE_MOCK_DB = os.getenv("USE_MOCK_DB", "true").lower() == "true"

if USE_MOCK_DB:
    print("🔧 Using mock database for development")
    from .db_mock import get_db
else:
    print("🗄️ Using MongoDB database")
    from .db import get_db

from .routers import users, branches, students, teachers, attendance, backup_logs, classes, fees, grade_levels, grade_transitions, payment_mode, registration_payments, student_enrollments, subjects, stats

app = FastAPI()

origins = [
    "http://localhost:8080",
    "http://localhost:5173", # Assuming a common vite dev port
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(branches.router, prefix="/branches", tags=["branches"])
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
