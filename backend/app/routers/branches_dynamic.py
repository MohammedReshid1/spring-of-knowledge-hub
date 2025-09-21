"""
Dynamic Branch Management Router
Allows superadmin to create/delete branches and manage branch lifecycle
"""
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from bson import ObjectId
from datetime import datetime
from passlib.context import CryptContext

from ..db import get_db, get_branch_collection
from ..models.branch import Branch, BranchCreate, BranchUpdate
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def require_superadmin(current_user: dict):
    """Ensure user is superadmin"""
    if current_user.get("role") != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can manage branches"
        )

# Note: Automatic defaults removed - branches now start empty
# Grade levels and subjects must be manually created by branch admin

async def create_branch_admin(db, branch_id: str, branch_name: str, branch_code: str):
    """Create a default admin user for the new branch"""
    
    # Generate admin email
    safe_name = branch_name.lower().replace(' ', '').replace('-', '')[:20]
    admin_email = f"admin@{safe_name}.edu"
    
    # Create admin user
    admin_user = {
        "_id": ObjectId(),
        "email": admin_email,
        "hashed_password": pwd_context.hash("admin123"),
        "full_name": f"{branch_name} Administrator",
        "role": "admin",
        "phone": f"+1-555-{hash(branch_id) % 9000 + 1000}",
        "branch_id": branch_id,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "is_active": True,
        "all_branches_access": False
    }
    
    await db.users.insert_one(admin_user)
    return admin_email

async def delete_branch_data(db, branch_id: str):
    """Delete all data associated with a branch"""
    
    collections_to_clean = [
        "users", "students", "teachers", "classes", "subjects", "grade_levels",
        "fees", "attendance", "exams", "exam_results", "assets", "supplies",
        "notifications", "incidents", "disciplinary_actions", "behavior_points",
        "academic_events", "messages", "announcements"
    ]
    
    deleted_counts = {}
    
    for collection_name in collections_to_clean:
        result = await db[collection_name].delete_many({"branch_id": branch_id})
        deleted_counts[collection_name] = result.deleted_count
    
    return deleted_counts

