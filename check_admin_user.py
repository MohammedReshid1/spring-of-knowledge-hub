#!/usr/bin/env python3
"""
Check if admin user exists in database
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

async def check_admin_user():
    """Check if admin user exists"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Using database: {DATABASE_NAME}")
    
    # Check for admin user
    admin_user = await db.users.find_one({"email": "admin@school.edu"})
    if admin_user:
        print("✅ Admin user found:")
        print(f"   Email: {admin_user['email']}")
        print(f"   Full Name: {admin_user.get('full_name', 'N/A')}")
        print(f"   Role: {admin_user.get('role', 'N/A')}")
        print(f"   Has Password: {'Yes' if admin_user.get('hashed_password') else 'No'}")
        print(f"   Is Active: {admin_user.get('is_active', 'N/A')}")
    else:
        print("❌ Admin user not found")
        
        # List all users
        print("\n📋 All users in database:")
        async for user in db.users.find():
            print(f"   - {user.get('email', 'N/A')} (Role: {user.get('role', 'N/A')})")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(check_admin_user()) 