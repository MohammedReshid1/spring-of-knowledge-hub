#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, date
from bson import ObjectId
import random

async def setup_academic_calendar():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017/")
    db = client["spring_knowledge_hub"]
    
    print("=" * 50)
    print("SETTING UP ACADEMIC CALENDAR")
    print("=" * 50)
    
    # Get collections
    academic_years_coll = db["academic_years"]
    terms_coll = db["terms"]
    events_coll = db["academic_events"]
    
    # Check if academic year exists
    existing_year = await academic_years_coll.find_one({"is_current": True})
    
    if not existing_year:
        print("\nCreating academic year 2024-2025...")
        # Create academic year
        academic_year = {
            "_id": ObjectId(),
            "name": "2024-2025",
            "start_date": datetime(2024, 9, 1),  # September 1, 2024
            "end_date": datetime(2025, 6, 30),   # June 30, 2025
            "is_current": True,
            "description": "Academic Year 2024-2025",
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "system"
        }
        result = await academic_years_coll.insert_one(academic_year)
        academic_year_id = str(result.inserted_id)
        print(f"✅ Created academic year: {academic_year['name']}")
    else:
        academic_year_id = str(existing_year["_id"])
        print(f"✅ Using existing academic year: {existing_year.get('name', 'Unknown')}")
    
    # Check if terms exist
    existing_terms = await terms_coll.count_documents({"academic_year_id": academic_year_id})
    
    if existing_terms == 0:
        print("\nCreating academic terms...")
        # Create terms
        terms = [
            {
                "_id": ObjectId(),
                "name": "First Term",
                "academic_year_id": academic_year_id,
                "start_date": datetime(2024, 9, 1),
                "end_date": datetime(2024, 12, 20),
                "is_current": False,
                "description": "First Term 2024",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "_id": ObjectId(),
                "name": "Second Term",
                "academic_year_id": academic_year_id,
                "start_date": datetime(2025, 1, 7),
                "end_date": datetime(2025, 3, 28),
                "is_current": True,  # Current term
                "description": "Second Term 2025",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            },
            {
                "_id": ObjectId(),
                "name": "Third Term",
                "academic_year_id": academic_year_id,
                "start_date": datetime(2025, 4, 7),
                "end_date": datetime(2025, 6, 30),
                "is_current": False,
                "description": "Third Term 2025",
                "created_at": datetime.now(),
                "updated_at": datetime.now()
            }
        ]
        
        result = await terms_coll.insert_many(terms)
        current_term_id = str(terms[1]["_id"])  # Second term is current
        print(f"✅ Created {len(result.inserted_ids)} academic terms")
    else:
        current_term = await terms_coll.find_one({
            "academic_year_id": academic_year_id,
            "is_current": True
        })
        if current_term:
            current_term_id = str(current_term["_id"])
        else:
            # Make the first term current
            first_term = await terms_coll.find_one({"academic_year_id": academic_year_id})
            if first_term:
                await terms_coll.update_one(
                    {"_id": first_term["_id"]},
                    {"$set": {"is_current": True}}
                )
                current_term_id = str(first_term["_id"])
                print("✅ Set first term as current")
    
    # Now create calendar events
    print("\nCreating calendar events...")
    events = []
    today = datetime.now()
    
    # 1. Create holiday events
    print("  Creating holiday events...")
    holidays = [
        ("Winter Break", 7, 2, "#4CAF50", True),
        ("Parent-Teacher Conference", 15, 0, "#2196F3", False),
        ("Sports Day", 20, 0, "#FF5722", False),
        ("Science Fair", 25, 0, "#9C27B0", False),
        ("Spring Break", 45, 5, "#4CAF50", True),
    ]
    
    for holiday_name, days_ahead, duration, color, is_break in holidays:
        start_date = today + timedelta(days=days_ahead)
        event = {
            "_id": ObjectId(),
            "title": holiday_name,
            "description": f"{'School Break' if is_break else 'School Event'}: {holiday_name}",
            "event_type": "holiday",
            "start_date": start_date,
            "end_date": start_date + timedelta(days=duration) if duration > 0 else None,
            "is_all_day": True,
            "academic_year_id": academic_year_id,
            "term_id": current_term_id,
            "class_ids": [],
            "branch_id": None,
            "color": color,
            "source_type": "manual",
            "source_id": None,
            "auto_generated": False,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "is_public": True,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "system",
            "metadata": {"is_break": is_break}
        }
        events.append(event)
    
    # 2. Create exam events
    print("  Creating exam events...")
    exam_events = [
        ("Midterm Exams - Mathematics", 10, "#FF9800", "midterm"),
        ("Midterm Exams - Science", 11, "#FF9800", "midterm"),
        ("Midterm Exams - English", 12, "#FF9800", "midterm"),
        ("Final Exams - Mathematics", 30, "#F44336", "final"),
        ("Final Exams - Science", 31, "#F44336", "final"),
    ]
    
    for exam_name, days_ahead, color, exam_type in exam_events:
        start_date = today + timedelta(days=days_ahead)
        event = {
            "_id": ObjectId(),
            "title": exam_name,
            "description": f"{exam_type.title()} Examination",
            "event_type": "exam",
            "start_date": start_date,
            "end_date": None,
            "is_all_day": False,
            "academic_year_id": academic_year_id,
            "term_id": current_term_id,
            "class_ids": [],
            "branch_id": None,
            "color": color,
            "source_type": "manual",
            "source_id": None,
            "auto_generated": False,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "is_public": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "system",
            "metadata": {"exam_type": exam_type}
        }
        events.append(event)
    
    # 3. Create deadline events
    print("  Creating deadline events...")
    deadlines = [
        ("Assignment Due: Mathematics Project", 3, "#E91E63"),
        ("Report Card Distribution", 16, "#3F51B5"),
        ("Registration Deadline for Next Term", 28, "#E91E63"),
        ("Fee Payment Deadline", 5, "#F44336"),
    ]
    
    for deadline_name, days_ahead, color in deadlines:
        start_date = today + timedelta(days=days_ahead)
        event = {
            "_id": ObjectId(),
            "title": deadline_name,
            "description": f"Important deadline: {deadline_name}",
            "event_type": "deadline",
            "start_date": start_date,
            "end_date": None,
            "is_all_day": True,
            "academic_year_id": academic_year_id,
            "term_id": current_term_id,
            "class_ids": [],
            "branch_id": None,
            "color": color,
            "source_type": "manual",
            "source_id": None,
            "auto_generated": False,
            "visibility_roles": ["admin", "principal", "teacher", "parent", "student"],
            "target_audience": "all",
            "send_notifications": True,
            "is_public": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "system",
            "metadata": {}
        }
        events.append(event)
    
    # 4. Create meeting events
    print("  Creating meeting events...")
    meetings = [
        ("Staff Meeting", 2, "#00BCD4", "staff"),
        ("PTA Meeting", 8, "#00BCD4", "parents"),
        ("Board Meeting", 14, "#00BCD4", "board"),
    ]
    
    for meeting_name, days_ahead, color, audience in meetings:
        start_date = today + timedelta(days=days_ahead, hours=14)  # 2 PM
        event = {
            "_id": ObjectId(),
            "title": meeting_name,
            "description": f"Scheduled meeting: {meeting_name}",
            "event_type": "meeting",
            "start_date": start_date,
            "end_date": start_date + timedelta(hours=2),  # 2-hour meeting
            "is_all_day": False,
            "academic_year_id": academic_year_id,
            "term_id": current_term_id,
            "class_ids": [],
            "branch_id": None,
            "color": color,
            "source_type": "manual",
            "source_id": None,
            "auto_generated": False,
            "visibility_roles": ["admin", "principal"] + (["teacher"] if audience == "staff" else []) + (["parent"] if audience == "parents" else []),
            "target_audience": audience,
            "send_notifications": True,
            "is_public": False,
            "created_at": datetime.now(),
            "updated_at": datetime.now(),
            "created_by": "system",
            "metadata": {"meeting_type": audience}
        }
        events.append(event)
    
    # Insert all events
    if events:
        result = await events_coll.insert_many(events)
        print(f"\n✅ Successfully created {len(result.inserted_ids)} calendar events!")
    
    # Verify the setup
    total_events = await events_coll.count_documents({})
    upcoming_events = await events_coll.count_documents({
        "start_date": {
            "$gte": today,
            "$lte": today + timedelta(days=30)
        }
    })
    
    print(f"\nCalendar Status:")
    print(f"  - Total events in database: {total_events}")
    print(f"  - Upcoming events (next 30 days): {upcoming_events}")
    
    # Display sample upcoming events
    print("\nSample Upcoming Events:")
    cursor = events_coll.find({
        "start_date": {"$gte": today}
    }).sort("start_date", 1).limit(10)
    
    async for event in cursor:
        event_date = event.get('start_date', 'No date')
        if isinstance(event_date, datetime):
            event_date = event_date.strftime("%Y-%m-%d %H:%M")
        print(f"  📅 {event.get('title', 'Untitled')} - {event_date}")
    
    print("\n" + "=" * 50)
    print("✅ Academic calendar setup complete!")
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(setup_academic_calendar())