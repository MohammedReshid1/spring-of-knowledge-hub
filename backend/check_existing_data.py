#!/usr/bin/env python3
"""
Check existing data in the database
"""
import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime, date, timedelta
import json

# Set up environment variables
from dotenv import load_dotenv
load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def check_data():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DATABASE_NAME]

    branch_id = "68b7231bb110092a69ae2acc"

    print("Checking existing fee templates...")
    templates = await db.fee_templates.find({"branch_id": branch_id}).to_list(length=None)
    print(f"Found {len(templates)} fee templates:")
    for t in templates[:5]:  # Show first 5
        print(f"- {t.get('name', 'No name')}: {t.get('fee_type', 'No type')}, Grade Levels: {t.get('grade_levels', 'None')}")

    print("\nChecking students...")
    students = await db.students.find({"branch_id": branch_id}).to_list(length=5)
    print(f"Sample students:")
    for s in students[:5]:  # Show first 5
        print(f"- {s.get('student_id', 'No ID')}: {s.get('first_name', '')} {s.get('last_name', '')}, Grade: {s.get('grade_level', 'No grade')}")

    print("\nChecking academic years...")
    years = await db.academic_years.find({"branch_id": branch_id}).to_list(length=None)
    for y in years:
        print(f"- {y.get('year', 'No year')}: Current: {y.get('is_current', False)}")

    client.close()

if __name__ == "__main__":
    asyncio.run(check_data())