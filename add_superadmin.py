#!/usr/bin/env python3
"""
Script to add a superadmin user to the MongoDB database
"""

import asyncio
import sys
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt

# Database configuration
MONGODB_URI = "mongodb://localhost:27017"
DATABASE_NAME = "spring_of_knowledge"

async def add_superadmin_user():
    """Add a superadmin user to the database"""

    # User details
    email = "swifteasesolutions@gmail.com"
    password = "superadmin"
    full_name = "Mohammed Reshid"
    role = "superadmin"

    print(f"🔧 Connecting to MongoDB at {MONGODB_URI}...")

    try:
        # Connect to MongoDB
        client = AsyncIOMotorClient(MONGODB_URI)
        db = client[DATABASE_NAME]

        print(f"✅ Connected to database: {DATABASE_NAME}")

        # Check if user already exists
        existing_user = await db.users.find_one({"email": email})
        if existing_user:
            print(f"⚠️  User {email} already exists!")
            print("Updating existing user...")

            # Hash the password
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)

            # Update the user
            update_result = await db.users.update_one(
                {"email": email},
                {
                    "$set": {
                        "password": hashed_password,
                        "full_name": full_name,
                        "role": role,
                        "is_active": True,
                        "is_verified": True,
                        "updated_at": datetime.utcnow()
                    }
                }
            )

            if update_result.modified_count > 0:
                print(f"✅ User {email} updated successfully")
            else:
                print(f"❌ Failed to update user {email}")
        else:
            print(f"📝 Creating new user: {email}")

            # Hash the password
            salt = bcrypt.gensalt()
            hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt)

            # Create user document
            user_doc = {
                "email": email,
                "password": hashed_password,
                "full_name": full_name,
                "role": role,
                "is_active": True,
                "is_verified": True,
                "branch_id": None,  # Superadmin can access all branches
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "last_login": None,
                "profile_picture": None,
                "phone_number": None
            }

            # Insert the user
            result = await db.users.insert_one(user_doc)

            if result.inserted_id:
                print(f"✅ User {email} created successfully with ID: {result.inserted_id}")
            else:
                print(f"❌ Failed to create user {email}")
                return

        # Verify the user was created/updated
        user_check = await db.users.find_one({"email": email})
        if user_check:
            print(f"✅ Verification successful - User found in database:")
            print(f"   Email: {user_check.get('email')}")
            print(f"   Role: {user_check.get('role')}")
            print(f"   Full Name: {user_check.get('full_name')}")
            print(f"   Active: {user_check.get('is_active')}")
            print(f"   Verified: {user_check.get('is_verified')}")
        else:
            print(f"❌ Verification failed - User not found in database")

        # Close connection
        client.close()
        print("🔌 Database connection closed")

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    print("🚀 Starting superadmin user creation script...")
    print("=" * 50)
    asyncio.run(add_superadmin_user())
    print("=" * 50)
    print("🎉 Script completed!")