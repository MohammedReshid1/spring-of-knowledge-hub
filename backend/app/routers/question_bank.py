from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from bson import ObjectId
from datetime import datetime
import secrets
import json
import random
from cryptography.fernet import Fernet
import hashlib

from ..db import get_db, validate_subject_id, validate_mongodb_id
from ..models.secure_exam import Question, QuestionBank, QuestionType
from ..utils.rbac import get_current_user
from ..models.user import User
from ..utils.validation import sanitize_input, prevent_nosql_injection

router = APIRouter()

# Encryption key for question bank (use key management service in production)
QUESTION_ENCRYPTION_KEY = Fernet.generate_key()
question_cipher = Fernet(QUESTION_ENCRYPTION_KEY)

def encrypt_question_data(data: str) -> str:
    """Encrypt sensitive question data."""
    return question_cipher.encrypt(data.encode()).decode()

def decrypt_question_data(encrypted_data: str) -> str:
    """Decrypt sensitive question data."""
    return question_cipher.decrypt(encrypted_data.encode()).decode()

def generate_question_hash(question_data: dict) -> str:
    """Generate hash for question integrity verification."""
    question_str = json.dumps(question_data, sort_keys=True)
    return hashlib.sha256(question_str.encode()).hexdigest()

def randomize_question_order(questions: List[dict], seed: str = None) -> List[dict]:
    """Randomize question order with optional seed for reproducibility."""
    if seed:
        random.seed(seed)
    randomized = questions.copy()
    random.shuffle(randomized)
    return randomized

def randomize_option_order(question: dict) -> dict:
    """Randomize option order for MCQ questions."""
    if question.get("question_type") == "multiple_choice" and question.get("options"):
        options = question["options"].copy()
        correct_answer = question.get("correct_answer")
        
        # Find correct answer index before randomization
        try:
            correct_index = options.index(correct_answer)
        except ValueError:
            correct_index = -1
        
        random.shuffle(options)
        
        # Update correct answer after randomization
        if correct_index >= 0:
            question["correct_answer"] = options[correct_index] if correct_index < len(options) else correct_answer
        
        question["options"] = options
    
    return question

@router.post("/", response_model=Dict)
async def create_question_bank(
    subject_id: str = Form(...),
    grade_level_id: str = Form(...),
    questions_file: UploadFile = File(...),
    encrypt_questions: bool = Form(True),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new question bank with encryption."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to create question banks")
    
    # Validate IDs
    await validate_subject_id(subject_id)
    
    # Read questions from uploaded file
    try:
        content = await questions_file.read()
        questions_data = json.loads(content.decode('utf-8'))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")
    
    if not isinstance(questions_data, list):
        raise HTTPException(status_code=400, detail="Questions file must contain an array of questions")
    
    # Validate and process questions
    processed_questions = []
    difficulty_distribution = {}
    
    for i, q_data in enumerate(questions_data):
        try:
            # Validate required fields
            required_fields = ["question_text", "question_type", "marks"]
            for field in required_fields:
                if field not in q_data:
                    raise ValueError(f"Missing required field: {field}")
            
            # Create question object
            question = Question(
                id=secrets.token_urlsafe(16),
                question_text=q_data["question_text"],
                question_type=QuestionType(q_data["question_type"]),
                marks=float(q_data["marks"]),
                options=q_data.get("options", []),
                correct_answer=q_data.get("correct_answer"),
                answer_key=q_data.get("answer_key"),
                time_limit_seconds=q_data.get("time_limit_seconds"),
                difficulty_level=q_data.get("difficulty_level", 1),
                topic_tags=q_data.get("topic_tags", []),
                media_urls=q_data.get("media_urls", []),
                code_template=q_data.get("code_template"),
                test_cases=q_data.get("test_cases"),
                randomize_options=q_data.get("randomize_options", True)
            )
            
            question_dict = question.dict()
            
            # Encrypt sensitive data
            if encrypt_questions:
                if question_dict.get("correct_answer"):
                    question_dict["correct_answer"] = encrypt_question_data(question_dict["correct_answer"])
                
                if question_dict.get("answer_key"):
                    question_dict["answer_key"] = encrypt_question_data(question_dict["answer_key"])
                
                if question_dict.get("test_cases"):
                    question_dict["test_cases"] = encrypt_question_data(json.dumps(question_dict["test_cases"]))
            
            # Generate integrity hash
            question_dict["integrity_hash"] = generate_question_hash(question_dict)
            question_dict["created_at"] = datetime.utcnow()
            
            processed_questions.append(question_dict)
            
            # Update difficulty distribution
            difficulty = question.difficulty_level
            difficulty_distribution[difficulty] = difficulty_distribution.get(difficulty, 0) + 1
            
        except Exception as e:
            raise HTTPException(
                status_code=400, 
                detail=f"Error processing question {i+1}: {str(e)}"
            )
    
    # Create question bank
    question_bank = QuestionBank(
        id=secrets.token_urlsafe(16),
        subject_id=subject_id,
        grade_level_id=grade_level_id,
        questions=processed_questions,
        created_by=current_user.get("user_id"),
        created_at=datetime.utcnow(),
        last_modified=datetime.utcnow(),
        is_encrypted=encrypt_questions,
        encryption_key_id=QUESTION_ENCRYPTION_KEY.decode(),
        difficulty_distribution=difficulty_distribution
    )
    
    # Store in database
    question_banks_coll = db.question_banks
    bank_dict = question_bank.dict()
    result = await question_banks_coll.insert_one(bank_dict)
    
    return {
        "id": str(result.inserted_id),
        "question_bank_id": question_bank.id,
        "total_questions": len(processed_questions),
        "difficulty_distribution": difficulty_distribution,
        "encrypted": encrypt_questions,
        "message": "Question bank created successfully"
    }

