from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import uuid
import logging
from pydantic import BaseModel

from ..models.inventory import (
    Asset, Supply, InventoryTransaction, MaintenanceRecord,
    InventoryRequest, PurchaseOrder, InventoryAudit, InventoryAuditItem,
    Vendor, InventorySettings, AssetCategory, AssetStatus,
    AssetCondition, SupplyUnit, MaintenanceType, MaintenanceStatus,
    RequestStatus, AssetCreate, SupplyCreate, MaintenanceRecordCreate, 
    InventoryRequestCreate, VendorCreate
)
from ..db import (
    get_assets_collection, get_supplies_collection,
    get_inventory_transactions_collection, get_maintenance_records_collection,
    get_inventory_requests_collection, get_purchase_orders_collection,
    get_inventory_audits_collection, get_inventory_audit_items_collection,
    get_vendors_collection, get_inventory_settings_collection,
    get_user_collection as get_users_collection, get_classes_collection, get_db
)
from ..utils.rbac import get_current_user, has_permission, Role, Permission, is_hq_role

router = APIRouter()
logger = logging.getLogger(__name__)


def require_auth(current_user: dict, allowed_roles: list):
    """Helper function to check user roles"""
    if not current_user or current_user.get('role') not in allowed_roles:
        raise HTTPException(status_code=403, detail="Not authorized")


def generate_inventory_code(prefix: str, number: int) -> str:
    """Generate unique inventory code"""
    return f"{prefix}-{number:06d}"


