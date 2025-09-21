"""
Branch-aware academic_calendar router
Ensures data isolation per branch
"""
from typing import List, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from bson import ObjectId
from datetime import datetime

from ..db import get_db
from ..utils.rbac import get_current_user
from ..utils.branch_context import BranchContext, get_branch_filter, ensure_branch_compatibility
from ..models.user import User

router = APIRouter()

@router.get("/")
async def list_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """List items with branch isolation"""
    collection = db["academic_calendar"]
    
    # Build filter query with branch isolation
    filter_query = BranchContext.add_branch_filter(
        {}, 
        branch_context["branch_id"], 
        branch_context["user"]
    )
    
    # Add search if provided
    if search:
        search_regex = {"$regex": search, "$options": "i"}
        # Add appropriate search fields based on collection
        filter_query["$or"] = [
            {"name": search_regex},
            # Add more search fields as needed
        ]
    
    # Get total count
    total_count = await collection.count_documents(filter_query)
    
    # Get paginated results
    skip = (page - 1) * limit
    cursor = collection.find(filter_query).skip(skip).limit(limit).sort("created_at", -1)
    
    items = []
    async for item in cursor:
        item_data = {
            "id": str(item["_id"]),
            **{k: v for k, v in item.items() if k != "_id"}
        }
        items.append(item_data)
    
    total_pages = (total_count + limit - 1) // limit
    
    return {
        "items": items,
        "total_count": total_count,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "branch_id": branch_context["branch_id"],
        "branch_filtered": True
    }

@router.get("/{item_id}")
async def get_item(
    item_id: str,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Get single item with branch isolation"""
    collection = db["academic_calendar"]
    
    # Build filter with branch isolation
    filter_query = BranchContext.add_branch_filter(
        {"_id": ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id},
        branch_context["branch_id"],
        branch_context["user"]
    )
    
    item = await collection.find_one(filter_query)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or not accessible"
        )
    
    return {
        "id": str(item["_id"]),
        **{k: v for k, v in item.items() if k != "_id"}
    }

@router.post("/")
async def create_item(
    item_data: dict,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Create item with branch isolation"""
    collection = db["academic_calendar"]
    
    # Ensure branch compatibility
    item_data = await ensure_branch_compatibility(item_data, branch_context)
    
    # Add timestamps
    now = datetime.utcnow()
    item_data["created_at"] = now
    item_data["updated_at"] = now
    
    try:
        result = await collection.insert_one(item_data)
        return {
            "id": str(result.inserted_id),
            **item_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error creating item: {str(e)}"
        )

@router.put("/{item_id}")
async def update_item(
    item_id: str,
    update_data: dict,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Update item with branch isolation"""
    collection = db["academic_calendar"]
    
    # Find existing item with branch filter
    filter_query = BranchContext.add_branch_filter(
        {"_id": ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id},
        branch_context["branch_id"],
        branch_context["user"]
    )
    
    existing_item = await collection.find_one(filter_query)
    if not existing_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or not accessible"
        )
    
    # Ensure branch compatibility
    update_data = await ensure_branch_compatibility(update_data, branch_context)
    update_data["updated_at"] = datetime.utcnow()
    
    await collection.update_one(filter_query, {"$set": update_data})
    
    # Return updated item
    updated_item = await collection.find_one(filter_query)
    return {
        "id": str(updated_item["_id"]),
        **{k: v for k, v in updated_item.items() if k != "_id"}
    }

@router.delete("/{item_id}")
async def delete_item(
    item_id: str,
    branch_context: dict = Depends(get_branch_filter()),
    db = Depends(get_db)
):
    """Delete item with branch isolation"""
    collection = db["academic_calendar"]
    
    # Find existing item with branch filter
    filter_query = BranchContext.add_branch_filter(
        {"_id": ObjectId(item_id) if ObjectId.is_valid(item_id) else item_id},
        branch_context["branch_id"],
        branch_context["user"]
    )
    
    existing_item = await collection.find_one(filter_query)
    if not existing_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found or not accessible"
        )
    
    # Only superadmins can hard delete, others do soft delete
    if branch_context["user"].get("role") != "superadmin":
        # Soft delete
        await collection.update_one(
            filter_query,
            {"$set": {"status": "inactive", "updated_at": datetime.utcnow()}}
        )
        return {"message": "Item deactivated successfully"}
    else:
        # Hard delete
        await collection.delete_one(filter_query)
        return {"message": "Item deleted successfully"}
