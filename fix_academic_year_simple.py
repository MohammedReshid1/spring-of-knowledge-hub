#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os

async def fix_academic_year():
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "spring_of_knowledge_hub")
    
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    # Update the specific academic year
    result = await db.academic_years.update_one(
        {"_id": ObjectId("68b7228dde204aee12628c50")},
        {"$set": {"name": "2024-2025"}}
    )
    
    print(f"Updated {result.modified_count} document(s)")
    
    # Verify
    doc = await db.academic_years.find_one({"_id": ObjectId("68b7228dde204aee12628c50")})
    if doc:
        print(f"Academic year name is now: {doc.get('name')}")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_academic_year())