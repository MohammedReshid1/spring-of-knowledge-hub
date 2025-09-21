from enum import Enum
from typing import Dict, List, Set
from functools import wraps
from fastapi import HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .auth import decode_access_token
from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
import asyncio

security = HTTPBearer()

class Role(str, Enum):
    SUPER_ADMIN = "super_admin"
    HQ_ADMIN = "hq_admin"
    BRANCH_ADMIN = "branch_admin"
    HQ_REGISTRAR = "hq_registrar"
    REGISTRAR = "registrar"
    ADMIN = "admin"  # Legacy support
    TEACHER = "teacher"
    STUDENT = "student"
    PARENT = "parent"

class Permission(str, Enum):
    # User Management
    CREATE_USER = "create_user"
    READ_USER = "read_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    MANAGE_ROLES = "manage_roles"
    
    # Student Management
    CREATE_STUDENT = "create_student"
    READ_STUDENT = "read_student"
    UPDATE_STUDENT = "update_student"
    DELETE_STUDENT = "delete_student"
    BULK_IMPORT_STUDENTS = "bulk_import_students"
    
    # Academic Management
    CREATE_CLASS = "create_class"
    READ_CLASS = "read_class"
    UPDATE_CLASS = "update_class"
    DELETE_CLASS = "delete_class"
    ASSIGN_STUDENTS = "assign_students"
    
    # Teacher Management
    CREATE_TEACHER = "create_teacher"
    READ_TEACHER = "read_teacher"
    UPDATE_TEACHER = "update_teacher"
    DELETE_TEACHER = "delete_teacher"
    ASSIGN_SUBJECTS = "assign_subjects"
    
    # Attendance Management
    CREATE_ATTENDANCE = "create_attendance"
    READ_ATTENDANCE = "read_attendance"
    UPDATE_ATTENDANCE = "update_attendance"
    DELETE_ATTENDANCE = "delete_attendance"
    BULK_ATTENDANCE = "bulk_attendance"
    VIEW_ATTENDANCE_SUMMARY = "view_attendance_summary"
    MANAGE_ATTENDANCE_ALERTS = "manage_attendance_alerts"
    GENERATE_ATTENDANCE_REPORTS = "generate_attendance_reports"
    VIEW_ATTENDANCE_PATTERNS = "view_attendance_patterns"
    CONFIGURE_ATTENDANCE_SETTINGS = "configure_attendance_settings"
    
    # Financial Management
    CREATE_PAYMENT = "create_payment"
    READ_PAYMENT = "read_payment"
    UPDATE_PAYMENT = "update_payment"
    DELETE_PAYMENT = "delete_payment"
    PROCESS_REFUNDS = "process_refunds"
    VIEW_FINANCIAL_REPORTS = "view_financial_reports"
    
    # Academic Records
    CREATE_GRADE = "create_grade"
    READ_GRADE = "read_grade"
    UPDATE_GRADE = "update_grade"
    DELETE_GRADE = "delete_grade"
    VIEW_TRANSCRIPTS = "view_transcripts"
    
    # Behavior and Discipline
    CREATE_BEHAVIOR_RECORD = "create_behavior_record"
    READ_BEHAVIOR_RECORD = "read_behavior_record"
    UPDATE_BEHAVIOR_RECORD = "update_behavior_record"
    DELETE_BEHAVIOR_RECORD = "delete_behavior_record"
    
    # Reports and Analytics
    VIEW_REPORTS = "view_reports"
    CREATE_REPORTS = "create_reports"
    EXPORT_DATA = "export_data"
    VIEW_ANALYTICS = "view_analytics"
    
    # Communication
    SEND_MESSAGES = "send_messages"
    READ_MESSAGES = "read_messages"
    CREATE_ANNOUNCEMENTS = "create_announcements"
    MANAGE_NOTIFICATIONS = "manage_notifications"
    
    # System Administration
    MANAGE_BRANCHES = "manage_branches"
    SYSTEM_SETTINGS = "system_settings"
    BACKUP_RESTORE = "backup_restore"
    VIEW_LOGS = "view_logs"
    
    # Inventory Management
    CREATE_INVENTORY = "create_inventory"
    READ_INVENTORY = "read_inventory"
    UPDATE_INVENTORY = "update_inventory"
    DELETE_INVENTORY = "delete_inventory"
    
    # Transport Management
    CREATE_TRANSPORT = "create_transport"
    READ_TRANSPORT = "read_transport"
    UPDATE_TRANSPORT = "update_transport"
    DELETE_TRANSPORT = "delete_transport"

