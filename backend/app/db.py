from motor.motor_asyncio import AsyncIOMotorClient
from fastapi import Depends, HTTPException, status
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.spring_of_knowledge

def get_db():
    return db

# Dependency functions to fetch specific collections
    
def get_user_collection(db=Depends(get_db)):
    return db["users"]

    
def get_branch_collection(db=Depends(get_db)):
    return db["branches"]

    
def get_student_collection(db=Depends(get_db)):
    return db["students"]

async def validate_branch_id(branch_id: str) -> str:
    """
    Ensure the branch_id exists in the branches collection.
    """
    # use global db to get branches collection
    branches = db["branches"]
    if not ObjectId.is_valid(branch_id) or not await branches.find_one({"_id": ObjectId(branch_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid branch_id"
        )
    return branch_id
 
async def validate_student_id(student_id: str) -> str:
    """
    Ensure the student_id exists in the students collection.
    """
    students = db["students"]
    if not ObjectId.is_valid(student_id) or not await students.find_one({"_id": ObjectId(student_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid student_id"
        )
    return student_id

async def validate_subject_id(subject_id: str) -> str:
    """
    Ensure the subject_id exists in the subjects collection.
    """
    subjects = db["subjects"]
    if not ObjectId.is_valid(subject_id) or not await subjects.find_one({"_id": ObjectId(subject_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid subject_id"
        )
    return subject_id

async def validate_teacher_id(teacher_id: str) -> str:
    """
    Ensure the teacher_id exists in the users collection as a teacher.
    """
    users = db["users"]
    if not ObjectId.is_valid(teacher_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid teacher_id"
        )
    user = await users.find_one({"_id": ObjectId(teacher_id)})
    if not user or user.get("role") != "teacher":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher not found or invalid"
        )
    return teacher_id

async def validate_grade_level_id(grade_level_id: str) -> str:
    """
    Ensure the grade_level_id exists in the grade_levels collection.
    """
    grade_levels = db["grade_levels"]
    if not ObjectId.is_valid(grade_level_id) or not await grade_levels.find_one({"_id": ObjectId(grade_level_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid grade_level_id"
        )
    return grade_level_id

async def validate_class_id(class_id: str) -> str:
    """
    Ensure the class_id exists in the classes collection.
    """
    classes = db["classes"]
    if not ObjectId.is_valid(class_id) or not await classes.find_one({"_id": ObjectId(class_id)}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid class_id"
        )
    return class_id


def get_attendance_collection(db=Depends(get_db)):
    return db["attendance"]


def get_backup_logs_collection(db=Depends(get_db)):
    return db["backup_logs"]


def get_classes_collection(db=Depends(get_db)):
    return db["classes"]


def get_fees_collection(db=Depends(get_db)):
    return db["fees"]


def get_grade_levels_collection(db=Depends(get_db)):
    return db["grade_levels"]


def get_grade_transitions_collection(db=Depends(get_db)):
    return db["grade_transitions"]


def get_payment_mode_collection(db=Depends(get_db)):
    return db["payment_mode"]


def get_registration_payments_collection(db=Depends(get_db)):
    return db["registration_payments"]


def get_student_enrollments_collection(db=Depends(get_db)):
    return db["student_enrollments"]


def get_subjects_collection(db=Depends(get_db)):
    return db["subjects"]
