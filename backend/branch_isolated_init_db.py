#!/usr/bin/env python3
"""
Branch-Isolated MongoDB Database Initialization
Creates separate data for each branch to ensure proper data isolation
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

async def create_branch_data(db, branch_info, is_main=False):
    """Create complete data for a specific branch"""
    branch_id = str(branch_info["_id"])
    branch_name = branch_info["name"]
    
    print(f"\n🏢 Creating data for {branch_name} (ID: {branch_id})")
    
    # Create users for this branch
    users = [
        {
            "_id": ObjectId(),
            "email": f"admin@{branch_name.lower().replace(' ', '')}.edu",
            "hashed_password": pwd_context.hash("admin123"),
            "full_name": f"{branch_name} Administrator",
            "role": "admin",
            "phone": f"+1-555-{1000 + hash(branch_id) % 9000}",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True,
            "all_branches_access": False
        },
        {
            "_id": ObjectId(),
            "email": f"principal@{branch_name.lower().replace(' ', '')}.edu",
            "hashed_password": pwd_context.hash("principal123"),
            "full_name": f"{branch_name} Principal",
            "role": "principal",
            "phone": f"+1-555-{1100 + hash(branch_id) % 9000}",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        },
        {
            "_id": ObjectId(),
            "email": f"teacher@{branch_name.lower().replace(' ', '')}.edu",
            "hashed_password": pwd_context.hash("teacher123"),
            "full_name": f"{branch_name} Lead Teacher",
            "role": "teacher",
            "phone": f"+1-555-{1200 + hash(branch_id) % 9000}",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        },
        {
            "_id": ObjectId(),
            "email": f"accountant@{branch_name.lower().replace(' ', '')}.edu",
            "hashed_password": pwd_context.hash("accountant123"),
            "full_name": f"{branch_name} Accountant",
            "role": "accountant",
            "phone": f"+1-555-{1300 + hash(branch_id) % 9000}",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "is_active": True
        }
    ]
    
    await db.users.insert_many(users)
    print(f"   ✅ Created {len(users)} users for {branch_name}")
    
    teacher_user_id = str(users[2]["_id"])
    
    # Create grade levels for this branch
    grade_levels = [
        {
            "_id": ObjectId(),
            "name": "Kindergarten",
            "code": "KG",
            "description": "Kindergarten level for ages 3-5",
            "min_age": 3,
            "max_age": 5,
            "branch_id": branch_id,
            "order": 0,
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
            "branch_id": branch_id,
            "order": 1,
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
            "branch_id": branch_id,
            "order": 2,
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
            "branch_id": branch_id,
            "order": 3,
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.grade_levels.insert_many(grade_levels)
    print(f"   ✅ Created {len(grade_levels)} grade levels for {branch_name}")
    
    kg_id = str(grade_levels[0]["_id"])
    grade1_id = str(grade_levels[1]["_id"])
    grade2_id = str(grade_levels[2]["_id"])
    
    # Create subjects for this branch
    subjects = [
        {
            "_id": ObjectId(),
            "name": "Mathematics",
            "code": "MATH",
            "description": "Basic mathematics and arithmetic",
            "branch_id": branch_id,
            "credits": 3,
            "grade_levels": [kg_id, grade1_id, grade2_id],
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "English Language",
            "code": "ENG",
            "description": "English reading, writing, and communication",
            "branch_id": branch_id,
            "credits": 4,
            "grade_levels": [kg_id, grade1_id, grade2_id],
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Science",
            "code": "SCI",
            "description": "Basic science and nature studies",
            "branch_id": branch_id,
            "credits": 3,
            "grade_levels": [grade1_id, grade2_id],
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "name": "Arabic Language",
            "code": "AR",
            "description": "Arabic reading, writing, and communication",
            "branch_id": branch_id,
            "credits": 3,
            "grade_levels": [kg_id, grade1_id, grade2_id],
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.subjects.insert_many(subjects)
    print(f"   ✅ Created {len(subjects)} subjects for {branch_name}")
    
    math_id = str(subjects[0]["_id"])
    english_id = str(subjects[1]["_id"])
    science_id = str(subjects[2]["_id"])
    
    # Create teachers for this branch
    teachers = [
        {
            "_id": ObjectId(),
            "teacher_id": f"TCH{branch_id[-3:]}001",
            "first_name": "Sarah",
            "last_name": f"{branch_name.split()[0]}Teacher",
            "email": f"sarah.teacher@{branch_name.lower().replace(' ', '')}.edu",
            "phone": f"+1-555-{2000 + hash(branch_id) % 9000}",
            "date_of_birth": datetime(1985, 5, 15).isoformat(),
            "gender": "Female",
            "address": f"123 Teacher Street, {branch_name}",
            "hire_date": datetime(2020, 8, 1).isoformat(),
            "qualifications": ["Bachelor in Education", "Master in Mathematics"],
            "subjects": [math_id, science_id],
            "branch_id": branch_id,
            "user_id": teacher_user_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": ObjectId(),
            "teacher_id": f"TCH{branch_id[-3:]}002",
            "first_name": "Ahmed",
            "last_name": f"{branch_name.split()[0]}Instructor",
            "email": f"ahmed.instructor@{branch_name.lower().replace(' ', '')}.edu",
            "phone": f"+1-555-{2100 + hash(branch_id) % 9000}",
            "date_of_birth": datetime(1988, 3, 20).isoformat(),
            "gender": "Male",
            "address": f"456 Educator Avenue, {branch_name}",
            "hire_date": datetime(2021, 1, 15).isoformat(),
            "qualifications": ["Bachelor in English Literature", "TEFL Certificate"],
            "subjects": [english_id],
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.teachers.insert_many(teachers)
    print(f"   ✅ Created {len(teachers)} teachers for {branch_name}")
    
    teacher1_id = str(teachers[0]["_id"])
    teacher2_id = str(teachers[1]["_id"])
    
    # Create classes for this branch
    classes = [
        {
            "_id": ObjectId(),
            "class_name": f"{branch_name} - Kindergarten A",
            "grade_level_id": kg_id,
            "branch_id": branch_id,
            "teacher_id": teacher1_id,
            "max_capacity": 25,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "room_number": f"{branch_name[:2]}KG-101",
            "subjects": [math_id, english_id],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "class_name": f"{branch_name} - Grade 1 A",
            "grade_level_id": grade1_id,
            "branch_id": branch_id,
            "teacher_id": teacher2_id,
            "max_capacity": 30,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "room_number": f"{branch_name[:2]}G1-101",
            "subjects": [math_id, english_id, science_id],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    await db.classes.insert_many(classes)
    print(f"   ✅ Created {len(classes)} classes for {branch_name}")
    
    kg_class_id = str(classes[0]["_id"])
    grade1_class_id = str(classes[1]["_id"])
    
    # Create students for this branch
    branch_code = branch_name.upper().replace(' ', '')[:2]
    students = [
        {
            "_id": ObjectId(),
            "student_id": f"STU{branch_code}001",
            "first_name": "Fatima",
            "last_name": f"{branch_name.split()[0]}Student",
            "date_of_birth": datetime(2018, 4, 15).isoformat(),
            "gender": "Female",
            "address": f"123 Student Lane, {branch_name}",
            "guardian_name": f"Hassan {branch_name.split()[0]}Parent",
            "guardian_phone": f"+1-555-{3000 + hash(branch_id) % 9000}",
            "guardian_email": f"hassan.parent@{branch_name.lower().replace(' ', '')}family.com",
            "enrollment_date": datetime(2024, 9, 1).isoformat(),
            "grade_level_id": kg_id,
            "grade_level": "Kindergarten",
            "class_id": kg_class_id,
            "branch_id": branch_id,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "student_id": f"STU{branch_code}002",
            "first_name": "Omar",
            "last_name": f"{branch_name.split()[0]}Pupil",
            "date_of_birth": datetime(2017, 6, 20).isoformat(),
            "gender": "Male",
            "address": f"456 Pupil Street, {branch_name}",
            "guardian_name": f"Amina {branch_name.split()[0]}Guardian",
            "guardian_phone": f"+1-555-{3100 + hash(branch_id) % 9000}",
            "guardian_email": f"amina.guardian@{branch_name.lower().replace(' ', '')}family.com",
            "enrollment_date": datetime(2024, 9, 1).isoformat(),
            "grade_level_id": grade1_id,
            "grade_level": "Grade 1",
            "class_id": grade1_class_id,
            "branch_id": branch_id,
            "status": "active",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    await db.students.insert_many(students)
    print(f"   ✅ Created {len(students)} students for {branch_name}")
    
    # Update class enrollments
    await db.classes.update_one({"_id": ObjectId(kg_class_id)}, {"$set": {"current_enrollment": 1}})
    await db.classes.update_one({"_id": ObjectId(grade1_class_id)}, {"$set": {"current_enrollment": 1}})
    
    student1_id = str(students[0]["_id"])
    student2_id = str(students[1]["_id"])
    
    # Create fees for students in this branch
    fees = [
        {
            "_id": ObjectId(),
            "student_id": student1_id,
            "fee_type": "tuition",
            "amount": 4500.00 + (hash(branch_id) % 1000),
            "due_date": datetime(2024, 9, 30).isoformat(),
            "status": "pending",
            "academic_year": "2024-2025",
            "term": "Term 1",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "student_id": student2_id,
            "fee_type": "tuition",
            "amount": 5000.00 + (hash(branch_id) % 1000),
            "due_date": datetime(2024, 9, 30).isoformat(),
            "status": "paid",
            "academic_year": "2024-2025",
            "term": "Term 1",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    await db.fees.insert_many(fees)
    print(f"   ✅ Created {len(fees)} fees for {branch_name}")
    
    # Create attendance records for this branch
    attendance_records = []
    for i in range(5):
        date = datetime.now() - timedelta(days=i)
        for student_id in [student1_id, student2_id]:
            attendance_records.append({
                "_id": ObjectId(),
                "student_id": student_id,
                "class_id": kg_class_id if student_id == student1_id else grade1_class_id,
                "date": date.strftime("%Y-%m-%d"),
                "status": "present" if i % 3 != 0 else "absent",
                "remarks": "",
                "branch_id": branch_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            })
    
    await db.attendance.insert_many(attendance_records)
    print(f"   ✅ Created {len(attendance_records)} attendance records for {branch_name}")
    
    # Create exams for this branch
    exams = [
        {
            "_id": ObjectId(),
            "exam_name": f"{branch_name} Math Assessment",
            "exam_type": "assessment",
            "subject_id": math_id,
            "class_id": grade1_class_id,
            "exam_date": datetime(2024, 11, 15).isoformat(),
            "total_marks": 100,
            "passing_marks": 40,
            "duration_minutes": 60,
            "teacher_id": teacher1_id,
            "status": "scheduled",
            "instructions": "Bring calculator and pencil",
            "room_number": f"{branch_name[:2]}EXAM-01",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    await db.exams.insert_many(exams)
    print(f"   ✅ Created {len(exams)} exams for {branch_name}")
    
    # Create inventory items for this branch
    inventory_items = [
        {
            "_id": ObjectId(),
            "asset_code": f"AST{branch_code}001",
            "name": f"{branch_name} Student Desks",
            "category": "furniture",
            "quantity": 50 + (hash(branch_id) % 50),
            "unit": "pieces",
            "min_quantity": 5,
            "location": f"{branch_name} Storage Room A",
            "purchase_date": datetime.now().isoformat(),
            "purchase_price": 150.0,
            "current_value": 120.0,
            "status": "available",
            "condition": "good",
            "created_by": str(users[0]["_id"]),
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "asset_code": f"AST{branch_code}002",
            "name": f"{branch_name} Projectors",
            "category": "electronics",
            "quantity": 3 + (hash(branch_id) % 5),
            "unit": "pieces",
            "min_quantity": 1,
            "location": f"{branch_name} IT Room",
            "purchase_date": datetime.now().isoformat(),
            "purchase_price": 800.0,
            "current_value": 600.0,
            "status": "available",
            "condition": "excellent",
            "created_by": str(users[0]["_id"]),
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
    ]
    
    await db.assets.insert_many(inventory_items)
    print(f"   ✅ Created {len(inventory_items)} inventory items for {branch_name}")
    
    # Create notifications for this branch
    notifications = [
        {
            "_id": ObjectId(),
            "title": f"Welcome to {branch_name}",
            "message": f"Welcome to the {branch_name} branch for the 2024-2025 academic year!",
            "type": "announcement",
            "priority": "medium",
            "user_id": str(users[0]["_id"]),
            "recipients": ["all"],
            "status": "unread",
            "branch_id": branch_id,
            "created_at": datetime.now().isoformat(),
            "is_read": False
        }
    ]
    
    await db.notifications.insert_many(notifications)
    print(f"   ✅ Created {len(notifications)} notifications for {branch_name}")
    
    return {
        "users": len(users),
        "grade_levels": len(grade_levels), 
        "subjects": len(subjects),
        "teachers": len(teachers),
        "classes": len(classes),
        "students": len(students),
        "fees": len(fees),
        "attendance": len(attendance_records),
        "exams": len(exams),
        "inventory": len(inventory_items),
        "notifications": len(notifications)
    }

async def init_database():
    """Initialize the database with branch-isolated data"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Initializing branch-isolated database: {DATABASE_NAME}")
    
    # Clear existing data
    clear_data = input("Clear existing data? (y/n): ").lower() == 'y'
    if clear_data:
        print("🧹 Clearing existing data...")
        await clear_database(db)
    
    # Create branches first
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
        },
        {
            "_id": ObjectId(),
            "name": "East Branch",
            "address": "789 Scholar Road, East Side, ES 11111",
            "phone": "+1-555-0789",
            "email": "east@springofknowledge.edu",
            "established_date": datetime(2023, 1, 1).isoformat(),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.branches.insert_many(branches)
    print(f"✅ Created {len(branches)} branches")
    
    # Create global payment modes (shared across branches)
    payment_modes = [
        {
            "_id": ObjectId(),
            "name": "Cash",
            "code": "CASH",
            "description": "Cash payment",
            "is_active": True,
            "transaction_fee": 0.0,
            "min_amount": 0.0,
            "max_amount": 50000.0,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "name": "Bank Transfer",
            "code": "BANK",
            "description": "Bank transfer payment",
            "is_active": True,
            "transaction_fee": 5.0,
            "min_amount": 10.0,
            "max_amount": 1000000.0,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "name": "Credit Card",
            "code": "CARD",
            "description": "Credit card payment",
            "is_active": True,
            "transaction_fee": 2.5,
            "min_amount": 5.0,
            "max_amount": 100000.0,
            "created_at": datetime.now().isoformat()
        }
    ]
    
    await db.payment_mode.insert_many(payment_modes)
    print(f"✅ Created {len(payment_modes)} global payment modes")
    
    # Create a super admin user (can access all branches)
    superadmin = {
        "_id": ObjectId(),
        "email": "superadmin@springofknowledge.edu",
        "hashed_password": pwd_context.hash("superadmin123"),
        "full_name": "System Super Administrator",
        "role": "superadmin",
        "phone": "+1-555-0000",
        "branch_id": None,  # No specific branch
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "is_active": True,
        "all_branches_access": True
    }
    
    await db.users.insert_one(superadmin)
    print("✅ Created super admin user")
    
    # Create data for each branch
    total_stats = {}
    for branch in branches:
        branch_stats = await create_branch_data(db, branch)
        for key, value in branch_stats.items():
            total_stats[key] = total_stats.get(key, 0) + value
    
    # Create database indexes
    print("\n📈 Creating database indexes...")
    
    # Branch-aware indexes
    await db.users.create_index([("email", 1)], unique=True)
    await db.users.create_index("branch_id")
    await db.students.create_index([("student_id", 1)], unique=True)
    await db.students.create_index("branch_id")
    await db.teachers.create_index([("teacher_id", 1)], unique=True) 
    await db.teachers.create_index("branch_id")
    await db.classes.create_index("branch_id")
    await db.subjects.create_index("branch_id")
    await db.grade_levels.create_index("branch_id")
    await db.fees.create_index("branch_id")
    await db.attendance.create_index("branch_id")
    await db.exams.create_index("branch_id")
    await db.assets.create_index("branch_id")
    await db.notifications.create_index("branch_id")
    
    # Performance indexes
    await db.attendance.create_index([("student_id", 1), ("date", 1)])
    await db.fees.create_index([("student_id", 1), ("status", 1)])
    await db.classes.create_index([("branch_id", 1), ("grade_level_id", 1)])
    
    print("✅ Database indexes created")
    
    # Print summary
    print("\n🎉 Branch-isolated database initialization completed!")
    print("\n📊 Database Summary:")
    print(f"   • Branches: {len(branches)}")
    print(f"   • Payment Modes: {len(payment_modes)} (global)")
    print(f"   • Super Admin: 1")
    print(f"   • Total Users: {total_stats.get('users', 0) + 1}")
    print(f"   • Total Grade Levels: {total_stats.get('grade_levels', 0)}")
    print(f"   • Total Subjects: {total_stats.get('subjects', 0)}")
    print(f"   • Total Teachers: {total_stats.get('teachers', 0)}")
    print(f"   • Total Classes: {total_stats.get('classes', 0)}")
    print(f"   • Total Students: {total_stats.get('students', 0)}")
    print(f"   • Total Fees: {total_stats.get('fees', 0)}")
    print(f"   • Total Attendance Records: {total_stats.get('attendance', 0)}")
    print(f"   • Total Exams: {total_stats.get('exams', 0)}")
    print(f"   • Total Inventory Items: {total_stats.get('inventory', 0)}")
    print(f"   • Total Notifications: {total_stats.get('notifications', 0)}")
    
    print("\n🚀 Branch-isolated Spring of Knowledge Hub is ready!")
    print("\n📝 Test Credentials:")
    print("   Super Admin: superadmin@springofknowledge.edu / superadmin123")
    print("\n   Per Branch:")
    for branch in branches:
        branch_name = branch["name"].lower().replace(' ', '')
        print(f"   {branch['name']}:")
        print(f"     Admin: admin@{branch_name}.edu / admin123")
        print(f"     Principal: principal@{branch_name}.edu / principal123")
        print(f"     Teacher: teacher@{branch_name}.edu / teacher123")
        print(f"     Accountant: accountant@{branch_name}.edu / accountant123")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())