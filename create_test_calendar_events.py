#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from bson import ObjectId
import random

async def create_test_calendar_events():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017/")
    db = client["spring_knowledge_hub"]
    
    print("=" * 50)
    print("CREATING TEST CALENDAR EVENTS")
    print("=" * 50)
    
    # Get collections
    events_coll = db["academic_events"]
    academic_years_coll = db["academic_years"]
    terms_coll = db["terms"]
    exams_coll = db["exams"]
    
    # Get current academic year
    current_year = await academic_years_coll.find_one({"is_current": True})
    if not current_year:
        print("No current academic year found!")
        return
    
    academic_year_id = str(current_year["_id"])
    print(f"Using academic year: {current_year.get('name', 'Unknown')}")
    
    # Get current term
    current_term = await terms_coll.find_one({
        "academic_year_id": academic_year_id,
        "is_current": True
    })
    
    term_id = str(current_term["_id"]) if current_term else None
    if current_term:
        print(f"Using term: {current_term.get('name', 'Unknown')}")
    
    # Check existing exams
    exam_count = await exams_coll.count_documents({})
    print(f"\nFound {exam_count} exams in database")
    
    # Create various types of calendar events
    events = []
    today = datetime.now()
    
    # 1. Create exam events
    print("\nCreating exam events...")
    async for exam in exams_coll.find().limit(5):
        event = {
            "_id": ObjectId(),
            "title": f"Exam: {exam.get('name', 'Unknown Exam')}",
            "description": f"{exam.get('exam_type', 'Exam')} - {exam.get('total_marks', 0)} marks",
            "event_type": "exam",
            "start_date": exam.get('exam_date', today + timedelta(days=random.randint(1, 30))),
            "end_date": None,
            "is_all_day": False,
            "academic_year_id": academic_year_id,
            "term_id": term_id,
            "class_ids": [exam.get('class_id')] if exam.get('class_id') else [],
            "branch_id": exam.get('branch_id'),
            "color": "#ff9800",
            "source_type": "exam",
            "source_id": str(exam["_id"]),
            "auto_generated": True,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "metadata": {
                "exam_type": exam.get('exam_type'),
                "total_marks": exam.get('total_marks'),
                "subject_id": exam.get('subject_id'),
                "teacher_id": exam.get('teacher_id')
            }
        }
        events.append(event)
        print(f"  - Created exam event: {event['title']}")
    
    # 2. Create holiday events
    print("\nCreating holiday events...")
    holidays = [
        ("Winter Break", 7, "#4CAF50"),
        ("Parent-Teacher Conference", 15, "#2196F3"),
        ("Sports Day", 20, "#FF5722"),
        ("Science Fair", 25, "#9C27B0"),
    ]
    
    for holiday_name, days_ahead, color in holidays:
        event = {
            "_id": ObjectId(),
            "title": holiday_name,
            "description": f"School event: {holiday_name}",
            "event_type": "holiday",
            "start_date": today + timedelta(days=days_ahead),
            "end_date": today + timedelta(days=days_ahead + 1) if days_ahead == 7 else None,
            "is_all_day": True,
            "academic_year_id": academic_year_id,
            "term_id": term_id,
            "class_ids": [],
            "branch_id": None,
            "color": color,
            "source_type": "manual",
            "source_id": None,
            "auto_generated": False,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "metadata": {}
        }
        events.append(event)
        print(f"  - Created holiday event: {event['title']}")
    
    # 3. Create deadline events
    print("\nCreating deadline events...")
    deadlines = [
        ("Assignment Due: Mathematics Project", 3, "#F44336"),
        ("Report Card Distribution", 10, "#FF9800"),
        ("Registration Deadline for Next Term", 28, "#E91E63"),
    ]
    
    for deadline_name, days_ahead, color in deadlines:
        event = {
            "_id": ObjectId(),
            "title": deadline_name,
            "description": f"Important deadline: {deadline_name}",
            "event_type": "deadline",
            "start_date": today + timedelta(days=days_ahead),
            "end_date": None,
            "is_all_day": True,
            "academic_year_id": academic_year_id,
            "term_id": term_id,
            "class_ids": [],
            "branch_id": None,
            "color": color,
            "source_type": "manual",
            "source_id": None,
            "auto_generated": False,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "metadata": {}
        }
        events.append(event)
        print(f"  - Created deadline event: {event['title']}")
    
    # Insert all events
    if events:
        result = await events_coll.insert_many(events)
        print(f"\n✅ Successfully created {len(result.inserted_ids)} calendar events!")
    else:
        print("\n❌ No events were created")
    
    # Verify the events were created
    total_events = await events_coll.count_documents({})
    upcoming_events = await events_coll.count_documents({
        "start_date": {
            "$gte": today,
            "$lte": today + timedelta(days=30)
        }
    })
    
    print(f"\nCurrent status:")
    print(f"  - Total events in database: {total_events}")
    print(f"  - Upcoming events (next 30 days): {upcoming_events}")
    
    print("\n" + "=" * 50)

if __name__ == "__main__":
    asyncio.run(create_test_calendar_events())