#!/usr/bin/env python3
"""
Dynamic Database Initialization - No Pre-created Branches
Only creates the superadmin user and essential global data
Branches are created dynamically from the frontend
"""
import asyncio
import os
from datetime import datetime
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
    """Initialize the database with only essential data (no branches)"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Initializing dynamic database: {DATABASE_NAME}")
    
    # Clear existing data (skip interactive prompt for automation)
    clear_data = True  # Set to True for automated initialization
    if clear_data:
        print("🧹 Clearing existing data...")
        await clear_database(db)
    
    # Create global payment modes (shared across branches)
    payment_modes = [
        {
            "_id": ObjectId(),
            "payment_id": "CASH001",
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
            "payment_id": "BANK001",
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
            "payment_id": "CARD001",
            "name": "Credit Card",
            "code": "CARD",
            "description": "Credit card payment",
            "is_active": True,
            "transaction_fee": 2.5,
            "min_amount": 5.0,
            "max_amount": 100000.0,
            "created_at": datetime.now().isoformat()
        },
        {
            "_id": ObjectId(),
            "payment_id": "CHQ001",
            "name": "Cheque",
            "code": "CHQ",
            "description": "Cheque payment",
            "is_active": True,
            "transaction_fee": 0.0,
            "min_amount": 100.0,
            "max_amount": 500000.0,
            "created_at": datetime.now().isoformat()
        }
    ]
    
    await db.payment_mode.insert_many(payment_modes)
    print(f"✅ Created {len(payment_modes)} global payment modes")
    
    # Create default academic year
    academic_year = {
        "_id": ObjectId(),
        "year": "2024-2025",
        "start_date": "2024-09-01",
        "end_date": "2025-06-30",
        "is_current": True,
        "status": "active",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    await db.academic_years.insert_one(academic_year)
    print("✅ Created default academic year (2024-2025)")
    
    # Create a super admin user (can create branches and access all data)
    superadmin = {
        "_id": ObjectId(),
        "email": "superadmin@springofknowledge.edu",
        "hashed_password": pwd_context.hash("superadmin123"),
        "full_name": "System Super Administrator",
        "role": "superadmin",
        "phone": "+1-555-0000",
        "branch_id": None,  # No specific branch - can access all
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "is_active": True,
        "all_branches_access": True
    }
    
    await db.users.insert_one(superadmin)
    print("✅ Created super admin user")
    
    # Create basic system settings
    system_settings = {
        "_id": ObjectId(),
        "school_name": "Spring of Knowledge Hub",
        "system_version": "2.0.0",
        "features": {
            "branch_isolation": True,
            "dynamic_branches": True,
            "multi_tenant": True
        },
        "default_settings": {
            "academic_year": "2024-2025",
            "default_capacity": 30,
            "default_grade_levels": [
                {"name": "Kindergarten", "code": "KG", "min_age": 3, "max_age": 5},
                {"name": "Grade 1", "code": "G1", "min_age": 6, "max_age": 7},
                {"name": "Grade 2", "code": "G2", "min_age": 7, "max_age": 8},
                {"name": "Grade 3", "code": "G3", "min_age": 8, "max_age": 9},
                {"name": "Grade 4", "code": "G4", "min_age": 9, "max_age": 10},
                {"name": "Grade 5", "code": "G5", "min_age": 10, "max_age": 11}
            ],
            "default_subjects": [
                {"name": "Mathematics", "code": "MATH", "credits": 4},
                {"name": "English Language", "code": "ENG", "credits": 4},
                {"name": "Science", "code": "SCI", "credits": 3},
                {"name": "Social Studies", "code": "SOC", "credits": 3},
                {"name": "Arabic Language", "code": "AR", "credits": 3},
                {"name": "Physical Education", "code": "PE", "credits": 2}
            ]
        },
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    await db.system_settings.insert_one(system_settings)
    print("✅ Created system settings")
    
    # Create database indexes (skip if already exist)
    print("\n📈 Creating database indexes...")
    
    try:
        # User indexes
        await db.users.create_index("email", unique=True)
        await db.users.create_index("branch_id")
        await db.users.create_index("role")
        
        # Branch indexes (for when branches are created)
        await db.branches.create_index("name")
        await db.branches.create_index("status")
        await db.branches.create_index("created_at")
        
        # Branch-aware indexes for future data
        collections_to_index = [
            "students", "teachers", "classes", "subjects", "grade_levels",
            "fees", "attendance", "exams", "assets", "notifications", "incidents"
        ]
        
        for collection in collections_to_index:
            try:
                await db[collection].create_index("branch_id")
                await db[collection].create_index("created_at")
            except Exception as e:
                if "already exists" not in str(e):
                    print(f"   Warning: Could not create index for {collection}: {e}")
        
        # Specific indexes (ignore if they exist)
        try:
            await db.students.create_index("student_id", unique=True, sparse=True)
        except:
            pass
        try:
            await db.teachers.create_index("teacher_id", unique=True, sparse=True)
        except:
            pass
        try:
            await db.branches.create_index("code", unique=True, sparse=True)
        except:
            pass
        
        print("✅ Database indexes created")
    except Exception as e:
        print(f"⚠️  Some indexes may already exist: {e}")
    
    # Print summary
    print("\n🎉 Dynamic database initialization completed!")
    print("\n📊 Database Summary:")
    print(f"   • Payment Modes: {len(payment_modes)} (global)")
    print(f"   • Academic Years: 1 (default)")
    print(f"   • Super Admin: 1")
    print(f"   • Branches: 0 (will be created dynamically)")
    print(f"   • System Settings: Ready")
    
    print("\n🚀 Spring of Knowledge Hub - Dynamic Branch System Ready!")
    print("\n📝 Super Admin Credentials:")
    print("   Email: superadmin@springofknowledge.edu")
    print("   Password: superadmin123")
    print("\n🏗️  Next Steps:")
    print("   1. Login as superadmin")
    print("   2. Create branches from the frontend")
    print("   3. Each branch will have its own isolated data")
    print("   4. Branch admins can only access their branch data")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(init_database())