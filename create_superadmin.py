#!/usr/bin/env python3
"""
Create a superadmin user for the Spring of Knowledge Hub
"""
import asyncio
import sys
import os
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.db import get_db
from backend.app.utils.auth import get_password_hash

async def create_superadmin():
    """Create or update superadmin user"""
    db = get_db()
    users = db['users']
    
    # Superadmin credentials
    email = "superadmin@springofknowledge.com"
    password = "SuperAdmin123!"
    
    # Check if superadmin exists
    existing = await users.find_one({"email": email})
    
    if existing:
        print(f"✅ Superadmin already exists: {email}")
        # Update to ensure it has superadmin role
        hashed_password = get_password_hash(password)
        result = await users.update_one(
            {"email": email},
            {"$set": {
                "hashed_password": hashed_password,
                "role": "super_admin",
                "updated_at": datetime.utcnow().isoformat()
            }}
        )
        print(f"🔄 Updated superadmin role and password")
    else:
        print("Creating new superadmin user...")
        hashed_password = get_password_hash(password)
        superadmin_data = {
            "email": email,
            "hashed_password": hashed_password,
            "full_name": "Super Administrator",
            "role": "super_admin",
            "phone": "+1-555-0100",
            "branch_id": None,  # Super admin has no branch restriction
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        result = await users.insert_one(superadmin_data)
        print(f"✅ Superadmin user created with ID: {result.inserted_id}")
    
    # Also ensure regular admin exists
    admin_email = "admin@gmail.com"
    admin_exists = await users.find_one({"email": admin_email})
    
    if not admin_exists:
        admin_password = "admin123"
        admin_hashed = get_password_hash(admin_password)
        admin_data = {
            "email": admin_email,
            "hashed_password": admin_hashed,
            "full_name": "Administrator",
            "role": "admin",
            "phone": "+1-555-0101",
            "branch_id": "main_branch_001",
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        await users.insert_one(admin_data)
        print(f"✅ Admin user also created: {admin_email} / {admin_password}")
    
    print("\n" + "="*60)
    print("🔐 LOGIN CREDENTIALS")
    print("="*60)
    print("\n📌 SUPERADMIN (Full System Access):")
    print(f"   Email: {email}")
    print(f"   Password: {password}")
    print("\n📌 ADMIN (Branch Level Access):")
    print(f"   Email: admin@gmail.com")
    print(f"   Password: admin123")
    print("\n✨ You can now login with these credentials!")
    print("="*60)

if __name__ == "__main__":
    asyncio.run(create_superadmin())