# Define role permissions mapping
ROLE_PERMISSIONS: Dict[Role, Set[Permission]] = {
    Role.SUPER_ADMIN: {
        # Full system access
        *[perm for perm in Permission],
    },
    
    Role.HQ_ADMIN: {
        # Most permissions except super admin specific ones
        Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER, Permission.DELETE_USER,
        Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT, Permission.DELETE_STUDENT,
        Permission.BULK_IMPORT_STUDENTS,
        Permission.CREATE_CLASS, Permission.READ_CLASS, Permission.UPDATE_CLASS, Permission.DELETE_CLASS,
        Permission.ASSIGN_STUDENTS,
        Permission.CREATE_TEACHER, Permission.READ_TEACHER, Permission.UPDATE_TEACHER, Permission.DELETE_TEACHER,
        Permission.ASSIGN_SUBJECTS,
        Permission.CREATE_PAYMENT, Permission.READ_PAYMENT, Permission.UPDATE_PAYMENT, Permission.DELETE_PAYMENT,
        Permission.PROCESS_REFUNDS, Permission.VIEW_FINANCIAL_REPORTS,
        Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE, Permission.DELETE_GRADE,
        Permission.VIEW_TRANSCRIPTS,
        Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE, Permission.DELETE_ATTENDANCE,
        Permission.BULK_ATTENDANCE, Permission.VIEW_ATTENDANCE_SUMMARY, Permission.MANAGE_ATTENDANCE_ALERTS,
        Permission.GENERATE_ATTENDANCE_REPORTS, Permission.VIEW_ATTENDANCE_PATTERNS, Permission.CONFIGURE_ATTENDANCE_SETTINGS,
        Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD,
        Permission.DELETE_BEHAVIOR_RECORD,
        Permission.VIEW_REPORTS, Permission.CREATE_REPORTS, Permission.EXPORT_DATA, Permission.VIEW_ANALYTICS,
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES, Permission.CREATE_ANNOUNCEMENTS, Permission.MANAGE_NOTIFICATIONS,
        Permission.MANAGE_BRANCHES, Permission.SYSTEM_SETTINGS, Permission.BACKUP_RESTORE, Permission.VIEW_LOGS,
        Permission.CREATE_INVENTORY, Permission.READ_INVENTORY, Permission.UPDATE_INVENTORY, Permission.DELETE_INVENTORY,
        Permission.CREATE_TRANSPORT, Permission.READ_TRANSPORT, Permission.UPDATE_TRANSPORT, Permission.DELETE_TRANSPORT,
    },
    
    Role.BRANCH_ADMIN: {
        # Branch-level administration
        Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER,
        Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT, Permission.DELETE_STUDENT,
        Permission.BULK_IMPORT_STUDENTS,
        Permission.CREATE_CLASS, Permission.READ_CLASS, Permission.UPDATE_CLASS, Permission.DELETE_CLASS,
        Permission.ASSIGN_STUDENTS,
        Permission.CREATE_TEACHER, Permission.READ_TEACHER, Permission.UPDATE_TEACHER, Permission.DELETE_TEACHER,
        Permission.ASSIGN_SUBJECTS,
        Permission.CREATE_PAYMENT, Permission.READ_PAYMENT, Permission.UPDATE_PAYMENT, Permission.DELETE_PAYMENT,
        Permission.VIEW_FINANCIAL_REPORTS,
        Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE, Permission.DELETE_GRADE,
        Permission.VIEW_TRANSCRIPTS,
        Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE, Permission.DELETE_ATTENDANCE,
        Permission.BULK_ATTENDANCE, Permission.VIEW_ATTENDANCE_SUMMARY, Permission.MANAGE_ATTENDANCE_ALERTS,
        Permission.GENERATE_ATTENDANCE_REPORTS, Permission.VIEW_ATTENDANCE_PATTERNS, Permission.CONFIGURE_ATTENDANCE_SETTINGS,
        Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD,
        Permission.DELETE_BEHAVIOR_RECORD,
        Permission.VIEW_REPORTS, Permission.CREATE_REPORTS, Permission.EXPORT_DATA, Permission.VIEW_ANALYTICS,
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES, Permission.CREATE_ANNOUNCEMENTS, Permission.MANAGE_NOTIFICATIONS,
        Permission.CREATE_INVENTORY, Permission.READ_INVENTORY, Permission.UPDATE_INVENTORY, Permission.DELETE_INVENTORY,
        Permission.CREATE_TRANSPORT, Permission.READ_TRANSPORT, Permission.UPDATE_TRANSPORT, Permission.DELETE_TRANSPORT,
    },
    
    Role.HQ_REGISTRAR: {
        # HQ-level registrar permissions
        Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT,
        Permission.BULK_IMPORT_STUDENTS,
        Permission.READ_CLASS, Permission.ASSIGN_STUDENTS,
        Permission.READ_TEACHER,
        Permission.READ_PAYMENT, Permission.VIEW_FINANCIAL_REPORTS,
        Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
        Permission.VIEW_TRANSCRIPTS,
        Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
        Permission.READ_BEHAVIOR_RECORD,
        Permission.VIEW_REPORTS, Permission.EXPORT_DATA,
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES,
        Permission.READ_INVENTORY,
        Permission.READ_TRANSPORT,
    },
    
    Role.REGISTRAR: {
        # Branch-level registrar permissions
        Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT,
        Permission.BULK_IMPORT_STUDENTS,
        Permission.READ_CLASS, Permission.ASSIGN_STUDENTS,
        Permission.READ_TEACHER,
        Permission.READ_PAYMENT,
        Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
        Permission.VIEW_TRANSCRIPTS,
        Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
        Permission.READ_BEHAVIOR_RECORD,
        Permission.VIEW_REPORTS,
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES,
        Permission.READ_INVENTORY,
        Permission.READ_TRANSPORT,
    },
    
    Role.ADMIN: {
        # Legacy admin role - similar to branch admin
        Permission.CREATE_USER, Permission.READ_USER, Permission.UPDATE_USER,
        Permission.CREATE_STUDENT, Permission.READ_STUDENT, Permission.UPDATE_STUDENT, Permission.DELETE_STUDENT,
        Permission.CREATE_CLASS, Permission.READ_CLASS, Permission.UPDATE_CLASS, Permission.DELETE_CLASS,
        Permission.ASSIGN_STUDENTS,
        Permission.CREATE_TEACHER, Permission.READ_TEACHER, Permission.UPDATE_TEACHER, Permission.DELETE_TEACHER,
        Permission.ASSIGN_SUBJECTS,
        Permission.CREATE_PAYMENT, Permission.READ_PAYMENT, Permission.UPDATE_PAYMENT,
        Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
        Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
        Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD,
        Permission.VIEW_REPORTS, Permission.CREATE_REPORTS,
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES, Permission.CREATE_ANNOUNCEMENTS,
        Permission.CREATE_INVENTORY, Permission.READ_INVENTORY, Permission.UPDATE_INVENTORY,
        Permission.CREATE_TRANSPORT, Permission.READ_TRANSPORT, Permission.UPDATE_TRANSPORT,
    },
    
    Role.TEACHER: {
        # Teacher permissions
        Permission.READ_STUDENT, Permission.UPDATE_STUDENT,
        Permission.READ_CLASS,
        Permission.READ_TEACHER,
        Permission.READ_PAYMENT,
        Permission.CREATE_GRADE, Permission.READ_GRADE, Permission.UPDATE_GRADE,
        Permission.CREATE_ATTENDANCE, Permission.READ_ATTENDANCE, Permission.UPDATE_ATTENDANCE,
        Permission.BULK_ATTENDANCE, Permission.VIEW_ATTENDANCE_SUMMARY, Permission.GENERATE_ATTENDANCE_REPORTS,
        Permission.CREATE_BEHAVIOR_RECORD, Permission.READ_BEHAVIOR_RECORD, Permission.UPDATE_BEHAVIOR_RECORD,
        Permission.VIEW_REPORTS,
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES,
        Permission.READ_INVENTORY,
        Permission.READ_TRANSPORT,
    },
    
    Role.STUDENT: {
        # Student permissions
        Permission.READ_STUDENT,  # Only their own data
        Permission.READ_CLASS,    # Only their classes
        Permission.READ_GRADE,    # Only their grades
        Permission.READ_ATTENDANCE,  # Only their attendance
        Permission.READ_BEHAVIOR_RECORD,  # Only their records
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES,  # Limited messaging
    },
    
    Role.PARENT: {
        # Parent permissions
        Permission.READ_STUDENT,  # Only their children's data
        Permission.READ_CLASS,    # Only their children's classes
        Permission.READ_PAYMENT,  # Only their payment records
        Permission.READ_GRADE,    # Only their children's grades
        Permission.READ_ATTENDANCE,  # Only their children's attendance
        Permission.VIEW_ATTENDANCE_SUMMARY,  # View their children's attendance summary
        Permission.READ_BEHAVIOR_RECORD,  # Only their children's records
        Permission.SEND_MESSAGES, Permission.READ_MESSAGES,  # Communication with teachers
    },
}

