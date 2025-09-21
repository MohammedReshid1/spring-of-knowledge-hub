from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from datetime import datetime
from decimal import Decimal

from ..models.fee_category import (
    FeeCategory,
    FeeCategoryCreate,
    FeeCategoryUpdate,
    FeeCategoryBulkCreate
)
from ..db import (
    get_fee_categories_collection,
    validate_branch_id,
    validate_grade_level_id
)
from ..utils.rbac import get_current_user, has_permission, Permission

router = APIRouter()

@router.post("/", response_model=FeeCategory, status_code=status.HTTP_201_CREATED)
async def create_fee_category(
    category: FeeCategoryCreate,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Create a new fee category"""
    if not has_permission(current_user.get("role"), Permission.CREATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Validate branch_id
    await validate_branch_id(category.branch_id)

    # Validate grade_level_id if provided
    if category.grade_level_id:
        await validate_grade_level_id(category.grade_level_id)

    # Check for duplicate fee category name in the same branch
    existing = await collection.find_one({
        "name": category.name,
        "branch_id": category.branch_id,
        "is_active": True
    })

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Fee category '{category.name}' already exists in this branch"
        )

    # Prepare document
    doc = category.dict()
    doc["created_at"] = datetime.now()
    doc["created_by"] = current_user.get("user_id") or current_user.get("id")

    # Convert Decimal to string for MongoDB
    if "amount" in doc:
        doc["amount"] = str(doc["amount"])
    if "late_fee_percentage" in doc:
        doc["late_fee_percentage"] = str(doc["late_fee_percentage"]) if doc["late_fee_percentage"] else None
    if "tax_percentage" in doc:
        doc["tax_percentage"] = str(doc["tax_percentage"]) if doc["tax_percentage"] else None

    # Insert document
    result = await collection.insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    return FeeCategory(**doc)

@router.post("/bulk", response_model=List[FeeCategory], status_code=status.HTTP_201_CREATED)
async def create_fee_categories_bulk(
    bulk_data: FeeCategoryBulkCreate,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Create multiple fee categories at once"""
    if not has_permission(current_user.get("role"), Permission.CREATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Validate branch_id
    await validate_branch_id(bulk_data.branch_id)

    created_categories = []

    for category_data in bulk_data.categories:
        # Set branch_id for each category
        category_data.branch_id = bulk_data.branch_id

        # Check for duplicate
        existing = await collection.find_one({
            "name": category_data.name,
            "branch_id": bulk_data.branch_id,
            "is_active": True
        })

        if existing:
            continue  # Skip duplicates

        # Prepare document
        doc = category_data.dict()
        doc["created_at"] = datetime.now()
        doc["created_by"] = current_user["id"]

        # Convert Decimal to string
        if "amount" in doc:
            doc["amount"] = str(doc["amount"])
        if "late_fee_percentage" in doc:
            doc["late_fee_percentage"] = str(doc["late_fee_percentage"]) if doc["late_fee_percentage"] else None
        if "tax_percentage" in doc:
            doc["tax_percentage"] = str(doc["tax_percentage"]) if doc["tax_percentage"] else None

        # Insert document
        result = await collection.insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        created_categories.append(FeeCategory(**doc))

    return created_categories

@router.get("/", response_model=List[FeeCategory])
async def get_fee_categories(
    branch_id: str = Query(..., description="Branch ID to filter by"),
    grade_level_id: Optional[str] = Query(None, description="Filter by grade level"),
    fee_type: Optional[str] = Query(None, description="Filter by fee type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status (True/False). If omitted, returns all."),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Get fee categories with filters"""
    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Build query
    query = {"branch_id": branch_id}

    if grade_level_id:
        query["grade_level_id"] = grade_level_id

    if fee_type:
        query["fee_type"] = fee_type

    if is_active is not None:
        query["is_active"] = is_active

    # Execute query
    cursor = collection.find(query).skip(skip).limit(limit).sort("priority", 1)
    categories = []

    async for doc in cursor:
        doc["_id"] = str(doc["_id"])
        categories.append(FeeCategory(**doc))

    return categories

@router.get("/{category_id}", response_model=FeeCategory)
async def get_fee_category(
    category_id: str,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Get a specific fee category by ID"""
    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID"
        )

    doc = await collection.find_one({"_id": ObjectId(category_id)})

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee category not found"
        )

    doc["_id"] = str(doc["_id"])
    return FeeCategory(**doc)

@router.put("/{category_id}", response_model=FeeCategory)
async def update_fee_category(
    category_id: str,
    update_data: FeeCategoryUpdate,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Update a fee category"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID"
        )

    # Check if category exists
    existing = await collection.find_one({"_id": ObjectId(category_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee category not found"
        )

    # Prepare update document
    update_doc = {k: v for k, v in update_data.dict().items() if v is not None}

    if update_doc:
        # Convert Decimal to string
        if "amount" in update_doc:
            update_doc["amount"] = str(update_doc["amount"])
        if "late_fee_percentage" in update_doc:
            update_doc["late_fee_percentage"] = str(update_doc["late_fee_percentage"])
        if "tax_percentage" in update_doc:
            update_doc["tax_percentage"] = str(update_doc["tax_percentage"])

        update_doc["updated_at"] = datetime.now()
        update_doc["updated_by"] = current_user.get("user_id") or current_user.get("id")

        # Update document
        await collection.update_one(
            {"_id": ObjectId(category_id)},
            {"$set": update_doc}
        )

    # Return updated document
    doc = await collection.find_one({"_id": ObjectId(category_id)})
    doc["_id"] = str(doc["_id"])
    return FeeCategory(**doc)

@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_fee_category(
    category_id: str,
    permanent: bool = Query(False, description="Permanently delete instead of soft delete"),
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Delete a fee category (soft delete by default)"""
    if not has_permission(current_user.get("role"), Permission.DELETE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID"
        )

    # Check if category exists
    existing = await collection.find_one({"_id": ObjectId(category_id)})
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee category not found"
        )

    if permanent:
        # Hard delete
        await collection.delete_one({"_id": ObjectId(category_id)})
    else:
        # Soft delete - set is_active to False
        await collection.update_one(
            {"_id": ObjectId(category_id)},
            {
                "$set": {
                    "is_active": False,
                    "updated_at": datetime.now(),
                    "updated_by": current_user["id"]
                }
            }
        )

    return None

@router.post("/{category_id}/activate", response_model=FeeCategory)
async def activate_fee_category(
    category_id: str,
    current_user: dict = Depends(get_current_user),
    collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Reactivate a deactivated fee category"""
    if not has_permission(current_user.get("role"), Permission.UPDATE_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not ObjectId.is_valid(category_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid category ID"
        )

    # Update document
    result = await collection.update_one(
        {"_id": ObjectId(category_id)},
        {
            "$set": {
                "is_active": True,
                "updated_at": datetime.now(),
                "updated_by": current_user.get("user_id") or current_user.get("id")
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fee category not found"
        )

    # Return updated document
    doc = await collection.find_one({"_id": ObjectId(category_id)})
    doc["_id"] = str(doc["_id"])
    return FeeCategory(**doc)
