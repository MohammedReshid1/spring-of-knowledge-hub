from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from ..db import get_branch_collection
from ..models.branch import BranchCreate, Branch
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=Branch)
async def create_branch(
    branch_in: BranchCreate,
    branches: Any = Depends(get_branch_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    doc = branch_in.dict()
    doc["created_at"] = now
    doc["updated_at"] = now
    result = await branches.insert_one(doc)
    return Branch(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[Branch])
async def list_branches(
    branches: Any = Depends(get_branch_collection),
    current_user: User = Depends(get_current_user),
):
    cursor = branches.find()
    items: List[Branch] = []
    async for b in cursor:
        items.append(Branch(
            id=str(b["_id"]),
            name=b["name"],
            address=b.get("address"),
            contact_info=b.get("contact_info"),
            logo_url=b.get("logo_url"),
            is_active=b.get("is_active", True),
            created_at=b.get("created_at"),
            updated_at=b.get("updated_at"),
        ))
    return items

@router.get("/{branch_id}", response_model=Branch)
async def get_branch(
    branch_id: str,
    branches: Any = Depends(get_branch_collection),
    current_user: User = Depends(get_current_user),
):
    b = await branches.find_one({"_id": ObjectId(branch_id)})
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    return Branch(
        id=branch_id,
        name=b["name"],
        address=b.get("address"),
        contact_info=b.get("contact_info"),
        logo_url=b.get("logo_url"),
        is_active=b.get("is_active", True),
        created_at=b.get("created_at"),
        updated_at=b.get("updated_at"),
    )

@router.put("/{branch_id}", response_model=Branch)
async def update_branch(
    branch_id: str,
    branch_in: BranchCreate,
    branches: Any = Depends(get_branch_collection),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    update_data = branch_in.dict()
    update_data["updated_at"] = now
    res = await branches.update_one({"_id": ObjectId(branch_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
    b = await branches.find_one({"_id": ObjectId(branch_id)})
    return Branch(
        id=branch_id,
        name=b["name"],
        address=b.get("address"),
        contact_info=b.get("contact_info"),
        logo_url=b.get("logo_url"),
        is_active=b.get("is_active", True),
        created_at=b.get("created_at"),
        updated_at=b.get("updated_at"),
    )

@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: str,
    branches: Any = Depends(get_branch_collection),
    current_user: User = Depends(get_current_user),
):
    result = await branches.delete_one({"_id": ObjectId(branch_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Branch not found")