# Assets Management
@router.post("/assets", response_model=Asset)
async def create_asset(
    asset: AssetCreate,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Create a new asset"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # Determine branch for isolation
    # Priority: explicit payload branch_id (for HQ roles) -> user's branch
    payload_branch_id = getattr(asset, "branch_id", None)
    branch_id = payload_branch_id or current_user.get("branch_id")
    if not branch_id:
        # HQ roles must specify a branch explicitly when creating
        if is_hq_role(current_user.get("role")):
            raise HTTPException(status_code=400, detail="branch_id is required when creating assets as HQ user")
        # Non-HQ users must be assigned to a branch
        raise HTTPException(status_code=403, detail="User must be assigned to a branch")
    
    asset_dict = asset.dict(exclude={"id"})
    asset_dict["asset_code"] = generate_inventory_code("AST", 
        await get_next_asset_number(assets_collection))
    asset_dict["created_by"] = current_user.get("id", current_user.get("user_id", ""))
    asset_dict["branch_id"] = branch_id  # Add branch isolation
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["purchase_date", "assigned_date", "warranty_expiry", "insurance_expiry", "last_maintenance", "next_maintenance"]:
        if asset_dict.get(field):
            if isinstance(asset_dict[field], date):
                asset_dict[field] = datetime.combine(asset_dict[field], datetime.min.time())
    
    # Convert enum fields to their values for MongoDB compatibility
    if "category" in asset_dict:
        asset_dict["category"] = asset_dict["category"].value if hasattr(asset_dict["category"], "value") else asset_dict["category"]
    if "status" in asset_dict:
        asset_dict["status"] = asset_dict["status"].value if hasattr(asset_dict["status"], "value") else asset_dict["status"]
    if "condition" in asset_dict:
        asset_dict["condition"] = asset_dict["condition"].value if hasattr(asset_dict["condition"], "value") else asset_dict["condition"]
    
    result = await assets_collection.insert_one(asset_dict)
    asset_dict["id"] = str(result.inserted_id)
    
    return Asset(**asset_dict)


@router.get("/assets", response_model=List[Asset])
async def get_assets(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[AssetCategory] = None,
    status: Optional[AssetStatus] = None,
    branch_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get assets with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {}
    
    # Enforce branch isolation
    if is_hq_role(current_user.get("role")):
        # HQ roles can optionally filter by branch or see all
        if branch_id:
            filter_dict["branch_id"] = branch_id
    else:
        # Regular users see only their branch's assets
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []  # No branch = no data
        filter_dict["branch_id"] = user_branch_id
    
    if category:
        filter_dict["category"] = category
    if status:
        filter_dict["status"] = status
    if search:
        filter_dict["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"asset_code": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"brand": {"$regex": search, "$options": "i"}},
            {"model": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = assets_collection.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    assets = await cursor.to_list(length=limit)
    
    for asset in assets:
        asset["id"] = str(asset["_id"])
        del asset["_id"]
    
    return [Asset(**asset) for asset in assets]


@router.get("/assets/{asset_id}", response_model=Asset)
async def get_asset(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get asset by ID"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    asset["id"] = str(asset["_id"])
    del asset["_id"]
    
    return Asset(**asset)


@router.put("/assets/{asset_id}", response_model=Asset)
async def update_asset(
    asset_id: str,
    asset_update: AssetCreate,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Update asset"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    update_dict = asset_update.dict(exclude={"id", "asset_code", "created_by", "created_at"})
    update_dict["updated_at"] = datetime.utcnow()
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["purchase_date", "assigned_date", "warranty_expiry", "insurance_expiry", "last_maintenance", "next_maintenance"]:
        if update_dict.get(field):
            if isinstance(update_dict[field], date):
                update_dict[field] = datetime.combine(update_dict[field], datetime.min.time())
    
    # Convert enum fields to their values for MongoDB compatibility
    if "category" in update_dict:
        update_dict["category"] = update_dict["category"].value if hasattr(update_dict["category"], "value") else update_dict["category"]
    if "status" in update_dict:
        update_dict["status"] = update_dict["status"].value if hasattr(update_dict["status"], "value") else update_dict["status"]
    if "condition" in update_dict:
        update_dict["condition"] = update_dict["condition"].value if hasattr(update_dict["condition"], "value") else update_dict["condition"]
    
    result = await assets_collection.update_one(
        {"_id": ObjectId(asset_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return await get_asset(asset_id, current_user, assets_collection)


@router.delete("/assets/{asset_id}")
async def delete_asset(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Delete asset"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await assets_collection.delete_one({"_id": ObjectId(asset_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    return {"message": "Asset deleted successfully"}


# Supplies Management
@router.post("/supplies", response_model=Supply)
async def create_supply(
    supply: SupplyCreate,
    current_user: dict = Depends(get_current_user),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection)
):
    """Create a new supply item"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    supply_dict = supply.dict(exclude={"id"})
    supply_dict["supply_code"] = generate_inventory_code("SUP", 
        await get_next_supply_number(supplies_collection))
    supply_dict["created_by"] = current_user["user_id"]
    
    # Determine branch for isolation
    payload_branch_id = supply_dict.get("branch_id")
    branch_id = payload_branch_id or current_user.get("branch_id")
    if not branch_id:
        if is_hq_role(current_user.get("role")):
            raise HTTPException(status_code=400, detail="branch_id is required when creating supplies as HQ user")
        raise HTTPException(status_code=403, detail="User must be assigned to a branch")
    supply_dict["branch_id"] = branch_id
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["expiry_date", "last_counted"]:
        if supply_dict.get(field):
            if isinstance(supply_dict[field], date):
                supply_dict[field] = datetime.combine(supply_dict[field], datetime.min.time())
    
    # Convert enum fields to their values for MongoDB compatibility
    if "category" in supply_dict:
        supply_dict["category"] = supply_dict["category"].value if hasattr(supply_dict["category"], "value") else supply_dict["category"]
    if "unit" in supply_dict:
        supply_dict["unit"] = supply_dict["unit"].value if hasattr(supply_dict["unit"], "value") else supply_dict["unit"]
    
    result = await supplies_collection.insert_one(supply_dict)
    supply_dict["id"] = str(result.inserted_id)
    
    return Supply(**supply_dict)


@router.get("/supplies", response_model=List[Supply])
async def get_supplies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    category: Optional[AssetCategory] = None,
    low_stock: bool = False,
    branch_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection)
):
    """Get supplies with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {"is_active": True}
    # Enforce branch isolation similar to assets
    if is_hq_role(current_user.get("role")):
        if branch_id:
            filter_dict["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        filter_dict["branch_id"] = user_branch_id
    if category:
        filter_dict["category"] = category
    if low_stock:
        filter_dict["$expr"] = {"$lte": ["$quantity_in_stock", "$minimum_stock_level"]}
    if search:
        filter_dict["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"supply_code": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = supplies_collection.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    supplies = await cursor.to_list(length=limit)
    
    for supply in supplies:
        supply["id"] = str(supply["_id"])
        del supply["_id"]
    
    return [Supply(**supply) for supply in supplies]


@router.get("/supplies/{supply_id}", response_model=Supply)
async def get_supply(
    supply_id: str,
    current_user: dict = Depends(get_current_user),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection)
):
    """Get supply by ID"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    supply = await supplies_collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    supply["id"] = str(supply["_id"])
    del supply["_id"]
    
    return Supply(**supply)


@router.put("/supplies/{supply_id}", response_model=Supply)
async def update_supply(
    supply_id: str,
    supply_update: SupplyCreate,
    current_user: dict = Depends(get_current_user),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection)
):
    """Update supply"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    update_dict = supply_update.dict(exclude={"id", "supply_code", "created_by", "created_at"})
    update_dict["updated_at"] = datetime.utcnow()
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["expiry_date", "last_counted"]:
        if update_dict.get(field):
            if isinstance(update_dict[field], date):
                update_dict[field] = datetime.combine(update_dict[field], datetime.min.time())
    
    # Convert enum fields to their values for MongoDB compatibility
    if "category" in update_dict:
        update_dict["category"] = update_dict["category"].value if hasattr(update_dict["category"], "value") else update_dict["category"]
    if "unit" in update_dict:
        update_dict["unit"] = update_dict["unit"].value if hasattr(update_dict["unit"], "value") else update_dict["unit"]
    
    result = await supplies_collection.update_one(
        {"_id": ObjectId(supply_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    return await get_supply(supply_id, current_user, supplies_collection)


@router.delete("/supplies/{supply_id}")
async def delete_supply(
    supply_id: str,
    current_user: dict = Depends(get_current_user),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection)
):
    """Delete supply"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await supplies_collection.delete_one({"_id": ObjectId(supply_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    return {"message": "Supply deleted successfully"}


class StockUpdateRequest(BaseModel):
    quantity_change: int
    reason: str

@router.put("/supplies/{supply_id}/stock", response_model=Supply)
async def update_supply_stock(
    supply_id: str,
    stock_update: StockUpdateRequest,
    current_user: dict = Depends(get_current_user),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection),
    transactions_collection: AsyncIOMotorCollection = Depends(get_inventory_transactions_collection)
):
    """Update supply stock quantity"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # Get current supply
    supply = await supplies_collection.find_one({"_id": ObjectId(supply_id)})
    if not supply:
        raise HTTPException(status_code=404, detail="Supply not found")
    
    new_quantity = supply["quantity_in_stock"] + stock_update.quantity_change
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")
    
    # Update stock
    await supplies_collection.update_one(
        {"_id": ObjectId(supply_id)},
        {
            "$set": {
                "quantity_in_stock": new_quantity,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    # Create transaction record
    transaction = InventoryTransaction(
        transaction_code=generate_inventory_code("TXN", 
            await get_next_transaction_number(transactions_collection)),
        transaction_type="in" if stock_update.quantity_change > 0 else "out",
        item_type="supply",
        item_id=supply_id,
        item_name=supply["name"],
        quantity=abs(stock_update.quantity_change),
        reason=stock_update.reason,
        created_by=current_user["user_id"]
    )
    
    await transactions_collection.insert_one(transaction.dict(exclude={"id"}))
    
    # Return updated supply
    updated_supply = await supplies_collection.find_one({"_id": ObjectId(supply_id)})
    updated_supply["id"] = str(updated_supply["_id"])
    del updated_supply["_id"]
    
    return Supply(**updated_supply)


# Maintenance Records
@router.post("/maintenance", response_model=MaintenanceRecord)
async def create_maintenance_record(
    maintenance: MaintenanceRecordCreate,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Create a new maintenance record"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    maintenance_dict = maintenance.dict(exclude={"id"})
    maintenance_dict["maintenance_code"] = generate_inventory_code("MNT", 
        await get_next_maintenance_number(maintenance_collection))
    maintenance_dict["created_by"] = current_user["user_id"]
    
    # Get asset name for the maintenance record
    asset = await assets_collection.find_one({"_id": ObjectId(maintenance_dict["asset_id"])})
    if asset:
        maintenance_dict["asset_name"] = asset.get("name", "Unknown Asset")
        # Use explicit branch_id from request, fallback to asset's branch_id for isolation
        maintenance_dict["branch_id"] = maintenance.branch_id or asset.get("branch_id")
    else:
        maintenance_dict["asset_name"] = "Unknown Asset"
        # For HQ roles creating maintenance without valid asset, require explicit branch
        if maintenance.branch_id:
            maintenance_dict["branch_id"] = maintenance.branch_id
        elif is_hq_role(current_user.get("role")):
            raise HTTPException(status_code=400, detail="branch_id is required when creating maintenance as HQ user")
    
    # Final check for HQ roles
    if not maintenance_dict.get("branch_id") and is_hq_role(current_user.get("role")):
        raise HTTPException(status_code=400, detail="branch_id is required when creating maintenance as HQ user")
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["scheduled_date", "next_maintenance_date"]:
        if maintenance_dict.get(field):
            if isinstance(maintenance_dict[field], date):
                maintenance_dict[field] = datetime.combine(maintenance_dict[field], datetime.min.time())
    
    # Convert enum fields to their values for MongoDB compatibility
    if "maintenance_type" in maintenance_dict:
        maintenance_dict["maintenance_type"] = maintenance_dict["maintenance_type"].value if hasattr(maintenance_dict["maintenance_type"], "value") else maintenance_dict["maintenance_type"]
    if "status" in maintenance_dict:
        maintenance_dict["status"] = maintenance_dict["status"].value if hasattr(maintenance_dict["status"], "value") else maintenance_dict["status"]
    
    result = await maintenance_collection.insert_one(maintenance_dict)
    maintenance_dict["id"] = str(result.inserted_id)
    
    return MaintenanceRecord(**maintenance_dict)


@router.get("/maintenance", response_model=List[MaintenanceRecord])
async def get_maintenance_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    asset_id: Optional[str] = None,
    status: Optional[MaintenanceStatus] = None,
    maintenance_type: Optional[MaintenanceType] = None,
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection)
):
    """Get maintenance records with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {}
    # Enforce branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            filter_dict["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        filter_dict["branch_id"] = user_branch_id
    if asset_id:
        filter_dict["asset_id"] = asset_id
    if status:
        filter_dict["status"] = status
    if maintenance_type:
        filter_dict["maintenance_type"] = maintenance_type
    
    cursor = maintenance_collection.find(filter_dict).skip(skip).limit(limit).sort("scheduled_date", -1)
    records = await cursor.to_list(length=limit)
    
    for record in records:
        record["id"] = str(record["_id"])
        del record["_id"]
    
    return [MaintenanceRecord(**record) for record in records]


@router.get("/maintenance/{maintenance_id}", response_model=MaintenanceRecord)
async def get_maintenance_record(
    maintenance_id: str,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection)
):
    """Get maintenance record by ID"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    record = await maintenance_collection.find_one({"_id": ObjectId(maintenance_id)})
    if not record:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    record["id"] = str(record["_id"])
    del record["_id"]
    
    return MaintenanceRecord(**record)


@router.put("/maintenance/{maintenance_id}", response_model=MaintenanceRecord)
async def update_maintenance_record(
    maintenance_id: str,
    maintenance_update: MaintenanceRecordCreate,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection)
):
    """Update maintenance record"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    update_dict = maintenance_update.dict(exclude={"id", "maintenance_code", "created_by", "created_at"})
    update_dict["updated_at"] = datetime.utcnow()
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["scheduled_date", "next_maintenance_date"]:
        if update_dict.get(field):
            if isinstance(update_dict[field], date):
                update_dict[field] = datetime.combine(update_dict[field], datetime.min.time())
    
    # Convert enum fields to their values for MongoDB compatibility
    if "maintenance_type" in update_dict:
        update_dict["maintenance_type"] = update_dict["maintenance_type"].value if hasattr(update_dict["maintenance_type"], "value") else update_dict["maintenance_type"]
    if "status" in update_dict:
        status_value = update_dict["status"].value if hasattr(update_dict["status"], "value") else update_dict["status"]
        update_dict["status"] = status_value
        # Handle status completion
        if status_value == "completed" and not update_dict.get("completed_at"):
            update_dict["completed_at"] = datetime.utcnow()
    elif update_dict.get("status") == "completed" and not update_dict.get("completed_at"):
        update_dict["completed_at"] = datetime.utcnow()
    
    result = await maintenance_collection.update_one(
        {"_id": ObjectId(maintenance_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    return await get_maintenance_record(maintenance_id, current_user, maintenance_collection)


@router.delete("/maintenance/{maintenance_id}")
async def delete_maintenance_record(
    maintenance_id: str,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection)
):
    """Delete maintenance record"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await maintenance_collection.delete_one({"_id": ObjectId(maintenance_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    return {"message": "Maintenance record deleted successfully"}


@router.put("/maintenance/{maintenance_id}/start", response_model=MaintenanceRecord)
async def start_maintenance_work(
    maintenance_id: str,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Start maintenance work"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # Check if maintenance record exists
    maintenance = await maintenance_collection.find_one({"_id": ObjectId(maintenance_id)})
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    # Check if already started
    if maintenance.get("status") == "in_progress":
        raise HTTPException(status_code=400, detail="Maintenance work is already in progress")
    
    if maintenance.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Maintenance work is already completed")
    
    # Update maintenance record
    now = datetime.utcnow()
    update_data = {
        "status": "in_progress",
        "started_at": now,
        "updated_at": now
    }
    
    # If assigned_to is not set, assign to current user
    if not maintenance.get("assigned_to"):
        update_data["assigned_to"] = current_user["user_id"]
        update_data["assigned_to_name"] = current_user.get("full_name", current_user["email"])
    
    await maintenance_collection.update_one(
        {"_id": ObjectId(maintenance_id)},
        {"$set": update_data}
    )
    
    # Update asset status to under_maintenance
    if maintenance.get("asset_id"):
        await assets_collection.update_one(
            {"_id": ObjectId(maintenance["asset_id"])},
            {"$set": {"status": "under_maintenance", "updated_at": now}}
        )
    
    # Return updated maintenance record
    return await get_maintenance_record(maintenance_id, current_user, maintenance_collection)


@router.put("/maintenance/{maintenance_id}/complete", response_model=MaintenanceRecord)
async def complete_maintenance_work(
    maintenance_id: str,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Complete maintenance work"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # Check if maintenance record exists
    maintenance = await maintenance_collection.find_one({"_id": ObjectId(maintenance_id)})
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    # Check if already completed
    if maintenance.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Maintenance work is already completed")
    
    # Check if maintenance was started
    if maintenance.get("status") not in ["scheduled", "in_progress"]:
        raise HTTPException(status_code=400, detail="Cannot complete maintenance with current status")
    
    # Update maintenance record
    now = datetime.utcnow()
    update_data = {
        "status": "completed",
        "completed_at": now,
        "updated_at": now
    }
    
    # If not started yet, also set started_at
    if not maintenance.get("started_at"):
        update_data["started_at"] = now
    
    # If not assigned, assign to current user
    if not maintenance.get("assigned_to"):
        update_data["assigned_to"] = current_user["user_id"]
        update_data["assigned_to_name"] = current_user.get("full_name", current_user["email"])
    
    # Set performed_by to current user
    update_data["performed_by"] = current_user["user_id"]
    update_data["performed_by_name"] = current_user.get("full_name", current_user["email"])
    
    await maintenance_collection.update_one(
        {"_id": ObjectId(maintenance_id)},
        {"$set": update_data}
    )
    
    # Update asset status back to active
    if maintenance.get("asset_id"):
        await assets_collection.update_one(
            {"_id": ObjectId(maintenance["asset_id"])},
            {"$set": {"status": "active", "updated_at": now}}
        )
    
    # Return updated maintenance record
    return await get_maintenance_record(maintenance_id, current_user, maintenance_collection)


# Inventory Requests
@router.post("/requests", response_model=InventoryRequest)
async def create_inventory_request(
    request: InventoryRequestCreate,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Create a new inventory request"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    request_dict = request.dict(exclude={"id"})
    request_dict["request_code"] = generate_inventory_code("REQ", 
        await get_next_request_number(requests_collection))
    request_dict["requested_by"] = current_user["user_id"]
    request_dict["requested_by_name"] = current_user.get("full_name", current_user["email"])
    request_dict["requested_date"] = date.today()
    
    # Attach branch for isolation (InventoryRequest has branch_id field)
    branch_id = request.branch_id or current_user.get("branch_id")
    if not branch_id and is_hq_role(current_user.get("role")):
        # For HQ roles, require explicit branch selection
        raise HTTPException(status_code=400, detail="branch_id is required when creating requests as HQ user")
    if branch_id:
        request_dict["branch_id"] = branch_id
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["requested_date", "required_by_date"]:
        if request_dict.get(field):
            if isinstance(request_dict[field], date):
                request_dict[field] = datetime.combine(request_dict[field], datetime.min.time())
    
    result = await requests_collection.insert_one(request_dict)
    request_dict["id"] = str(result.inserted_id)
    
    return InventoryRequest(**request_dict)


@router.get("/requests", response_model=List[InventoryRequest])
async def get_inventory_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[RequestStatus] = None,
    request_type: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Get inventory requests with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {}
    # Enforce branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            filter_dict["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        filter_dict["branch_id"] = user_branch_id
    if status:
        filter_dict["status"] = status
    if request_type:
        filter_dict["request_type"] = request_type
    
    cursor = requests_collection.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    requests = await cursor.to_list(length=limit)
    
    for request in requests:
        request["id"] = str(request["_id"])
        del request["_id"]
    
    return [InventoryRequest(**request) for request in requests]


@router.get("/requests/{request_id}", response_model=InventoryRequest)
async def get_inventory_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Get inventory request by ID"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    request = await requests_collection.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request["id"] = str(request["_id"])
    del request["_id"]
    
    return InventoryRequest(**request)


@router.put("/requests/{request_id}", response_model=InventoryRequest)
async def update_inventory_request(
    request_id: str,
    request_update: InventoryRequestCreate,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Update inventory request"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    update_dict = request_update.dict()
    update_dict["updated_at"] = datetime.utcnow()
    
    # Convert dates to datetime for MongoDB compatibility
    for field in ["required_by_date"]:
        if update_dict.get(field):
            if isinstance(update_dict[field], date):
                update_dict[field] = datetime.combine(update_dict[field], datetime.min.time())
    
    result = await requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return await get_inventory_request(request_id, current_user, requests_collection)


@router.delete("/requests/{request_id}")
async def delete_inventory_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Delete inventory request"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await requests_collection.delete_one({"_id": ObjectId(request_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"message": "Request deleted successfully"}


@router.put("/requests/{request_id}/approve")
async def approve_inventory_request(
    request_id: str,
    approval_notes: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Approve an inventory request"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": RequestStatus.APPROVED,
                "approved_by": current_user["user_id"],
                "approved_by_name": current_user.get("full_name", current_user["email"]),
                "approved_at": datetime.utcnow(),
                "fulfillment_notes": approval_notes,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"message": "Request approved successfully"}


@router.put("/requests/{request_id}/reject")
async def reject_inventory_request(
    request_id: str,
    rejection_data: dict,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Reject an inventory request"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": RequestStatus.REJECTED,
                "rejected_by": current_user["user_id"],
                "rejected_by_name": current_user.get("full_name", current_user["email"]),
                "rejected_at": datetime.utcnow(),
                "rejection_reason": rejection_data.get("rejection_reason", "No reason provided"),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"message": "Request rejected successfully"}


@router.put("/requests/{request_id}/fulfill")
async def fulfill_inventory_request(
    request_id: str,
    current_user: dict = Depends(get_current_user),
    requests_collection: AsyncIOMotorCollection = Depends(get_inventory_requests_collection)
):
    """Mark an inventory request as fulfilled"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # First check if request exists and is approved
    request = await requests_collection.find_one({"_id": ObjectId(request_id)})
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if request["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved requests can be fulfilled")
    
    result = await requests_collection.update_one(
        {"_id": ObjectId(request_id)},
        {
            "$set": {
                "status": RequestStatus.FULFILLED,
                "fulfilled_by": current_user["user_id"],
                "fulfilled_by_name": current_user.get("full_name", current_user["email"]),
                "fulfilled_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    
    return {"message": "Request fulfilled successfully"}


# Vendors Management
@router.post("/vendors", response_model=Vendor)
async def create_vendor(
    vendor: VendorCreate,
    current_user: dict = Depends(get_current_user),
    vendors_collection: AsyncIOMotorCollection = Depends(get_vendors_collection)
):
    """Create a new vendor"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    vendor_dict = vendor.dict(exclude={"id"})
    vendor_dict["vendor_code"] = generate_inventory_code("VND", 
        await get_next_vendor_number(vendors_collection))
    vendor_dict["created_by"] = current_user["user_id"]
    
    # Convert enum lists to their values for MongoDB compatibility
    if "categories" in vendor_dict:
        vendor_dict["categories"] = [cat.value if hasattr(cat, "value") else cat for cat in vendor_dict["categories"]]
    
    result = await vendors_collection.insert_one(vendor_dict)
    vendor_dict["id"] = str(result.inserted_id)
    
    return Vendor(**vendor_dict)


@router.get("/vendors", response_model=List[Vendor])
async def get_vendors(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    is_active: bool = True,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    vendors_collection: AsyncIOMotorCollection = Depends(get_vendors_collection)
):
    """Get vendors with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {"is_active": is_active}
    if search:
        filter_dict["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"vendor_code": {"$regex": search, "$options": "i"}},
            {"contact_person": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]
    
    cursor = vendors_collection.find(filter_dict).skip(skip).limit(limit).sort("created_at", -1)
    vendors = await cursor.to_list(length=limit)
    
    for vendor in vendors:
        vendor["id"] = str(vendor["_id"])
        del vendor["_id"]
    
    return [Vendor(**vendor) for vendor in vendors]


@router.get("/vendors/{vendor_id}", response_model=Vendor)
async def get_vendor(
    vendor_id: str,
    current_user: dict = Depends(get_current_user),
    vendors_collection: AsyncIOMotorCollection = Depends(get_vendors_collection)
):
    """Get vendor by ID"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    vendor = await vendors_collection.find_one({"_id": ObjectId(vendor_id)})
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    vendor["id"] = str(vendor["_id"])
    del vendor["_id"]
    
    return Vendor(**vendor)


@router.put("/vendors/{vendor_id}", response_model=Vendor)
async def update_vendor(
    vendor_id: str,
    vendor_update: VendorCreate,
    current_user: dict = Depends(get_current_user),
    vendors_collection: AsyncIOMotorCollection = Depends(get_vendors_collection)
):
    """Update vendor"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    update_dict = vendor_update.dict(exclude={"id", "vendor_code", "created_by", "created_at"})
    update_dict["updated_at"] = datetime.utcnow()
    
    # Convert enum lists to their values for MongoDB compatibility
    if "categories" in update_dict:
        update_dict["categories"] = [cat.value if hasattr(cat, "value") else cat for cat in update_dict["categories"]]
    
    result = await vendors_collection.update_one(
        {"_id": ObjectId(vendor_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    return await get_vendor(vendor_id, current_user, vendors_collection)


@router.delete("/vendors/{vendor_id}")
async def delete_vendor(
    vendor_id: str,
    current_user: dict = Depends(get_current_user),
    vendors_collection: AsyncIOMotorCollection = Depends(get_vendors_collection)
):
    """Delete vendor"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await vendors_collection.delete_one({"_id": ObjectId(vendor_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    return {"message": "Vendor deleted successfully"}


# Purchase Orders Management
@router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_purchase_order(
    purchase_order: PurchaseOrder,
    current_user: dict = Depends(get_current_user),
    po_collection: AsyncIOMotorCollection = Depends(get_purchase_orders_collection)
):
    """Create a new purchase order"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    po_dict = purchase_order.dict(exclude={"id"})
    po_dict["po_number"] = generate_inventory_code("PO", 
        await get_next_po_number(po_collection))
    po_dict["created_by"] = current_user["user_id"]
    
    # Determine branch: allow HQ roles to specify via payload; otherwise use user's branch
    payload_branch_id = po_dict.get("branch_id")
    branch_id = payload_branch_id or current_user.get("branch_id")
    if not branch_id:
        if is_hq_role(current_user.get("role")):
            raise HTTPException(status_code=400, detail="branch_id is required when creating purchase orders as HQ user")
        raise HTTPException(status_code=403, detail="User must be assigned to a branch")
    po_dict["branch_id"] = branch_id
    
    result = await po_collection.insert_one(po_dict)
    po_dict["id"] = str(result.inserted_id)
    
    return PurchaseOrder(**po_dict)


@router.get("/purchase-orders", response_model=List[PurchaseOrder])
async def get_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    vendor_name: Optional[str] = None,
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    po_collection: AsyncIOMotorCollection = Depends(get_purchase_orders_collection)
):
    """Get purchase orders with filtering"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    filter_dict = {}
    # Enforce branch isolation
    if is_hq_role(current_user.get("role")):
        if branch_id:
            filter_dict["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return []
        filter_dict["branch_id"] = user_branch_id
    if status:
        filter_dict["status"] = status
    if vendor_name:
        filter_dict["vendor_name"] = {"$regex": vendor_name, "$options": "i"}
    
    cursor = po_collection.find(filter_dict).skip(skip).limit(limit).sort("order_date", -1)
    orders = await cursor.to_list(length=limit)
    
    for order in orders:
        order["id"] = str(order["_id"])
        del order["_id"]
    
    return [PurchaseOrder(**order) for order in orders]


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def get_purchase_order(
    po_id: str,
    current_user: dict = Depends(get_current_user),
    po_collection: AsyncIOMotorCollection = Depends(get_purchase_orders_collection)
):
    """Get purchase order by ID"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    order = await po_collection.find_one({"_id": ObjectId(po_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    order["id"] = str(order["_id"])
    del order["_id"]
    
    return PurchaseOrder(**order)


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrder)
async def update_purchase_order(
    po_id: str,
    po_update: PurchaseOrder,
    current_user: dict = Depends(get_current_user),
    po_collection: AsyncIOMotorCollection = Depends(get_purchase_orders_collection)
):
    """Update purchase order"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    update_dict = po_update.dict(exclude={"id", "po_number", "created_by", "created_at"})
    update_dict["updated_at"] = datetime.utcnow()
    
    result = await po_collection.update_one(
        {"_id": ObjectId(po_id)},
        {"$set": update_dict}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return await get_purchase_order(po_id, current_user, po_collection)


@router.delete("/purchase-orders/{po_id}")
async def delete_purchase_order(
    po_id: str,
    current_user: dict = Depends(get_current_user),
    po_collection: AsyncIOMotorCollection = Depends(get_purchase_orders_collection)
):
    """Delete purchase order"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    result = await po_collection.delete_one({"_id": ObjectId(po_id)})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    
    return {"message": "Purchase order deleted successfully"}


# Analytics and Statistics
@router.get("/analytics/overview")
async def get_inventory_overview(
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection),
    supplies_collection: AsyncIOMotorCollection = Depends(get_supplies_collection),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection)
):
    """Get inventory overview statistics (branch-isolated)."""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])

    # Build branch filters according to role
    asset_filter: Dict[str, Any] = {}
    supply_filter: Dict[str, Any] = {"is_active": True}
    maintenance_filter: Dict[str, Any] = {}

    if is_hq_role(current_user.get("role")):
        # HQ roles may optionally filter by a specific branch
        if branch_id:
            asset_filter["branch_id"] = branch_id
            supply_filter["branch_id"] = branch_id
            maintenance_filter["branch_id"] = branch_id
    else:
        # Non-HQ roles are restricted to their assigned branch
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            # No branch assigned → no data
            return {
                "total_assets": 0,
                "active_assets": 0,
                "assets_under_maintenance": 0,
                "total_supplies": 0,
                "low_stock_supplies": 0,
                "pending_maintenance": 0,
                "overdue_maintenance": 0,
                "total_asset_value": 0,
                "category_distribution": {},
                "system_health": {
                    "asset_utilization": 0,
                    "maintenance_compliance": 100,
                    "stock_adequacy": 100,
                },
            }
        asset_filter["branch_id"] = user_branch_id
        supply_filter["branch_id"] = user_branch_id
        maintenance_filter["branch_id"] = user_branch_id

    # Asset statistics
    total_assets = await assets_collection.count_documents(asset_filter)
    active_assets = await assets_collection.count_documents({**asset_filter, "status": "active"})
    assets_under_maintenance = await assets_collection.count_documents({**asset_filter, "status": "under_maintenance"})

    # Supply statistics
    total_supplies = await supplies_collection.count_documents(supply_filter)
    low_stock_supplies = await supplies_collection.count_documents({
        **supply_filter,
        "$expr": {"$lte": ["$quantity_in_stock", "$minimum_stock_level"]},
    })

    # Maintenance statistics
    pending_maintenance = await maintenance_collection.count_documents({**maintenance_filter, "status": "scheduled"})
    overdue_maintenance = await maintenance_collection.count_documents({
        **maintenance_filter,
        "status": "scheduled",
        "scheduled_date": {"$lt": datetime.utcnow()},
    })

    # Asset value calculation
    asset_pipeline = []
    if asset_filter:
        asset_pipeline.append({"$match": asset_filter})
    asset_pipeline.extend([
        {"$match": {"purchase_price": {"$exists": True}}},
        {"$group": {"_id": None, "total_value": {"$sum": "$purchase_price"}}},
    ])
    asset_value_result = await assets_collection.aggregate(asset_pipeline).to_list(1)
    total_asset_value = asset_value_result[0]["total_value"] if asset_value_result else 0

    # Category distribution
    category_pipeline = []
    if asset_filter:
        category_pipeline.append({"$match": asset_filter})
    category_pipeline.append({"$group": {"_id": "$category", "count": {"$sum": 1}}})
    category_distribution = await assets_collection.aggregate(category_pipeline).to_list(None)

    return {
        "total_assets": total_assets,
        "active_assets": active_assets,
        "assets_under_maintenance": assets_under_maintenance,
        "total_supplies": total_supplies,
        "low_stock_supplies": low_stock_supplies,
        "pending_maintenance": pending_maintenance,
        "overdue_maintenance": overdue_maintenance,
        "total_asset_value": total_asset_value,
        "category_distribution": {item["_id"]: item["count"] for item in category_distribution},
        "system_health": {
            "asset_utilization": (active_assets / max(total_assets, 1)) * 100,
            "maintenance_compliance": ((pending_maintenance - overdue_maintenance) / max(pending_maintenance, 1)) * 100 if pending_maintenance > 0 else 100,
            "stock_adequacy": ((total_supplies - low_stock_supplies) / max(total_supplies, 1)) * 100 if total_supplies > 0 else 100,
        },
    }


@router.get("/analytics/maintenance-schedule")
async def get_maintenance_schedule(
    days_ahead: int = Query(30, ge=1, le=365),
    branch_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection)
):
    """Get upcoming maintenance schedule (branch-isolated)."""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    start_date = datetime.utcnow().date()
    end_date = start_date + timedelta(days=days_ahead)
    
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    # Build filter with branch isolation
    filter_dict: Dict[str, Any] = {
        "status": "scheduled",
        "scheduled_date": {"$gte": start_datetime, "$lte": end_datetime},
    }
    if is_hq_role(current_user.get("role")):
        if branch_id:
            filter_dict["branch_id"] = branch_id
    else:
        user_branch_id = current_user.get("branch_id")
        if not user_branch_id:
            return {"upcoming_maintenance": [], "total_upcoming": 0, "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()}}
        filter_dict["branch_id"] = user_branch_id
    
    upcoming_maintenance = await maintenance_collection.find(filter_dict).sort("scheduled_date", 1).to_list(None)
    
    for record in upcoming_maintenance:
        record["id"] = str(record["_id"])
        del record["_id"]
    
    return {
        "upcoming_maintenance": [MaintenanceRecord(**record) for record in upcoming_maintenance],
        "total_upcoming": len(upcoming_maintenance),
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }


# Helper functions
async def get_next_asset_number(collection: AsyncIOMotorCollection) -> int:
    """Get next asset number for code generation"""
    last_asset = await collection.find_one(
        {"asset_code": {"$regex": "^AST-"}},
        sort=[("asset_code", -1)]
    )
    if last_asset and last_asset.get("asset_code"):
        try:
            last_number = int(last_asset["asset_code"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


async def get_next_supply_number(collection: AsyncIOMotorCollection) -> int:
    """Get next supply number for code generation"""
    last_supply = await collection.find_one(
        {"supply_code": {"$regex": "^SUP-"}},
        sort=[("supply_code", -1)]
    )
    if last_supply and last_supply.get("supply_code"):
        try:
            last_number = int(last_supply["supply_code"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


async def get_next_maintenance_number(collection: AsyncIOMotorCollection) -> int:
    """Get next maintenance number for code generation"""
    last_maintenance = await collection.find_one(
        {"maintenance_code": {"$regex": "^MNT-"}},
        sort=[("maintenance_code", -1)]
    )
    if last_maintenance and last_maintenance.get("maintenance_code"):
        try:
            last_number = int(last_maintenance["maintenance_code"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


async def get_next_transaction_number(collection: AsyncIOMotorCollection) -> int:
    """Get next transaction number for code generation"""
    last_transaction = await collection.find_one(
        {"transaction_code": {"$regex": "^TXN-"}},
        sort=[("transaction_code", -1)]
    )
    if last_transaction and last_transaction.get("transaction_code"):
        try:
            last_number = int(last_transaction["transaction_code"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


async def get_next_request_number(collection: AsyncIOMotorCollection) -> int:
    """Get next request number for code generation"""
    last_request = await collection.find_one(
        {"request_code": {"$regex": "^REQ-"}},
        sort=[("request_code", -1)]
    )
    if last_request and last_request.get("request_code"):
        try:
            last_number = int(last_request["request_code"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


async def get_next_vendor_number(collection: AsyncIOMotorCollection) -> int:
    """Get next vendor number for code generation"""
    last_vendor = await collection.find_one(
        {"vendor_code": {"$regex": "^VND-"}},
        sort=[("vendor_code", -1)]
    )
    if last_vendor and last_vendor.get("vendor_code"):
        try:
            last_number = int(last_vendor["vendor_code"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


async def get_next_po_number(collection: AsyncIOMotorCollection) -> int:
    """Get next purchase order number for code generation"""
    last_po = await collection.find_one(
        {"po_number": {"$regex": "^PO-"}},
        sort=[("po_number", -1)]
    )
    if last_po and last_po.get("po_number"):
        try:
            last_number = int(last_po["po_number"].split("-")[1])
            return last_number + 1
        except (ValueError, IndexError):
            pass
    return 1000


# Asset Assignment Endpoints
@router.post("/assets/{asset_id}/assign")
async def assign_asset(
    asset_id: str,
    assignment_data: dict,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection),
    users_collection: AsyncIOMotorCollection = Depends(get_users_collection),
    classes_collection: AsyncIOMotorCollection = Depends(get_classes_collection)
):
    """Assign asset to teacher, student, or department"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Validate assignment data
    assigned_to = assignment_data.get("assigned_to")
    assigned_to_type = assignment_data.get("assigned_to_type")  # teacher, student, staff, department
    department_id = assignment_data.get("department_id")
    classroom_id = assignment_data.get("classroom_id")
    
    if not assigned_to and not department_id and not classroom_id:
        raise HTTPException(status_code=400, detail="Must specify assignment target")
    
    # Get asset
    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    assigned_to_name = None
    
    # If assigning to a person, get their name
    if assigned_to:
        user = await users_collection.find_one({"_id": ObjectId(assigned_to)})
        if user:
            assigned_to_name = f"{user.get('first_name', '')} {user.get('last_name', '')}".strip()
        else:
            # Check if it's a class assignment
            if classroom_id:
                class_info = await classes_collection.find_one({"_id": ObjectId(classroom_id)})
                if class_info:
                    assigned_to_name = f"Class {class_info.get('name', 'Unknown')}"
    
    # Update asset with assignment information
    update_data = {
        "assigned_to": assigned_to,
        "assigned_to_name": assigned_to_name,
        "assigned_to_type": assigned_to_type,
        "assigned_date": datetime.utcnow(),
        "department_id": department_id,
        "classroom_id": classroom_id,
        "updated_at": datetime.utcnow()
    }
    
    await assets_collection.update_one(
        {"_id": ObjectId(asset_id)},
        {"$set": update_data}
    )
    
    # Return updated asset
    updated_asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    updated_asset["id"] = str(updated_asset["_id"])
    del updated_asset["_id"]
    
    return Asset(**updated_asset)


@router.post("/assets/{asset_id}/unassign")
async def unassign_asset(
    asset_id: str,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Unassign asset from current assignment"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Clear assignment fields
    update_data = {
        "assigned_to": None,
        "assigned_to_name": None,
        "assigned_to_type": None,
        "assigned_date": None,
        "department_id": None,
        "classroom_id": None,
        "updated_at": datetime.utcnow()
    }
    
    await assets_collection.update_one(
        {"_id": ObjectId(asset_id)},
        {"$set": update_data}
    )
    
    # Return updated asset
    updated_asset = await assets_collection.find_one({"_id": ObjectId(asset_id)})
    updated_asset["id"] = str(updated_asset["_id"])
    del updated_asset["_id"]
    
    return Asset(**updated_asset)


@router.get("/assets/assignments/teachers")
async def get_teacher_assignments(
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection),
    users_collection: AsyncIOMotorCollection = Depends(get_users_collection)
):
    """Get all assets assigned to teachers"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Get all assets assigned to teachers
    teacher_assets = await assets_collection.find({
        "assigned_to_type": "teacher",
        "assigned_to": {"$ne": None}
    }).to_list(length=None)
    
    # Group by teacher
    assignments = {}
    for asset in teacher_assets:
        teacher_id = asset["assigned_to"]
        if teacher_id not in assignments:
            assignments[teacher_id] = {
                "teacher_id": teacher_id,
                "teacher_name": asset.get("assigned_to_name", "Unknown"),
                "assets": []
            }
        assignments[teacher_id]["assets"].append({
            "id": str(asset["_id"]),
            "asset_code": asset.get("asset_code"),
            "name": asset.get("name"),
            "category": asset.get("category"),
            "assigned_date": asset.get("assigned_date")
        })
    
    return list(assignments.values())


@router.get("/assets/assignments/students")
async def get_student_assignments(
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get all assets assigned to students"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Get all assets assigned to students
    student_assets = await assets_collection.find({
        "assigned_to_type": "student",
        "assigned_to": {"$ne": None}
    }).to_list(length=None)
    
    # Group by student
    assignments = {}
    for asset in student_assets:
        student_id = asset["assigned_to"]
        if student_id not in assignments:
            assignments[student_id] = {
                "student_id": student_id,
                "student_name": asset.get("assigned_to_name", "Unknown"),
                "assets": []
            }
        assignments[student_id]["assets"].append({
            "id": str(asset["_id"]),
            "asset_code": asset.get("asset_code"),
            "name": asset.get("name"),
            "category": asset.get("category"),
            "assigned_date": asset.get("assigned_date")
        })
    
    return list(assignments.values())


@router.get("/assets/assignments/departments")
async def get_department_assignments(
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get all assets assigned to departments"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Get all assets assigned to departments
    dept_assets = await assets_collection.find({
        "department_id": {"$ne": None}
    }).to_list(length=None)
    
    # Group by department
    assignments = {}
    for asset in dept_assets:
        dept_id = asset["department_id"]
        if dept_id not in assignments:
            assignments[dept_id] = {
                "department_id": dept_id,
                "assets": []
            }
        assignments[dept_id]["assets"].append({
            "id": str(asset["_id"]),
            "asset_code": asset.get("asset_code"),
            "name": asset.get("name"),
            "category": asset.get("category"),
            "assigned_date": asset.get("assigned_date"),
            "assigned_to_name": asset.get("assigned_to_name")
        })
    
    return list(assignments.values())


# Academic Calendar Integration for Maintenance Scheduling
@router.post("/maintenance/{maintenance_id}/schedule-with-calendar")
async def schedule_maintenance_with_calendar(
    maintenance_id: str,
    schedule_data: dict,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection),
    db = Depends(get_db)
):
    """Schedule maintenance considering academic calendar events"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    # Get maintenance record
    maintenance = await maintenance_collection.find_one({"_id": ObjectId(maintenance_id)})
    if not maintenance:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    
    proposed_date = datetime.fromisoformat(schedule_data.get("scheduled_date"))
    branch_id = maintenance.get("branch_id") or current_user.get("branch_id")
    
    # Check academic calendar for conflicts
    academic_events_collection = db["academic_events"]
    
    # Look for conflicting events (exams, holidays, important meetings)
    conflicting_events = await academic_events_collection.find({
        "branch_id": branch_id,
        "event_type": {"$in": ["exam", "holiday", "important_meeting"]},
        "start_date": {"$lte": proposed_date + timedelta(days=1)},
        "$or": [
            {"end_date": {"$gte": proposed_date}},
            {"end_date": None, "start_date": {"$gte": proposed_date - timedelta(days=1)}}
        ]
    }).to_list(length=None)
    
    warnings = []
    if conflicting_events:
        for event in conflicting_events:
            warnings.append({
                "type": "calendar_conflict",
                "message": f"Conflicts with {event.get('event_type')}: {event.get('title')}",
                "event_date": event.get('start_date'),
                "severity": "high" if event.get('event_type') == 'exam' else "medium"
            })
    
    # Suggest alternative dates if conflicts exist
    suggested_dates = []
    if conflicting_events:
        # Look for free slots in the next 30 days
        for days_ahead in range(1, 31):
            alternative_date = proposed_date + timedelta(days=days_ahead)
            
            # Check if this date is free
            conflicts = await academic_events_collection.find({
                "branch_id": branch_id,
                "event_type": {"$in": ["exam", "holiday", "important_meeting"]},
                "start_date": {"$lte": alternative_date + timedelta(days=1)},
                "$or": [
                    {"end_date": {"$gte": alternative_date}},
                    {"end_date": None, "start_date": {"$gte": alternative_date - timedelta(days=1)}}
                ]
            }).to_list(length=1)
            
            if not conflicts:
                suggested_dates.append({
                    "date": alternative_date.isoformat(),
                    "reason": "No academic conflicts"
                })
                
            if len(suggested_dates) >= 3:
                break
    
    # Update maintenance schedule if no high-severity conflicts or if forced
    if not any(w["severity"] == "high" for w in warnings) or schedule_data.get("force_schedule", False):
        update_data = {
            "scheduled_date": proposed_date,
            "calendar_checked": True,
            "calendar_warnings": warnings,
            "updated_at": datetime.utcnow()
        }
        
        await maintenance_collection.update_one(
            {"_id": ObjectId(maintenance_id)},
            {"$set": update_data}
        )
        
        # Create calendar event for maintenance
        maintenance_event = {
            "title": f"Maintenance: {maintenance.get('title', 'Asset Maintenance')}",
            "description": f"Scheduled maintenance for asset {maintenance.get('asset_code', 'Unknown')}",
            "event_type": "maintenance",
            "start_date": proposed_date,
            "end_date": proposed_date + timedelta(hours=2),
            "is_all_day": False,
            "academic_year_id": None,
            "term_id": None,
            "branch_id": branch_id,
            "color": "#f39c12",
            "is_public": False,
            "maintenance_id": maintenance_id,
            "created_at": datetime.utcnow()
        }
        
        await academic_events_collection.insert_one(maintenance_event)
        
        return {
            "success": True,
            "scheduled_date": proposed_date.isoformat(),
            "warnings": warnings,
            "message": "Maintenance scheduled successfully"
        }
    
    return {
        "success": False,
        "warnings": warnings,
        "suggested_dates": suggested_dates,
        "message": "Cannot schedule due to conflicts. Consider suggested dates or use force_schedule=true"
    }


@router.get("/maintenance/calendar-integration")
async def get_maintenance_calendar_view(
    start_date: str,
    end_date: str,
    current_user: dict = Depends(get_current_user),
    maintenance_collection: AsyncIOMotorCollection = Depends(get_maintenance_records_collection),
    db = Depends(get_db)
):
    """Get maintenance schedule integrated with academic calendar"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    branch_id = current_user.get("branch_id")
    
    # Get maintenance events
    maintenance_filter = {
        "scheduled_date": {"$gte": start, "$lte": end}
    }
    if branch_id and current_user.get("role") not in ["super_admin", "hq_admin"]:
        maintenance_filter["branch_id"] = branch_id
    
    maintenance_events = await maintenance_collection.find(maintenance_filter).to_list(length=None)
    
    # Get academic events
    academic_events_collection = db["academic_events"]
    academic_filter = {
        "start_date": {"$lte": end},
        "$or": [
            {"end_date": {"$gte": start}},
            {"end_date": None, "start_date": {"$gte": start}}
        ]
    }
    if branch_id:
        academic_filter["branch_id"] = branch_id
    
    academic_events = await academic_events_collection.find(academic_filter).to_list(length=None)
    
    # Format events for calendar view
    calendar_events = []
    
    # Add maintenance events
    for maintenance in maintenance_events:
        calendar_events.append({
            "id": str(maintenance["_id"]),
            "title": f"Maintenance: {maintenance.get('title', 'Asset Maintenance')}",
            "start": maintenance.get("scheduled_date").isoformat(),
            "end": (maintenance.get("scheduled_date") + timedelta(hours=2)).isoformat(),
            "type": "maintenance",
            "category": "maintenance",
            "color": "#f39c12",
            "details": {
                "asset_code": maintenance.get("asset_code"),
                "maintenance_type": maintenance.get("maintenance_type"),
                "status": maintenance.get("status"),
                "assigned_to": maintenance.get("assigned_to_name")
            }
        })
    
    # Add academic events
    for event in academic_events:
        calendar_events.append({
            "id": str(event["_id"]),
            "title": event.get("title"),
            "start": event.get("start_date").isoformat(),
            "end": event.get("end_date").isoformat() if event.get("end_date") else event.get("start_date").isoformat(),
            "type": "academic",
            "category": event.get("event_type"),
            "color": event.get("color", "#3498db"),
            "allDay": event.get("is_all_day", True),
            "details": {
                "description": event.get("description"),
                "event_type": event.get("event_type"),
                "is_public": event.get("is_public", True)
            }
        })
    
    return {
        "events": calendar_events,
        "summary": {
            "maintenance_count": len(maintenance_events),
            "academic_events_count": len(academic_events),
            "date_range": {"start": start_date, "end": end_date}
        }
    }


# Classroom/Department Asset Assignment Endpoints
@router.get("/assets/by-classroom/{classroom_id}")
async def get_classroom_assets(
    classroom_id: str,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get all assets assigned to a specific classroom"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Get assets assigned to this classroom
    assets = await assets_collection.find({
        "classroom_id": classroom_id
    }).to_list(length=None)
    
    # Format response
    classroom_assets = []
    for asset in assets:
        classroom_assets.append({
            "id": str(asset["_id"]),
            "asset_code": asset.get("asset_code"),
            "name": asset.get("name"),
            "category": asset.get("category"),
            "condition": asset.get("condition"),
            "status": asset.get("status"),
            "assigned_date": asset.get("assigned_date"),
            "assigned_to_name": asset.get("assigned_to_name"),
            "assigned_to_type": asset.get("assigned_to_type"),
            "location": asset.get("location")
        })
    
    return {
        "classroom_id": classroom_id,
        "asset_count": len(classroom_assets),
        "assets": classroom_assets
    }


@router.get("/assets/by-department")
async def get_department_asset_summary(
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get asset summary grouped by department"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Branch filtering for non-admin users
    filter_dict = {}
    if current_user.get("role") not in ["super_admin", "hq_admin"]:
        filter_dict["branch_id"] = current_user.get("branch_id")
    
    # Get all assets with department assignments
    assets = await assets_collection.find({
        **filter_dict,
        "department_id": {"$ne": None}
    }).to_list(length=None)
    
    # Group by department
    departments = {}
    for asset in assets:
        dept_id = asset.get("department_id")
        if dept_id not in departments:
            departments[dept_id] = {
                "department_id": dept_id,
                "total_assets": 0,
                "assets_by_category": {},
                "assets_by_condition": {"good": 0, "fair": 0, "poor": 0, "needs_repair": 0},
                "total_value": 0
            }
        
        departments[dept_id]["total_assets"] += 1
        
        # Count by category
        category = asset.get("category", "unknown")
        if category not in departments[dept_id]["assets_by_category"]:
            departments[dept_id]["assets_by_category"][category] = 0
        departments[dept_id]["assets_by_category"][category] += 1
        
        # Count by condition
        condition = asset.get("condition", "unknown")
        if condition in departments[dept_id]["assets_by_condition"]:
            departments[dept_id]["assets_by_condition"][condition] += 1
        
        # Add to total value
        if asset.get("current_value"):
            departments[dept_id]["total_value"] += asset.get("current_value", 0)
        elif asset.get("purchase_price"):
            departments[dept_id]["total_value"] += asset.get("purchase_price", 0)
    
    return list(departments.values())


@router.post("/assets/bulk-assign-classroom")
async def bulk_assign_assets_to_classroom(
    assignment_data: dict,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection),
    classes_collection: AsyncIOMotorCollection = Depends(get_classes_collection)
):
    """Bulk assign multiple assets to a classroom"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    asset_ids = assignment_data.get("asset_ids", [])
    classroom_id = assignment_data.get("classroom_id")
    
    if not asset_ids or not classroom_id:
        raise HTTPException(status_code=400, detail="asset_ids and classroom_id are required")
    
    # Verify classroom exists
    classroom = await classes_collection.find_one({"_id": ObjectId(classroom_id)})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")
    
    # Update all assets
    object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
    
    update_result = await assets_collection.update_many(
        {"_id": {"$in": object_ids}},
        {"$set": {
            "classroom_id": classroom_id,
            "assigned_to_type": "classroom",
            "assigned_to_name": f"Class {classroom.get('class_name', 'Unknown')}",
            "assigned_date": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "success": True,
        "updated_count": update_result.modified_count,
        "classroom_name": classroom.get("class_name"),
        "message": f"Successfully assigned {update_result.modified_count} assets to classroom"
    }


@router.post("/assets/bulk-assign-department")
async def bulk_assign_assets_to_department(
    assignment_data: dict,
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Bulk assign multiple assets to a department/subject"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin"])
    
    asset_ids = assignment_data.get("asset_ids", [])
    department_id = assignment_data.get("department_id")
    department_name = assignment_data.get("department_name", "Department")
    
    if not asset_ids or not department_id:
        raise HTTPException(status_code=400, detail="asset_ids and department_id are required")
    
    # Update all assets
    object_ids = [ObjectId(asset_id) for asset_id in asset_ids]
    
    update_result = await assets_collection.update_many(
        {"_id": {"$in": object_ids}},
        {"$set": {
            "department_id": department_id,
            "assigned_to_type": "department",
            "assigned_to_name": department_name,
            "assigned_date": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }}
    )
    
    return {
        "success": True,
        "updated_count": update_result.modified_count,
        "department_name": department_name,
        "message": f"Successfully assigned {update_result.modified_count} assets to {department_name}"
    }


@router.get("/assets/unassigned")
async def get_unassigned_assets(
    current_user: dict = Depends(get_current_user),
    assets_collection: AsyncIOMotorCollection = Depends(get_assets_collection)
):
    """Get all assets that are not assigned to anyone or any department/classroom"""
    require_auth(current_user, ["super_admin", "hq_admin", "branch_admin", "admin", "teacher"])
    
    # Branch filtering for non-admin users
    filter_dict = {"status": "active"}
    if current_user.get("role") not in ["super_admin", "hq_admin"]:
        filter_dict["branch_id"] = current_user.get("branch_id")
    
    # Find assets with no assignments
    filter_dict["$and"] = [
        {"$or": [
            {"assigned_to": None},
            {"assigned_to": {"$exists": False}}
        ]},
        {"$or": [
            {"classroom_id": None},
            {"classroom_id": {"$exists": False}}
        ]},
        {"$or": [
            {"department_id": None},
            {"department_id": {"$exists": False}}
        ]}
    ]
    
    unassigned_assets = await assets_collection.find(filter_dict).to_list(length=None)
    
    # Format response
    assets_list = []
    for asset in unassigned_assets:
        assets_list.append({
            "id": str(asset["_id"]),
            "asset_code": asset.get("asset_code"),
            "name": asset.get("name"),
            "category": asset.get("category"),
            "condition": asset.get("condition"),
            "location": asset.get("location"),
            "purchase_price": asset.get("purchase_price"),
            "current_value": asset.get("current_value")
        })
    
    return {
        "unassigned_count": len(assets_list),
        "assets": assets_list,
        "total_value": sum(asset.get("current_value") or asset.get("purchase_price", 0) for asset in unassigned_assets)
    }
