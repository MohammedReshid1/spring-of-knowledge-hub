#!/usr/bin/env python3
"""
Student Search Investigation Script
Investigates the MongoDB student collection to identify why search is returning 0 results
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from pprint import pprint
import json

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "spring_of_knowledge"
BRANCH_ID = "68b7231bb110092a69ae2acc"
SEARCH_TERM = "test"

async def investigate_student_search():
    """Main investigation function"""
    print("🔍 Starting MongoDB Student Search Investigation")
    print("=" * 60)

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    students_collection = db["students"]

    print(f"📊 Database: {DB_NAME}")
    print(f"🏢 Branch ID: {BRANCH_ID}")
    print(f"🔎 Search Term: {SEARCH_TERM}")
    print()

    try:
        # 1. Basic collection stats
        print("1️⃣ BASIC COLLECTION STATISTICS")
        print("-" * 40)
        total_students = await students_collection.count_documents({})
        print(f"Total students in database: {total_students}")

        # 2. Check if branch exists and has students
        print("\n2️⃣ BRANCH ANALYSIS")
        print("-" * 40)
        students_in_branch = await students_collection.count_documents({"branch_id": BRANCH_ID})
        print(f"Students in branch {BRANCH_ID}: {students_in_branch}")

        # Alternative branch_id formats to check
        branch_variations = [
            BRANCH_ID,
            ObjectId(BRANCH_ID) if ObjectId.is_valid(BRANCH_ID) else None,
            str(BRANCH_ID),
            {"$regex": BRANCH_ID, "$options": "i"}
        ]

        for i, branch_var in enumerate(branch_variations):
            if branch_var is None:
                continue
            try:
                count = await students_collection.count_documents({"branch_id": branch_var})
                print(f"Branch format {i+1} ({type(branch_var).__name__}): {count} students")
            except Exception as e:
                print(f"Branch format {i+1} failed: {e}")

        # 3. Sample student documents to understand structure
        print("\n3️⃣ SAMPLE STUDENT DOCUMENTS")
        print("-" * 40)

        # Get first few students to examine structure
        sample_students = await students_collection.find({}).limit(3).to_list(3)

        if sample_students:
            print(f"Found {len(sample_students)} sample documents")
            for i, student in enumerate(sample_students, 1):
                print(f"\n--- Sample Student {i} ---")
                # Convert ObjectId to string for JSON serialization
                student_copy = student.copy()
                student_copy["_id"] = str(student_copy["_id"])

                # Show key fields
                key_fields = ["_id", "student_id", "first_name", "last_name", "email", "phone", "branch_id", "is_active"]
                for field in key_fields:
                    value = student_copy.get(field, "MISSING")
                    print(f"  {field}: {value} ({type(value).__name__})")
        else:
            print("❌ No students found in database!")
            return

        # 4. Test the exact search conditions from the API
        print("\n4️⃣ TESTING API SEARCH CONDITIONS")
        print("-" * 40)

        # Exact search conditions from payments_dev.py
        search_conditions = {
            "$or": [
                {"student_id": {"$regex": SEARCH_TERM, "$options": "i"}},
                {"first_name": {"$regex": SEARCH_TERM, "$options": "i"}},
                {"last_name": {"$regex": SEARCH_TERM, "$options": "i"}},
                {"email": {"$regex": SEARCH_TERM, "$options": "i"}},
                {"phone": {"$regex": SEARCH_TERM, "$options": "i"}}
            ],
            "branch_id": BRANCH_ID,
            "is_active": True
        }

        print("Search conditions:")
        print(json.dumps(search_conditions, indent=2, default=str))

        # Test the search
        search_results = await students_collection.find(search_conditions).to_list(20)
        print(f"\n🔍 Search results: {len(search_results)} students found")

        if search_results:
            print("✅ Search is working! Found students:")
            for student in search_results:
                print(f"  - {student.get('first_name', '')} {student.get('last_name', '')} ({student.get('student_id', '')})")
        else:
            print("❌ Search returned 0 results")

            # Let's debug why
            print("\n🔧 DEBUGGING SEARCH FAILURE")
            print("-" * 40)

            # Test each condition separately
            or_conditions = search_conditions["$or"]
            for i, condition in enumerate(or_conditions, 1):
                field_name = list(condition.keys())[0]
                test_query = {**condition, "branch_id": BRANCH_ID}
                count = await students_collection.count_documents(test_query)
                print(f"Condition {i} ({field_name} contains '{SEARCH_TERM}'): {count} matches")

            # Test without branch_id
            no_branch_search = {"$or": or_conditions, "is_active": True}
            no_branch_count = await students_collection.count_documents(no_branch_search)
            print(f"Same search without branch filter: {no_branch_count} matches")

            # Test without is_active
            no_active_search = {"$or": or_conditions, "branch_id": BRANCH_ID}
            no_active_count = await students_collection.count_documents(no_active_search)
            print(f"Same search without is_active filter: {no_active_count} matches")

            # Test branch_id alone
            branch_only = {"branch_id": BRANCH_ID}
            branch_count = await students_collection.count_documents(branch_only)
            print(f"Students with exact branch_id match: {branch_count}")

            # Test is_active alone
            active_only = {"is_active": True}
            active_count = await students_collection.count_documents(active_only)
            print(f"Students with is_active=True: {active_count}")

        # 5. Check for field existence
        print("\n5️⃣ FIELD EXISTENCE CHECK")
        print("-" * 40)

        search_fields = ["student_id", "first_name", "last_name", "email", "phone", "branch_id", "is_active"]
        for field in search_fields:
            exists_count = await students_collection.count_documents({field: {"$exists": True}})
            not_null_count = await students_collection.count_documents({field: {"$ne": None}})
            print(f"{field}: {exists_count} exist, {not_null_count} not null")

        # 6. Check branch_id field values
        print("\n6️⃣ BRANCH_ID FIELD ANALYSIS")
        print("-" * 40)

        pipeline = [
            {"$group": {"_id": "$branch_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]

        branch_distribution = await students_collection.aggregate(pipeline).to_list(10)
        print("Branch ID distribution (top 10):")
        for branch_info in branch_distribution:
            branch_id = branch_info["_id"]
            count = branch_info["count"]
            match_indicator = "👈 TARGET" if str(branch_id) == BRANCH_ID else ""
            print(f"  {branch_id} ({type(branch_id).__name__}): {count} students {match_indicator}")

        # 7. Check is_active field values
        print("\n7️⃣ IS_ACTIVE FIELD ANALYSIS")
        print("-" * 40)

        active_pipeline = [
            {"$group": {"_id": "$is_active", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]

        active_distribution = await students_collection.aggregate(active_pipeline).to_list(10)
        print("is_active field distribution:")
        for active_info in active_distribution:
            is_active = active_info["_id"]
            count = active_info["count"]
            print(f"  {is_active} ({type(is_active).__name__}): {count} students")

        # 8. Test with sample data that contains search term
        print("\n8️⃣ TESTING WITH ACTUAL DATA")
        print("-" * 40)

        # Find any student with "test" in any field
        test_regex = {"$regex": "test", "$options": "i"}
        potential_matches = await students_collection.find({
            "$or": [
                {"student_id": test_regex},
                {"first_name": test_regex},
                {"last_name": test_regex},
                {"email": test_regex},
                {"phone": test_regex}
            ]
        }).limit(5).to_list(5)

        print(f"Students containing 'test' anywhere: {len(potential_matches)}")
        for student in potential_matches:
            print(f"  - {student.get('first_name', '')} {student.get('last_name', '')} "
                  f"(ID: {student.get('student_id', '')}, Branch: {student.get('branch_id', '')}, "
                  f"Active: {student.get('is_active', '')})")

    except Exception as e:
        print(f"❌ Error during investigation: {e}")
        import traceback
        traceback.print_exc()

    finally:
        client.close()

    print("\n" + "=" * 60)
    print("🏁 Investigation Complete")

if __name__ == "__main__":
    asyncio.run(investigate_student_search())