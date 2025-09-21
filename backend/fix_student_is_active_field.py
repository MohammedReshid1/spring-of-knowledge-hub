#!/usr/bin/env python3
"""
Student Database Migration Script
Adds missing is_active field to all student documents
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime

# MongoDB connection
MONGO_URI = "mongodb://localhost:27017"
DB_NAME = "spring_of_knowledge"

async def fix_student_is_active_field():
    """Add is_active field to all student documents"""
    print("🔧 Starting Student Database Migration")
    print("=" * 50)

    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    students_collection = db["students"]

    try:
        # 1. Check current state
        print("1️⃣ ANALYZING CURRENT STATE")
        print("-" * 30)

        total_students = await students_collection.count_documents({})
        missing_is_active = await students_collection.count_documents({"is_active": {"$exists": False}})
        has_is_active = await students_collection.count_documents({"is_active": {"$exists": True}})

        print(f"Total students: {total_students}")
        print(f"Missing is_active field: {missing_is_active}")
        print(f"Has is_active field: {has_is_active}")

        if missing_is_active == 0:
            print("✅ All students already have is_active field!")
            return

        # 2. Preview the update
        print(f"\n2️⃣ MIGRATION PLAN")
        print("-" * 30)
        print(f"Will add is_active=True to {missing_is_active} students")

        # Get sample of students that need updating
        sample_students = await students_collection.find(
            {"is_active": {"$exists": False}}
        ).limit(3).to_list(3)

        print("\nSample students to be updated:")
        for student in sample_students:
            print(f"  - {student.get('first_name', 'Unknown')} ({student.get('student_id', 'No ID')})")

        # 3. Confirm before proceeding
        print(f"\n3️⃣ EXECUTING MIGRATION")
        print("-" * 30)

        # Update all students missing is_active field
        update_result = await students_collection.update_many(
            {"is_active": {"$exists": False}},
            {
                "$set": {
                    "is_active": True,
                    "is_active_updated_at": datetime.utcnow(),
                    "is_active_migration_note": "Added by migration script on " + datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                }
            }
        )

        print(f"✅ Migration completed!")
        print(f"Documents matched: {update_result.matched_count}")
        print(f"Documents updated: {update_result.modified_count}")

        # 4. Verify the results
        print(f"\n4️⃣ VERIFICATION")
        print("-" * 30)

        total_after = await students_collection.count_documents({})
        missing_after = await students_collection.count_documents({"is_active": {"$exists": False}})
        has_active_true = await students_collection.count_documents({"is_active": True})
        has_active_false = await students_collection.count_documents({"is_active": False})

        print(f"Total students: {total_after}")
        print(f"Missing is_active field: {missing_after}")
        print(f"Students with is_active=True: {has_active_true}")
        print(f"Students with is_active=False: {has_active_false}")

        if missing_after == 0:
            print("✅ Migration successful! All students now have is_active field.")
        else:
            print(f"⚠️ Warning: {missing_after} students still missing is_active field.")

        # 5. Test the search query after migration
        print(f"\n5️⃣ TESTING SEARCH FUNCTIONALITY")
        print("-" * 30)

        # Test the original search that was failing
        BRANCH_ID = "68b7231bb110092a69ae2acc"
        SEARCH_TERM = "test"

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

        search_results = await students_collection.find(search_conditions).to_list(20)
        print(f"Search for '{SEARCH_TERM}' in branch {BRANCH_ID}: {len(search_results)} results")

        # Test a broader search
        any_active_students = await students_collection.find({
            "branch_id": BRANCH_ID,
            "is_active": True
        }).limit(5).to_list(5)

        print(f"Active students in branch: {len(any_active_students)} found (showing first 5)")
        for student in any_active_students:
            print(f"  - {student.get('first_name', 'Unknown')} {student.get('last_name', '')} ({student.get('student_id', 'No ID')})")

    except Exception as e:
        print(f"❌ Error during migration: {e}")
        import traceback
        traceback.print_exc()

    finally:
        client.close()

    print("\n" + "=" * 50)
    print("🏁 Migration Complete")

async def rollback_migration():
    """Rollback the migration (remove the added fields)"""
    print("🔄 Rolling back migration...")

    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    students_collection = db["students"]

    try:
        # Remove the fields added by migration
        update_result = await students_collection.update_many(
            {"is_active_migration_note": {"$exists": True}},
            {
                "$unset": {
                    "is_active": "",
                    "is_active_updated_at": "",
                    "is_active_migration_note": ""
                }
            }
        )

        print(f"Rollback completed: {update_result.modified_count} documents updated")

    except Exception as e:
        print(f"❌ Error during rollback: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        asyncio.run(rollback_migration())
    else:
        asyncio.run(fix_student_is_active_field())