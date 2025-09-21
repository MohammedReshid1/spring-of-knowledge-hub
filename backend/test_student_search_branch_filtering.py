#!/usr/bin/env python3
"""
Test script to verify and validate the branch filtering logic in student search API
Tests different scenarios: specific branch ID, "all" branches, invalid branch IDs
"""

import asyncio
import os
import sys
from datetime import datetime
from bson import ObjectId

# Add the backend directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__)))

from app.db import get_db
from motor.motor_asyncio import AsyncIOMotorClient

async def test_branch_filtering_logic():
    """Test the branch filtering logic for student search"""

    print("=== Testing Branch Filtering Logic ===")
    print(f"Test started at: {datetime.now()}")

    # Get database connection
    db_client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = db_client.school_management

    try:
        # Test 1: Get branch statistics
        print("\n1. Getting branch statistics...")

        # Get all branches
        branches_cursor = db.branches.find({})
        branches = await branches_cursor.to_list(length=None)
        print(f"Total branches in system: {len(branches)}")

        for branch in branches[:5]:  # Show first 5 branches
            branch_id = str(branch["_id"])
            branch_name = branch.get("name", "Unknown")
            print(f"  - Branch ID: {branch_id}, Name: {branch_name}")

        # Test 2: Student count per branch
        print("\n2. Student counts per branch...")

        # Count all students
        total_students = await db.students.count_documents({})
        active_students = await db.students.count_documents({"status": {"$in": ["Active", "active"]}})
        print(f"Total students: {total_students}")
        print(f"Active students: {active_students}")

        # Count students per branch
        branch_counts = {}
        for branch in branches[:3]:  # Test first 3 branches
            branch_id = str(branch["_id"])
            branch_name = branch.get("name", "Unknown")

            # Count total students in branch
            total_in_branch = await db.students.count_documents({"branch_id": branch_id})

            # Count active students in branch
            active_in_branch = await db.students.count_documents({
                "branch_id": branch_id,
                "status": {"$in": ["Active", "active"]}
            })

            branch_counts[branch_id] = {
                "name": branch_name,
                "total": total_in_branch,
                "active": active_in_branch
            }

            print(f"  Branch {branch_name} ({branch_id}): {active_in_branch} active / {total_in_branch} total")

        # Test 3: Test search queries with different branch filters
        print("\n3. Testing search queries...")

        # Sample search terms to test
        search_terms = ["Ahmed", "Mohammad", "Ali", "test"]

        for search_term in search_terms[:2]:  # Test first 2 terms
            print(f"\n  Testing search term: '{search_term}'")

            # Test 3a: Search in all branches
            print("    a) Searching in all branches:")
            all_branches_query = {
                "$or": [
                    {"student_id": {"$regex": search_term, "$options": "i"}},
                    {"first_name": {"$regex": search_term, "$options": "i"}},
                    {"father_name": {"$regex": search_term, "$options": "i"}},
                    {"grandfather_name": {"$regex": search_term, "$options": "i"}},
                    {"last_name": {"$regex": search_term, "$options": "i"}},
                    {"email": {"$regex": search_term, "$options": "i"}},
                    {"phone": {"$regex": search_term, "$options": "i"}}
                ],
                "status": {"$in": ["Active", "active"]}
            }

            all_results = await db.students.find(all_branches_query).limit(20).to_list(length=20)
            print(f"       Found {len(all_results)} students across all branches")

            # Show branch distribution
            branch_distribution = {}
            for student in all_results:
                branch_id = student.get("branch_id", "unknown")
                branch_distribution[branch_id] = branch_distribution.get(branch_id, 0) + 1

            for branch_id, count in branch_distribution.items():
                branch_name = "Unknown"
                for branch in branches:
                    if str(branch["_id"]) == branch_id:
                        branch_name = branch.get("name", "Unknown")
                        break
                print(f"       Branch {branch_name} ({branch_id}): {count} students")

            # Test 3b: Search in specific branch
            if branches:
                test_branch = branches[0]
                test_branch_id = str(test_branch["_id"])
                test_branch_name = test_branch.get("name", "Unknown")

                print(f"    b) Searching in specific branch: {test_branch_name} ({test_branch_id})")

                specific_branch_query = {
                    "$or": [
                        {"student_id": {"$regex": search_term, "$options": "i"}},
                        {"first_name": {"$regex": search_term, "$options": "i"}},
                        {"father_name": {"$regex": search_term, "$options": "i"}},
                        {"grandfather_name": {"$regex": search_term, "$options": "i"}},
                        {"last_name": {"$regex": search_term, "$options": "i"}},
                        {"email": {"$regex": search_term, "$options": "i"}},
                        {"phone": {"$regex": search_term, "$options": "i"}}
                    ],
                    "branch_id": test_branch_id,
                    "status": {"$in": ["Active", "active"]}
                }

                specific_results = await db.students.find(specific_branch_query).limit(20).to_list(length=20)
                print(f"       Found {len(specific_results)} students in branch {test_branch_name}")

                # Show sample results
                for i, student in enumerate(specific_results[:3]):
                    name = f"{student.get('first_name', '')} {student.get('father_name', '')} {student.get('grandfather_name', '')}".strip()
                    student_id = student.get('student_id', 'No ID')
                    print(f"       {i+1}. {name} (ID: {student_id})")

        # Test 4: Test branch validation logic
        print("\n4. Testing branch validation logic...")

        def validate_branch_id(branch_id: str, user_branch_id: str = None) -> str:
            """Validate and normalize branch_id parameter"""
            if branch_id == "all":
                return branch_id
            if not branch_id:
                if user_branch_id and user_branch_id != "all":
                    return user_branch_id
                return "all"
            return branch_id

        test_cases = [
            ("all", None, "all"),
            ("", None, "all"),
            ("68b7231bb110092a69ae2acc", None, "68b7231bb110092a69ae2acc"),
            ("", "68b7231bb110092a69ae2acc", "68b7231bb110092a69ae2acc"),
            ("", "all", "all"),
            (None, None, "all")
        ]

        print("    Branch validation test cases:")
        for i, (input_branch, user_branch, expected) in enumerate(test_cases, 1):
            try:
                result = validate_branch_id(input_branch or "", user_branch)
                status = "✓ PASS" if result == expected else "✗ FAIL"
                print(f"    {i}. Input: {input_branch}, User: {user_branch} -> {result} {status}")
            except Exception as e:
                print(f"    {i}. Input: {input_branch}, User: {user_branch} -> ERROR: {e}")

        # Test 5: Test ObjectId validation
        print("\n5. Testing ObjectId validation...")

        valid_object_ids = []
        invalid_object_ids = ["invalid", "123", "not-an-id", ""]

        # Get some valid ObjectIds from branches
        for branch in branches[:3]:
            valid_object_ids.append(str(branch["_id"]))

        print("    Valid ObjectId tests:")
        for obj_id in valid_object_ids:
            try:
                ObjectId(obj_id)
                print(f"    ✓ {obj_id} - Valid")
            except Exception as e:
                print(f"    ✗ {obj_id} - Invalid: {e}")

        print("    Invalid ObjectId tests:")
        for obj_id in invalid_object_ids:
            try:
                ObjectId(obj_id)
                print(f"    ✗ {obj_id} - Should be invalid but passed")
            except Exception:
                print(f"    ✓ {obj_id} - Correctly identified as invalid")

        # Test 6: Test the actual API logic simulation
        print("\n6. Simulating API endpoint logic...")

        async def simulate_student_search(q: str, branch_id: str, limit: int = 20):
            """Simulate the student search endpoint logic"""

            validated_branch_id = validate_branch_id(branch_id, None)

            # Build search query
            search_query = {
                "$or": [
                    {"student_id": {"$regex": q, "$options": "i"}},
                    {"first_name": {"$regex": q, "$options": "i"}},
                    {"father_name": {"$regex": q, "$options": "i"}},
                    {"grandfather_name": {"$regex": q, "$options": "i"}},
                    {"last_name": {"$regex": q, "$options": "i"}},
                    {"email": {"$regex": q, "$options": "i"}},
                    {"phone": {"$regex": q, "$options": "i"}}
                ]
            }

            # Add branch filter if not searching all branches
            if validated_branch_id != "all":
                search_query["branch_id"] = validated_branch_id

            # Add active student filter
            search_query["status"] = {"$in": ["Active", "active"]}

            # Get branch statistics for debug info
            if validated_branch_id != "all":
                branch_count = await db.students.count_documents({"branch_id": validated_branch_id})
                active_count = await db.students.count_documents({
                    "branch_id": validated_branch_id,
                    "status": {"$in": ["Active", "active"]}
                })
            else:
                branch_count = await db.students.count_documents({})
                active_count = await db.students.count_documents({"status": {"$in": ["Active", "active"]}})

            # Execute search
            cursor = db.students.find(search_query).limit(limit)
            students = await cursor.to_list(length=limit)

            return {
                "students": students,
                "count": len(students),
                "query": q,
                "branch_id": validated_branch_id,
                "debug_info": {
                    "total_in_branch": branch_count,
                    "active_in_branch": active_count,
                    "search_results": len(students),
                    "branch_filter_applied": validated_branch_id != "all"
                }
            }

        # Test different scenarios
        test_scenarios = [
            ("Ahmed", "all"),
            ("Ahmed", str(branches[0]["_id"]) if branches else "68b7231bb110092a69ae2acc"),
            ("Mohammad", "all"),
            ("test", "invalid_branch_id")
        ]

        for query, branch_id in test_scenarios:
            print(f"\n    Scenario: q='{query}', branch_id='{branch_id}'")
            try:
                result = await simulate_student_search(query, branch_id)
                print(f"    Results: {result['count']} students found")
                print(f"    Branch filter applied: {result['debug_info']['branch_filter_applied']}")
                print(f"    Total in branch: {result['debug_info']['total_in_branch']}")
                print(f"    Active in branch: {result['debug_info']['active_in_branch']}")
                print(f"    Validated branch_id: {result['branch_id']}")

                # Show sample results
                for i, student in enumerate(result['students'][:2]):
                    name = f"{student.get('first_name', '')} {student.get('father_name', '')}".strip()
                    student_id = student.get('student_id', 'No ID')
                    student_branch = student.get('branch_id', 'No Branch')
                    print(f"      {i+1}. {name} (ID: {student_id}, Branch: {student_branch})")

            except Exception as e:
                print(f"    ERROR: {e}")

        print(f"\n=== Test completed at: {datetime.now()} ===")

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Close database connection
        db_client.close()

if __name__ == "__main__":
    asyncio.run(test_branch_filtering_logic())