@router.post("/", response_model=dict)
async def create_branch(
    branch_in: BranchCreate,
    background_tasks: BackgroundTasks,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new branch (superadmin only)"""
    require_superadmin(current_user)
    
    # Check if branch with same name or code already exists
    existing = await db.branches.find_one({
        "$or": [
            {"name": branch_in.name},
            {"code": branch_in.code} if hasattr(branch_in, 'code') and branch_in.code else {}
        ]
    })
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Branch with this name or code already exists"
        )
    
    # Create branch
    branch_data = branch_in.dict()
    branch_id = ObjectId()
    branch_data["_id"] = branch_id
    branch_data["created_at"] = datetime.now().isoformat()
    branch_data["updated_at"] = datetime.now().isoformat()
    branch_data["status"] = "active"
    branch_data["created_by"] = str(current_user.get("id", current_user.get("_id", "")))
    
    # Generate branch code if not provided
    if "code" not in branch_data or not branch_data["code"]:
        branch_data["code"] = branch_in.name.upper().replace(" ", "")[:10]
    
    # Insert branch
    await db.branches.insert_one(branch_data)
    
    # Create branch admin only
    branch_id_str = str(branch_id)
    
    # Create branch admin
    admin_email = await create_branch_admin(
        db, branch_id_str, branch_in.name, branch_data["code"]
    )
    
    return {
        "id": branch_id_str,
        "name": branch_in.name,
        "code": branch_data["code"],
        "status": "active",
        "created_at": branch_data["created_at"],
        "admin_email": admin_email,
        "message": "Branch created successfully. Admin can now manually add grade levels and subjects."
    }

@router.get("/", response_model=List[dict])
async def list_branches(
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all branches (superadmin sees all, others see only their branch)"""
    
    if current_user.get("role") == "superadmin":
        # Superadmin sees all branches
        branches = await db.branches.find({}).sort("created_at", -1).to_list(None)
    else:
        # Regular users only see their branch
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        
        branches = await db.branches.find({"_id": ObjectId(user_branch_id)}).to_list(None)
    
    result = []
    for branch in branches:
        # Get branch statistics
        branch_id = str(branch["_id"])
        
        # Count users, students, teachers
        users_count = await db.users.count_documents({"branch_id": branch_id})
        students_count = await db.students.count_documents({"branch_id": branch_id})
        teachers_count = await db.teachers.count_documents({"branch_id": branch_id})
        classes_count = await db.classes.count_documents({"branch_id": branch_id})
        
        branch_data = {
            "id": branch_id,
            "name": branch["name"],
            "code": branch.get("code", ""),
            "address": branch.get("address", ""),
            "phone": branch.get("phone", ""),
            "email": branch.get("email", ""),
            "status": branch.get("status", "active"),
            "established_date": branch.get("established_date"),
            "created_at": branch["created_at"],
            "updated_at": branch.get("updated_at"),
            "statistics": {
                "users": users_count,
                "students": students_count,
                "teachers": teachers_count,
                "classes": classes_count
            }
        }
        result.append(branch_data)
    
    return result

@router.get("/{branch_id}", response_model=dict)
async def get_branch(
    branch_id: str,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get branch details"""
    
    # Validate access
    if current_user.get("role") != "superadmin":
        if current_user.get("branch_id") != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    if not ObjectId.is_valid(branch_id):
        raise HTTPException(status_code=400, detail="Invalid branch ID")
    
    branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Get detailed statistics
    branch_id_str = str(branch["_id"])
    stats = {}
    
    collections = [
        "users", "students", "teachers", "classes", "subjects", 
        "grade_levels", "fees", "attendance", "exams", "assets"
    ]
    
    for collection in collections:
        stats[collection] = await db[collection].count_documents({"branch_id": branch_id_str})
    
    return {
        "id": branch_id_str,
        **{k: v for k, v in branch.items() if k != "_id"},
        "statistics": stats
    }

@router.put("/{branch_id}", response_model=dict)
async def update_branch(
    branch_id: str,
    branch_update: BranchUpdate,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update branch details"""
    
    # Validate access
    if current_user.get("role") != "superadmin":
        if current_user.get("branch_id") != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    if not ObjectId.is_valid(branch_id):
        raise HTTPException(status_code=400, detail="Invalid branch ID")
    
    existing_branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    if not existing_branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Check for name/code conflicts (excluding current branch)
    update_data = branch_update.dict(exclude_unset=True)
    if "name" in update_data or "code" in update_data:
        query_parts = []
        if "name" in update_data:
            query_parts.append({"name": update_data["name"]})
        if "code" in update_data:
            query_parts.append({"code": update_data["code"]})
        
        existing = await db.branches.find_one({
            "$and": [
                {"_id": {"$ne": ObjectId(branch_id)}},
                {"$or": query_parts}
            ]
        })
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Branch with this name or code already exists"
            )
    
    # Update branch
    update_data["updated_at"] = datetime.now().isoformat()
    await db.branches.update_one(
        {"_id": ObjectId(branch_id)}, 
        {"$set": update_data}
    )
    
    # Return updated branch
    updated_branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    return {
        "id": str(updated_branch["_id"]),
        **{k: v for k, v in updated_branch.items() if k != "_id"},
        "message": "Branch updated successfully"
    }

@router.delete("/{branch_id}")
async def delete_branch(
    branch_id: str,
    background_tasks: BackgroundTasks,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete branch and all associated data (superadmin only)"""
    require_superadmin(current_user)
    
    if not ObjectId.is_valid(branch_id):
        raise HTTPException(status_code=400, detail="Invalid branch ID")
    
    existing_branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    if not existing_branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Delete all branch data
    deleted_counts = await delete_branch_data(db, branch_id)
    
    # Delete the branch itself
    await db.branches.delete_one({"_id": ObjectId(branch_id)})
    
    return {
        "message": f"Branch '{existing_branch['name']}' deleted successfully",
        "deleted_data": deleted_counts,
        "branch_id": branch_id
    }

@router.post("/{branch_id}/reset")
async def reset_branch_data(
    branch_id: str,
    background_tasks: BackgroundTasks,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Reset branch data (keep branch but clear all associated data) - superadmin only"""
    require_superadmin(current_user)
    
    if not ObjectId.is_valid(branch_id):
        raise HTTPException(status_code=400, detail="Invalid branch ID")
    
    existing_branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    if not existing_branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Delete all branch data except the branch itself
    deleted_counts = await delete_branch_data(db, branch_id)
    
    # Recreate admin only
    admin_email = await create_branch_admin(
        db, branch_id, existing_branch["name"], existing_branch.get("code", "")
    )
    
    return {
        "message": f"Branch '{existing_branch['name']}' data reset successfully. Admin can now manually setup grade levels and subjects.",
        "deleted_data": deleted_counts,
        "recreated": {
            "admin_email": admin_email
        },
        "branch_id": branch_id
    }

@router.get("/{branch_id}/users")
async def get_branch_users(
    branch_id: str,
    db = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all users in a branch"""
    
    # Validate access
    if current_user.get("role") != "superadmin":
        if current_user.get("branch_id") != branch_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    users = await db.users.find({"branch_id": branch_id}).to_list(None)
    
    result = []
    for user in users:
        result.append({
            "id": str(user["_id"]),
            "email": user["email"],
            "full_name": user["full_name"],
            "role": user["role"],
            "phone": user.get("phone", ""),
            "is_active": user.get("is_active", True),
            "created_at": user["created_at"]
        })
    
    return {
        "branch_id": branch_id,
        "users": result,
        "total_users": len(result)
    }