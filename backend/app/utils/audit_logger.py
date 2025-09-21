"""
Comprehensive Audit Logging System for School Management System
Tracks all security-sensitive operations, permission checks, and user activities
"""

import asyncio
import json
import logging
import logging.handlers
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum
from pathlib import Path
import aiofiles
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ASCENDING, DESCENDING
from functools import wraps

# Configure audit logger
audit_logger = logging.getLogger("audit")
audit_logger.setLevel(logging.INFO)

# Create audit log directory
AUDIT_LOG_DIR = Path("logs/audit")
AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)

# File handler for audit logs
file_handler = logging.handlers.RotatingFileHandler(
    AUDIT_LOG_DIR / "audit.log",
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=10,
    encoding='utf-8'
)
file_handler.setFormatter(logging.Formatter(
    '%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
))
audit_logger.addHandler(file_handler)

class AuditAction(str, Enum):
    """Types of auditable actions in the system"""
    # Authentication & Authorization
    LOGIN = "login"
    LOGOUT = "logout"
    LOGIN_FAILED = "login_failed"
    TOKEN_REFRESH = "token_refresh"
    PASSWORD_CHANGE = "password_change"
    PASSWORD_RESET = "password_reset"
    PERMISSION_DENIED = "permission_denied"
    ROLE_CHANGE = "role_change"
    
    # CRUD Operations
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    BULK_CREATE = "bulk_create"
    BULK_UPDATE = "bulk_update"
    BULK_DELETE = "bulk_delete"
    
    # Data Access
    EXPORT_DATA = "export_data"
    IMPORT_DATA = "import_data"
    VIEW_SENSITIVE = "view_sensitive"
    DOWNLOAD_FILE = "download_file"
    UPLOAD_FILE = "upload_file"
    
    # Financial Operations
    PAYMENT_CREATED = "payment_created"
    PAYMENT_UPDATED = "payment_updated"
    PAYMENT_DELETED = "payment_deleted"
    PAYMENT_PROCESSED = "payment_processed"
    PAYMENT_FAILED = "payment_failed"
    PAYMENT_APPROVED = "payment_approved"
    PAYMENT_REJECTED = "payment_rejected"
    PAYMENT_RECONCILED = "payment_reconciled"
    PAYMENT_VOIDED = "payment_voided"
    PAYMENT_STATUS_CHANGED = "payment_status_changed"
    PAYMENT_STATUS_CHANGE_FAILED = "payment_status_change_failed"
    PAYMENT_APPROVAL_FAILED = "payment_approval_failed"
    REFUND_PROCESSED = "refund_processed"
    REFUND_CREATED = "refund_created"
    REFUND_INITIATED = "refund_initiated"
    REFUND_FAILED = "refund_failed"
    REFUND_APPROVED = "refund_approved"
    REFUND_REJECTED = "refund_rejected"
    FEE_STRUCTURE_CHANGED = "fee_structure_changed"
    FEE_STRUCTURE_CREATED = "fee_structure_created"
    FEE_TEMPLATE_CREATED = "fee_template_created"
    FEE_TEMPLATE_UPDATED = "fee_template_updated"
    FEE_TEMPLATE_DELETED = "fee_template_deleted"
    
    # Academic Operations
    GRADE_CREATED = "grade_created"
    GRADE_UPDATED = "grade_updated"
    GRADE_DELETED = "grade_deleted"
    EXAM_CREATED = "exam_created"
    EXAM_UPDATED = "exam_updated"
    EXAM_DELETED = "exam_deleted"
    REPORT_GENERATED = "report_generated"
    
    # Communication
    MESSAGE_SENT = "message_sent"
    ANNOUNCEMENT_CREATED = "announcement_created"
    NOTIFICATION_SENT = "notification_sent"
    
    # System Operations
    SETTINGS_CHANGED = "settings_changed"
    BRANCH_CREATED = "branch_created"
    BRANCH_UPDATED = "branch_updated"
    BRANCH_DELETED = "branch_deleted"
    BACKUP_CREATED = "backup_created"
    RESTORE_EXECUTED = "restore_executed"
    
    # Security Events
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    BRUTE_FORCE_ATTEMPT = "brute_force_attempt"
    PRIVILEGE_ESCALATION = "privilege_escalation"
    CROSS_BRANCH_ACCESS = "cross_branch_access"
    DATA_BREACH_ATTEMPT = "data_breach_attempt"

