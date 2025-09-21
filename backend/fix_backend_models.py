#!/usr/bin/env python3
"""
Fix backend models and data consistency issues
"""
import asyncio
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def fix_database():
    """Fix database consistency issues"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"🔧 Fixing database: {DATABASE_NAME}")
    
    # Fix assets collection (inventory items)
    print("\n📦 Fixing assets collection...")
    assets = await db.assets.find({}).to_list(None)
    for asset in assets:
        updates = {}
        
        # Add missing fields
        if "asset_code" not in asset:
            updates["asset_code"] = f"AST{str(asset['_id'])[-6:]}"
        
        if "name" not in asset and "item_name" in asset:
            updates["name"] = asset["item_name"]
        
        if "category" in asset:
            # Map old categories to new ones
            category_map = {
                "furniture": "furniture",
                "supplies": "office_supplies",
                "equipment": "electronics"
            }
            if asset["category"] in category_map:
                updates["category"] = category_map[asset["category"]]
        
        if "created_by" not in asset:
            # Get first admin user
            admin = await db.users.find_one({"role": "admin"})
            if admin:
                updates["created_by"] = str(admin["_id"])
        
        if "purchase_date" not in asset:
            updates["purchase_date"] = datetime.now().isoformat()
        
        if "purchase_price" not in asset:
            updates["purchase_price"] = 0.0
        
        if "current_value" not in asset:
            updates["current_value"] = 0.0
        
        if "status" not in asset:
            updates["status"] = "available"
        
        if "condition" not in asset:
            updates["condition"] = "good"
        
        if updates:
            await db.assets.update_one({"_id": asset["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed asset: {asset.get('item_name', asset.get('name', 'Unknown'))}")
    
    # Fix students collection - add grade_level field
    print("\n👨‍🎓 Fixing students collection...")
    students = await db.students.find({}).to_list(None)
    for student in students:
        updates = {}
        
        if "grade_level" not in student and "grade_level_id" in student:
            # Get grade level name
            grade_level = await db.grade_levels.find_one({"_id": ObjectId(student["grade_level_id"])})
            if grade_level:
                updates["grade_level"] = grade_level["name"]
        
        if updates:
            await db.students.update_one({"_id": student["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed student: {student.get('first_name', 'Unknown')} {student.get('last_name', '')}")
    
    # Fix notifications collection
    print("\n🔔 Fixing notifications collection...")
    notifications = await db.notifications.find({}).to_list(None)
    for notification in notifications:
        updates = {}
        
        if "user_id" not in notification:
            # Get first admin user
            admin = await db.users.find_one({"role": "admin"})
            if admin:
                updates["user_id"] = str(admin["_id"])
        
        if "status" not in notification:
            updates["status"] = "unread" if not notification.get("is_read", False) else "read"
        
        if updates:
            await db.notifications.update_one({"_id": notification["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed notification: {notification.get('title', 'Unknown')}")
    
    # Fix incidents collection
    print("\n⚖️ Fixing incidents collection...")
    incidents = await db.incidents.find({}).to_list(None)
    for incident in incidents:
        updates = {}
        
        if "action_taken" not in incident:
            updates["action_taken"] = []
        
        if "witnesses" not in incident:
            updates["witnesses"] = []
        
        if "parent_notified" not in incident:
            updates["parent_notified"] = False
        
        if "parent_notification_date" not in incident:
            updates["parent_notification_date"] = None
        
        if "follow_up_required" not in incident:
            updates["follow_up_required"] = False
        
        if "follow_up_notes" not in incident:
            updates["follow_up_notes"] = None
        
        if updates:
            await db.incidents.update_one({"_id": incident["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed incident: {incident.get('title', 'Unknown')}")
    
    # Fix exams collection
    print("\n📝 Fixing exams collection...")
    exams = await db.exams.find({}).to_list(None)
    for exam in exams:
        updates = {}
        
        if "instructions" not in exam:
            updates["instructions"] = ""
        
        if "room_number" not in exam:
            updates["room_number"] = None
        
        if "teacher_id" not in exam:
            # Get first teacher
            teacher = await db.teachers.find_one({})
            if teacher:
                updates["teacher_id"] = str(teacher["_id"])
        
        if "status" not in exam:
            updates["status"] = "scheduled"
        
        if updates:
            await db.exams.update_one({"_id": exam["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed exam: {exam.get('exam_name', 'Unknown')}")
    
    # Fix academic_events collection
    print("\n📅 Fixing academic events...")
    events = await db.academic_events.find({}).to_list(None)
    for event in events:
        updates = {}
        
        if "is_holiday" not in event:
            updates["is_holiday"] = event.get("event_type") == "holiday"
        
        if "all_branches" not in event:
            updates["all_branches"] = False
        
        if "target_audience" not in event:
            updates["target_audience"] = ["all"]
        
        if "location" not in event:
            updates["location"] = None
        
        if "reminder_sent" not in event:
            updates["reminder_sent"] = False
        
        if updates:
            await db.academic_events.update_one({"_id": event["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed event: {event.get('title', 'Unknown')}")
    
    # Create missing collections with sample data
    print("\n📂 Creating missing collections...")
    
    # Create messages collection
    if await db.messages.count_documents({}) == 0:
        message = {
            "_id": ObjectId(),
            "sender_id": str((await db.users.find_one({"role": "admin"}))["_id"]),
            "subject": "Welcome Message",
            "content": "Welcome to Spring of Knowledge Hub!",
            "message_type": "announcement",
            "priority": "normal",
            "recipients": ["all"],
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        await db.messages.insert_one(message)
        print("   ✅ Created sample message")
    
    # Create announcements collection
    if await db.announcements.count_documents({}) == 0:
        announcement = {
            "_id": ObjectId(),
            "title": "School Year 2024-2025",
            "content": "Welcome to the new academic year!",
            "author_id": str((await db.users.find_one({"role": "admin"}))["_id"]),
            "target_audience": ["all"],
            "priority": "high",
            "is_active": True,
            "start_date": datetime.now().isoformat(),
            "end_date": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }
        await db.announcements.insert_one(announcement)
        print("   ✅ Created sample announcement")
    
    # Fix grade_levels collection
    print("\n📚 Fixing grade levels...")
    grade_levels = await db.grade_levels.find({}).to_list(None)
    for grade in grade_levels:
        updates = {}
        
        if "order" not in grade:
            # Assign order based on grade number
            order_map = {"KG": 0, "G1": 1, "G2": 2, "G3": 3, "G4": 4, "G5": 5}
            updates["order"] = order_map.get(grade.get("code", ""), 99)
        
        if updates:
            await db.grade_levels.update_one({"_id": grade["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed grade level: {grade.get('name', 'Unknown')}")
    
    # Fix subjects collection
    print("\n📖 Fixing subjects...")
    subjects = await db.subjects.find({}).to_list(None)
    for subject in subjects:
        updates = {}
        
        if "credits" not in subject:
            updates["credits"] = 3
        
        if "grade_levels" not in subject:
            # Assign to all grade levels
            all_grades = await db.grade_levels.find({}).to_list(None)
            updates["grade_levels"] = [str(g["_id"]) for g in all_grades]
        
        if updates:
            await db.subjects.update_one({"_id": subject["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed subject: {subject.get('name', 'Unknown')}")
    
    # Fix payment_mode collection
    print("\n💳 Fixing payment modes...")
    payment_modes = await db.payment_mode.find({}).to_list(None)
    for mode in payment_modes:
        updates = {}
        
        if "transaction_fee" not in mode:
            updates["transaction_fee"] = 0.0
        
        if "min_amount" not in mode:
            updates["min_amount"] = 0.0
        
        if "max_amount" not in mode:
            updates["max_amount"] = 1000000.0
        
        if updates:
            await db.payment_mode.update_one({"_id": mode["_id"]}, {"$set": updates})
            print(f"   ✅ Fixed payment mode: {mode.get('name', 'Unknown')}")
    
    print("\n✅ All database fixes completed!")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_database())