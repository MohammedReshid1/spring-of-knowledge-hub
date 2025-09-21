import asyncio
from app.db import get_db
from app.utils.auth import get_password_hash
from bson import ObjectId

async def create_admin():
    db = get_db()
    users = db['users']
    
    # Check if admin exists
    admin = await users.find_one({"email": "admin@gmail.com"})
    
    if admin:
        print(f"Admin user exists: {admin.get('email')} (role: {admin.get('role')})")
        # Update password and role
        hashed_password = get_password_hash("admin123")
        result = await users.update_one(
            {"email": "admin@gmail.com"},
            {"$set": {"hashed_password": hashed_password, "role": "super_admin"}}
        )
        print(f"Password updated: {result.modified_count} document(s) modified")
    else:
        print("Creating new admin user...")
        hashed_password = get_password_hash("admin123")
        admin_data = {
            "email": "admin@gmail.com",
            "hashed_password": hashed_password,
            "full_name": "Admin User",
            "role": "super_admin",
            "phone": "",
            "branch_id": "",
            "created_at": "2024-01-01T00:00:00Z",
            "updated_at": "2024-01-01T00:00:00Z"
        }
        result = await users.insert_one(admin_data)
        print(f"Admin user created with ID: {result.inserted_id}")
    
    print("Admin user ready: admin@gmail.com / admin123")

if __name__ == "__main__":
    asyncio.run(create_admin()) 