class AuditSeverity(str, Enum):
    """Severity levels for audit events"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class AuditLogger:
    """Main audit logging class for tracking all system activities"""
    
    def __init__(self, db_url: Optional[str] = None):
        """
        Initialize audit logger
        Args:
            db_url: MongoDB connection string for storing audit logs
        """
        self.db_url = db_url or os.getenv("DATABASE_URL", "mongodb://localhost:27017/school_db")
        self.client = None
        self.db = None
        self.collection = None
        self._initialized = False
        
    async def initialize(self):
        """Initialize database connection for audit logs"""
        if self._initialized:
            return
            
        try:
            self.client = AsyncIOMotorClient(self.db_url)
            self.db = self.client.school_db
            self.collection = self.db.audit_logs
            
            # Create indexes for efficient querying
            await self.collection.create_index([("timestamp", DESCENDING)])
            await self.collection.create_index([("user_id", ASCENDING)])
            await self.collection.create_index([("action", ASCENDING)])
            await self.collection.create_index([("severity", ASCENDING)])
            await self.collection.create_index([("resource_type", ASCENDING)])
            await self.collection.create_index([("branch_id", ASCENDING)])
            await self.collection.create_index([
                ("timestamp", DESCENDING),
                ("severity", ASCENDING)
            ])
            
            # TTL index for automatic log rotation (keep logs for 1 year)
            await self.collection.create_index(
                [("timestamp", ASCENDING)],
                expireAfterSeconds=365 * 24 * 60 * 60
            )
            
            self._initialized = True
            audit_logger.info("Audit logger initialized successfully")
            
        except Exception as e:
            audit_logger.error(f"Failed to initialize audit logger: {e}")
            raise
    
    async def log_event(
        self,
        action: AuditAction,
        user_id: Optional[str] = None,
        user_email: Optional[str] = None,
        user_role: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        severity: AuditSeverity = AuditSeverity.INFO,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        branch_id: Optional[str] = None,
        success: bool = True,
        error_message: Optional[str] = None
    ):
        """
        Log an audit event
        
        Args:
            action: Type of action performed
            user_id: ID of user performing the action
            user_email: Email of user performing the action
            user_role: Role of user performing the action
            resource_type: Type of resource affected (e.g., "student", "payment")
            resource_id: ID of resource affected
            details: Additional details about the action
            severity: Severity level of the event
            ip_address: IP address of the user
            user_agent: User agent string
            branch_id: Branch ID for branch-specific actions
            success: Whether the action was successful
            error_message: Error message if action failed
        """
        if not self._initialized:
            await self.initialize()
        
        # Create audit log entry
        audit_entry = {
            "timestamp": datetime.utcnow(),
            "action": action.value if isinstance(action, AuditAction) else action,
            "severity": severity.value if isinstance(severity, AuditSeverity) else severity,
            "success": success,
            "user": {
                "id": user_id,
                "email": user_email,
                "role": user_role
            },
            "resource": {
                "type": resource_type,
                "id": resource_id
            },
            "details": details or {},
            "metadata": {
                "ip_address": ip_address,
                "user_agent": user_agent,
                "branch_id": branch_id
            },
            "error": error_message
        }
        
        # Remove None values
        audit_entry = {k: v for k, v in audit_entry.items() if v is not None}
        audit_entry["user"] = {k: v for k, v in audit_entry["user"].items() if v is not None}
        audit_entry["resource"] = {k: v for k, v in audit_entry["resource"].items() if v is not None}
        audit_entry["metadata"] = {k: v for k, v in audit_entry["metadata"].items() if v is not None}
        
        try:
            # Store in database
            if self.collection:
                await self.collection.insert_one(audit_entry)
            
            # Log to file
            log_message = json.dumps(audit_entry, default=str, ensure_ascii=False)
            
            if severity == AuditSeverity.CRITICAL:
                audit_logger.critical(log_message)
            elif severity == AuditSeverity.ERROR:
                audit_logger.error(log_message)
            elif severity == AuditSeverity.WARNING:
                audit_logger.warning(log_message)
            else:
                audit_logger.info(log_message)
                
        except Exception as e:
            audit_logger.error(f"Failed to log audit event: {e}")
    
    async def log_permission_check(
        self,
        user_id: str,
        user_role: str,
        required_permission: str,
        granted: bool,
        endpoint: str,
        method: str,
        ip_address: Optional[str] = None,
        branch_id: Optional[str] = None
    ):
        """
        Log a permission check event
        """
        await self.log_event(
            action=AuditAction.PERMISSION_DENIED if not granted else AuditAction.READ,
            user_id=user_id,
            user_role=user_role,
            resource_type="endpoint",
            resource_id=f"{method} {endpoint}",
            details={
                "required_permission": required_permission,
                "granted": granted,
                "endpoint": endpoint,
                "method": method
            },
            severity=AuditSeverity.WARNING if not granted else AuditSeverity.INFO,
            ip_address=ip_address,
            branch_id=branch_id,
            success=granted
        )
    
    async def log_login_attempt(
        self,
        email: str,
        success: bool,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        failure_reason: Optional[str] = None
    ):
        """
        Log a login attempt
        """
        await self.log_event(
            action=AuditAction.LOGIN if success else AuditAction.LOGIN_FAILED,
            user_email=email,
            details={
                "login_time": datetime.utcnow().isoformat(),
                "failure_reason": failure_reason
            },
            severity=AuditSeverity.INFO if success else AuditSeverity.WARNING,
            ip_address=ip_address,
            user_agent=user_agent,
            success=success,
            error_message=failure_reason
        )
    
    async def log_data_access(
        self,
        user_id: str,
        user_role: str,
        resource_type: str,
        resource_id: str,
        action: str,
        fields_accessed: Optional[List[str]] = None,
        ip_address: Optional[str] = None,
        branch_id: Optional[str] = None
    ):
        """
        Log data access event
        """
        await self.log_event(
            action=action,
            user_id=user_id,
            user_role=user_role,
            resource_type=resource_type,
            resource_id=resource_id,
            details={
                "fields_accessed": fields_accessed,
                "access_time": datetime.utcnow().isoformat()
            },
            severity=AuditSeverity.INFO,
            ip_address=ip_address,
            branch_id=branch_id,
            success=True
        )
    
    async def log_security_event(
        self,
        event_type: str,
        user_id: Optional[str] = None,
        details: Dict[str, Any] = None,
        ip_address: Optional[str] = None,
        severity: AuditSeverity = AuditSeverity.CRITICAL
    ):
        """
        Log a security event
        """
        await self.log_event(
            action=AuditAction.SUSPICIOUS_ACTIVITY,
            user_id=user_id,
            details={
                "event_type": event_type,
                "event_details": details,
                "detected_at": datetime.utcnow().isoformat()
            },
            severity=severity,
            ip_address=ip_address,
            success=False
        )
    
    async def get_user_activity(
        self,
        user_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Get activity logs for a specific user
        """
        if not self._initialized:
            await self.initialize()
        
        query = {"user.id": user_id}
        
        if start_date or end_date:
            query["timestamp"] = {}
            if start_date:
                query["timestamp"]["$gte"] = start_date
            if end_date:
                query["timestamp"]["$lte"] = end_date
        
        cursor = self.collection.find(query).sort("timestamp", -1).limit(limit)
        return await cursor.to_list(length=limit)
    
    async def get_security_events(
        self,
        severity: Optional[AuditSeverity] = None,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """
        Get recent security events
        """
        if not self._initialized:
            await self.initialize()
        
        since = datetime.utcnow() - timedelta(hours=hours)
        query = {
            "timestamp": {"$gte": since},
            "action": {"$in": [
                AuditAction.SUSPICIOUS_ACTIVITY.value,
                AuditAction.PERMISSION_DENIED.value,
                AuditAction.LOGIN_FAILED.value,
                AuditAction.BRUTE_FORCE_ATTEMPT.value,
                AuditAction.PRIVILEGE_ESCALATION.value,
                AuditAction.CROSS_BRANCH_ACCESS.value,
                AuditAction.DATA_BREACH_ATTEMPT.value
            ]}
        }
        
        if severity:
            query["severity"] = severity.value
        
        cursor = self.collection.find(query).sort("timestamp", -1)
        return await cursor.to_list(length=1000)
    
    async def detect_brute_force(
        self,
        email: str,
        window_minutes: int = 5,
        max_attempts: int = 5
    ) -> bool:
        """
        Detect potential brute force attacks
        """
        if not self._initialized:
            await self.initialize()
        
        since = datetime.utcnow() - timedelta(minutes=window_minutes)
        
        count = await self.collection.count_documents({
            "action": AuditAction.LOGIN_FAILED.value,
            "user.email": email,
            "timestamp": {"$gte": since}
        })
        
        if count >= max_attempts:
            await self.log_security_event(
                event_type="brute_force_detected",
                details={
                    "email": email,
                    "attempts": count,
                    "window_minutes": window_minutes
                },
                severity=AuditSeverity.CRITICAL
            )
            return True
        
        return False
    
    async def cleanup_old_logs(self, days: int = 365):
        """
        Clean up old audit logs
        """
        if not self._initialized:
            await self.initialize()
        
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        
        result = await self.collection.delete_many({
            "timestamp": {"$lt": cutoff_date}
        })
        
        await self.log_event(
            action=AuditAction.DELETE,
            resource_type="audit_logs",
            details={
                "deleted_count": result.deleted_count,
                "cutoff_date": cutoff_date.isoformat(),
                "retention_days": days
            },
            severity=AuditSeverity.INFO
        )
        
        return result.deleted_count

# Global audit logger instance
_audit_logger_instance = None

def get_audit_logger() -> AuditLogger:
    """Get or create the global audit logger instance"""
    global _audit_logger_instance
    if _audit_logger_instance is None:
        _audit_logger_instance = AuditLogger()
    return _audit_logger_instance

# Decorator for automatic audit logging
def audit_action(
    action: AuditAction,
    resource_type: Optional[str] = None,
    severity: AuditSeverity = AuditSeverity.INFO
):
    """
    Decorator to automatically log actions
    
    Usage:
        @audit_action(AuditAction.CREATE, resource_type="student")
        async def create_student(...):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            audit_log = get_audit_logger()
            
            # Extract user info from kwargs if available
            current_user = kwargs.get('current_user', {})
            user_id = current_user.get('user_id')
            user_email = current_user.get('email')
            user_role = current_user.get('role')
            branch_id = current_user.get('branch_id')
            
            # Extract resource ID if available
            resource_id = None
            if len(args) > 1 and hasattr(args[1], 'id'):
                resource_id = args[1].id
            elif 'id' in kwargs:
                resource_id = kwargs['id']
            
            try:
                # Execute the function
                result = await func(*args, **kwargs)
                
                # Log successful action
                await audit_log.log_event(
                    action=action,
                    user_id=user_id,
                    user_email=user_email,
                    user_role=user_role,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    branch_id=branch_id,
                    severity=severity,
                    success=True,
                    details={
                        "function": func.__name__,
                        "module": func.__module__
                    }
                )
                
                return result
                
            except Exception as e:
                # Log failed action
                await audit_log.log_event(
                    action=action,
                    user_id=user_id,
                    user_email=user_email,
                    user_role=user_role,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    branch_id=branch_id,
                    severity=AuditSeverity.ERROR,
                    success=False,
                    error_message=str(e),
                    details={
                        "function": func.__name__,
                        "module": func.__module__,
                        "error_type": type(e).__name__
                    }
                )
                raise
                
        return wrapper
    return decorator

# Export all necessary components
__all__ = [
    'AuditAction',
    'AuditSeverity',
    'AuditLogger',
    'get_audit_logger',
    'audit_action'
]