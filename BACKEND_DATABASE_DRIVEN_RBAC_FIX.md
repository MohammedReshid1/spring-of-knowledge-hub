# 🚨 CRITICAL: Backend RBAC - Implement Database-Driven Permission System

## 🔍 Problem

The backend is returning **empty permissions and roles** for all users:

```json
{
  "user_id": "68e62acb5e3b493c50a9079b",
  "roles": [],           // ❌ EMPTY
  "permissions": [],     // ❌ EMPTY
}
```

**Impact**: Users cannot access ANY pages because they have zero permissions.

---

## 🎯 Required Solution: Database-Driven Permissions

Fetch permissions from the database based on user roles. This is the **production-ready, scalable approach**.

---

## 📋 Implementation Steps

### Step 1: Verify Database Schema

Ensure you have these collections with proper structure:

#### Collection: `roles`
```json
{
  "_id": ObjectId("..."),
  "name": "branch_admin",
  "display_name": "Branch Administrator",
  "description": "Branch-level administrator with full branch management access",
  "permissions": [
    ObjectId("perm1"),
    ObjectId("perm2"),
    ObjectId("perm3"),
    // ... or permission name strings
  ],
  "inherits_from": [],
  "is_system": true,
  "is_active": true,
  "priority": 50,
  "branch_specific": true,
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

#### Collection: `permissions`
```json
{
  "_id": ObjectId("..."),
  "name": "student.read",
  "resource": "student",
  "action": "read",
  "description": "View student information",
  "is_active": true,
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

#### Collection: `users`
```json
{
  "_id": ObjectId("..."),
  "email": "admin@gmail.com",
  "full_name": "Admin",
  "role": "branch_admin",  // Role name as string
  "branch_id": "68dc6f68d29733e270cadd37",
  "password_hash": "...",
  "is_active": true,
  "created_at": ISODate("..."),
  "updated_at": ISODate("...")
}
```

---

### Step 2: Implement `get_user_permissions` Function

Create a function to fetch permissions from database:

```python
from typing import List
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
import logging

logger = logging.getLogger(__name__)


async def get_user_permissions(
    user_id: str,
    role: str,
    branch_id: str = None,
    db: AsyncIOMotorDatabase = None
) -> List[str]:
    """
    Fetch all permissions for a user based on their role from database.

    Args:
        user_id: User's ID
        role: User's role name (e.g., "branch_admin", "teacher")
        branch_id: User's branch ID (for branch-specific roles)
        db: Database instance

    Returns:
        List of permission strings (e.g., ["student.read", "class.create", ...])
    """
    try:
        if not db:
            logger.error("Database instance not provided")
            return []

        # Step 1: Fetch role document from database
        role_doc = await db.roles.find_one({"name": role, "is_active": True})

        if not role_doc:
            logger.warning(f"Role not found or inactive: {role}")
            return []

        # Step 2: Get permission references from role
        permission_refs = role_doc.get("permissions", [])

        if not permission_refs:
            logger.warning(f"No permissions assigned to role: {role}")
            return []

        # Step 3: Determine if permissions are stored as ObjectIds or strings
        permission_names = []

        # Check if first permission is an ObjectId or string
        if permission_refs and isinstance(permission_refs[0], ObjectId):
            # Permissions stored as ObjectId references
            # Fetch permission documents
            permissions = await db.permissions.find({
                "_id": {"$in": permission_refs},
                "is_active": True
            }).to_list(length=None)

            # Extract permission names
            permission_names = [
                perm.get("name")
                for perm in permissions
                if perm.get("name")
            ]

        elif permission_refs and isinstance(permission_refs[0], str):
            # Permissions stored as string names directly
            permission_names = permission_refs

        else:
            logger.warning(f"Unknown permission reference format for role: {role}")
            return []

        # Step 4: Handle role inheritance (if needed)
        inherited_roles = role_doc.get("inherits_from", [])
        if inherited_roles:
            for inherited_role_name in inherited_roles:
                inherited_perms = await get_user_permissions(
                    user_id=user_id,
                    role=inherited_role_name,
                    branch_id=branch_id,
                    db=db
                )
                permission_names.extend(inherited_perms)

        # Step 5: Remove duplicates and return
        unique_permissions = list(set(permission_names))

        logger.info(f"Fetched {len(unique_permissions)} permissions for role '{role}'")

        return unique_permissions

    except Exception as e:
        logger.error(f"Error fetching permissions for role {role}: {e}")
        logger.exception(e)
        return []
```

---

### Step 3: Update `/auth/me` Endpoint

```python
from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime

router = APIRouter()


@router.get("/auth/me")
async def get_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current authenticated user with their permissions.

    Returns:
        User information including permissions array
    """
    try:
        # Fetch user's permissions from database
        user_permissions = await get_user_permissions(
            user_id=str(current_user.id),
            role=current_user.role,
            branch_id=current_user.branch_id,
            db=db
        )

        return {
            "id": str(current_user.id),
            "user_id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "role": current_user.role,
            "branch_id": current_user.branch_id,
            "phone": getattr(current_user, "phone", None),
            "permissions": user_permissions,  # ✅ ADD THIS
            "created_at": current_user.created_at.isoformat() if hasattr(current_user, "created_at") and current_user.created_at else None,
            "updated_at": current_user.updated_at.isoformat() if hasattr(current_user, "updated_at") and current_user.updated_at else None,
        }

    except Exception as e:
        logger.error(f"Error in /auth/me endpoint: {e}")
        raise HTTPException(status_code=500, detail="Error fetching user information")
```

---

### Step 4: Update `/rbac/me/permissions` Endpoint

```python
@router.get("/rbac/me/permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """
    Get current user's permissions and roles.

    Returns:
        User permissions, roles, and metadata
    """
    try:
        # Fetch permissions
        permissions = await get_user_permissions(
            user_id=str(current_user.id),
            role=current_user.role,
            branch_id=current_user.branch_id,
            db=db
        )

        # Fetch role details
        role_doc = await db.roles.find_one({"name": current_user.role})

        role_details = None
        if role_doc:
            role_details = {
                "name": role_doc.get("name"),
                "display_name": role_doc.get("display_name", current_user.role.replace("_", " ").title()),
                "branch_specific": role_doc.get("branch_specific", False),
                "branch_id": current_user.branch_id if role_doc.get("branch_specific") else None,
            }
        else:
            # Fallback if role not in database
            role_details = {
                "name": current_user.role,
                "display_name": current_user.role.replace("_", " ").title(),
                "branch_specific": current_user.branch_id is not None,
                "branch_id": current_user.branch_id,
            }

        return {
            "user_id": str(current_user.id),
            "roles": [role_details],
            "permissions": permissions,
            "branch_id": current_user.branch_id,
            "cached": True,
            "computed_at": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error in /rbac/me/permissions endpoint: {e}")
        raise HTTPException(status_code=500, detail="Error fetching permissions")
```

---

### Step 5: Ensure Database Has Roles and Permissions Populated

**CRITICAL**: Make sure your database has roles and permissions configured.

#### Option A: Check if data exists
```python
# Run this script to check database
async def check_rbac_data():
    # Check roles
    roles_count = await db.roles.count_documents({})
    print(f"Roles in database: {roles_count}")

    # Check permissions
    perms_count = await db.permissions.count_documents({})
    print(f"Permissions in database: {perms_count}")

    # Check branch_admin role
    branch_admin = await db.roles.find_one({"name": "branch_admin"})
    if branch_admin:
        print(f"branch_admin role exists with {len(branch_admin.get('permissions', []))} permissions")
    else:
        print("⚠️ WARNING: branch_admin role NOT FOUND")
```

#### Option B: If data is missing, you need to populate it

Create a script to seed initial roles and permissions:

```python
async def seed_roles_and_permissions(db: AsyncIOMotorDatabase):
    """
    Seed database with initial roles and permissions.
    Run this ONCE to populate the database.
    """

    # Create permissions first
    permissions_data = [
        # Student permissions
        {"name": "student.create", "resource": "student", "action": "create", "description": "Create students", "is_active": True},
        {"name": "student.read", "resource": "student", "action": "read", "description": "View students", "is_active": True},
        {"name": "student.update", "resource": "student", "action": "update", "description": "Update students", "is_active": True},
        {"name": "student.delete", "resource": "student", "action": "delete", "description": "Delete students", "is_active": True},
        {"name": "student.manage", "resource": "student", "action": "manage", "description": "Manage all student operations", "is_active": True},

        # Class permissions
        {"name": "class.create", "resource": "class", "action": "create", "description": "Create classes", "is_active": True},
        {"name": "class.read", "resource": "class", "action": "read", "description": "View classes", "is_active": True},
        {"name": "class.update", "resource": "class", "action": "update", "description": "Update classes", "is_active": True},
        {"name": "class.delete", "resource": "class", "action": "delete", "description": "Delete classes", "is_active": True},
        {"name": "class.manage", "resource": "class", "action": "manage", "description": "Manage all class operations", "is_active": True},

        # Teacher permissions
        {"name": "teacher.create", "resource": "teacher", "action": "create", "description": "Create teachers", "is_active": True},
        {"name": "teacher.read", "resource": "teacher", "action": "read", "description": "View teachers", "is_active": True},
        {"name": "teacher.update", "resource": "teacher", "action": "update", "description": "Update teachers", "is_active": True},
        {"name": "teacher.delete", "resource": "teacher", "action": "delete", "description": "Delete teachers", "is_active": True},
        {"name": "teacher.manage", "resource": "teacher", "action": "manage", "description": "Manage all teacher operations", "is_active": True},

        # ... Add all other permissions (attendance, payment, grade, etc.)
        # You should have 100+ permissions total covering all resources
    ]

    # Insert permissions and get their IDs
    result = await db.permissions.insert_many(permissions_data)
    permission_ids = result.inserted_ids

    # Create permission name to ID mapping
    perm_map = {}
    for i, perm_data in enumerate(permissions_data):
        perm_map[perm_data["name"]] = permission_ids[i]

    # Create roles with permission references
    roles_data = [
        {
            "name": "branch_admin",
            "display_name": "Branch Administrator",
            "description": "Full branch management access",
            "permissions": [
                # Use ObjectId references
                perm_map.get("student.manage"),
                perm_map.get("teacher.manage"),
                perm_map.get("class.manage"),
                perm_map.get("attendance.manage"),
                perm_map.get("payment.manage"),
                perm_map.get("grade.manage"),
                # ... add all branch_admin permissions
            ],
            "inherits_from": [],
            "is_system": True,
            "is_active": True,
            "priority": 50,
            "branch_specific": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        },
        # ... Add other roles (superadmin, teacher, student, etc.)
    ]

    # Remove None values from permissions
    for role in roles_data:
        role["permissions"] = [p for p in role["permissions"] if p is not None]

    # Insert roles
    await db.roles.insert_many(roles_data)

    print("✅ Roles and permissions seeded successfully!")
```

---

## 🧪 Testing the Fix

### Test 1: Verify Database Has Data

```python
# Check if roles exist
db.roles.find().pretty()

# Check if permissions exist
db.permissions.find().limit(10).pretty()

# Check branch_admin role specifically
db.roles.find_one({"name": "branch_admin"})
```

### Test 2: Test `/auth/me` Endpoint

```bash
# Login to get token
curl -X POST https://school.dablietech.club/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin@gmail.com", "password": "your_password"}'

# Test /auth/me
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://school.dablietech.club/auth/me

# ✅ Expected response should include:
{
  "id": "...",
  "email": "admin@gmail.com",
  "role": "branch_admin",
  "permissions": [
    "student.create",
    "student.read",
    "student.update",
    "class.read",
    "class.create",
    ... (50+ permissions)
  ]
}
```

### Test 3: Test `/rbac/me/permissions` Endpoint

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://school.dablietech.club/rbac/me/permissions

# ✅ Expected response:
{
  "user_id": "...",
  "roles": [{
    "name": "branch_admin",
    "display_name": "Branch Administrator",
    "branch_specific": true,
    "branch_id": "..."
  }],
  "permissions": [
    "student.create",
    "student.read",
    ... (50+ permissions)
  ]
}
```

---

## 📋 Implementation Checklist

### Required Tasks:

- [ ] **1. Verify database collections exist** (`roles`, `permissions`, `users`)
- [ ] **2. Check if roles and permissions are populated in database**
  - If empty: Run seed script to populate
  - If exists: Verify `branch_admin` role has permissions
- [ ] **3. Implement `get_user_permissions()` function**
- [ ] **4. Update `/auth/me` endpoint** to call `get_user_permissions()`
- [ ] **5. Update `/rbac/me/permissions` endpoint** to call `get_user_permissions()`
- [ ] **6. Add error logging** for debugging
- [ ] **7. Test with branch_admin user**
- [ ] **8. Test with other roles** (teacher, student, superadmin)
- [ ] **9. Monitor logs** for any errors
- [ ] **10. Verify frontend receives permissions** and works

---

## 🎯 Expected Results

After implementing this fix:

1. ✅ Database-driven permission system
2. ✅ All roles get proper permissions from database
3. ✅ Frontend automatically works (no frontend changes needed)
4. ✅ Users can access pages based on their role permissions
5. ✅ Scalable and maintainable (add/remove permissions via database)

---

## ⚠️ Important Notes

1. **Database must be populated** with roles and permissions first
2. **Use ObjectId references** for cleaner database structure
3. **Add indexes** on `roles.name` and `permissions.name` for performance
4. **Cache permissions** for better performance (optional, future enhancement)
5. **Log all permission fetches** for debugging

---

## 🚀 Priority

**CRITICAL - P0 - BLOCKING PRODUCTION**

All users are blocked from accessing the application because no permissions are being returned.

---

## 💡 Next Steps After This Fix

Once this is working, consider:

1. Adding permission caching (Redis/in-memory)
2. Adding permission inheritance for complex role hierarchies
3. Adding user-specific permission overrides
4. Adding audit logging for permission changes
5. Adding API endpoints for role/permission management UI

---

## ✨ Summary

**What to do:**
1. Verify database has roles and permissions
2. If empty, run seed script
3. Implement `get_user_permissions()` function
4. Update `/auth/me` and `/rbac/me/permissions` endpoints
5. Test and verify

**Timeline:** Fix ASAP - this is blocking production

**Frontend status:** ✅ Ready and waiting for permissions!

Once deployed, the frontend will immediately start working! 🎉
