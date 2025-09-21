#!/usr/bin/env python3
"""
Create an admin user for testing
"""
import asyncio
from datetime import datetime
from bson import ObjectId
from app.db import get_db
from motor.motor_asyncio import AsyncIOMotorClient
from app.utils.auth import get_password_hash

async def create_admin_user():
    """Create an admin user"""

    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.school_management

    # Create admin user
    admin_user = {
        "_id": ObjectId(),
        "email": "admin@school.com",
        "password_hash": get_password_hash("admin123"),  # Hash the password properly
        "first_name": "System",
        "last_name": "Administrator",
        "role": "admin",
        "is_active": True,
        "is_superuser": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }

    # Check if user exists
    existing = await db.users.find_one({"email": "admin@school.com"})
    if existing:
        # Update existing user
        await db.users.update_one(
            {"email": "admin@school.com"},
            {"$set": {
                "password_hash": get_password_hash("admin123"),
                "role": "admin",
                "is_active": True,
                "is_superuser": True,
                "updated_at": datetime.utcnow()
            }}
        )
        print("Updated existing admin user")
    else:
        # Insert new user
        await db.users.insert_one(admin_user)
        print("Created new admin user")

    print("\nAdmin credentials:")
    print("Email: admin@school.com")
    print("Password: admin123")
    print("\nYou can now login to the system!")

if __name__ == "__main__":
    asyncio.run(create_admin_user())