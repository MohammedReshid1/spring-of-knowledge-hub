#!/usr/bin/env python3
"""
Direct database test to verify class population functionality
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def test_class_population():
    """Test class population functionality directly"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Using database: {DATABASE_NAME}")
    
    # Get test student
    student = await db.students.find_one({"student_id": "SCH-2025-00001"})
    if not student:
        print("❌ Test student not found")
        return
    
    print(f"✅ Found test student: {student['first_name']} {student['father_name']}")
    print(f"   Class ID: {student.get('class_id', 'None')}")
    
    # Test class lookup
    class_id = student.get('class_id')
    if class_id:
        print(f"\n🔍 Looking up class with ID: {class_id}")
        
        # Try ObjectId lookup
        class_doc = None
        if ObjectId.is_valid(class_id):
            class_doc = await db.classes.find_one({"_id": ObjectId(class_id)})
            print(f"   ObjectId lookup: {'✅ Found' if class_doc else '❌ Not found'}")
        
        # Try string ID lookup
        if not class_doc:
            class_doc = await db.classes.find_one({"_id": class_id})
            print(f"   String ID lookup: {'✅ Found' if class_doc else '❌ Not found'}")
        
        if class_doc:
            print(f"   Class Name: {class_doc.get('class_name', 'N/A')}")
            print(f"   Grade Level ID: {class_doc.get('grade_level_id', 'N/A')}")
            print(f"   Academic Year: {class_doc.get('academic_year', 'N/A')}")
        else:
            print("   ❌ Class not found")
    else:
        print("   ❌ No class assigned")
    
    # List all classes for reference
    print(f"\n📚 All classes in database:")
    async for class_doc in db.classes.find():
        print(f"   - {class_doc.get('class_name', 'Unknown')} (ID: {class_doc['_id']})")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(test_class_population()) 