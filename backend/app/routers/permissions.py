from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from pydantic import BaseModel

from ..utils.rbac import (
    get_current_user,
    has_permission,
    Permission,
    Role,
    ROLE_PERMISSIONS,
    ROLE_HIERARCHY
)

router = APIRouter()

class PermissionCheckRequest(BaseModel):
    permission: str
    resource_id: str = None

class PermissionCheckResponse(BaseModel):
    has_permission: bool
    role: str
    normalized_role: str
    permissions: List[str]
    reason: str

class UserPermissionsResponse(BaseModel):
    role: str
    normalized_role: str
    permissions: List[str]
    role_hierarchy_level: int
    branch_access: str

@router.post("/check", response_model=PermissionCheckResponse)
async def check_permission(
    request: PermissionCheckRequest,
    current_user: dict = Depends(get_current_user)
):
    """Check if current user has a specific permission."""
    user_role = current_user.get('role')
    
    # Normalize role format
    normalized_role = 'super_admin' if user_role == 'superadmin' else user_role
    
    # Check permission
    try:
        permission_enum = Permission(request.permission)
        has_perm = has_permission(user_role, permission_enum)
    except ValueError:
        # Invalid permission name
        has_perm = False
        permission_enum = None
    
    # Get all user permissions
    role_enum = Role(normalized_role) if normalized_role else None
    user_permissions = []
    
    if role_enum and role_enum in ROLE_PERMISSIONS:
        user_permissions = [p.value for p in ROLE_PERMISSIONS[role_enum]]
    
    # Determine reason
    if has_perm:
        reason = f"Role '{normalized_role}' has explicit permission '{request.permission}'"
    else:
        reason = f"Role '{normalized_role}' lacks permission '{request.permission}'"
    
    return PermissionCheckResponse(
        has_permission=has_perm,
        role=user_role,
        normalized_role=normalized_role,
        permissions=user_permissions,
        reason=reason
    )

@router.get("/me", response_model=UserPermissionsResponse)
async def get_user_permissions(
    current_user: dict = Depends(get_current_user)
):
    """Get all permissions for the current user."""
    user_role = current_user.get('role')
    
    # Normalize role format
    normalized_role = 'super_admin' if user_role == 'superadmin' else user_role
    
    # Get role enum
    try:
        role_enum = Role(normalized_role)
    except ValueError:
        # Invalid role, return empty permissions
        return UserPermissionsResponse(
            role=user_role,
            normalized_role=normalized_role,
            permissions=[],
            role_hierarchy_level=0,
            branch_access='none'
        )
    
    # Get permissions
    permissions = []
    if role_enum in ROLE_PERMISSIONS:
        permissions = [p.value for p in ROLE_PERMISSIONS[role_enum]]
    
    # Get hierarchy level
    hierarchy_level = ROLE_HIERARCHY.get(role_enum, 0)
    
    # Determine branch access
    if normalized_role in ['super_admin', 'hq_admin', 'hq_registrar']:
        branch_access = 'all'
    elif current_user.get('branch_id'):
        branch_access = 'restricted'
    else:
        branch_access = 'none'
    
    return UserPermissionsResponse(
        role=user_role,
        normalized_role=normalized_role,
        permissions=permissions,
        role_hierarchy_level=hierarchy_level,
        branch_access=branch_access
    )

@router.get("/list")
async def list_all_permissions(
    current_user: dict = Depends(get_current_user)
):
    """List all available permissions in the system. Admin only."""
    user_role = current_user.get('role')
    normalized_role = 'super_admin' if user_role == 'superadmin' else user_role
    
    # Check if user is admin
    if normalized_role not in ['super_admin', 'hq_admin', 'branch_admin']:
        raise HTTPException(status_code=403, detail="Only admins can view all permissions")
    
    # Get all permissions
    all_permissions = {}
    for role in Role:
        if role in ROLE_PERMISSIONS:
            all_permissions[role.value] = [p.value for p in ROLE_PERMISSIONS[role]]
    
    return {
        "permissions": [p.value for p in Permission],
        "role_permissions": all_permissions,
        "role_hierarchy": {r.value: level for r, level in ROLE_HIERARCHY.items()}
    }