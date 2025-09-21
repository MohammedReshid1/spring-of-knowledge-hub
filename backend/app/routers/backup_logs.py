from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from datetime import datetime

from ..db import get_backup_logs_collection, get_db
from ..models.backup_log import BackupLogCreate, BackupLog
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.post("/", response_model=BackupLog)
async def create_backup_log(
    log_in: BackupLogCreate,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    """Create a backup log entry (Super Admin only)"""
    if current_user.get("role") not in ['super_admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can create backups")
    
    # Add user information to the backup log
    doc = log_in.dict()
    doc["performed_by"] = current_user.get("id")
    
    # Set default values if not provided
    if not doc.get("started_at"):
        doc["started_at"] = datetime.utcnow()
    
    result = await coll.insert_one(doc)
    backup_data = {
        "id": str(result.inserted_id),
        "backup_type": doc.get("backup_type", ""),
        "backup_method": doc.get("backup_method", ""),
        "status": doc.get("status", "in_progress"),
        "file_path": doc.get("file_path"),
        "file_size": doc.get("file_size"),
        "started_at": doc.get("started_at"),
        "completed_at": doc.get("completed_at"),
        "performed_by": doc.get("performed_by"),
        "error_message": doc.get("error_message"),
        "tables_backed_up": doc.get("tables_backed_up"),
        "records_count": doc.get("records_count")
    }
    return BackupLog(**backup_data)

@router.get("/", response_model=List[BackupLog])
async def list_backup_logs(
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    """Get all backup logs (Admin and Super Admin only)"""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view backup logs")
    
    items: List[BackupLog] = []
    async for b in coll.find():
        # Convert MongoDB document to proper format
        backup_data = {
            "id": str(b["_id"]),
            "backup_type": b.get("backup_type", ""),
            "backup_method": b.get("backup_method", ""),
            "status": b.get("status", "in_progress"),
            "file_path": b.get("file_path"),
            "file_size": b.get("file_size"),
            "started_at": b.get("started_at"),
            "completed_at": b.get("completed_at"),
            "performed_by": b.get("performed_by"),
            "error_message": b.get("error_message"),
            "tables_backed_up": b.get("tables_backed_up"),
            "records_count": b.get("records_count")
        }
        items.append(BackupLog(**backup_data))
    return items

@router.get("/{id}", response_model=BackupLog)
async def get_backup_log(
    id: str,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    """Get a specific backup log (Admin and Super Admin only)"""
    if current_user.get("role") not in ['super_admin', 'hq_admin', 'branch_admin', 'admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to view backup logs")
    
    b = await coll.find_one({"_id": ObjectId(id)})
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BackupLog not found")
    
    # Convert MongoDB document to proper format
    backup_data = {
        "id": id,
        "backup_type": b.get("backup_type", ""),
        "backup_method": b.get("backup_method", ""),
        "status": b.get("status", "in_progress"),
        "file_path": b.get("file_path"),
        "file_size": b.get("file_size"),
        "started_at": b.get("started_at"),
        "completed_at": b.get("completed_at"),
        "performed_by": b.get("performed_by"),
        "error_message": b.get("error_message"),
        "tables_backed_up": b.get("tables_backed_up"),
        "records_count": b.get("records_count")
    }
    return BackupLog(**backup_data)

@router.put("/{id}", response_model=BackupLog)
async def update_backup_log(
    id: str,
    log_in: BackupLogCreate,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    """Update a backup log (Super Admin only)"""
    if current_user.get("role") not in ['super_admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can update backup logs")
    
    res = await coll.update_one({"_id": ObjectId(id)}, {"$set": log_in.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BackupLog not found")
    
    # Return the updated backup log
    updated_backup = await coll.find_one({"_id": ObjectId(id)})
    backup_data = {
        "id": id,
        "backup_type": updated_backup.get("backup_type", ""),
        "backup_method": updated_backup.get("backup_method", ""),
        "status": updated_backup.get("status", "in_progress"),
        "file_path": updated_backup.get("file_path"),
        "file_size": updated_backup.get("file_size"),
        "started_at": updated_backup.get("started_at"),
        "completed_at": updated_backup.get("completed_at"),
        "performed_by": updated_backup.get("performed_by"),
        "error_message": updated_backup.get("error_message"),
        "tables_backed_up": updated_backup.get("tables_backed_up"),
        "records_count": updated_backup.get("records_count")
    }
    return BackupLog(**backup_data)

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup_log(
    id: str,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    """Delete a backup log (Super Admin only)"""
    if current_user.get("role") not in ['super_admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can delete backups")
    
    await coll.delete_one({"_id": ObjectId(id)})

@router.post("/create-backup", response_model=BackupLog)
async def create_manual_backup(
    coll: Any = Depends(get_backup_logs_collection),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a manual backup of the database (Super Admin only)"""
    if current_user.get("role") not in ['super_admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can create backups")
    
    # Create backup log entry
    backup_log = {
        "backup_type": "manual",
        "backup_method": "full",
        "status": "in_progress",
        "started_at": datetime.utcnow(),
        "performed_by": current_user.get("id"),
        "tables_backed_up": ["students", "users", "classes", "payments", "branches", "grade_levels"],
        "records_count": 0,
        "file_path": f"backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json",
        "file_size": 0
    }
    
    try:
        # Insert the backup log
        result = await coll.insert_one(backup_log)
        backup_id = str(result.inserted_id)
        
        # Perform actual backup by collecting data from all collections
        backup_data = {}
        total_records = 0
        
        # Get all collections to backup
        collections_to_backup = [
            ("students", db.students),
            ("users", db.users),
            ("classes", db.classes),
            ("branches", db.branches),
            ("grade_levels", db.grade_levels),
            ("subjects", db.subjects),
            ("teachers", db.teachers),
            ("registration_payments", db.registration_payments),
            ("fees", db.fees),
            ("payment_modes", db.payment_modes),
            ("student_enrollments", db.student_enrollments),
            ("attendance", db.attendance),
            ("grade_transitions", db.grade_transitions)
        ]
        
        for collection_name, collection in collections_to_backup:
            try:
                collection_data = []
                async for doc in collection.find():
                    # Convert ObjectId to string for JSON serialization
                    doc["_id"] = str(doc["_id"])
                    collection_data.append(doc)
                
                backup_data[collection_name] = collection_data
                total_records += len(collection_data)
            except Exception as e:
                print(f"Error backing up {collection_name}: {e}")
        
        # Store backup data in the backup log document
        await coll.update_one(
            {"_id": result.inserted_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "records_count": total_records,
                    "file_size": len(str(backup_data).encode('utf-8')),
                    "backup_data": backup_data
                }
            }
        )
        
        # Return the updated backup log
        updated_backup = await coll.find_one({"_id": result.inserted_id})
        backup_data = {
            "id": backup_id,
            "backup_type": updated_backup.get("backup_type", ""),
            "backup_method": updated_backup.get("backup_method", ""),
            "status": updated_backup.get("status", "in_progress"),
            "file_path": updated_backup.get("file_path"),
            "file_size": updated_backup.get("file_size"),
            "started_at": updated_backup.get("started_at"),
            "completed_at": updated_backup.get("completed_at"),
            "performed_by": updated_backup.get("performed_by"),
            "error_message": updated_backup.get("error_message"),
            "tables_backed_up": updated_backup.get("tables_backed_up"),
            "records_count": updated_backup.get("records_count")
        }
        return BackupLog(**backup_data)
        
    except Exception as e:
        # Update backup log with error
        await coll.update_one(
            {"_id": result.inserted_id},
            {
                "$set": {
                    "status": "failed",
                    "completed_at": datetime.utcnow(),
                    "error_message": str(e)
                }
            }
        )
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Backup failed: {str(e)}")

@router.post("/restore/{backup_id}", response_model=dict)
async def restore_from_backup(
    backup_id: str,
    coll: Any = Depends(get_backup_logs_collection),
    db: Any = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore database from a backup (Super Admin only)"""
    if current_user.get("role") not in ['super_admin']:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only Super Admins can restore backups")
    
    # Get the backup log
    backup_log = await coll.find_one({"_id": ObjectId(backup_id)})
    if not backup_log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup not found")
    
    if backup_log.get("status") != "completed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot restore from incomplete backup")
    
    backup_data = backup_log.get("backup_data")
    if not backup_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No backup data found")
    
    try:
        # Create a safety backup before restoring
        safety_backup = {
            "backup_type": "safety",
            "backup_method": "full",
            "status": "in_progress",
            "started_at": datetime.utcnow(),
            "performed_by": current_user.get("id"),
            "notes": f"Safety backup before restoring from backup {backup_id}"
        }
        
        safety_result = await coll.insert_one(safety_backup)
        
        # Perform safety backup
        safety_backup_data = {}
        collections_to_backup = [
            ("students", db.students),
            ("users", db.users),
            ("classes", db.classes),
            ("branches", db.branches),
            ("grade_levels", db.grade_levels),
            ("subjects", db.subjects),
            ("teachers", db.teachers),
            ("registration_payments", db.registration_payments),
            ("fees", db.fees),
            ("payment_modes", db.payment_modes),
            ("student_enrollments", db.student_enrollments),
            ("attendance", db.attendance),
            ("grade_transitions", db.grade_transitions)
        ]
        
        for collection_name, collection in collections_to_backup:
            try:
                collection_data = []
                async for doc in collection.find():
                    doc["_id"] = str(doc["_id"])
                    collection_data.append(doc)
                safety_backup_data[collection_name] = collection_data
            except Exception as e:
                print(f"Error in safety backup of {collection_name}: {e}")
        
        # Update safety backup as completed
        await coll.update_one(
            {"_id": safety_result.inserted_id},
            {
                "$set": {
                    "status": "completed",
                    "completed_at": datetime.utcnow(),
                    "backup_data": safety_backup_data
                }
            }
        )
        
        # Now restore from the selected backup
        restored_collections = []
        total_restored = 0
        
        for collection_name, collection_data in backup_data.items():
            try:
                # Clear existing data in the collection
                await db[collection_name].delete_many({})
                
                # Insert restored data
                if collection_data:
                    # Convert string IDs back to ObjectId
                    for doc in collection_data:
                        if "_id" in doc and isinstance(doc["_id"], str):
                            doc["_id"] = ObjectId(doc["_id"])
                    
                    await db[collection_name].insert_many(collection_data)
                    restored_collections.append(collection_name)
                    total_restored += len(collection_data)
            except Exception as e:
                print(f"Error restoring {collection_name}: {e}")
        
        # Create restore log entry
        restore_log = {
            "backup_type": "restore",
            "backup_method": "full",
            "status": "completed",
            "started_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
            "performed_by": current_user.get("id"),
            "notes": f"Restored from backup {backup_id}",
            "restored_from_backup": backup_id,
            "safety_backup_id": str(safety_result.inserted_id),
            "restored_collections": restored_collections,
            "total_restored": total_restored
        }
        
        await coll.insert_one(restore_log)
        
        return {
            "message": "Database restored successfully",
            "restored_collections": restored_collections,
            "total_restored": total_restored,
            "safety_backup_id": str(safety_result.inserted_id),
            "restored_from_backup": backup_id
        }
        
    except Exception as e:
        # Update safety backup as failed if it exists
        if 'safety_result' in locals():
            await coll.update_one(
                {"_id": safety_result.inserted_id},
                {
                    "$set": {
                        "status": "failed",
                        "completed_at": datetime.utcnow(),
                        "error_message": f"Restore failed: {str(e)}"
                    }
                }
            )
        
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Restore failed: {str(e)}")
