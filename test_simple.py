#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

async def test_collections():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.spring_of_knowledge
    
    # Check collections
    collections = await db.list_collection_names()
    print("Existing collections:")
    for coll in collections:
        print(f"  - {coll}")
    
    # Check if required collections exist
    required = ['books', 'incidents', 'assets', 'supplies', 'borrow_records', 'digital_resources']
    missing = [r for r in required if r not in collections]
    
    if missing:
        print(f"\n⚠️ Missing collections: {missing}")
        print("Creating missing collections...")
        for coll_name in missing:
            await db.create_collection(coll_name)
            print(f"  ✅ Created collection: {coll_name}")
    else:
        print("\n✅ All required collections exist")

if __name__ == "__main__":
    asyncio.run(test_collections())