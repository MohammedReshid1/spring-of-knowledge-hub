#!/usr/bin/env python3
"""
Fix validation errors in existing routers and models
"""
import asyncio
import os
from datetime import datetime, date
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def fix_data_validation_issues():
    """Fix data validation issues in the database"""
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print("🔧 Fixing validation issues in database...")
    
    # Fix assets collection
    print("📦 Fixing assets collection...")
    assets = await db.assets.find({}).to_list(None)
    for asset in assets:
        updates = {}
        
        # Fix date format (should be date, not datetime)
        if "purchase_date" in asset and isinstance(asset["purchase_date"], str):
            try:
                dt = datetime.fromisoformat(asset["purchase_date"])
                updates["purchase_date"] = dt.date().isoformat()
            except:
                updates["purchase_date"] = date.today().isoformat()
        
        # Fix status enum
        if "status" in asset and asset["status"] not in ["active", "inactive", "under_maintenance", "damaged", "lost", "disposed", "on_loan", "reserved"]:
            status_map = {
                "available": "active",
                "good": "active", 
                "excellent": "active"
            }
            updates["status"] = status_map.get(asset["status"], "active")
        
        if updates:
            await db.assets.update_one({"_id": asset["_id"]}, {"$set": updates})
            print(f"   Fixed asset: {asset.get('name', 'Unknown')}")
    
    # Fix subjects collection
    print("📖 Fixing subjects collection...")
    subjects = await db.subjects.find({}).to_list(None)
    for subject in subjects:
        updates = {}
        
        # Add required fields that might be missing
        if "subject_name" not in subject and "name" in subject:
            updates["subject_name"] = subject["name"]
        
        if "subject_code" not in subject and "code" in subject:
            updates["subject_code"] = subject["code"]
        
        if updates:
            await db.subjects.update_one({"_id": subject["_id"]}, {"$set": updates})
            print(f"   Fixed subject: {subject.get('name', 'Unknown')}")
    
    # Fix payment_mode collection
    print("💳 Fixing payment modes...")
    payment_modes = await db.payment_mode.find({}).to_list(None)
    for mode in payment_modes:
        updates = {}
        
        if "payment_id" not in mode:
            updates["payment_id"] = str(mode["_id"])
        
        if updates:
            await db.payment_mode.update_one({"_id": mode["_id"]}, {"$set": updates})
            print(f"   Fixed payment mode: {mode.get('name', 'Unknown')}")
    
    # Fix exams collection
    print("📝 Fixing exams...")
    exams = await db.exams.find({}).to_list(None)
    for exam in exams:
        updates = {}
        
        if "name" not in exam and "exam_name" in exam:
            updates["name"] = exam["exam_name"]
        
        if "academic_year" not in exam:
            updates["academic_year"] = "2024-2025"
        
        if "term" not in exam:
            updates["term"] = "Term 1"
        
        if updates:
            await db.exams.update_one({"_id": exam["_id"]}, {"$set": updates})
            print(f"   Fixed exam: {exam.get('exam_name', 'Unknown')}")
    
    # Fix academic_events collection
    print("📅 Fixing academic events...")
    events = await db.academic_events.find({}).to_list(None)
    for event in events:
        updates = {}
        
        if "academic_year_id" not in event:
            # Create a default academic year
            academic_year = await db.academic_years.find_one({"year": "2024-2025"})
            if not academic_year:
                academic_year_id = ObjectId()
                await db.academic_years.insert_one({
                    "_id": academic_year_id,
                    "year": "2024-2025",
                    "start_date": "2024-09-01",
                    "end_date": "2025-06-30",
                    "is_current": True,
                    "created_at": datetime.now().isoformat()
                })
                updates["academic_year_id"] = str(academic_year_id)
            else:
                updates["academic_year_id"] = str(academic_year["_id"])
        
        if "created_by" not in event:
            admin = await db.users.find_one({"role": "admin"})
            if admin:
                updates["created_by"] = str(admin["_id"])
            else:
                updates["created_by"] = "system"
        
        if updates:
            await db.academic_events.update_one({"_id": event["_id"]}, {"$set": updates})
            print(f"   Fixed event: {event.get('title', 'Unknown')}")
    
    # Fix grade_levels collection 
    print("📚 Fixing grade levels...")
    grade_levels = await db.grade_levels.find({}).to_list(None)
    for grade in grade_levels:
        updates = {}
        
        # Add missing required fields
        required_fields = {
            "grade": grade.get("code", "Unknown"),
            "max_capacity": 30,
            "current_enrollment": 0,
            "academic_year": "2024-2025"
        }
        
        for field, default_value in required_fields.items():
            if field not in grade:
                updates[field] = default_value
        
        if "updated_at" not in grade:
            updates["updated_at"] = datetime.now().isoformat()
        
        if updates:
            await db.grade_levels.update_one({"_id": grade["_id"]}, {"$set": updates})
            print(f"   Fixed grade level: {grade.get('name', 'Unknown')}")
    
    # Fix discipline incidents - date handling
    print("⚖️ Fixing discipline incidents...")
    incidents = await db.incidents.find({}).to_list(None)
    for incident in incidents:
        updates = {}
        
        # Fix date strings that are already ISO format
        if "incident_date" in incident and isinstance(incident["incident_date"], str):
            try:
                # If it's already a valid ISO string, keep it
                datetime.fromisoformat(incident["incident_date"])
            except:
                # If not, set to current date
                updates["incident_date"] = datetime.now().isoformat()
        
        if updates:
            await db.incidents.update_one({"_id": incident["_id"]}, {"$set": updates})
            print(f"   Fixed incident: {incident.get('title', 'Unknown')}")
    
    print("✅ All validation fixes completed!")
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_data_validation_issues())