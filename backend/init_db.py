#!/usr/bin/env python3
"""
Initialize MongoDB database with initial data for production
"""
import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def init_database():
    """Initialize the database with initial data"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Initializing database: {DATABASE_NAME}")
    
    # Check if branches collection already has data
    branches_count = await db.branches.count_documents({})
    
    if branches_count > 0:
        print(f"✅ Database already initialized with {branches_count} branches")
        return
    
    # Create initial branch
    initial_branch = {
        "_id": "main_branch_001",
        "name": "Main Campus",
        "address": "123 Education Street, Knowledge City, KC 12345",
        "phone": "+1-555-0123",
        "email": "main@school.edu",
        "established_date": datetime.now().isoformat(),
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "status": "active"
    }
    
    # Insert initial data
    await db.branches.insert_one(initial_branch)
    print("✅ Created initial branch: Main Campus")
    
    # Create initial grade levels
    grade_levels = [
        {
            "_id": "kg_001",
            "name": "Kindergarten",
            "code": "KG",
            "description": "Kindergarten level for ages 3-5",
            "min_age": 3,
            "max_age": 5,
            "branch_id": "main_branch_001",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": "grade_1_001",
            "name": "Grade 1",
            "code": "G1",
            "description": "First grade for ages 6-7",
            "min_age": 6,
            "max_age": 7,
            "branch_id": "main_branch_001",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": "grade_2_001",
            "name": "Grade 2",
            "code": "G2",
            "description": "Second grade for ages 7-8",
            "min_age": 7,
            "max_age": 8,
            "branch_id": "main_branch_001",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.grade_levels.insert_many(grade_levels)
    print(f"✅ Created {len(grade_levels)} grade levels")
    
    # Create initial subjects
    subjects = [
        {
            "_id": "math_001",
            "name": "Mathematics",
            "code": "MATH",
            "description": "Basic mathematics and arithmetic",
            "branch_id": "main_branch_001",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": "english_001",
            "name": "English Language",
            "code": "ENG",
            "description": "English reading, writing, and communication",
            "branch_id": "main_branch_001",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": "science_001",
            "name": "Science",
            "code": "SCI",
            "description": "Basic science and nature studies",
            "branch_id": "main_branch_001",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.subjects.insert_many(subjects)
    print(f"✅ Created {len(subjects)} subjects")
    
    # Create initial classes
    classes = [
        {
            "_id": "kg_a_001",
            "name": "Kindergarten A",
            "code": "KG-A",
            "grade_level_id": "kg_001",
            "branch_id": "main_branch_001",
            "capacity": 25,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        },
        {
            "_id": "grade_1_a_001",
            "name": "Grade 1 A",
            "code": "G1-A",
            "grade_level_id": "grade_1_001",
            "branch_id": "main_branch_001",
            "capacity": 30,
            "current_enrollment": 0,
            "academic_year": "2024-2025",
            "created_at": datetime.now().isoformat(),
            "status": "active"
        }
    ]
    
    await db.classes.insert_many(classes)
    print(f"✅ Created {len(classes)} classes")
    
    # Create payment modes
    payment_modes = [
        {
            "_id": "cash_001",
            "name": "Cash",
            "code": "CASH",
            "description": "Cash payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": "bank_transfer_001",
            "name": "Bank Transfer",
            "code": "BANK",
            "description": "Bank transfer payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": "card_001",
            "name": "Credit/Debit Card",
            "code": "CARD",
            "description": "Card payment",
            "is_active": True,
            "created_at": datetime.now().isoformat()
        }
    ]
    
    await db.payment_mode.insert_many(payment_modes)
    print(f"✅ Created {len(payment_modes)} payment modes")
    
    # Create default admin user
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    
    admin_user = {
        "_id": "admin_user_001",
        "email": "admin@school.edu",
        "hashed_password": pwd_context.hash("admin123"),
        "full_name": "System Administrator",
        "role": "admin",
        "phone": "+1-555-0100",
        "branch_id": "main_branch_001",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "is_active": True
    }
    
    await db.users.insert_one(admin_user)
    print("✅ Created default admin user (admin@school.edu / admin123)")
    
    # Create indexes for better performance
    print("📈 Creating database indexes...")
    
    # Branches indexes
    await db.branches.create_index("name")
    await db.branches.create_index("status")
    
    # Students indexes
    await db.students.create_index("branch_id")
    await db.students.create_index("student_id")
    await db.students.create_index([("first_name", 1), ("last_name", 1)])
    
    # Classes indexes
    await db.classes.create_index("branch_id")
    await db.classes.create_index("grade_level_id")
    await db.classes.create_index("academic_year")
    
    # Attendance indexes
    await db.attendance.create_index("student_id")
    await db.attendance.create_index("class_id")
    await db.attendance.create_index("date")
    await db.attendance.create_index([("student_id", 1), ("date", 1)])
    
    # Fees indexes
    await db.fees.create_index("student_id")
    await db.fees.create_index("branch_id")
    await db.fees.create_index("due_date")
    await db.fees.create_index("status")
    
    print("✅ Database indexes created")
    
    print("\n🎉 Database initialization completed successfully!")
    print("\n📊 Summary:")
    print(f"   • Branches: {await db.branches.count_documents({})}")
    print(f"   • Grade Levels: {await db.grade_levels.count_documents({})}")
    print(f"   • Subjects: {await db.subjects.count_documents({})}")
    print(f"   • Classes: {await db.classes.count_documents({})}")
    print(f"   • Payment Modes: {await db.payment_mode.count_documents({})}")
    print(f"   • Students: {await db.students.count_documents({})}")
    
    print("\n🚀 Your production database is ready!")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())