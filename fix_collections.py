#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

async def fix_all_collections():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.spring_of_knowledge
    
    # All required collections for the modules
    required_collections = [
        # Library Management
        'books', 'borrow_requests', 'borrow_records', 'library_members',
        'library_settings', 'reservations', 'digital_resources',
        
        # Discipline Management  
        'incidents', 'behavior_points', 'rewards', 'disciplinary_actions',
        'counseling_sessions', 'behavior_contracts', 'parent_meetings',
        
        # Inventory Management
        'assets', 'supplies', 'maintenance', 'inventory_requests',
        'inventory_transactions', 'vendors', 'purchase_orders'
    ]
    
    # Check existing collections
    existing = await db.list_collection_names()
    print("Existing collections:", len(existing))
    
    # Create missing collections
    created = []
    for coll_name in required_collections:
        if coll_name not in existing:
            await db.create_collection(coll_name)
            created.append(coll_name)
            print(f"✅ Created collection: {coll_name}")
    
    if created:
        print(f"\n✅ Created {len(created)} missing collections")
    else:
        print("\n✅ All required collections already exist")
    
    return len(created)

if __name__ == "__main__":
    count = asyncio.run(fix_all_collections())
    print(f"\nTotal collections created: {count}")