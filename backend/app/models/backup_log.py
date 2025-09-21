from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class BackupLogBase(BaseModel):
    backup_type: str
    backup_method: str
    status: str = Field(default="in_progress")
    file_path: Optional[str] = None
    file_size: Optional[int] = None
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    performed_by: Optional[str] = None
    error_message: Optional[str] = None
    tables_backed_up: Optional[List[str]] = None
    records_count: Optional[int] = None

class BackupLogCreate(BackupLogBase):
    pass

class BackupLog(BackupLogBase):
    id: str

    class Config:
        orm_mode = True