# Define role hierarchy for access checks
ROLE_HIERARCHY: Dict[Role, int] = {
    Role.SUPER_ADMIN: 100,
    Role.HQ_ADMIN: 90,
    Role.BRANCH_ADMIN: 80,
    Role.HQ_REGISTRAR: 70,
    Role.REGISTRAR: 60,
    Role.ADMIN: 70,  # Legacy admin similar to registrar
    Role.TEACHER: 50,
    Role.STUDENT: 20,
    Role.PARENT: 30,
}

class RBACError(HTTPException):
    def __init__(self, detail: str = "Insufficient permissions"):
        super().__init__(status_code=403, detail=detail)

def has_permission(user_role: str, required_permission: Permission) -> bool:
    """Check if a user role has a specific permission."""
    try:
        # Handle legacy "superadmin" role format
        if user_role == "superadmin":
            user_role = "super_admin"
        
        role = Role(user_role)
        return required_permission in ROLE_PERMISSIONS.get(role, set())
    except ValueError:
        return False

def has_role_level(user_role: str, required_level: int) -> bool:
    """Check if a user role meets a minimum hierarchy level."""
    try:
        # Handle legacy "superadmin" role format
        if user_role == "superadmin":
            user_role = "super_admin"
        
        role = Role(user_role)
        return ROLE_HIERARCHY.get(role, 0) >= required_level
    except ValueError:
        return False

