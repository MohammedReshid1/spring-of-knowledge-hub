#!/usr/bin/env python3
"""
Create test admin user for API testing
"""
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DATABASE_NAME = "spring_of_knowledge"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_test_admin():
    """Create test admin user"""
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DATABASE_NAME]
    
    print(f"🔗 Connected to MongoDB at {MONGODB_URI}")
    print(f"📊 Using database: {DATABASE_NAME}")
    
    # Check if test admin already exists
    test_admin = await db.users.find_one({"email": "testadmin@school.com"})
    if test_admin:
        print("✅ Test admin already exists")
        print(f"   Email: testadmin@school.com")
        print(f"   Password: testpassword123")
        client.close()
        return
    
    # Create test admin user
    hashed_password = pwd_context.hash("testpassword123")
    
    admin_user = {
        "email": "testadmin@school.com",
        "hashed_password": hashed_password,
        "full_name": "Test Administrator",
        "role": "super_admin",
        "is_active": True,
        "branch_id": "687a956f94db7613aaf3ff77"  # Using existing branch
    }
    
    result = await db.users.insert_one(admin_user)
    print(f"✅ Created test admin user:")
    print(f"   Email: testadmin@school.com")
    print(f"   Password: testpassword123")
    print(f"   Role: super_admin")
    print(f"   User ID: {result.inserted_id}")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(create_test_admin())