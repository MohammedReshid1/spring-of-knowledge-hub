from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import Any, List
from bson import ObjectId
from datetime import datetime

from ..db import get_user_collection, validate_branch_id
from ..models.user import UserCreate, UserUpdate, User
from ..utils.auth import get_password_hash, verify_password, create_access_token, decode_access_token
from ..utils.rbac import (
    get_current_user as rbac_get_current_user, 
    require_permission, 
    require_min_role_level,
    Permission, 
    Role,
    RBACError,
    can_access_role,
    is_admin_role,
    has_permission
)

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/login")

async def get_current_user_legacy(token: str = Depends(oauth2_scheme), users: Any = Depends(get_user_collection)):
    """Legacy get current user function for backward compatibility."""
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication credentials")
    
    user_id = payload["sub"]
    # Try to find user by ObjectId first, then by string ID
    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    return User(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "student"),
        phone=user.get("phone"),
        branch_id=user.get("branch_id"),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
    )

@router.post("/signup", response_model=User)
async def signup(
    user_in: UserCreate, 
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(rbac_get_current_user)
):
    """Create a new user account. Requires CREATE_USER permission."""
    # Check if user has permission to create users
    if not has_permission(current_user.get('role'), Permission.CREATE_USER):
        raise RBACError("Insufficient permissions to create users")
    
    # Check if current user can create the requested role
    if not can_access_role(current_user.get('role'), user_in.role):
        raise RBACError(f"Cannot create user with role '{user_in.role}'")
    
    existing = await users.find_one({"email": user_in.email})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    # Prepare user document
    now = datetime.utcnow()
    data = user_in.dict()
    
    # Validate branch_id if provided
    if data.get("branch_id") is not None:
        await validate_branch_id(data["branch_id"])
    
    # For branch-level admins, restrict to their branch
    if current_user.get('role') in [Role.BRANCH_ADMIN, Role.REGISTRAR]:
        if current_user.get('branch_id'):
            data["branch_id"] = current_user.get('branch_id')
    
    pwd = data.pop("password")
    data["password_hash"] = get_password_hash(pwd)
    data["created_at"] = now
    data["updated_at"] = now
    
    result = await users.insert_one(data)
    user = await users.find_one({"_id": result.inserted_id})
    
    return User(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "student"),
        phone=user.get("phone"),
        branch_id=user.get("branch_id"),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
    )

@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), users: Any = Depends(get_user_collection)):
    """User login endpoint."""
    user = await users.find_one({"email": form_data.username})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    # Support multiple password field names for compatibility
    password_field = user.get("hashed_password") or user.get("password_hash") or user.get("password", "")
    
    if not password_field:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    if not verify_password(form_data.password, password_field):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password")
    
    # Create access token with user information
    access_token = create_access_token(data={
        "sub": str(user["_id"]),
        "email": user["email"],
        "role": user.get("role", "student"),
        "branch_id": user.get("branch_id"),
        "full_name": user.get("full_name", "")
    })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user.get("full_name"),
            "role": user.get("role"),
            "phone": user.get("phone"),
            "branch_id": user.get("branch_id"),
        }
    }

@router.get("/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user_legacy)):
    """Get current user information."""
    return current_user

@router.get("/", response_model=List[User])
async def get_users(
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(rbac_get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """Get all users. Requires READ_USER permission."""
    if not has_permission(current_user.get('role'), Permission.READ_USER):
        raise RBACError("Insufficient permissions to view users")
    
    # Filter by branch for branch-level users
    query = {}
    if current_user.get('role') in [Role.BRANCH_ADMIN, Role.REGISTRAR]:
        if current_user.get('branch_id'):
            query["branch_id"] = current_user.get('branch_id')
    
    cursor = users.find(query).skip(skip).limit(limit)
    user_list = []
    async for user in cursor:
        user_list.append(User(
            id=str(user["_id"]),
            email=user["email"],
            full_name=user.get("full_name"),
            role=user.get("role"),
            phone=user.get("phone"),
            branch_id=user.get("branch_id"),
            created_at=user.get("created_at"),
            updated_at=user.get("updated_at"),
        ))
    
    return user_list

@router.get("/{user_id}", response_model=User)
async def get_user(
    user_id: str,
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(rbac_get_current_user)
):
    """Get a specific user by ID. Requires READ_USER permission."""
    if not has_permission(current_user.get('role'), Permission.READ_USER):
        raise RBACError("Insufficient permissions to view user details")
    
    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check branch access for branch-level users
    if current_user.get('role') in [Role.BRANCH_ADMIN, Role.REGISTRAR]:
        if current_user.get('branch_id') and user.get('branch_id') != current_user.get('branch_id'):
            raise RBACError("Cannot access user from different branch")
    
    return User(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "student"),
        phone=user.get("phone"),
        branch_id=user.get("branch_id"),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
    )

@router.put("/{user_id}", response_model=User)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(rbac_get_current_user)
):
    """Update a user. Requires UPDATE_USER permission."""
    if not has_permission(current_user.get('role'), Permission.UPDATE_USER):
        raise RBACError("Insufficient permissions to update users")
    
    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check if current user can modify this user's role
    if user_update.role and not can_access_role(current_user.get('role'), user_update.role):
        raise RBACError(f"Cannot assign role '{user_update.role}'")
    
    # Check branch access for branch-level users
    if current_user.get('role') in [Role.BRANCH_ADMIN, Role.REGISTRAR]:
        if current_user.get('branch_id') and user.get('branch_id') != current_user.get('branch_id'):
            raise RBACError("Cannot modify user from different branch")
    
    update_data = user_update.dict(exclude_unset=True)
    if update_data:
        if user_update.password:
            update_data["password_hash"] = get_password_hash(user_update.password)
            update_data.pop("password", None)
        
        # Validate branch_id if being updated
        if "branch_id" in update_data and update_data["branch_id"]:
            await validate_branch_id(update_data["branch_id"])
        
        update_data["updated_at"] = datetime.utcnow()
        await users.update_one({"_id": user["_id"]}, {"$set": update_data})
        
        # Fetch updated user
        updated_user = await users.find_one({"_id": user["_id"]})
        return User(
            id=str(updated_user["_id"]),
            email=updated_user["email"],
            full_name=updated_user.get("full_name"),
            role=updated_user.get("role"),
            phone=updated_user.get("phone"),
            branch_id=updated_user.get("branch_id"),
            created_at=updated_user.get("created_at"),
            updated_at=updated_user.get("updated_at"),
        )
    
    return User(
        id=str(user["_id"]),
        email=user["email"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "student"),
        phone=user.get("phone"),
        branch_id=user.get("branch_id"),
        created_at=user.get("created_at", datetime.utcnow()),
        updated_at=user.get("updated_at", datetime.utcnow()),
    )

@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(rbac_get_current_user)
):
    """Delete a user. Requires DELETE_USER permission."""
    if not has_permission(current_user.get('role'), Permission.DELETE_USER):
        raise RBACError("Insufficient permissions to delete users")
    
    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Prevent self-deletion
    if str(user["_id"]) == current_user.get('user_id'):
        raise RBACError("Cannot delete your own account")
    
    # Check if current user can delete this user
    if not can_access_role(current_user.get('role'), user.get('role')):
        raise RBACError(f"Cannot delete user with role '{user.get('role')}'")
    
    # Check branch access for branch-level users
    if current_user.get('role') in [Role.BRANCH_ADMIN]:
        if current_user.get('branch_id') and user.get('branch_id') != current_user.get('branch_id'):
            raise RBACError("Cannot delete user from different branch")
    
    await users.delete_one({"_id": user["_id"]})
    return {"message": "User deleted successfully"}