def can_access_role(user_role: str, target_role: str) -> bool:
    """Check if a user can access/manage another role."""
    try:
        # Handle legacy "superadmin" role format
        if user_role == "superadmin":
            user_role = "super_admin"
        if target_role == "superadmin":
            target_role = "super_admin"
            
        user_role_enum = Role(user_role)
        target_role_enum = Role(target_role)
        return ROLE_HIERARCHY.get(user_role_enum, 0) > ROLE_HIERARCHY.get(target_role_enum, 0)
    except ValueError:
        return False

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), request: Request = None):
    """Extract current user from JWT token with audit logging."""
    if not credentials:
        # Log failed authentication attempt
        audit_log = get_audit_logger()
        ip_address = None
        if request and hasattr(request, 'client'):
            ip_address = request.client.host if request.client else None
        
        asyncio.create_task(audit_log.log_event(
            action=AuditAction.LOGIN_FAILED,
            details={"reason": "No authorization header"},
            severity=AuditSeverity.WARNING,
            ip_address=ip_address,
            success=False
        ))
        raise HTTPException(status_code=401, detail="Authorization header required")
    
    payload = decode_access_token(credentials.credentials)
    if not payload:
        # Log invalid token attempt
        audit_log = get_audit_logger()
        ip_address = None
        if request and hasattr(request, 'client'):
            ip_address = request.client.host if request.client else None
        
        asyncio.create_task(audit_log.log_event(
            action=AuditAction.LOGIN_FAILED,
            details={"reason": "Invalid or expired token"},
            severity=AuditSeverity.WARNING,
            ip_address=ip_address,
            success=False
        ))
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    # Normalize role format for legacy compatibility
    user_role = payload.get('role')
    if user_role == 'superadmin':
        user_role = 'super_admin'
    
    return {
        'user_id': payload.get('sub'),
        'email': payload.get('email'),
        'role': user_role,
        'branch_id': payload.get('branch_id'),
        'full_name': payload.get('full_name', ''),
    }

