#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta
from bson import ObjectId

async def check_calendar_data():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017/")
    db = client["spring_knowledge_hub"]
    
    print("=" * 50)
    print("CHECKING CALENDAR DATA")
    print("=" * 50)
    
    # 1. Check academic events collection
    events_coll = db["academic_events"]
    
    # Count total events
    total_events = await events_coll.count_documents({})
    print(f"\nTotal academic events in database: {total_events}")
    
    # Count events in next 30 days
    today = datetime.now()
    next_30_days = today + timedelta(days=30)
    
    upcoming_events = await events_coll.count_documents({
        "start_date": {
            "$gte": today,
            "$lte": next_30_days
        }
    })
    print(f"Upcoming events (next 30 days): {upcoming_events}")
    
    # Count events by type
    event_types = await events_coll.distinct("event_type")
    print(f"\nEvent types found: {event_types}")
    
    for event_type in event_types:
        count = await events_coll.count_documents({"event_type": event_type})
        print(f"  - {event_type}: {count} events")
    
    # Get sample upcoming events
    print("\n--- Sample Upcoming Events ---")
    cursor = events_coll.find({
        "start_date": {"$gte": today}
    }).sort("start_date", 1).limit(5)
    
    async for event in cursor:
        print(f"  - {event.get('title', 'Untitled')}")
        print(f"    Type: {event.get('event_type', 'unknown')}")
        print(f"    Date: {event.get('start_date', 'No date')}")
        print(f"    Auto-generated: {event.get('auto_generated', False)}")
        print()
    
    # Check for auto-generated exam events
    exam_events = await events_coll.count_documents({
        "event_type": "exam",
        "auto_generated": True
    })
    print(f"Auto-generated exam events: {exam_events}")
    
    # Check current month stats
    start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
    
    current_month_events = await events_coll.count_documents({
        "start_date": {
            "$gte": start_of_month,
            "$lte": end_of_month
        }
    })
    print(f"\nEvents this month: {current_month_events}")
    
    # Check if there are any future events at all
    future_events = await events_coll.count_documents({
        "start_date": {"$gte": today}
    })
    print(f"Total future events: {future_events}")
    
    # Check for events without dates
    no_date_events = await events_coll.count_documents({
        "start_date": {"$exists": False}
    })
    print(f"Events without start_date: {no_date_events}")
    
    print("\n" + "=" * 50)

if __name__ == "__main__":
    asyncio.run(check_calendar_data())