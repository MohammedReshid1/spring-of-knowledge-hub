from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, WebSocket, WebSocketDisconnect, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from bson import ObjectId
from datetime import datetime, timedelta
import secrets
import hashlib
import json
import jwt
from cryptography.fernet import Fernet
import asyncio
from collections import defaultdict

from ..db import (
    get_db, get_exams_collection, get_exam_results_collection,
    get_student_collection, validate_student_id, validate_class_id
)
from ..models.secure_exam import (
    SecureExamCreate, ExamSession, SecureAnswer, ExamSubmission,
    Question, QuestionBank, ExamMonitoring, ProctorEvent,
    ExamAuditLog, ExamIntegrityReport, SecurityLevel,
    generate_submission_hash, verify_submission_integrity
)
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import sanitize_input, validate_mongodb_id
from ..utils.rate_limit import rate_limit

router = APIRouter()

# In-memory storage for active exam sessions (use Redis in production)
active_sessions: Dict[str, ExamSession] = {}
monitoring_data: Dict[str, List[Dict]] = defaultdict(list)
websocket_connections: Dict[str, WebSocket] = {}

# Encryption key (use key management service in production)
ENCRYPTION_KEY = Fernet.generate_key()
cipher_suite = Fernet(ENCRYPTION_KEY)

# JWT secret for exam sessions
EXAM_SESSION_SECRET = secrets.token_urlsafe(32)

def encrypt_data(data: str) -> str:
    """Encrypt sensitive data."""
    return cipher_suite.encrypt(data.encode()).decode()

def decrypt_data(encrypted_data: str) -> str:
    """Decrypt sensitive data."""
    return cipher_suite.decrypt(encrypted_data.encode()).decode()

def generate_exam_token(exam_id: str, student_id: str, duration_minutes: int) -> str:
    """Generate JWT token for exam session."""
    payload = {
        "exam_id": exam_id,
        "student_id": student_id,
        "exp": datetime.utcnow() + timedelta(minutes=duration_minutes + 10),
        "iat": datetime.utcnow(),
        "session_id": secrets.token_urlsafe(16)
    }
    return jwt.encode(payload, EXAM_SESSION_SECRET, algorithm="HS256")