@router.get("/", response_model=List[Dict])
async def list_question_banks(
    subject_id: Optional[str] = Query(None),
    grade_level_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List question banks with optional filters."""
    query = {}
    
    if subject_id:
        query["subject_id"] = subject_id
    if grade_level_id:
        query["grade_level_id"] = grade_level_id
    
    # Add branch filter for branch admins
    if current_user.get('role') == 'branch_admin' and current_user.get('branch_id'):
        query["branch_id"] = current_user.get('branch_id')
    
    query = prevent_nosql_injection(query)
    
    question_banks_coll = db.question_banks
    banks = []
    
    async for bank in question_banks_coll.find(query).skip(skip).limit(limit).sort("created_at", -1):
        # Don't include actual questions in list view
        bank_summary = {
            "id": str(bank["_id"]),
            "question_bank_id": bank.get("id"),
            "subject_id": bank.get("subject_id"),
            "grade_level_id": bank.get("grade_level_id"),
            "total_questions": len(bank.get("questions", [])),
            "difficulty_distribution": bank.get("difficulty_distribution", {}),
            "is_encrypted": bank.get("is_encrypted", False),
            "created_by": bank.get("created_by"),
            "created_at": bank.get("created_at"),
            "last_modified": bank.get("last_modified"),
            "tags": bank.get("tags", [])
        }
        banks.append(bank_summary)
    
    return banks

@router.get("/{bank_id}/questions", response_model=List[Dict])
async def get_question_bank_questions(
    bank_id: str,
    include_answers: bool = Query(False),
    randomize: bool = Query(False),
    difficulty_filter: Optional[int] = Query(None, ge=1, le=5),
    topic_filter: Optional[str] = Query(None),
    limit_questions: Optional[int] = Query(None, ge=1, le=100),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get questions from a question bank with various options."""
    if not validate_mongodb_id(bank_id):
        raise HTTPException(status_code=400, detail="Invalid question bank ID")
    
    question_banks_coll = db.question_banks
    bank = await question_banks_coll.find_one({"_id": ObjectId(bank_id)})
    
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    questions = bank.get("questions", [])
    
    # Apply filters
    if difficulty_filter:
        questions = [q for q in questions if q.get("difficulty_level") == difficulty_filter]
    
    if topic_filter:
        questions = [q for q in questions if topic_filter.lower() in [tag.lower() for tag in q.get("topic_tags", [])]]
    
    # Limit number of questions
    if limit_questions:
        questions = questions[:limit_questions]
    
    # Randomize if requested
    if randomize:
        questions = randomize_question_order(questions)
    
    # Process questions for response
    processed_questions = []
    for question in questions:
        q_copy = question.copy()
        
        # Remove sensitive data if not authorized
        if not include_answers or current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
            q_copy.pop("correct_answer", None)
            q_copy.pop("answer_key", None)
            q_copy.pop("test_cases", None)
            q_copy.pop("integrity_hash", None)
        else:
            # Decrypt sensitive data for authorized users
            if bank.get("is_encrypted"):
                try:
                    if q_copy.get("correct_answer"):
                        q_copy["correct_answer"] = decrypt_question_data(q_copy["correct_answer"])
                    
                    if q_copy.get("answer_key"):
                        q_copy["answer_key"] = decrypt_question_data(q_copy["answer_key"])
                    
                    if q_copy.get("test_cases"):
                        q_copy["test_cases"] = json.loads(decrypt_question_data(q_copy["test_cases"]))
                except Exception:
                    # Skip if decryption fails
                    q_copy.pop("correct_answer", None)
                    q_copy.pop("answer_key", None)
                    q_copy.pop("test_cases", None)
        
        # Randomize options if enabled
        if question.get("randomize_options", True):
            q_copy = randomize_option_order(q_copy)
        
        processed_questions.append(q_copy)
    
    return processed_questions

@router.post("/{bank_id}/generate-exam", response_model=Dict)
async def generate_exam_from_bank(
    bank_id: str,
    num_questions: int = Query(..., ge=1, le=100),
    difficulty_mix: Optional[Dict[int, int]] = None,  # {difficulty_level: count}
    topic_weights: Optional[Dict[str, float]] = None,  # {topic: weight}
    randomize_questions: bool = Query(True),
    randomize_options: bool = Query(True),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generate an exam by selecting questions from question bank with intelligent selection."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to generate exams")
    
    if not validate_mongodb_id(bank_id):
        raise HTTPException(status_code=400, detail="Invalid question bank ID")
    
    question_banks_coll = db.question_banks
    bank = await question_banks_coll.find_one({"_id": ObjectId(bank_id)})
    
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    all_questions = bank.get("questions", [])
    
    if len(all_questions) < num_questions:
        raise HTTPException(
            status_code=400, 
            detail=f"Not enough questions in bank. Available: {len(all_questions)}, Requested: {num_questions}"
        )
    
    selected_questions = []
    
    # If difficulty mix is specified, select questions by difficulty
    if difficulty_mix:
        for difficulty, count in difficulty_mix.items():
            difficulty_questions = [q for q in all_questions if q.get("difficulty_level") == difficulty]
            
            if len(difficulty_questions) < count:
                raise HTTPException(
                    status_code=400,
                    detail=f"Not enough questions of difficulty {difficulty}. Available: {len(difficulty_questions)}, Requested: {count}"
                )
            
            # Apply topic weights if specified
            if topic_weights:
                weighted_questions = []
                for q in difficulty_questions:
                    weight = 1.0
                    for topic in q.get("topic_tags", []):
                        if topic in topic_weights:
                            weight *= topic_weights[topic]
                    weighted_questions.append((q, weight))
                
                # Sort by weight and select top questions
                weighted_questions.sort(key=lambda x: x[1], reverse=True)
                selected_questions.extend([q[0] for q in weighted_questions[:count]])
            else:
                # Random selection
                selected_questions.extend(random.sample(difficulty_questions, count))
    else:
        # Simple random selection
        if topic_weights:
            # Apply topic weights
            weighted_questions = []
            for q in all_questions:
                weight = 1.0
                for topic in q.get("topic_tags", []):
                    if topic in topic_weights:
                        weight *= topic_weights[topic]
                weighted_questions.append((q, weight))
            
            # Sort by weight and select top questions
            weighted_questions.sort(key=lambda x: x[1], reverse=True)
            selected_questions = [q[0] for q in weighted_questions[:num_questions]]
        else:
            selected_questions = random.sample(all_questions, num_questions)
    
    # Randomize question order if requested
    if randomize_questions:
        selected_questions = randomize_question_order(selected_questions)
    
    # Process questions for exam
    exam_questions = []
    total_marks = 0
    
    for question in selected_questions:
        q_copy = question.copy()
        
        # Randomize options if requested and applicable
        if randomize_options and question.get("randomize_options", True):
            q_copy = randomize_option_order(q_copy)
        
        # Remove sensitive data for exam delivery
        q_copy.pop("correct_answer", None)
        q_copy.pop("answer_key", None)
        q_copy.pop("test_cases", None)
        q_copy.pop("integrity_hash", None)
        
        exam_questions.append(q_copy)
        total_marks += question.get("marks", 0)
    
    # Generate exam metadata
    exam_metadata = {
        "generated_from_bank": bank_id,
        "generation_timestamp": datetime.utcnow().isoformat(),
        "total_questions": len(exam_questions),
        "total_marks": total_marks,
        "difficulty_distribution": {},
        "topic_distribution": {},
        "generation_params": {
            "num_questions": num_questions,
            "difficulty_mix": difficulty_mix,
            "topic_weights": topic_weights,
            "randomize_questions": randomize_questions,
            "randomize_options": randomize_options
        }
    }
    
    # Calculate distributions
    for q in selected_questions:
        difficulty = q.get("difficulty_level", 1)
        exam_metadata["difficulty_distribution"][difficulty] = exam_metadata["difficulty_distribution"].get(difficulty, 0) + 1
        
        for topic in q.get("topic_tags", []):
            exam_metadata["topic_distribution"][topic] = exam_metadata["topic_distribution"].get(topic, 0) + 1
    
    return {
        "questions": exam_questions,
        "metadata": exam_metadata,
        "message": f"Generated exam with {len(exam_questions)} questions"
    }

@router.post("/{bank_id}/add-questions", response_model=Dict)
async def add_questions_to_bank(
    bank_id: str,
    questions: List[Question],
    encrypt_new_questions: bool = Query(True),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add new questions to an existing question bank."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to modify question banks")
    
    if not validate_mongodb_id(bank_id):
        raise HTTPException(status_code=400, detail="Invalid question bank ID")
    
    question_banks_coll = db.question_banks
    bank = await question_banks_coll.find_one({"_id": ObjectId(bank_id)})
    
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Process new questions
    new_questions = []
    difficulty_distribution = bank.get("difficulty_distribution", {})
    
    for question in questions:
        question_dict = question.dict()
        question_dict["id"] = secrets.token_urlsafe(16)
        
        # Encrypt sensitive data if requested
        if encrypt_new_questions:
            if question_dict.get("correct_answer"):
                question_dict["correct_answer"] = encrypt_question_data(question_dict["correct_answer"])
            
            if question_dict.get("answer_key"):
                question_dict["answer_key"] = encrypt_question_data(question_dict["answer_key"])
            
            if question_dict.get("test_cases"):
                question_dict["test_cases"] = encrypt_question_data(json.dumps(question_dict["test_cases"]))
        
        # Generate integrity hash
        question_dict["integrity_hash"] = generate_question_hash(question_dict)
        question_dict["created_at"] = datetime.utcnow()
        
        new_questions.append(question_dict)
        
        # Update difficulty distribution
        difficulty = question.difficulty_level
        difficulty_distribution[str(difficulty)] = difficulty_distribution.get(str(difficulty), 0) + 1
    
    # Update question bank
    existing_questions = bank.get("questions", [])
    updated_questions = existing_questions + new_questions
    
    await question_banks_coll.update_one(
        {"_id": ObjectId(bank_id)},
        {
            "$set": {
                "questions": updated_questions,
                "difficulty_distribution": difficulty_distribution,
                "last_modified": datetime.utcnow()
            }
        }
    )
    
    return {
        "message": f"Added {len(new_questions)} questions to question bank",
        "total_questions": len(updated_questions),
        "new_difficulty_distribution": difficulty_distribution
    }

@router.get("/{bank_id}/analytics", response_model=Dict)
async def get_question_bank_analytics(
    bank_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get analytics for a question bank."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin', 'teacher']:
        raise HTTPException(status_code=403, detail="Not authorized to view analytics")
    
    if not validate_mongodb_id(bank_id):
        raise HTTPException(status_code=400, detail="Invalid question bank ID")
    
    question_banks_coll = db.question_banks
    bank = await question_banks_coll.find_one({"_id": ObjectId(bank_id)})
    
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    questions = bank.get("questions", [])
    
    # Calculate analytics
    analytics = {
        "total_questions": len(questions),
        "difficulty_distribution": bank.get("difficulty_distribution", {}),
        "topic_distribution": {},
        "question_type_distribution": {},
        "marks_distribution": {},
        "time_limit_distribution": {},
        "average_marks": 0,
        "total_marks": 0
    }
    
    total_marks = 0
    
    for question in questions:
        # Topic distribution
        for topic in question.get("topic_tags", []):
            analytics["topic_distribution"][topic] = analytics["topic_distribution"].get(topic, 0) + 1
        
        # Question type distribution
        q_type = question.get("question_type", "unknown")
        analytics["question_type_distribution"][q_type] = analytics["question_type_distribution"].get(q_type, 0) + 1
        
        # Marks distribution
        marks = question.get("marks", 0)
        analytics["marks_distribution"][str(marks)] = analytics["marks_distribution"].get(str(marks), 0) + 1
        total_marks += marks
        
        # Time limit distribution
        time_limit = question.get("time_limit_seconds")
        if time_limit:
            time_key = f"{time_limit}s"
            analytics["time_limit_distribution"][time_key] = analytics["time_limit_distribution"].get(time_key, 0) + 1
    
    analytics["total_marks"] = total_marks
    analytics["average_marks"] = round(total_marks / len(questions), 2) if questions else 0
    
    return analytics

@router.delete("/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question_bank(
    bank_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a question bank."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to delete question banks")
    
    if not validate_mongodb_id(bank_id):
        raise HTTPException(status_code=400, detail="Invalid question bank ID")
    
    question_banks_coll = db.question_banks
    
    # Check if bank exists
    bank = await question_banks_coll.find_one({"_id": ObjectId(bank_id)})
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    # Delete the question bank
    result = await question_banks_coll.delete_one({"_id": ObjectId(bank_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Question bank not found")

@router.post("/{bank_id}/validate-integrity", response_model=Dict)
async def validate_question_bank_integrity(
    bank_id: str,
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate the integrity of questions in a question bank."""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=403, detail="Not authorized to validate integrity")
    
    if not validate_mongodb_id(bank_id):
        raise HTTPException(status_code=400, detail="Invalid question bank ID")
    
    question_banks_coll = db.question_banks
    bank = await question_banks_coll.find_one({"_id": ObjectId(bank_id)})
    
    if not bank:
        raise HTTPException(status_code=404, detail="Question bank not found")
    
    questions = bank.get("questions", [])
    integrity_results = {
        "total_questions": len(questions),
        "valid_questions": 0,
        "invalid_questions": 0,
        "issues": []
    }
    
    for i, question in enumerate(questions):
        try:
            # Create a copy without the integrity hash
            q_copy = {k: v for k, v in question.items() if k != "integrity_hash"}
            
            # Calculate expected hash
            expected_hash = generate_question_hash(q_copy)
            stored_hash = question.get("integrity_hash")
            
            if expected_hash == stored_hash:
                integrity_results["valid_questions"] += 1
            else:
                integrity_results["invalid_questions"] += 1
                integrity_results["issues"].append({
                    "question_index": i,
                    "question_id": question.get("id"),
                    "issue": "Hash mismatch - question may have been tampered with",
                    "expected_hash": expected_hash,
                    "stored_hash": stored_hash
                })
        
        except Exception as e:
            integrity_results["invalid_questions"] += 1
            integrity_results["issues"].append({
                "question_index": i,
                "question_id": question.get("id"),
                "issue": f"Integrity check failed: {str(e)}"
            })
    
    return integrity_results