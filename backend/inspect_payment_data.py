#!/usr/bin/env python3
"""
Script to inspect actual payment data structure in MongoDB
"""

import asyncio
import os
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

async def inspect_payment_data():
    """Inspect the actual structure of payment documents in MongoDB"""

    # MongoDB connection
    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.spring_of_knowledge

    try:
        # Get payments collection
        payments_collection = db.payments

        # Count total payments
        total_count = await payments_collection.count_documents({})
        print(f"📊 Total payments in database: {total_count}")

        if total_count == 0:
            print("❌ No payment documents found in database")
            return

        # Get a sample payment document
        sample_payment = await payments_collection.find_one({})

        if sample_payment:
            print(f"\n📄 Sample payment document structure:")
            print("=" * 50)

            # Convert ObjectId to string for JSON serialization
            if '_id' in sample_payment:
                sample_payment['_id'] = str(sample_payment['_id'])

            # Print with proper formatting
            print(json.dumps(sample_payment, indent=2, default=str))

            print("=" * 50)
            print(f"\n🔍 Available fields in sample document:")
            for key in sorted(sample_payment.keys()):
                value_type = type(sample_payment[key]).__name__
                print(f"  - {key}: {value_type}")

        # Get field statistics across all documents
        print(f"\n📈 Field presence statistics across all {total_count} documents:")
        print("=" * 50)

        # Use aggregation to check field presence
        pipeline = [
            {
                "$project": {
                    field: {"$cond": [{"$ifNull": [f"${field}", False]}, 1, 0]}
                    for field in [
                        "receipt_no", "subtotal", "total_amount", "student_id",
                        "payment_date", "payment_method", "status", "branch_id",
                        "amount", "fee_type", "description"
                    ]
                }
            },
            {
                "$group": {
                    "_id": None,
                    **{
                        f"{field}_count": {"$sum": f"${field}"}
                        for field in [
                            "receipt_no", "subtotal", "total_amount", "student_id",
                            "payment_date", "payment_method", "status", "branch_id",
                            "amount", "fee_type", "description"
                        ]
                    }
                }
            }
        ]

        async for result in payments_collection.aggregate(pipeline):
            for field, count in sorted(result.items()):
                if field != "_id":
                    percentage = (count / total_count) * 100 if total_count > 0 else 0
                    print(f"  - {field}: {count}/{total_count} ({percentage:.1f}%)")

        # Check for common field patterns
        print(f"\n🔧 Suggested fixes:")
        print("=" * 30)

        # Check if we have amount field instead of total_amount
        amount_count = await payments_collection.count_documents({"amount": {"$exists": True}})
        if amount_count > 0:
            print(f"✅ Found 'amount' field in {amount_count} documents - can map to 'total_amount'")

        # Check if we have fee_type instead of receipt_no
        fee_type_count = await payments_collection.count_documents({"fee_type": {"$exists": True}})
        if fee_type_count > 0:
            print(f"✅ Found 'fee_type' field in {fee_type_count} documents - might need receipt_no generation")

        print(f"\n💡 Recommendations:")
        print("  1. Make 'receipt_no', 'subtotal', 'total_amount' optional in the Payment model")
        print("  2. Or map existing fields: amount -> total_amount, generate receipt_no")
        print("  3. Or create a migration script to add missing required fields")

    except Exception as e:
        print(f"❌ Error inspecting payment data: {e}")
        import traceback
        traceback.print_exc()

    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(inspect_payment_data())