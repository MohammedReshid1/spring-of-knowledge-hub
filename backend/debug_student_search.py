#!/usr/bin/env python3
"""
Debug script to analyze student search issues in the payment API.
"""
import asyncio
import sys
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup database connection
MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URI)
db = client.spring_of_knowledge

async def analyze_student_data():
    """Analyze student collection structure and data"""
    print("=== STUDENT SEARCH DEBUG ANALYSIS ===\n")

    # Check total students
    total_students = await db.students.count_documents({})
    print(f"Total students in database: {total_students}")

    if total_students == 0:
        print("❌ No students found in database!")
        return

    # Get sample student to see field structure
    sample_student = await db.students.find_one({})
    print(f"\n=== SAMPLE STUDENT DOCUMENT STRUCTURE ===")
    for key, value in sample_student.items():
        if key != "_id":
            print(f"  {key}: {type(value).__name__} = {repr(value)}")

    # Check for critical fields used in search
    search_fields = ["student_id", "first_name", "last_name", "email", "phone"]
    missing_fields = []

    print(f"\n=== SEARCH FIELD ANALYSIS ===")
    for field in search_fields:
        count = await db.students.count_documents({field: {"$exists": True, "$ne": None, "$ne": ""}})
        print(f"  {field}: {count} students have this field")
        if count == 0:
            missing_fields.append(field)

    # Check the specific branch
    target_branch = "68b7231bb110092a69ae2acc"
    branch_students = await db.students.count_documents({"branch_id": target_branch})
    print(f"\n=== BRANCH-SPECIFIC ANALYSIS ===")
    print(f"Students in branch {target_branch}: {branch_students}")

    # Check for active status variations
    status_variations = [
        ("is_active: True", {"is_active": True}),
        ("is_active: 'true'", {"is_active": "true"}),
        ("status: 'Active'", {"status": "Active"}),
        ("status: 'active'", {"status": "active"}),
        ("No status field", {"is_active": {"$exists": False}, "status": {"$exists": False}})
    ]

    print(f"\n=== STATUS FIELD ANALYSIS ===")
    for label, query in status_variations:
        count = await db.students.count_documents(query)
        print(f"  {label}: {count} students")

    # Test the exact search query from the API
    test_query = "test"
    api_search_query = {
        "$or": [
            {"student_id": {"$regex": test_query, "$options": "i"}},
            {"first_name": {"$regex": test_query, "$options": "i"}},
            {"last_name": {"$regex": test_query, "$options": "i"}},
            {"email": {"$regex": test_query, "$options": "i"}},
            {"phone": {"$regex": test_query, "$options": "i"}}
        ],
        "branch_id": target_branch,
        "is_active": True
    }

    print(f"\n=== API SEARCH QUERY TEST ===")
    print(f"Query: {api_search_query}")

    search_results = await db.students.count_documents(api_search_query)
    print(f"Results with full API query: {search_results}")

    # Test parts of the query individually
    print(f"\n=== QUERY BREAKDOWN TEST ===")

    # Test search terms only
    search_only_query = {
        "$or": [
            {"student_id": {"$regex": test_query, "$options": "i"}},
            {"first_name": {"$regex": test_query, "$options": "i"}},
            {"last_name": {"$regex": test_query, "$options": "i"}},
            {"email": {"$regex": test_query, "$options": "i"}},
            {"phone": {"$regex": test_query, "$options": "i"}}
        ]
    }
    search_only_count = await db.students.count_documents(search_only_query)
    print(f"Search terms only: {search_only_count}")

    # Test branch only
    branch_only_count = await db.students.count_documents({"branch_id": target_branch})
    print(f"Branch filter only: {branch_only_count}")

    # Test is_active only
    active_only_count = await db.students.count_documents({"is_active": True})
    print(f"is_active=True only: {active_only_count}")

    # Test branch + active
    branch_and_active = await db.students.count_documents({
        "branch_id": target_branch,
        "is_active": True
    })
    print(f"Branch + is_active: {branch_and_active}")

    # Show some actual students in the branch
    print(f"\n=== SAMPLE STUDENTS IN BRANCH ===")
    sample_branch_students = await db.students.find({"branch_id": target_branch}).limit(3).to_list(length=3)

    for i, student in enumerate(sample_branch_students, 1):
        print(f"Student {i}:")
        print(f"  _id: {student.get('_id')}")
        print(f"  student_id: {student.get('student_id', 'MISSING')}")
        print(f"  first_name: {student.get('first_name', 'MISSING')}")
        print(f"  last_name: {student.get('last_name', 'MISSING')}")
        print(f"  email: {student.get('email', 'MISSING')}")
        print(f"  phone: {student.get('phone', 'MISSING')}")
        print(f"  is_active: {student.get('is_active', 'MISSING')}")
        print(f"  status: {student.get('status', 'MISSING')}")
        print()

    # Test if any students contain "test" in any field
    print(f"=== STUDENTS CONTAINING 'test' ===")
    test_students = await db.students.find({
        "$or": [
            {"student_id": {"$regex": "test", "$options": "i"}},
            {"first_name": {"$regex": "test", "$options": "i"}},
            {"last_name": {"$regex": "test", "$options": "i"}},
            {"email": {"$regex": "test", "$options": "i"}},
            {"phone": {"$regex": "test", "$options": "i"}}
        ]
    }).limit(5).to_list(length=5)

    print(f"Found {len(test_students)} students with 'test' in their data:")
    for student in test_students:
        print(f"  {student.get('student_id', 'NO_ID')} - {student.get('first_name', 'NO_NAME')} - Branch: {student.get('branch_id', 'NO_BRANCH')}")

    # Recommendations
    print(f"\n=== RECOMMENDATIONS ===")
    if missing_fields:
        print(f"❌ Missing critical search fields: {missing_fields}")

    if branch_students == 0:
        print(f"❌ No students found in target branch {target_branch}")
        print("   - Check if branch_id is correct")
        print("   - Check if students exist in other branches")

    if search_results == 0 and search_only_count > 0:
        print(f"❌ Search terms work ({search_only_count} results) but filters remove all results")
        print("   - Check is_active field values")
        print("   - Check branch_id field values")

    print(f"\n✅ Analysis complete!")

if __name__ == "__main__":
    asyncio.run(analyze_student_data())