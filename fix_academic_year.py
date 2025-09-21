#!/usr/bin/env python3
"""
Fix academic year name field
"""
import os
import sys
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_academic_year():
    """Fix academic year name field"""
    print("🔧 Fixing Academic Year Name Field")
    print("=" * 40)
    
    # Connect to database
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "spring_of_knowledge_hub")
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    academic_years = db["academic_years"]
    
    # Find academic year with null name
    academic_year = await academic_years.find_one({"name": None})
    if academic_year:
        print(f"Found academic year with null name: {academic_year['_id']}")
        
        # Create a name based on dates
        start_date = academic_year.get("start_date")
        end_date = academic_year.get("end_date")
        
        if start_date and end_date:
            start_year = start_date.year
            end_year = end_date.year
            name = f"{start_year}-{end_year}"
            
            # Update the record
            await academic_years.update_one(
                {"_id": academic_year["_id"]},
                {"$set": {"name": name}}
            )
            print(f"✅ Updated academic year name to: {name}")
        else:
            # Fallback name
            name = "2024-2025"
            await academic_years.update_one(
                {"_id": academic_year["_id"]},
                {"$set": {"name": name}}
            )
            print(f"✅ Updated academic year name to: {name} (fallback)")
    else:
        print("ℹ️  No academic year with null name found")
    
    # List all academic years
    print("\nAll Academic Years:")
    async for ay in academic_years.find():
        print(f"  - {ay.get('name', 'NO NAME')} ({ay.get('start_date')} to {ay.get('end_date')}) - Current: {ay.get('is_current', False)}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_academic_year())