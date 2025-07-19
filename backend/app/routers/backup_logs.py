from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..db import get_backup_logs_collection
from ..models.backup_log import BackupLogCreate, BackupLog
from .users import get_current_user, User

router = APIRouter()

@router.post("/", response_model=BackupLog)
async def create_backup_log(
    log_in: BackupLogCreate,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    doc = log_in.dict()
    result = await coll.insert_one(doc)
    return BackupLog(id=str(result.inserted_id), **doc)

@router.get("/", response_model=List[BackupLog])
async def list_backup_logs(
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    items: List[BackupLog] = []
    async for b in coll.find():
        items.append(BackupLog(id=str(b["_id"]), **{k: b.get(k) for k in b}))
    return items

@router.get("/{id}", response_model=BackupLog)
async def get_backup_log(
    id: str,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    b = await coll.find_one({"_id": ObjectId(id)})
    if not b:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BackupLog not found")
    return BackupLog(id=id, **{k: b.get(k) for k in b})

@router.put("/{id}", response_model=BackupLog)
async def update_backup_log(
    id: str,
    log_in: BackupLogCreate,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    res = await coll.update_one({"_id": ObjectId(id)}, {"$set": log_in.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="BackupLog not found")
    return BackupLog(id=id, **log_in.dict())

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backup_log(
    id: str,
    coll: Any = Depends(get_backup_logs_collection),
    current_user: User = Depends(get_current_user),
):
    await coll.delete_one({"_id": ObjectId(id)})
