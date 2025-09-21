#!/usr/bin/env python3
"""
Quick script to check financial data in MongoDB for debugging branch filtering
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

async def check_financial_data():
    # Connect to MongoDB
    mongodb_url = os.getenv('DATABASE_URL', 'mongodb://localhost:27017')
    client = AsyncIOMotorClient(mongodb_url)
    db = client['school_management_db']
    
    # Check payment collections
    payment_collections = ['registration_payments', 'fees']
    
    print("🔍 Financial Data Analysis:")
    print("=" * 50)
    
    for collection_name in payment_collections:
        collection = db[collection_name]
        
        # Get total count
        total_count = await collection.count_documents({})
        print(f"\n{collection_name.upper()}:")
        print(f"  Total records: {total_count}")
        
        if total_count > 0:
            # Get sample documents to see structure
            sample_docs = await collection.find({}).limit(3).to_list(length=3)
            print(f"  Sample records:")
            for i, doc in enumerate(sample_docs, 1):
                branch_id = doc.get('branch_id', 'NO BRANCH_ID')
                amount = doc.get('amount_paid', doc.get('total_amount', doc.get('amount', 0)))
                student_id = doc.get('student_id', 'NO STUDENT_ID')
                print(f"    {i}. branch_id: {branch_id}, amount: {amount}, student_id: {student_id}")
            
            # Count by branch
            pipeline = [
                {"$group": {"_id": "$branch_id", "count": {"$sum": 1}, "total_amount": {"$sum": {"$ifNull": [{"$max": ["$amount_paid", "$total_amount", "$amount"]}, 0]}}}},
                {"$sort": {"count": -1}}
            ]
            branch_summary = await collection.aggregate(pipeline).to_list(length=None)
            print(f"  By branch:")
            for branch in branch_summary:
                branch_id = branch['_id'] or 'NULL'
                count = branch['count']
                total = branch['total_amount']
                print(f"    Branch {branch_id}: {count} records, ${total:.2f} total")
    
    # Check student collection for branch distribution
    students = db['students']
    student_count = await students.count_documents({})
    print(f"\nSTUDENTS:")
    print(f"  Total students: {student_count}")
    
    if student_count > 0:
        pipeline = [
            {"$group": {"_id": "$branch_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}}
        ]
        student_branch_summary = await students.aggregate(pipeline).to_list(length=None)
        print(f"  By branch:")
        for branch in student_branch_summary:
            branch_id = branch['_id'] or 'NULL'
            count = branch['count']
            print(f"    Branch {branch_id}: {count} students")
    
    await client.close()

if __name__ == "__main__":
    asyncio.run(check_financial_data())