def verify_exam_token(token: str) -> dict:
    """Verify exam session token."""
    try:
        return jwt.decode(token, EXAM_SESSION_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Exam session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid exam session token")

async def log_exam_action(
    exam_id: str, action: str, user_id: str, 
    request: Request, details: Dict = None
):
    """Log exam-related actions for audit trail."""
    db = await get_db()
    audit_coll = db.exam_audit_logs
    
    log_entry = {
        "exam_id": exam_id,
        "action": action,
        "performed_by": user_id,
        "timestamp": datetime.utcnow(),
        "ip_address": request.client.host,
        "user_agent": request.headers.get("user-agent", ""),
        "details": details or {}
    }
    
    await audit_coll.insert_one(log_entry)

async def check_exam_integrity(session: ExamSession) -> float:
    """Calculate integrity score based on session behavior."""
    score = 100.0
    
    # Deduct points for violations
    score -= session.tab_switch_count * 5
    score -= session.window_blur_count * 3
    score -= session.copy_attempts * 10
    score -= session.paste_attempts * 10
    score -= session.right_click_attempts * 2
    
    # Check for suspicious patterns
    if len(session.suspicious_activities) > 0:
        score -= len(session.suspicious_activities) * 15
    
    return max(0, min(100, score))

@router.post("/secure/create", response_model=Dict)
async def create_secure_exam(
    exam_data: SecureExamCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a secure exam with enhanced security features."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to create exams")
    
    exams_coll = db.secure_exams
    
    # Validate and sanitize input
    exam_dict = sanitize_input(exam_data.dict(), list(exam_data.dict().keys()))
    
    # Generate access code if not provided
    if not exam_dict.get("access_code"):
        exam_dict["access_code"] = secrets.token_urlsafe(8)
    
    # Encrypt access code
    exam_dict["access_code"] = encrypt_data(exam_dict["access_code"])
    
    # Add metadata
    exam_dict.update({
        "created_by": current_user.get("user_id"),
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
        "status": "scheduled",
        "encryption_key_id": ENCRYPTION_KEY.decode()
    })
    
    result = await exams_coll.insert_one(exam_dict)
    exam_id = str(result.inserted_id)
    
    # Log action
    await log_exam_action(
        exam_id, "exam_created", current_user.get("user_id"),
        request, {"exam_name": exam_data.name}
    )
    
    return {
        "id": exam_id,
        "message": "Secure exam created successfully",
        "access_code": decrypt_data(exam_dict["access_code"])  # Return decrypted for display
    }

@router.post("/secure/{exam_id}/questions", response_model=Dict)
async def add_exam_questions(
    exam_id: str,
    questions: List[Question],
    request: Request,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add questions to a secure exam with encryption."""
    if not validate_mongodb_id(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    exams_coll = db.secure_exams
    questions_coll = db.exam_questions
    
    # Check exam exists
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Encrypt correct answers and test cases
    encrypted_questions = []
    for q in questions:
        q_dict = q.dict()
        
        if q_dict.get("correct_answer"):
            q_dict["correct_answer"] = encrypt_data(q_dict["correct_answer"])
        
        if q_dict.get("test_cases"):
            q_dict["test_cases"] = encrypt_data(json.dumps(q_dict["test_cases"]))
        
        q_dict["exam_id"] = exam_id
        q_dict["created_at"] = datetime.utcnow()
        encrypted_questions.append(q_dict)
    
    # Insert questions
    result = await questions_coll.insert_many(encrypted_questions)
    
    # Update exam with question count
    await exams_coll.update_one(
        {"_id": ObjectId(exam_id)},
        {"$set": {"question_count": len(result.inserted_ids)}}
    )
    
    # Log action
    await log_exam_action(
        exam_id, "questions_added", current_user.get("user_id"),
        request, {"question_count": len(questions)}
    )
    
    return {
        "message": f"Added {len(result.inserted_ids)} questions successfully",
        "question_ids": [str(id) for id in result.inserted_ids]
    }

@router.post("/secure/{exam_id}/start", response_model=Dict)
@rate_limit(max_requests=5, window_seconds=60)
async def start_exam_session(
    exam_id: str,
    access_code: str,
    request: Request,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Start a secure exam session with authentication."""
    if not validate_mongodb_id(exam_id):
        raise HTTPException(status_code=400, detail="Invalid exam ID")
    
    exams_coll = db.secure_exams
    sessions_coll = db.exam_sessions
    
    # Get exam
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Verify access code
    try:
        if encrypt_data(access_code) != exam["access_code"]:
            raise HTTPException(status_code=401, detail="Invalid access code")
    except:
        raise HTTPException(status_code=401, detail="Invalid access code")
    
    # Check exam timing
    exam_date = exam["exam_date"]
    grace_period = timedelta(minutes=exam.get("grace_period_minutes", 5))
    
    if datetime.utcnow() < exam_date - grace_period:
        raise HTTPException(status_code=400, detail="Exam has not started yet")
    
    if datetime.utcnow() > exam_date + timedelta(minutes=exam["duration_minutes"] + exam.get("grace_period_minutes", 5)):
        raise HTTPException(status_code=400, detail="Exam has ended")
    
    # Check for existing session
    student_id = current_user.get("user_id")
    existing_session = await sessions_coll.find_one({
        "exam_id": exam_id,
        "student_id": student_id,
        "status": {"$in": ["active", "completed"]}
    })
    
    if existing_session:
        if existing_session["status"] == "completed":
            raise HTTPException(status_code=400, detail="You have already completed this exam")
        return {
            "session_token": existing_session["session_token"],
            "message": "Resuming existing session"
        }
    
    # Create new session
    session_token = generate_exam_token(exam_id, student_id, exam["duration_minutes"])
    
    session = ExamSession(
        id=secrets.token_urlsafe(16),
        exam_id=exam_id,
        student_id=student_id,
        session_token=session_token,
        start_time=datetime.utcnow(),
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent", ""),
        status="active"
    )
    
    # Store session
    session_dict = session.dict()
    await sessions_coll.insert_one(session_dict)
    active_sessions[session.id] = session
    
    # Log action
    await log_exam_action(
        exam_id, "exam_started", student_id,
        request, {"session_id": session.id}
    )
    
    # Get questions (without correct answers)
    questions_coll = db.exam_questions
    questions = []
    async for q in questions_coll.find({"exam_id": exam_id}):
        q_clean = {k: v for k, v in q.items() if k not in ["correct_answer", "test_cases", "_id"]}
        q_clean["id"] = str(q["_id"])
        
        # Randomize options if enabled
        if exam.get("randomize_options") and q_clean.get("options"):
            import random
            random.shuffle(q_clean["options"])
        
        questions.append(q_clean)
    
    # Randomize questions if enabled
    if exam.get("randomize_questions"):
        import random
        random.shuffle(questions)
    
    return {
        "session_token": session_token,
        "session_id": session.id,
        "duration_minutes": exam["duration_minutes"],
        "questions": questions,
        "exam_settings": {
            "questions_per_page": exam.get("questions_per_page", 1),
            "allow_navigation": exam.get("allow_navigation", True),
            "show_question_numbers": exam.get("show_question_numbers", True),
            "show_marks": exam.get("show_marks", True),
            "auto_submit": exam.get("auto_submit", True),
            "warning_time_minutes": exam.get("warning_time_minutes", 10)
        }
    }

@router.post("/secure/session/{session_id}/answer")
async def submit_answer(
    session_id: str,
    answer: SecureAnswer,
    request: Request,
    db: Any = Depends(get_db)
):
    """Submit an answer for a question during exam."""
    if session_id not in active_sessions:
        sessions_coll = db.exam_sessions
        session_data = await sessions_coll.find_one({"id": session_id, "status": "active"})
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found or expired")
        active_sessions[session_id] = ExamSession(**session_data)
    
    session = active_sessions[session_id]
    
    # Verify session token from header
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization")
    
    token = auth_header.split(" ")[1]
    token_data = verify_exam_token(token)
    
    if token_data["student_id"] != session.student_id:
        raise HTTPException(status_code=403, detail="Unauthorized session access")
    
    # Store answer
    answers_coll = db.exam_answers
    answer_dict = answer.dict()
    answer_dict.update({
        "session_id": session_id,
        "exam_id": session.exam_id,
        "student_id": session.student_id,
        "submitted_at": datetime.utcnow()
    })
    
    # Generate answer hash for integrity
    answer_dict["answer_hash"] = generate_submission_hash(answer_dict)
    
    # Check if answer already exists
    existing = await answers_coll.find_one({
        "session_id": session_id,
        "question_id": answer.question_id
    })
    
    if existing:
        await answers_coll.update_one(
            {"_id": existing["_id"]},
            {"$set": answer_dict}
        )
    else:
        await answers_coll.insert_one(answer_dict)
    
    # Update session progress
    if answer.question_id not in session.answered_questions:
        session.answered_questions.append(answer.question_id)
    
    session.time_spent_per_question[answer.question_id] = answer.time_spent_seconds
    
    # Update session in database
    sessions_coll = db.exam_sessions
    await sessions_coll.update_one(
        {"id": session_id},
        {"$set": {
            "answered_questions": session.answered_questions,
            "time_spent_per_question": session.time_spent_per_question
        }}
    )
    
    return {"message": "Answer submitted successfully"}

@router.post("/secure/session/{session_id}/submit")
async def submit_exam(
    session_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Any = Depends(get_db)
):
    """Submit final exam and calculate integrity score."""
    if session_id not in active_sessions:
        sessions_coll = db.exam_sessions
        session_data = await sessions_coll.find_one({"id": session_id})
        if not session_data:
            raise HTTPException(status_code=404, detail="Session not found")
        session = ExamSession(**session_data)
    else:
        session = active_sessions[session_id]
    
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="Exam already submitted")
    
    # Get all answers
    answers_coll = db.exam_answers
    answers = []
    async for answer in answers_coll.find({"session_id": session_id}):
        answers.append(SecureAnswer(**answer))
    
    # Calculate integrity score
    integrity_score = await check_exam_integrity(session)
    
    # Create submission
    submission = ExamSubmission(
        id=secrets.token_urlsafe(16),
        exam_session_id=session_id,
        student_id=session.student_id,
        exam_id=session.exam_id,
        answers=answers,
        submission_time=datetime.utcnow(),
        time_taken_minutes=int((datetime.utcnow() - session.start_time).total_seconds() / 60),
        auto_submitted=request.headers.get("X-Auto-Submit", "false") == "true",
        submission_hash="",
        client_timestamp=datetime.utcnow(),
        server_timestamp=datetime.utcnow(),
        security_violations=session.suspicious_activities,
        integrity_score=integrity_score
    )
    
    # Generate submission hash
    submission_dict = submission.dict()
    submission.submission_hash = generate_submission_hash(submission_dict)
    submission_dict["submission_hash"] = submission.submission_hash
    
    # Store submission
    submissions_coll = db.exam_submissions
    await submissions_coll.insert_one(submission_dict)
    
    # Update session status
    session.status = "completed"
    session.end_time = datetime.utcnow()
    sessions_coll = db.exam_sessions
    await sessions_coll.update_one(
        {"id": session_id},
        {"$set": {
            "status": "completed",
            "end_time": session.end_time,
            "integrity_score": integrity_score
        }}
    )
    
    # Remove from active sessions
    if session_id in active_sessions:
        del active_sessions[session_id]
    
    # Schedule grading in background
    background_tasks.add_task(grade_submission, submission.id, session.exam_id)
    
    # Log action
    await log_exam_action(
        session.exam_id, "exam_submitted", session.student_id,
        request, {
            "session_id": session_id,
            "integrity_score": integrity_score,
            "time_taken_minutes": submission.time_taken_minutes
        }
    )
    
    return {
        "message": "Exam submitted successfully",
        "submission_id": submission.id,
        "integrity_score": integrity_score
    }

@router.post("/secure/session/{session_id}/proctor-event")
async def record_proctor_event(
    session_id: str,
    event: ProctorEvent,
    db: Any = Depends(get_db)
):
    """Record proctoring events during exam."""
    if session_id not in active_sessions:
        return {"message": "Session not active"}
    
    session = active_sessions[session_id]
    
    # Update session based on event type
    if event.event_type == "tab_switch":
        session.tab_switch_count += 1
    elif event.event_type == "window_blur":
        session.window_blur_count += 1
    elif event.event_type == "copy_attempt":
        session.copy_attempts += 1
    elif event.event_type == "paste_attempt":
        session.paste_attempts += 1
    elif event.event_type == "right_click":
        session.right_click_attempts += 1
    
    # Add to suspicious activities if severity is high
    if event.severity in ["high", "critical"]:
        session.suspicious_activities.append(event.dict())
    
    # Store event
    events_coll = db.proctor_events
    event_dict = event.dict()
    event_dict["session_id"] = session_id
    await events_coll.insert_one(event_dict)
    
    # Add to monitoring data
    monitoring_data[session.exam_id].append(event_dict)
    
    # Check if session should be terminated
    exams_coll = db.secure_exams
    exam = await exams_coll.find_one({"_id": ObjectId(session.exam_id)})
    
    if exam and exam.get("max_tab_switches") and session.tab_switch_count > exam["max_tab_switches"]:
        session.status = "terminated"
        session.suspicious_activities.append({
            "reason": "Exceeded maximum tab switches",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Update in database
        sessions_coll = db.exam_sessions
        await sessions_coll.update_one(
            {"id": session_id},
            {"$set": {"status": "terminated", "suspicious_activities": session.suspicious_activities}}
        )
        
        return {"action": "terminate", "reason": "Exceeded maximum tab switches"}
    
    # Calculate current integrity score
    integrity_score = await check_exam_integrity(session)
    
    # Terminate if integrity score too low
    if integrity_score < 30:
        session.status = "suspicious"
        return {"action": "warning", "integrity_score": integrity_score}
    
    return {"action": "recorded", "integrity_score": integrity_score}

@router.websocket("/secure/monitor/{exam_id}")
async def monitor_exam(
    websocket: WebSocket,
    exam_id: str,
    db: Any = Depends(get_db)
):
    """WebSocket endpoint for real-time exam monitoring."""
    await websocket.accept()
    websocket_connections[exam_id] = websocket
    
    try:
        while True:
            # Send monitoring data periodically
            if exam_id in monitoring_data:
                await websocket.send_json({
                    "type": "monitoring_update",
                    "data": monitoring_data[exam_id][-10:]  # Last 10 events
                })
            
            # Get active sessions
            sessions_coll = db.exam_sessions
            active_count = await sessions_coll.count_documents({
                "exam_id": exam_id,
                "status": "active"
            })
            
            suspicious_count = await sessions_coll.count_documents({
                "exam_id": exam_id,
                "status": "suspicious"
            })
            
            await websocket.send_json({
                "type": "session_stats",
                "data": {
                    "active_sessions": active_count,
                    "suspicious_sessions": suspicious_count
                }
            })
            
            await asyncio.sleep(5)  # Update every 5 seconds
            
    except WebSocketDisconnect:
        del websocket_connections[exam_id]

@router.get("/secure/{exam_id}/integrity-report/{student_id}")
async def get_integrity_report(
    exam_id: str,
    student_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate integrity report for a student's exam."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to view reports")
    
    # Get session data
    sessions_coll = db.exam_sessions
    session = await sessions_coll.find_one({
        "exam_id": exam_id,
        "student_id": student_id
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get proctor events
    events_coll = db.proctor_events
    events = []
    async for event in events_coll.find({"session_id": session["id"]}):
        events.append(event)
    
    # Get submission
    submissions_coll = db.exam_submissions
    submission = await submissions_coll.find_one({
        "exam_session_id": session["id"]
    })
    
    # Generate report
    report = ExamIntegrityReport(
        exam_id=exam_id,
        session_id=session["id"],
        student_id=student_id,
        integrity_score=session.get("integrity_score", 100),
        confidence_level="high" if session.get("integrity_score", 100) > 80 else "medium" if session.get("integrity_score", 100) > 50 else "low",
        typing_pattern_score=95.0,  # Placeholder - implement actual analysis
        answer_pattern_score=90.0,  # Placeholder - implement actual analysis
        time_distribution_score=85.0,  # Placeholder - implement actual analysis
        total_violations=len(events),
        critical_violations=len([e for e in events if e.get("severity") == "critical"]),
        violation_details=events,
        review_required=session.get("integrity_score", 100) < 70 or len([e for e in events if e.get("severity") == "critical"]) > 0,
        review_reasons=[],
        recommended_actions=[],
        evidence_snapshots=session.get("snapshots", []),
        activity_timeline=events,
        generated_at=datetime.utcnow()
    )
    
    # Add review reasons
    if session.get("tab_switch_count", 0) > 5:
        report.review_reasons.append("Excessive tab switching")
    if session.get("copy_attempts", 0) > 0:
        report.review_reasons.append("Copy attempts detected")
    if session.get("integrity_score", 100) < 70:
        report.review_reasons.append("Low integrity score")
    
    # Add recommended actions
    if report.review_required:
        report.recommended_actions.append("Manual review of submission")
        if report.critical_violations > 0:
            report.recommended_actions.append("Interview student for verification")
    
    return report

async def grade_submission(submission_id: str, exam_id: str):
    """Background task to grade exam submission."""
    db = await get_db()
    
    # Get submission
    submissions_coll = db.exam_submissions
    submission = await submissions_coll.find_one({"id": submission_id})
    
    if not submission:
        return
    
    # Get exam
    exams_coll = db.secure_exams
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    
    if not exam:
        return
    
    # Get questions with correct answers
    questions_coll = db.exam_questions
    questions = {}
    async for q in questions_coll.find({"exam_id": exam_id}):
        questions[str(q["_id"])] = q
    
    # Calculate marks
    total_marks_obtained = 0
    
    for answer in submission.get("answers", []):
        question = questions.get(answer["question_id"])
        if not question:
            continue
        
        # Decrypt correct answer
        if question.get("correct_answer"):
            correct_answer = decrypt_data(question["correct_answer"])
            
            # Check answer based on question type
            if question["question_type"] == "multiple_choice":
                if answer.get("selected_options") == [correct_answer]:
                    total_marks_obtained += question["marks"]
            elif question["question_type"] in ["short_answer", "true_false"]:
                if answer.get("answer_text", "").lower().strip() == correct_answer.lower().strip():
                    total_marks_obtained += question["marks"]
            # Essay and coding questions need manual grading
    
    # Calculate percentage and grade
    percentage = (total_marks_obtained / exam["total_marks"]) * 100 if exam["total_marks"] > 0 else 0
    status = "pass" if total_marks_obtained >= exam["passing_marks"] else "fail"
    
    # Update submission with grades
    await submissions_coll.update_one(
        {"id": submission_id},
        {"$set": {
            "marks_obtained": total_marks_obtained,
            "percentage": percentage,
            "status": "graded",
            "grade": "A" if percentage >= 90 else "B" if percentage >= 80 else "C" if percentage >= 70 else "D" if percentage >= 60 else "F"
        }}
    )

@router.get("/secure/dashboard/{exam_id}")
async def get_exam_dashboard(
    exam_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get real-time exam monitoring dashboard data."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get exam
    exams_coll = db.secure_exams
    exam = await exams_coll.find_one({"_id": ObjectId(exam_id)})
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    
    # Get sessions
    sessions_coll = db.exam_sessions
    total_sessions = await sessions_coll.count_documents({"exam_id": exam_id})
    active_sessions = await sessions_coll.count_documents({"exam_id": exam_id, "status": "active"})
    completed_sessions = await sessions_coll.count_documents({"exam_id": exam_id, "status": "completed"})
    suspicious_sessions = await sessions_coll.count_documents({"exam_id": exam_id, "status": "suspicious"})
    terminated_sessions = await sessions_coll.count_documents({"exam_id": exam_id, "status": "terminated"})
    
    # Get average integrity score
    pipeline = [
        {"$match": {"exam_id": exam_id, "integrity_score": {"$exists": True}}},
        {"$group": {"_id": None, "avg_integrity": {"$avg": "$integrity_score"}}}
    ]
    
    result = await sessions_coll.aggregate(pipeline).to_list(1)
    avg_integrity = result[0]["avg_integrity"] if result else 100
    
    # Get recent events
    events_coll = db.proctor_events
    recent_events = []
    async for event in events_coll.find({}).sort("timestamp", -1).limit(20):
        event["_id"] = str(event["_id"])
        recent_events.append(event)
    
    return {
        "exam_info": {
            "name": exam["name"],
            "status": exam.get("status", "scheduled"),
            "security_level": exam.get("security_level", "medium"),
            "duration_minutes": exam["duration_minutes"]
        },
        "session_stats": {
            "total": total_sessions,
            "active": active_sessions,
            "completed": completed_sessions,
            "suspicious": suspicious_sessions,
            "terminated": terminated_sessions
        },
        "integrity": {
            "average_score": avg_integrity,
            "high_risk_count": suspicious_sessions + terminated_sessions
        },
        "recent_events": recent_events,
        "monitoring_data": monitoring_data.get(exam_id, [])[-50:]  # Last 50 events
    }