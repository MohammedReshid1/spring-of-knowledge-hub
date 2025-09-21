#!/usr/bin/env python3
"""
Script to add a test student with class assignment for testing class population
"""
import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def add_test_student():
    """Add a test student with class assignment"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Using database: {DATABASE_NAME}")
    
    # Check if test student already exists
    existing_student = await db.students.find_one({"student_id": "SCH-2025-00001"})
    if existing_student:
        print("✅ Test student already exists")
        return
    
    # Get the first available class
    class_doc = await db.classes.find_one({})
    if not class_doc:
        print("❌ No classes found in database")
        return
    
    class_id = str(class_doc["_id"])
    print(f"📚 Found class: {class_doc.get('class_name', 'Unknown')} (ID: {class_id})")
    
    # Create test student
    test_student = {
        "student_id": "SCH-2025-00001",
        "first_name": "Test",
        "father_name": "Student",
        "grandfather_name": "Demo",
        "date_of_birth": datetime(2018, 1, 1),
        "gender": "Male",
        "address": "123 Test Street",
        "phone": "+1-555-0001",
        "email": "test.student@school.edu",
        "grade_level": "KG",
        "class_id": class_id,
        "status": "Active",
        "branch_id": "main_branch_001",
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    
    # Insert test student
    result = await db.students.insert_one(test_student)
    print(f"✅ Created test student with ID: {result.inserted_id}")
    print(f"   Name: {test_student['first_name']} {test_student['father_name']} {test_student['grandfather_name']}")
    print(f"   Student ID: {test_student['student_id']}")
    print(f"   Class ID: {test_student['class_id']}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(add_test_student()) 