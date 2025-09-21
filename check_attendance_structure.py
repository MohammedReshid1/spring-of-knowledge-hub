#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import json

async def main():
    try:
        client = AsyncIOMotorClient("mongodb://localhost:27017/")
        db = client.spring_of_knowledge
        
        attendance = db.attendance
        
        print("=== ATTENDANCE DATA ANALYSIS ===\n")
        
        count = await attendance.count_documents({})
        print(f"Total attendance records: {count}")
        
        if count > 0:
            # Get sample attendance records
            sample_records = await attendance.find({}).to_list(length=None)
            
            for i, record in enumerate(sample_records):
                print(f"Attendance Record {i+1}:")
                record['_id'] = str(record['_id'])
                print(json.dumps(record, indent=2, default=str))
                print()
        
        # Check the field structure
        if count > 0:
            sample = await attendance.find_one({})
            print(f"Available fields: {list(sample.keys())}")
            
            # Check status distribution
            pipeline = [
                {"$group": {"_id": "$status", "count": {"$sum": 1}}}
            ]
            status_dist = await attendance.aggregate(pipeline).to_list(None)
            print("\nStatus distribution:")
            for item in status_dist:
                print(f"  {item['_id']}: {item['count']} records")
    
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(main())