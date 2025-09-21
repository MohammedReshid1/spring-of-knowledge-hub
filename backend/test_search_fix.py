#!/usr/bin/env python3
"""
Test the search functionality after fixing the is_active field issue
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "spring_of_knowledge"
BRANCH_ID = "68b7231bb110092a69ae2acc"

async def test_search_functionality():
    """Test the student search with the fixed query"""
    print("🧪 Testing Fixed Student Search Functionality")
    print("=" * 50)

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    students_collection = db["students"]

    try:
        # Test search with different terms that should exist in the data
        search_terms = [
            "Abdellah",  # First name from sample
            "SCH-2025",  # Student ID prefix
            "SCH",       # Partial student ID
            "Abdul",     # Partial first name
            "001"        # Partial student ID number
        ]

        for search_term in search_terms:
            print(f"\n🔍 Testing search term: '{search_term}'")
            print("-" * 30)

            # Fixed search query (without is_active filter)
            search_conditions = {
                "$or": [
                    {"student_id": {"$regex": search_term, "$options": "i"}},
                    {"first_name": {"$regex": search_term, "$options": "i"}},
                    {"last_name": {"$regex": search_term, "$options": "i"}},
                    {"email": {"$regex": search_term, "$options": "i"}},
                    {"phone": {"$regex": search_term, "$options": "i"}}
                ],
                "branch_id": BRANCH_ID
                # NOTE: is_active filter removed
            }

            search_results = await students_collection.find(search_conditions).limit(10).to_list(10)
            print(f"Results found: {len(search_results)}")

            if search_results:
                print("Students found:")
                for student in search_results:
                    first_name = student.get('first_name', '')
                    last_name = student.get('last_name', '')
                    student_id = student.get('student_id', '')
                    full_name = f"{first_name} {last_name}".strip()
                    print(f"  - {full_name} ({student_id})")
            else:
                print("No results found")

        # Test the exact API endpoint simulation
        print(f"\n🎯 SIMULATING API ENDPOINT CALL")
        print("-" * 30)

        # Simulate the exact parameters from the failing API call
        api_search_term = "test"
        api_branch_id = "68b7231bb110092a69ae2acc"
        api_limit = 20

        # Build search query exactly like in the fixed API
        search_query = {
            "$or": [
                {"student_id": {"$regex": api_search_term, "$options": "i"}},
                {"first_name": {"$regex": api_search_term, "$options": "i"}},
                {"last_name": {"$regex": api_search_term, "$options": "i"}},
                {"email": {"$regex": api_search_term, "$options": "i"}},
                {"phone": {"$regex": api_search_term, "$options": "i"}}
            ]
        }

        # Add branch filter
        search_query["branch_id"] = api_branch_id

        # NOTE: is_active filter removed (this was the fix)

        cursor = students_collection.find(search_query).limit(api_limit)
        students = await cursor.to_list(api_limit)

        print(f"API simulation results:")
        print(f"Search term: '{api_search_term}'")
        print(f"Branch ID: {api_branch_id}")
        print(f"Results: {len(students)} students")

        # Build response like the API does
        results = []
        for student in students:
            first_name = student.get("first_name", "")
            last_name = student.get("last_name", "")
            full_name = student.get("full_name", f"{first_name} {last_name}".strip())

            student_data = {
                "id": str(student["_id"]),
                "student_id": student.get("student_id", ""),
                "first_name": first_name,
                "last_name": last_name,
                "full_name": full_name,
                "email": student.get("email", ""),
                "phone": student.get("phone", ""),
                "grade_level": student.get("grade_level", ""),
                "current_class": student.get("current_class", ""),
                "branch_id": student.get("branch_id", ""),
                "is_active": student.get("is_active", True)  # Default to True for now
            }

            results.append(student_data)

        api_response = {
            "students": results,
            "count": len(results),
            "query": api_search_term,
            "branch_id": api_branch_id
        }

        print(f"\nAPI Response would be:")
        print(f"  Count: {api_response['count']}")
        print(f"  Students: {len(api_response['students'])}")

        if api_response['count'] > 0:
            print("✅ SEARCH IS NOW WORKING!")
            print("The API would return student results.")
        else:
            print("❌ Search still returning 0 results")
            print("Need to check if any students match the search term 'test'")

            # Let's search for any student to verify the query structure works
            print(f"\n🔧 Testing with broader search...")
            any_student_query = {"branch_id": api_branch_id}
            any_students = await students_collection.find(any_student_query).limit(5).to_list(5)
            print(f"Any students in branch: {len(any_students)}")

            if any_students:
                print("Sample students in branch:")
                for student in any_students:
                    print(f"  - {student.get('first_name', 'Unknown')} ({student.get('student_id', 'No ID')})")

                # Test with partial match of actual student data
                first_student = any_students[0]
                test_name = first_student.get('first_name', '')[:3].lower()
                if test_name:
                    print(f"\n🧪 Testing with actual name prefix: '{test_name}'")
                    test_query = {
                        "$or": [
                            {"first_name": {"$regex": test_name, "$options": "i"}}
                        ],
                        "branch_id": api_branch_id
                    }
                    test_results = await students_collection.find(test_query).limit(5).to_list(5)
                    print(f"Results with name prefix '{test_name}': {len(test_results)}")

    except Exception as e:
        print(f"❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()

    finally:
        client.close()

    print("\n" + "=" * 50)
    print("🏁 Testing Complete")

if __name__ == "__main__":
    asyncio.run(test_search_functionality())