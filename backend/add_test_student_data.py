#!/usr/bin/env python3
"""
Add test student data for testing branch filtering in student search API
"""

import asyncio
import os
import sys
from datetime import datetime
from bson import ObjectId

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from motor.motor_asyncio import AsyncIOMotorClient

async def add_test_student_data():
    """Add test student data for branch filtering tests"""

    print("=== Adding Test Student Data ===")
    print(f"Started at: {datetime.now()}")

    # Get database connection
    db_client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = db_client.school_management

    try:
        # Get existing branches
        branches_cursor = db.branches.find({})
        branches = await branches_cursor.to_list(length=None)

        if not branches:
            print("No branches found. Creating a test branch...")
            branch_data = {
                "name": "Test Branch",
                "address": "Test Address",
                "phone": "123-456-7890",
                "email": "test@branch.com",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
            result = await db.branches.insert_one(branch_data)
            test_branch_id = str(result.inserted_id)
            branches = [{"_id": result.inserted_id, "name": "Test Branch"}]
        else:
            test_branch_id = str(branches[0]["_id"])

        print(f"Using branch: {branches[0]['name']} (ID: {test_branch_id})")

        # Create a second branch for multi-branch testing
        second_branch_data = {
            "name": "Secondary Campus",
            "address": "Secondary Address",
            "phone": "987-654-3210",
            "email": "secondary@branch.com",
            "is_active": True,
            "created_at": datetime.utcnow()
        }

        # Check if secondary branch already exists
        existing_secondary = await db.branches.find_one({"name": "Secondary Campus"})
        if not existing_secondary:
            result = await db.branches.insert_one(second_branch_data)
            second_branch_id = str(result.inserted_id)
            print(f"Created secondary branch: Secondary Campus (ID: {second_branch_id})")
        else:
            second_branch_id = str(existing_secondary["_id"])
            print(f"Using existing secondary branch: Secondary Campus (ID: {second_branch_id})")

        # Test student data with Arabic names
        test_students = [
            # Students for first branch
            {
                "student_id": "STU-2025-001",
                "first_name": "Ahmed",
                "father_name": "Mohammad",
                "grandfather_name": "Ali",
                "last_name": "Al-Rashid",
                "email": "ahmed.mohammad@test.com",
                "phone": "555-0001",
                "grade_level": "Grade 10",
                "status": "Active",
                "branch_id": test_branch_id,
                "created_at": datetime.utcnow()
            },
            {
                "student_id": "STU-2025-002",
                "first_name": "Fatima",
                "father_name": "Ahmad",
                "grandfather_name": "Hassan",
                "last_name": "Al-Zahra",
                "email": "fatima.ahmad@test.com",
                "phone": "555-0002",
                "grade_level": "Grade 9",
                "status": "Active",
                "branch_id": test_branch_id,
                "created_at": datetime.utcnow()
            },
            {
                "student_id": "STU-2025-003",
                "first_name": "Omar",
                "father_name": "Ibrahim",
                "grandfather_name": "Youssef",
                "last_name": "Al-Mansour",
                "email": "omar.ibrahim@test.com",
                "phone": "555-0003",
                "grade_level": "Grade 11",
                "status": "Active",
                "branch_id": test_branch_id,
                "created_at": datetime.utcnow()
            },
            {
                "student_id": "STU-2025-004",
                "first_name": "Abdurahman",
                "father_name": "Abdullah",
                "grandfather_name": "Ahmad",
                "last_name": "Al-Harbi",
                "email": "abdurahman.abdullah@test.com",
                "phone": "555-0004",
                "grade_level": "Grade 12",
                "status": "Active",
                "branch_id": test_branch_id,
                "created_at": datetime.utcnow()
            },
            # Students for second branch
            {
                "student_id": "STU-2025-005",
                "first_name": "Abdurahman",
                "father_name": "Mohammad",
                "grandfather_name": "Salem",
                "last_name": "Al-Qasemi",
                "email": "abdurahman.mohammad@test.com",
                "phone": "555-0005",
                "grade_level": "Grade 10",
                "status": "Active",
                "branch_id": second_branch_id,
                "created_at": datetime.utcnow()
            },
            {
                "student_id": "STU-2025-006",
                "first_name": "Mariam",
                "father_name": "Ahmed",
                "grandfather_name": "Omar",
                "last_name": "Al-Sabah",
                "email": "mariam.ahmed@test.com",
                "phone": "555-0006",
                "grade_level": "Grade 9",
                "status": "Active",
                "branch_id": second_branch_id,
                "created_at": datetime.utcnow()
            },
            {
                "student_id": "STU-2025-007",
                "first_name": "Khalid",
                "father_name": "Mohammad",
                "grandfather_name": "Rashid",
                "last_name": "Al-Thani",
                "email": "khalid.mohammad@test.com",
                "phone": "555-0007",
                "grade_level": "Grade 11",
                "status": "Active",
                "branch_id": second_branch_id,
                "created_at": datetime.utcnow()
            },
            # Inactive student for testing
            {
                "student_id": "STU-2025-008",
                "first_name": "Hassan",
                "father_name": "Ali",
                "grandfather_name": "Mohammad",
                "last_name": "Al-Maktoum",
                "email": "hassan.ali@test.com",
                "phone": "555-0008",
                "grade_level": "Grade 10",
                "status": "Inactive",
                "branch_id": test_branch_id,
                "created_at": datetime.utcnow()
            },
            # Additional students to test search functionality
            {
                "student_id": "STU-2025-009",
                "first_name": "Mohammad",
                "father_name": "Ahmed",
                "grandfather_name": "Ibrahim",
                "last_name": "Al-Sharqi",
                "email": "mohammad.ahmed@test.com",
                "phone": "555-0009",
                "grade_level": "Grade 8",
                "status": "Active",
                "branch_id": test_branch_id,
                "created_at": datetime.utcnow()
            },
            {
                "student_id": "STU-2025-010",
                "first_name": "Aisha",
                "father_name": "Abdurahman",
                "grandfather_name": "Hassan",
                "last_name": "Al-Nuaimi",
                "email": "aisha.abdurahman@test.com",
                "phone": "555-0010",
                "grade_level": "Grade 7",
                "status": "Active",
                "branch_id": second_branch_id,
                "created_at": datetime.utcnow()
            }
        ]

        # Insert test students
        print(f"\nInserting {len(test_students)} test students...")

        # First, remove any existing test students to avoid duplicates
        await db.students.delete_many({"student_id": {"$regex": "STU-2025-"}})

        # Insert new test students
        result = await db.students.insert_many(test_students)
        print(f"Successfully inserted {len(result.inserted_ids)} students")

        # Verify the data
        print("\nVerifying inserted data...")

        # Count by branch
        for branch in [{"_id": ObjectId(test_branch_id), "name": branches[0]["name"]},
                      {"_id": ObjectId(second_branch_id), "name": "Secondary Campus"}]:
            branch_id = str(branch["_id"])
            total_count = await db.students.count_documents({"branch_id": branch_id})
            active_count = await db.students.count_documents({
                "branch_id": branch_id,
                "status": "Active"
            })
            print(f"  {branch['name']}: {active_count} active / {total_count} total students")

        # Test search functionality
        print("\nTesting search functionality with new data...")

        # Test case 1: Search for "Abdurahman" across all branches
        search_query = {
            "$or": [
                {"first_name": {"$regex": "Abdurahman", "$options": "i"}},
                {"father_name": {"$regex": "Abdurahman", "$options": "i"}},
                {"grandfather_name": {"$regex": "Abdurahman", "$options": "i"}}
            ],
            "status": "Active"
        }

        all_abdurahman = await db.students.find(search_query).to_list(length=None)
        print(f"  Found {len(all_abdurahman)} students named 'Abdurahman' across all branches")

        # Group by branch
        branch_counts = {}
        for student in all_abdurahman:
            branch_id = student.get("branch_id", "unknown")
            branch_counts[branch_id] = branch_counts.get(branch_id, 0) + 1

            # Get branch name
            branch_name = "Unknown"
            if branch_id == test_branch_id:
                branch_name = branches[0]["name"]
            elif branch_id == second_branch_id:
                branch_name = "Secondary Campus"

            full_name = f"{student.get('first_name', '')} {student.get('father_name', '')} {student.get('grandfather_name', '')}".strip()
            print(f"    - {full_name} (ID: {student.get('student_id')}) in {branch_name}")

        # Test case 2: Search in specific branch
        specific_branch_query = {
            "$or": [
                {"first_name": {"$regex": "Abdurahman", "$options": "i"}},
                {"father_name": {"$regex": "Abdurahman", "$options": "i"}},
                {"grandfather_name": {"$regex": "Abdurahman", "$options": "i"}}
            ],
            "branch_id": test_branch_id,
            "status": "Active"
        }

        branch_abdurahman = await db.students.find(specific_branch_query).to_list(length=None)
        print(f"  Found {len(branch_abdurahman)} students named 'Abdurahman' in {branches[0]['name']} branch")

        print(f"\n=== Test data setup completed at: {datetime.now()} ===")

        # Return summary for the main test
        return {
            "total_students_added": len(test_students),
            "primary_branch_id": test_branch_id,
            "secondary_branch_id": second_branch_id,
            "test_cases": {
                "abdurahman_all_branches": len(all_abdurahman),
                "abdurahman_primary_branch": len(branch_abdurahman)
            }
        }

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return None

    finally:
        # Close database connection
        db_client.close()

if __name__ == "__main__":
    asyncio.run(add_test_student_data())