@router.get("/roles/available")
async def get_available_roles(current_user: dict = Depends(rbac_get_current_user)):
    """Get roles that the current user can assign."""
    user_role = current_user.get('role')
    available_roles = []
    
    # Define role assignment permissions
    if user_role == Role.SUPER_ADMIN:
        available_roles = [role.value for role in Role]
    elif user_role == Role.HQ_ADMIN:
        available_roles = [
            Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.HQ_REGISTRAR, 
            Role.REGISTRAR, Role.ADMIN, Role.TEACHER, Role.STUDENT, Role.PARENT
        ]
    elif user_role in [Role.BRANCH_ADMIN, Role.ADMIN]:
        available_roles = [
            Role.REGISTRAR, Role.TEACHER, Role.STUDENT, Role.PARENT
        ]
    elif user_role in [Role.HQ_REGISTRAR, Role.REGISTRAR]:
        available_roles = [Role.STUDENT, Role.PARENT]
    
    return {"available_roles": available_roles}

@router.post("/change-password")
async def change_password(
    current_password: str,
    new_password: str,
    users: Any = Depends(get_user_collection),
    current_user: dict = Depends(rbac_get_current_user)
):
    """Change current user's password."""
    user_id = current_user.get('user_id')
    
    try:
        user = await users.find_one({"_id": ObjectId(user_id)})
    except:
        user = await users.find_one({"_id": user_id})
    
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Verify current password
    if not verify_password(current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect current password")
    
    # Update password
    new_password_hash = get_password_hash(new_password)
    await users.update_one(
        {"_id": user["_id"]}, 
        {"$set": {"password_hash": new_password_hash, "updated_at": datetime.utcnow()}}
    )
    
    return {"message": "Password changed successfully"}

@router.get("/me/permissions")
async def get_user_permissions(current_user: dict = Depends(rbac_get_current_user)):
    """Get current user's permissions."""
    from ..utils.rbac import ROLE_PERMISSIONS
    
    user_role = current_user.get('role')
    
    # Handle legacy "superadmin" role format
    if user_role == "superadmin":
        user_role = "super_admin"
    
    try:
        role_enum = Role(user_role)
        permissions = ROLE_PERMISSIONS.get(role_enum, set())
        permission_list = [perm.value for perm in permissions]
        
        return {
            "permissions": permission_list,
            "role": user_role,
            "user_id": current_user.get('user_id'),
            "branch_id": current_user.get('branch_id')
        }
    except ValueError:
        return {
            "permissions": [],
            "role": user_role,
            "user_id": current_user.get('user_id'),
            "branch_id": current_user.get('branch_id')
        }

@router.get("/me/permissions/check")
async def check_user_permission(
    permission: str,
    current_user: dict = Depends(rbac_get_current_user)
):
    """Check if current user has a specific permission."""
    user_role = current_user.get('role')
    
    try:
        permission_enum = Permission(permission)
        has_perm = has_permission(user_role, permission_enum)
        
        return {
            "hasPermission": has_perm,
            "permission": permission,
            "role": user_role
        }
    except ValueError:
        return {
            "hasPermission": False,
            "permission": permission,
            "role": user_role
        }