def require_permission(permission: Permission):
    """Decorator to require specific permission with audit logging."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get current user from kwargs (should be injected by dependency)
            current_user = kwargs.get('current_user')
            if not current_user:
                raise RBACError("Authentication required")
            
            user_role = current_user.get('role')
            granted = has_permission(user_role, permission)
            
            # Log permission check
            audit_log = get_audit_logger()
            request = kwargs.get('request')
            ip_address = None
            if request and hasattr(request, 'client'):
                ip_address = request.client.host if request.client else None
            
            # Use asyncio.create_task to avoid blocking
            asyncio.create_task(audit_log.log_permission_check(
                user_id=current_user.get('user_id'),
                user_role=user_role,
                required_permission=permission.value,
                granted=granted,
                endpoint=func.__name__,
                method="DECORATOR",
                ip_address=ip_address,
                branch_id=current_user.get('branch_id')
            ))
            
            if not granted:
                raise RBACError(f"Permission '{permission}' required")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_role(required_role: Role):
    """Decorator to require specific role."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user')
            if not current_user:
                raise RBACError("Authentication required")
            
            user_role = current_user.get('role')
            if user_role != required_role:
                raise RBACError(f"Role '{required_role}' required")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_min_role_level(min_level: int):
    """Decorator to require minimum role hierarchy level."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user')
            if not current_user:
                raise RBACError("Authentication required")
            
            user_role = current_user.get('role')
            if not has_role_level(user_role, min_level):
                raise RBACError("Insufficient role level")
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_same_branch_or_hq():
    """Decorator to require same branch access or HQ role."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user')
            if not current_user:
                raise RBACError("Authentication required")
            
            user_role = current_user.get('role')
            user_branch_id = current_user.get('branch_id')
            
            # HQ roles can access all branches
            if user_role in [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.HQ_REGISTRAR]:
                return await func(*args, **kwargs)
            
            # For branch-specific roles, check branch access
            # This would need to be implemented based on the specific endpoint
            # For now, allow access if user has branch_id
            if user_branch_id:
                return await func(*args, **kwargs)
            
            raise RBACError("Branch access required")
        return wrapper
    return decorator

# Helper functions for common permission checks
def is_admin_role(role: str) -> bool:
    """Check if role is any type of admin."""
    # Handle legacy "superadmin" role format
    if role == "superadmin":
        role = "super_admin"
    return role in [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.BRANCH_ADMIN, Role.ADMIN]

def is_hq_role(role: str) -> bool:
    """Check if role is HQ-level."""
    # Handle legacy "superadmin" role format
    if role == "superadmin":
        role = "super_admin"
    return role in [Role.SUPER_ADMIN, Role.HQ_ADMIN, Role.HQ_REGISTRAR]

def is_registrar_role(role: str) -> bool:
    """Check if role is any type of registrar."""
    return role in [Role.HQ_REGISTRAR, Role.REGISTRAR]

def can_manage_users(role: str) -> bool:
    """Check if role can manage users."""
    return has_permission(role, Permission.CREATE_USER)

def can_view_financial_data(role: str) -> bool:
    """Check if role can view financial data."""
    return has_permission(role, Permission.VIEW_FINANCIAL_REPORTS)

def can_manage_academic_records(role: str) -> bool:
    """Check if role can manage academic records."""
    return has_permission(role, Permission.CREATE_GRADE)

# Export commonly used functions and classes
__all__ = [
    'Role', 'Permission', 'RBACError',
    'has_permission', 'has_role_level', 'can_access_role',
    'get_current_user', 'require_permission', 'require_role', 
    'require_min_role_level', 'require_same_branch_or_hq',
    'is_admin_role', 'is_hq_role', 'is_registrar_role',
    'can_manage_users', 'can_view_financial_data', 'can_manage_academic_records',
    'ROLE_PERMISSIONS', 'ROLE_HIERARCHY'
]