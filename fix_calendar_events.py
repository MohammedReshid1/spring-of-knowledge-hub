#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from bson import ObjectId

async def fix_calendar_events():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017/")
    db = client["spring_knowledge_hub"]
    
    print("=" * 50)
    print("FIXING CALENDAR EVENTS")
    print("=" * 50)
    
    # Get collections
    events_coll = db["academic_events"]
    academic_years_coll = db["academic_years"]
    
    # Get current academic year
    current_year = await academic_years_coll.find_one({"is_current": True})
    if not current_year:
        print("No current academic year found!")
        return
    
    academic_year_id = str(current_year["_id"])
    print(f"Current academic year: {current_year.get('name', 'Unknown')}")
    
    # Find events with null academic_year_id
    events_with_null = await events_coll.count_documents({"academic_year_id": None})
    print(f"Events with null academic_year_id: {events_with_null}")
    
    if events_with_null > 0:
        # Update events with null academic_year_id
        result = await events_coll.update_many(
            {"academic_year_id": None},
            {"$set": {"academic_year_id": academic_year_id}}
        )
        print(f"✅ Updated {result.modified_count} events with academic_year_id")
    
    # Check for events with null term_id and set them to current term if available
    terms_coll = db["terms"]
    current_term = await terms_coll.find_one({
        "academic_year_id": academic_year_id,
        "is_current": True
    })
    
    if current_term:
        term_id = str(current_term["_id"])
        events_with_null_term = await events_coll.count_documents({"term_id": None})
        print(f"Events with null term_id: {events_with_null_term}")
        
        if events_with_null_term > 0:
            result = await events_coll.update_many(
                {"term_id": None},
                {"$set": {"term_id": term_id}}
            )
            print(f"✅ Updated {result.modified_count} events with term_id")
    
    # Verify the fixes
    total_events = await events_coll.count_documents({})
    valid_events = await events_coll.count_documents({"academic_year_id": {"$ne": None}})
    
    print(f"\nFinal status:")
    print(f"  - Total events: {total_events}")
    print(f"  - Valid events (with academic_year_id): {valid_events}")
    print(f"  - Invalid events: {total_events - valid_events}")
    
    if total_events == valid_events:
        print("✅ All events are now valid!")
    else:
        print("⚠️  Some events still have issues")
    
    print("=" * 50)

if __name__ == "__main__":
    asyncio.run(fix_calendar_events())