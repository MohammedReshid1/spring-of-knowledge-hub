#!/usr/bin/env python3
"""
Check academic calendar collections
"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, date

async def check_academic_calendar():
    """Check academic calendar data"""
    print("🔍 Checking Academic Calendar Collections")
    print("=" * 50)
    
    # Connect to database
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "spring_of_knowledge_hub")
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    # Check all collections
    collections = await db.list_collection_names()
    print("Available collections:")
    for col in sorted(collections):
        if 'academic' in col.lower() or 'calendar' in col.lower():
            count = await db[col].count_documents({})
            print(f"  📁 {col}: {count} documents")
    
    # Check academic_years specifically
    academic_years = db["academic_years"]
    print(f"\n📊 Academic Years Collection:")
    count = await academic_years.count_documents({})
    print(f"  Total documents: {count}")
    
    if count > 0:
        print("  Documents:")
        async for doc in academic_years.find():
            print(f"    - ID: {doc['_id']}")
            print(f"      Name: {doc.get('name', 'NULL')}")
            print(f"      Start: {doc.get('start_date', 'NULL')}")
            print(f"      End: {doc.get('end_date', 'NULL')}")
            print(f"      Current: {doc.get('is_current', 'NULL')}")
            print(f"      Branch: {doc.get('branch_id', 'NULL')}")
            print()
    else:
        # Create a sample academic year
        print("  Creating sample academic year...")
        current_year = datetime.now().year
        sample_academic_year = {
            "name": f"{current_year}-{current_year + 1}",
            "start_date": date(current_year, 9, 1),
            "end_date": date(current_year + 1, 6, 30),
            "is_current": True,
            "branch_id": None,
            "description": "Academic Year",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "created_by": "system"
        }
        
        result = await academic_years.insert_one(sample_academic_year)
        print(f"    ✅ Created academic year: {sample_academic_year['name']} (ID: {result.inserted_id})")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_academic_calendar())