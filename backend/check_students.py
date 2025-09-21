import asyncio
from app.db import get_db

async def check_students():
    db = get_db()
    coll = db["students"]
    
    # Get total count
    total_count = await coll.count_documents({})
    print(f"Total students in database: {total_count}")
    
    # Check first few students
    cursor = coll.find().limit(5)
    async for s in cursor:
        print(f"Student: {s.get('first_name', 'Unknown')} - Branch: {s.get('branch_id', 'None')} - Status: {s.get('status', 'Unknown')}")
    
    # Check branch distribution
    pipeline = [
        {"$group": {"_id": "$branch_id", "count": {"$sum": 1}}}
    ]
    branch_dist = await coll.aggregate(pipeline).to_list(None)
    print(f"\nBranch distribution:")
    for item in branch_dist:
        print(f"  Branch {item['_id']}: {item['count']} students")
    
    # Check status distribution
    pipeline = [
        {"$group": {"_id": "$status", "count": {"$sum": 1}}}
    ]
    status_dist = await coll.aggregate(pipeline).to_list(None)
    print(f"\nStatus distribution:")
    for item in status_dist:
        print(f"  Status {item['_id']}: {item['count']} students")

if __name__ == "__main__":
    asyncio.run(check_students()) 