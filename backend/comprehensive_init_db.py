#!/usr/bin/env python3
"""
Comprehensive MongoDB database initialization for Spring of Knowledge Hub
This script ensures all collections are properly initialized with sample data
"""
import asyncio
import os
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from passlib.context import CryptContext
from bson import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def clear_database(db):
    """Clear all collections before initialization"""
    collections = await db.list_collection_names()
    for collection in collections:
        if collection != "system.indexes":
            await db[collection].delete_many({})
            print(f"   Cleared collection: {collection}")

async def init_database():
    """Initialize the database with comprehensive data"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Initializing database: {DATABASE_NAME}")
    
    # Clear existing data if requested
    clear_data = input("Clear existing data? (y/n): ").lower() == 'y'
    if clear_data:
        print("🧹 Clearing existing data...")
        await clear_database(db)
    
    # Create initial branches
    branches = [
        {
            "_id": ObjectId(),
            "name": "Main Campus",
            "address": "123 Education Street, Knowledge City, KC 12345",
            "phone": "+1-555-0123",
            "email": "main@springofknowledge.edu",
            "established_date": datetime(2020, 1, 1).isoformat(),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "West Branch",
            "address": "456 Learning Lane, West District, WD 67890",
            "phone": "+1-555-0456",
            "email": "west@springofknowledge.edu",
            "established_date": datetime(2022, 1, 1).isoformat(),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    if await db.branches.count_documents({}) == 0:
        await db.branches.insert_many(branches)
        print(f"✅ Created {len(branches)} branches")
    
    main_branch_id = str(branches[0]["_id"])
    west_branch_id = str(branches[1]["_id"])
    
    # Create users with different roles
    users = [
        {
            "_id": ObjectId(),
            "email": "admin@springofknowledge.edu",
            "hashed_password": pwd_context.hash("admin123"),
            "full_name": "System Administrator",
            "role": "admin",
            "phone": "+1-555-0100",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        },
        {
            "_id": ObjectId(),
            "email": "principal@springofknowledge.edu",
            "hashed_password": pwd_context.hash("principal123"),
            "full_name": "John Principal",
            "role": "principal",
            "phone": "+1-555-0101",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        },
        {
            "_id": ObjectId(),
            "email": "teacher@springofknowledge.edu",
            "hashed_password": pwd_context.hash("teacher123"),
            "full_name": "Jane Teacher",
            "role": "teacher",
            "phone": "+1-555-0102",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        },
        {
            "_id": ObjectId(),
            "email": "accountant@springofknowledge.edu",
            "hashed_password": pwd_context.hash("accountant123"),
            "full_name": "Bob Accountant",
            "role": "accountant",
            "phone": "+1-555-0103",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        }
    ]
    
    if await db.users.count_documents({}) == 0:
        await db.users.insert_many(users)
        print(f"✅ Created {len(users)} users")
        print("   📧 Credentials:")
        print("      - admin@springofknowledge.edu / admin123")
        print("      - principal@springofknowledge.edu / principal123")
        print("      - teacher@springofknowledge.edu / teacher123")
        print("      - accountant@springofknowledge.edu / accountant123")
    
    teacher_user_id = str(users[2]["_id"])
    
    # Create grade levels
    grade_levels = [
        {
            "_id": ObjectId(),
            "name": "Kindergarten",
            "code": "KG",
            "description": "Kindergarten level for ages 3-5",
            "min_age": 3,
            "max_age": 5,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Grade 1",
            "code": "G1",
            "description": "First grade for ages 6-7",
            "min_age": 6,
            "max_age": 7,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Grade 2",
            "code": "G2",
            "description": "Second grade for ages 7-8",
            "min_age": 7,
            "max_age": 8,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Grade 3",
            "code": "G3",
            "description": "Third grade for ages 8-9",
            "min_age": 8,
            "max_age": 9,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Grade 4",
            "code": "G4",
            "description": "Fourth grade for ages 9-10",
            "min_age": 9,
            "max_age": 10,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Grade 5",
            "code": "G5",
            "description": "Fifth grade for ages 10-11",
            "min_age": 10,
            "max_age": 11,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    if await db.grade_levels.count_documents({}) == 0:
        await db.grade_levels.insert_many(grade_levels)
        print(f"✅ Created {len(grade_levels)} grade levels")
    
    kg_id = str(grade_levels[0]["_id"])
    grade1_id = str(grade_levels[1]["_id"])
    grade2_id = str(grade_levels[2]["_id"])
    
    # Create subjects
    subjects = [
        {
            "_id": ObjectId(),
            "name": "Mathematics",
            "code": "MATH",
            "description": "Basic mathematics and arithmetic",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "English Language",
            "code": "ENG",
            "description": "English reading, writing, and communication",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Science",
            "code": "SCI",
            "description": "Basic science and nature studies",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Social Studies",
            "code": "SOC",
            "description": "History, geography, and social sciences",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Arabic Language",
            "code": "AR",
            "description": "Arabic reading, writing, and communication",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Physical Education",
            "code": "PE",
            "description": "Physical education and sports",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    if await db.subjects.count_documents({}) == 0:
        await db.subjects.insert_many(subjects)
        print(f"✅ Created {len(subjects)} subjects")
    
    math_id = str(subjects[0]["_id"])
    english_id = str(subjects[1]["_id"])
    science_id = str(subjects[2]["_id"])
    
    # Create teachers
    teachers = [
        {
            "_id": ObjectId(),
            "teacher_id": "TCH001",
            "first_name": "Jane",
            "last_name": "Teacher",
            "email": "jane.teacher@springofknowledge.edu",
            "phone": "+1-555-0201",
            "date_of_birth": datetime(1985, 5, 15).isoformat(),
            "gender": "Female",
            "address": "789 Teacher Street, KC 12345",
            "hire_date": datetime(2020, 8, 1).isoformat(),
            "qualifications": ["Bachelor in Education", "Master in Mathematics"],
            "subjects": [math_id, science_id],
            "branch_id": main_branch_id,
            "user_id": teacher_user_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "teacher_id": "TCH002",
            "first_name": "John",
            "last_name": "Smith",
            "email": "john.smith@springofknowledge.edu",
            "phone": "+1-555-0202",
            "date_of_birth": datetime(1990, 3, 20).isoformat(),
            "gender": "Male",
            "address": "321 Educator Avenue, KC 12345",
            "hire_date": datetime(2021, 1, 15).isoformat(),
            "qualifications": ["Bachelor in English Literature", "TEFL Certificate"],
            "subjects": [english_id],
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    if await db.teachers.count_documents({}) == 0:
        await db.teachers.insert_many(teachers)
        print(f"✅ Created {len(teachers)} teachers")
    
    teacher1_id = str(teachers[0]["_id"])
    teacher2_id = str(teachers[1]["_id"])
    
    # Create classes
    classes = [
        {
            "_id": ObjectId(),
            "class_name": "Kindergarten A",
            "grade_level_id": kg_id,
            "branch_id": main_branch_id,
            "teacher_id": teacher1_id,
            "max_capacity": 25,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "room_number": "KG-101",
            "subjects": [math_id, english_id, science_id],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "class_name": "Kindergarten B",
            "grade_level_id": kg_id,
            "branch_id": main_branch_id,
            "teacher_id": teacher2_id,
            "max_capacity": 25,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "room_number": "KG-102",
            "subjects": [math_id, english_id, science_id],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "class_name": "Grade 1 A",
            "grade_level_id": grade1_id,
            "branch_id": main_branch_id,
            "teacher_id": teacher1_id,
            "max_capacity": 30,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "room_number": "G1-101",
            "subjects": [math_id, english_id, science_id],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "class_name": "Grade 2 A",
            "grade_level_id": grade2_id,
            "branch_id": main_branch_id,
            "teacher_id": teacher2_id,
            "max_capacity": 30,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "room_number": "G2-101",
            "subjects": [math_id, english_id, science_id],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.classes.count_documents({}) == 0:
        await db.classes.insert_many(classes)
        print(f"✅ Created {len(classes)} classes")
    
    kg_class_id = str(classes[0]["_id"])
    grade1_class_id = str(classes[2]["_id"])
    
    # Create students
    students = [
        {
            "_id": ObjectId(),
            "student_id": "STU001",
            "first_name": "Alice",
            "last_name": "Johnson",
            "date_of_birth": datetime(2018, 4, 15).isoformat(),
            "gender": "Female",
            "address": "123 Student Lane, KC 12345",
            "guardian_name": "Robert Johnson",
            "guardian_phone": "+1-555-1001",
            "guardian_email": "robert.johnson@email.com",
            "enrollment_date": datetime(2024, 9, 1).isoformat(),
            "grade_level_id": kg_id,
            "class_id": kg_class_id,
            "branch_id": main_branch_id,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "student_id": "STU002",
            "first_name": "Bob",
            "last_name": "Smith",
            "date_of_birth": datetime(2018, 6, 20).isoformat(),
            "gender": "Male",
            "address": "456 Pupil Street, KC 12345",
            "guardian_name": "Sarah Smith",
            "guardian_phone": "+1-555-1002",
            "guardian_email": "sarah.smith@email.com",
            "enrollment_date": datetime(2024, 9, 1).isoformat(),
            "grade_level_id": kg_id,
            "class_id": kg_class_id,
            "branch_id": main_branch_id,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "student_id": "STU003",
            "first_name": "Charlie",
            "last_name": "Brown",
            "date_of_birth": datetime(2017, 3, 10).isoformat(),
            "gender": "Male",
            "address": "789 Scholar Road, KC 12345",
            "guardian_name": "Michael Brown",
            "guardian_phone": "+1-555-1003",
            "guardian_email": "michael.brown@email.com",
            "enrollment_date": datetime(2024, 9, 1).isoformat(),
            "grade_level_id": grade1_id,
            "class_id": grade1_class_id,
            "branch_id": main_branch_id,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.students.count_documents({}) == 0:
        await db.students.insert_many(students)
        print(f"✅ Created {len(students)} students")
        # Update enrollment counts
        await db.classes.update_one({"_id": ObjectId(kg_class_id)}, {"$set": {"current_enrollment": 2}})
        await db.classes.update_one({"_id": ObjectId(grade1_class_id)}, {"$set": {"current_enrollment": 1}})
    
    student1_id = str(students[0]["_id"])
    student2_id = str(students[1]["_id"])
    student3_id = str(students[2]["_id"])
    
    # Create payment modes
    payment_modes = [
        {
            "_id": ObjectId(),
            "name": "Cash",
            "code": "CASH",
            "description": "Cash payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "name": "Bank Transfer",
            "code": "BANK",
            "description": "Bank transfer payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "name": "Credit Card",
            "code": "CARD",
            "description": "Credit card payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "name": "Cheque",
            "code": "CHQ",
            "description": "Cheque payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        }
    ]
    
    if await db.payment_mode.count_documents({}) == 0:
        await db.payment_mode.insert_many(payment_modes)
        print(f"✅ Created {len(payment_modes)} payment modes")
    
    cash_mode_id = str(payment_modes[0]["_id"])
    
    # Create fees
    fees = [
        {
            "_id": ObjectId(),
            "student_id": student1_id,
            "fee_type": "tuition",
            "amount": 5000.00,
            "due_date": datetime(2024, 9, 30).isoformat(),
            "status": "pending",
            "academic_year": "2024-2025",
            "term": "Term 1",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "student_id": student2_id,
            "fee_type": "tuition",
            "amount": 5000.00,
            "due_date": datetime(2024, 9, 30).isoformat(),
            "status": "pending",
            "academic_year": "2024-2025",
            "term": "Term 1",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "student_id": student3_id,
            "fee_type": "tuition",
            "amount": 5500.00,
            "due_date": datetime(2024, 9, 30).isoformat(),
            "status": "paid",
            "academic_year": "2024-2025",
            "term": "Term 1",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.fees.count_documents({}) == 0:
        await db.fees.insert_many(fees)
        print(f"✅ Created {len(fees)} fees")
    
    # Create registration payments
    payments = [
        {
            "_id": ObjectId(),
            "student_id": student3_id,
            "amount": 5500.00,
            "payment_date": datetime(2024, 9, 5).isoformat(),
            "payment_mode": cash_mode_id,
            "receipt_number": "RCP001",
            "academic_year": "2024-2025",
            "fee_type": "tuition",
            "term": "Term 1",
            "remarks": "Full payment for Term 1",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.registration_payments.count_documents({}) == 0:
        await db.registration_payments.insert_many(payments)
        print(f"✅ Created {len(payments)} registration payments")
    
    # Create attendance records
    attendance_records = []
    for i in range(5):
        date = datetime.now() - timedelta(days=i)
        for student_id in [student1_id, student2_id, student3_id]:
            attendance_records.append({
                "_id": ObjectId(),
                "student_id": student_id,
                "class_id": kg_class_id if student_id != student3_id else grade1_class_id,
                "date": date.strftime("%Y-%m-%d"),
                "status": "present" if i % 2 == 0 else "absent",
                "remarks": "",
                "branch_id": main_branch_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
    
    if await db.attendance.count_documents({}) == 0:
        await db.attendance.insert_many(attendance_records)
        print(f"✅ Created {len(attendance_records)} attendance records")
    
    # Create academic calendar events
    academic_events = [
        {
            "_id": ObjectId(),
            "title": "School Year Begins",
            "description": "First day of the 2024-2025 academic year",
            "event_type": "academic",
            "start_date": datetime(2024, 9, 1).isoformat(),
            "end_date": datetime(2024, 9, 1).isoformat(),
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "title": "Mid-Term Exams",
            "description": "Mid-term examinations for all grades",
            "event_type": "exam",
            "start_date": datetime(2024, 11, 15).isoformat(),
            "end_date": datetime(2024, 11, 22).isoformat(),
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "title": "Winter Break",
            "description": "Winter vacation",
            "event_type": "holiday",
            "start_date": datetime(2024, 12, 20).isoformat(),
            "end_date": datetime(2025, 1, 3).isoformat(),
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.academic_events.count_documents({}) == 0:
        await db.academic_events.insert_many(academic_events)
        print(f"✅ Created {len(academic_events)} academic calendar events")
    
    # Create exams
    exams = [
        {
            "_id": ObjectId(),
            "exam_name": "Math Mid-Term Exam",
            "exam_type": "midterm",
            "subject_id": math_id,
            "class_id": grade1_class_id,
            "exam_date": datetime(2024, 11, 15).isoformat(),
            "total_marks": 100,
            "passing_marks": 40,
            "duration_minutes": 90,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "exam_name": "English Mid-Term Exam",
            "exam_type": "midterm",
            "subject_id": english_id,
            "class_id": grade1_class_id,
            "exam_date": datetime(2024, 11, 16).isoformat(),
            "total_marks": 100,
            "passing_marks": 40,
            "duration_minutes": 90,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.exams.count_documents({}) == 0:
        await db.exams.insert_many(exams)
        print(f"✅ Created {len(exams)} exams")
    
    # Create discipline incidents
    incidents = [
        {
            "_id": ObjectId(),
            "student_id": student2_id,
            "incident_type": "minor_violation",
            "title": "Late to Class",
            "description": "Student was 15 minutes late to morning class",
            "incident_date": datetime.now().isoformat(),
            "severity": "low",
            "status": "resolved",
            "reported_by": teacher1_id,
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.incidents.count_documents({}) == 0:
        await db.incidents.insert_many(incidents)
        print(f"✅ Created {len(incidents)} discipline incidents")
    
    # Create inventory items
    inventory_items = [
        {
            "_id": ObjectId(),
            "item_name": "Student Desk",
            "category": "furniture",
            "quantity": 150,
            "unit": "pieces",
            "min_quantity": 10,
            "location": "Storage Room A",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "item_name": "Whiteboard Marker",
            "category": "supplies",
            "quantity": 500,
            "unit": "pieces",
            "min_quantity": 50,
            "location": "Supply Closet",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "item_name": "Projector",
            "category": "equipment",
            "quantity": 10,
            "unit": "pieces",
            "min_quantity": 2,
            "location": "IT Room",
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    if await db.assets.count_documents({}) == 0:
        await db.assets.insert_many(inventory_items)
        print(f"✅ Created {len(inventory_items)} inventory items")
    
    # Create notifications
    notifications = [
        {
            "_id": ObjectId(),
            "title": "Welcome to Spring of Knowledge",
            "message": "Welcome to the 2024-2025 academic year!",
            "type": "announcement",
            "priority": "medium",
            "recipients": ["all"],
            "branch_id": main_branch_id,
            "created_at": datetime.now().isoformat(),
            "is_read": False
        }
    ]
    
    if await db.notifications.count_documents({}) == 0:
        await db.notifications.insert_many(notifications)
        print(f"✅ Created {len(notifications)} notifications")
    
    # Create indexes for better performance
    print("\n📈 Creating database indexes...")
    
    # User indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("branch_id")
    
    # Branch indexes
    await db.branches.create_index("name")
    await db.branches.create_index("status")
    
    # Student indexes
    await db.students.create_index("student_id", unique=True)
    await db.students.create_index("branch_id")
    await db.students.create_index("class_id")
    await db.students.create_index([("first_name", 1), ("last_name", 1)])
    
    # Teacher indexes
    await db.teachers.create_index("teacher_id", unique=True)
    await db.teachers.create_index("branch_id")
    await db.teachers.create_index("email")
    
    # Class indexes
    await db.classes.create_index("branch_id")
    await db.classes.create_index("grade_level_id")
    await db.classes.create_index("teacher_id")
    await db.classes.create_index("academic_year")
    
    # Attendance indexes
    await db.attendance.create_index("student_id")
    await db.attendance.create_index("class_id")
    await db.attendance.create_index("date")
    await db.attendance.create_index([("student_id", 1), ("date", 1)])
    
    # Fee indexes
    await db.fees.create_index("student_id")
    await db.fees.create_index("branch_id")
    await db.fees.create_index("status")
    await db.fees.create_index("due_date")
    
    # Payment indexes
    await db.registration_payments.create_index("student_id")
    await db.registration_payments.create_index("branch_id")
    await db.registration_payments.create_index("payment_date")
    await db.registration_payments.create_index("receipt_number")
    
    # Exam indexes
    await db.exams.create_index("class_id")
    await db.exams.create_index("subject_id")
    await db.exams.create_index("exam_date")
    
    # Incident indexes
    await db.incidents.create_index("student_id")
    await db.incidents.create_index("branch_id")
    await db.incidents.create_index("incident_date")
    
    print("✅ Database indexes created")
    
    # Print summary
    print("\n🎉 Database initialization completed successfully!")
    print("\n📊 Database Summary:")
    print(f"   • Branches: {await db.branches.count_documents({})}")
    print(f"   • Users: {await db.users.count_documents({})}")
    print(f"   • Grade Levels: {await db.grade_levels.count_documents({})}")
    print(f"   • Subjects: {await db.subjects.count_documents({})}")
    print(f"   • Teachers: {await db.teachers.count_documents({})}")
    print(f"   • Classes: {await db.classes.count_documents({})}")
    print(f"   • Students: {await db.students.count_documents({})}")
    print(f"   • Payment Modes: {await db.payment_mode.count_documents({})}")
    print(f"   • Fees: {await db.fees.count_documents({})}")
    print(f"   • Payments: {await db.registration_payments.count_documents({})}")
    print(f"   • Attendance Records: {await db.attendance.count_documents({})}")
    print(f"   • Academic Events: {await db.academic_events.count_documents({})}")
    print(f"   • Exams: {await db.exams.count_documents({})}")
    print(f"   • Discipline Incidents: {await db.incidents.count_documents({})}")
    print(f"   • Inventory Items: {await db.assets.count_documents({})}")
    print(f"   • Notifications: {await db.notifications.count_documents({})}")
    
    print("\n🚀 Your Spring of Knowledge Hub backend is ready!")
    print("\n📝 Test Credentials:")
    print("   Admin: admin@springofknowledge.edu / admin123")
    print("   Principal: principal@springofknowledge.edu / principal123")
    print("   Teacher: teacher@springofknowledge.edu / teacher123")
    print("   Accountant: accountant@springofknowledge.edu / accountant123")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())