#!/usr/bin/env python3
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin_user():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client.spring_of_knowledge
    
    # Check if admin exists
    existing = await db.users.find_one({"username": "admin"})
    if existing:
        print("Admin user already exists")
        return
    
    # Create admin user
    admin_user = {
        "username": "admin",
        "email": "admin@springofknowledge.com",
        "password": pwd_context.hash("admin123"),
        "role": "admin",
        "is_active": True,
        "branch_id": None
    }
    
    result = await db.users.insert_one(admin_user)
    print(f"✅ Admin user created with ID: {result.inserted_id}")

if __name__ == "__main__":
    asyncio.run(create_admin_user())