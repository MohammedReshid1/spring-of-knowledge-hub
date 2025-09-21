#!/usr/bin/env python3
"""
Find all unique values for specific fields in the payments collection
"""

import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def find_unique_values():
    """Find unique values for payment fields that are causing validation errors"""

    MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client.spring_of_knowledge

    try:
        payments_collection = db.payments

        # Find unique payment methods
        print("🔍 Unique payment methods:")
        print("=" * 30)
        payment_methods = await payments_collection.distinct("payment_method")
        for method in sorted(payment_methods):
            print(f"  - {method}")

        # Find unique statuses
        print(f"\n🔍 Unique payment statuses:")
        print("=" * 30)
        statuses = await payments_collection.distinct("status")
        for status in sorted(statuses):
            print(f"  - {status}")

        # Find unique categories
        print(f"\n🔍 Unique payment categories:")
        print("=" * 30)
        categories = await payments_collection.distinct("category")
        for category in sorted(categories):
            print(f"  - {category}")

        # Find unique currencies
        print(f"\n🔍 Unique currencies:")
        print("=" * 30)
        currencies = await payments_collection.distinct("currency")
        for currency in sorted(currencies):
            print(f"  - {currency}")

        print(f"\n💡 Updated Literal values for payment models:")
        print("=" * 50)
        print(f"payment_method: {payment_methods}")
        print(f"status: {statuses}")
        print(f"category: {categories}")
        print(f"currency: {currencies}")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(find_unique_values())