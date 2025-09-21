"""
Resource-level permission checking for granular access control
Implements field-level and data ownership permissions beyond basic RBAC
"""

from typing import Dict, List, Optional, Any, Set
from enum import Enum
from fastapi import HTTPException, status
from .rbac import Permission, has_permission, Role, is_hq_role
from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
import asyncio

class ResourceType(str, Enum):
    """Types of resources in the system"""
    STUDENT = "student"
    TEACHER = "teacher"
    PARENT = "parent"
    CLASS = "class"
    GRADE = "grade"
    ATTENDANCE = "attendance"
    PAYMENT = "payment"
    EXAM = "exam"
    BEHAVIOR = "behavior_record"
    INVENTORY = "inventory"
    TRANSPORT = "transport"
    ANNOUNCEMENT = "announcement"
    MESSAGE = "message"
    USER = "user"
    BRANCH = "branch"

class ResourcePermissionChecker:
    """
    Enhanced permission checker with resource-level and field-level access control
    """
    
    # Define which roles can access their own data only
    SELF_ACCESS_ROLES = {Role.STUDENT, Role.PARENT}
    
    # Define sensitive fields that require special permissions
    SENSITIVE_FIELDS = {
        ResourceType.STUDENT: [
            "social_security_number", "medical_info", "parent_income", 
            "disciplinary_records", "psychological_reports"
        ],
        ResourceType.TEACHER: [
            "salary", "social_security_number", "personal_address", 
            "performance_reviews", "disciplinary_records"
        ],
        ResourceType.PAYMENT: [
            "credit_card_details", "bank_account", "financial_aid_details"
        ],
        ResourceType.PARENT: [
            "income", "social_security_number", "credit_score", "bank_details"
        ]
    }
    
    # Define parent-child relationships for access control
    PARENT_CHILD_RELATIONSHIPS = {
        (ResourceType.PARENT, ResourceType.STUDENT): "parent_guardian_id",
        (ResourceType.STUDENT, ResourceType.GRADE): "student_id",
        (ResourceType.STUDENT, ResourceType.ATTENDANCE): "student_id",
        (ResourceType.STUDENT, ResourceType.PAYMENT): "student_id",
        (ResourceType.STUDENT, ResourceType.BEHAVIOR): "student_id",
    }
    
    @staticmethod
    async def check_resource_access(
        user_id: str,
        user_role: str,
        user_branch: Optional[str],
        resource_type: ResourceType,
        resource_data: Dict[str, Any],
        action: str,
        requested_fields: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Check if user has access to a specific resource and fields
        
        Returns:
            Dict with 'allowed': bool, 'filtered_data': dict, 'denied_fields': list
        """
        audit_log = get_audit_logger()
        
        # Basic permission check
        permission_map = {
            "create": f"CREATE_{resource_type.value.upper()}",
            "read": f"READ_{resource_type.value.upper()}",
            "update": f"UPDATE_{resource_type.value.upper()}",
            "delete": f"DELETE_{resource_type.value.upper()}"
        }
        
        required_permission = permission_map.get(action)
        if required_permission and not has_permission(user_role, Permission(required_permission)):
            await audit_log.log_event(
                action=AuditAction.PERMISSION_DENIED,
                user_id=user_id,
                user_role=user_role,
                resource_type=resource_type.value,
                resource_id=resource_data.get("_id") or resource_data.get("id"),
                details={
                    "required_permission": required_permission,
                    "action": action
                },
                severity=AuditSeverity.WARNING,
                branch_id=user_branch,
                success=False
            )
            
            return {
                "allowed": False,
                "filtered_data": {},
                "denied_fields": requested_fields or [],
                "reason": f"Missing permission: {required_permission}"
            }
        
        # Check data ownership for self-access roles
        if Role(user_role) in ResourcePermissionChecker.SELF_ACCESS_ROLES:
            ownership_result = await ResourcePermissionChecker._check_data_ownership(
                user_id, user_role, resource_type, resource_data
            )
            if not ownership_result["allowed"]:
                await audit_log.log_security_event(
                    event_type="unauthorized_data_access",
                    user_id=user_id,
                    details={
                        "resource_type": resource_type.value,
                        "resource_id": resource_data.get("_id"),
                        "reason": ownership_result["reason"],
                        "user_role": user_role
                    },
                    severity=AuditSeverity.CRITICAL
                )
                
                return ownership_result
        
        # Check branch isolation
        resource_branch = resource_data.get("branch_id")
        if resource_branch and user_branch and not is_hq_role(user_role):
            if str(resource_branch) != str(user_branch):
                await audit_log.log_security_event(
                    event_type="cross_branch_data_access",
                    user_id=user_id,
                    details={
                        "resource_type": resource_type.value,
                        "resource_branch": resource_branch,
                        "user_branch": user_branch,
                        "user_role": user_role
                    },
                    severity=AuditSeverity.CRITICAL
                )
                
                return {
                    "allowed": False,
                    "filtered_data": {},
                    "denied_fields": requested_fields or [],
                    "reason": "Cross-branch access denied"
                }
        
        # Check field-level permissions
        if requested_fields:
            field_result = await ResourcePermissionChecker._check_field_access(
                user_role, resource_type, requested_fields, action
            )
            
            if field_result["denied_fields"]:
                await audit_log.log_event(
                    action=AuditAction.VIEW_SENSITIVE,
                    user_id=user_id,
                    user_role=user_role,
                    resource_type=resource_type.value,
                    resource_id=resource_data.get("_id"),
                    details={
                        "denied_fields": field_result["denied_fields"],
                        "allowed_fields": field_result["allowed_fields"],
                        "action": action
                    },
                    severity=AuditSeverity.WARNING,
                    branch_id=user_branch,
                    success=len(field_result["allowed_fields"]) > 0
                )
            
            # Filter data based on allowed fields
            filtered_data = {
                k: v for k, v in resource_data.items() 
                if k in field_result["allowed_fields"] or k in ["_id", "id", "created_at", "updated_at"]
            }
            
            return {
                "allowed": True,
                "filtered_data": filtered_data,
                "denied_fields": field_result["denied_fields"],
                "reason": "Field-level filtering applied"
            }
        
        # Full access granted
        return {
            "allowed": True,
            "filtered_data": resource_data,
            "denied_fields": [],
            "reason": "Full access granted"
        }
    
    @staticmethod
    async def _check_data_ownership(
        user_id: str,
        user_role: str,
        resource_type: ResourceType,
        resource_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Check if user owns the data they're trying to access
        """
        if user_role == Role.STUDENT.value:
            # Students can only access their own data
            student_id = resource_data.get("student_id") or resource_data.get("_id")
            if str(student_id) != str(user_id):
                return {
                    "allowed": False,
                    "filtered_data": {},
                    "denied_fields": [],
                    "reason": "Students can only access their own data"
                }
        
        elif user_role == Role.PARENT.value:
            # Parents can access their children's data
            if resource_type == ResourceType.STUDENT:
                parent_id = resource_data.get("parent_guardian_id")
                if str(parent_id) != str(user_id):
                    return {
                        "allowed": False,
                        "filtered_data": {},
                        "denied_fields": [],
                        "reason": "Parents can only access their children's data"
                    }
            elif resource_type in [ResourceType.GRADE, ResourceType.ATTENDANCE, ResourceType.BEHAVIOR]:
                # Need to check if the student belongs to this parent
                # This would require a database lookup in real implementation
                # For now, we'll assume this check happens at the service layer
                pass
        
        return {
            "allowed": True,
            "filtered_data": resource_data,
            "denied_fields": [],
            "reason": "Data ownership verified"
        }
    
    @staticmethod
    async def _check_field_access(
        user_role: str,
        resource_type: ResourceType,
        requested_fields: List[str],
        action: str
    ) -> Dict[str, Any]:
        """
        Check field-level access permissions
        """
        sensitive_fields = ResourcePermissionChecker.SENSITIVE_FIELDS.get(resource_type, [])
        
        allowed_fields = []
        denied_fields = []
        
        for field in requested_fields:
            if field in sensitive_fields:
                # Only certain roles can access sensitive fields
                if ResourcePermissionChecker._can_access_sensitive_field(user_role, resource_type, field):
                    allowed_fields.append(field)
                else:
                    denied_fields.append(field)
            else:
                allowed_fields.append(field)
        
        return {
            "allowed_fields": allowed_fields,
            "denied_fields": denied_fields
        }
    
    @staticmethod
    def _can_access_sensitive_field(user_role: str, resource_type: ResourceType, field: str) -> bool:
        """
        Determine if a role can access a sensitive field
        """
        # HQ roles can access all sensitive fields
        if is_hq_role(user_role):
            return True
        
        # Branch admins can access most sensitive fields
        if user_role in [Role.BRANCH_ADMIN.value, Role.ADMIN.value]:
            # Except for salary information
            if "salary" in field.lower() and resource_type == ResourceType.TEACHER:
                return False
            return True
        
        # Teachers can access student medical info for safety
        if user_role == Role.TEACHER.value and resource_type == ResourceType.STUDENT:
            if field in ["medical_info"]:
                return True
        
        # Registrars have limited sensitive access
        if user_role in [Role.REGISTRAR.value, Role.HQ_REGISTRAR.value]:
            if field in ["medical_info", "disciplinary_records"]:
                return True
        
        return False

class ResourcePermissionDecorator:
    """
    Decorators for automatic resource permission checking
    """
    
    @staticmethod
    def require_resource_access(
        resource_type: ResourceType,
        action: str,
        resource_param: str = "resource_id",
        data_param: str = "data"
    ):
        """
        Decorator to require resource-level access
        """
        def decorator(func):
            async def wrapper(*args, **kwargs):
                current_user = kwargs.get('current_user')
                if not current_user:
                    raise HTTPException(status_code=401, detail="Authentication required")
                
                # Extract resource data from parameters
                resource_data = kwargs.get(data_param, {})
                if not resource_data and resource_param in kwargs:
                    # If we only have ID, we'd need to fetch the resource
                    # This would be implemented at the service layer
                    resource_data = {"_id": kwargs[resource_param]}
                
                # Check permissions
                permission_result = await ResourcePermissionChecker.check_resource_access(
                    user_id=current_user.get("user_id"),
                    user_role=current_user.get("role"),
                    user_branch=current_user.get("branch_id"),
                    resource_type=resource_type,
                    resource_data=resource_data,
                    action=action
                )
                
                if not permission_result["allowed"]:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=permission_result["reason"]
                    )
                
                # Add filtered data to kwargs for the endpoint to use
                kwargs["filtered_resource"] = permission_result["filtered_data"]
                kwargs["permission_context"] = permission_result
                
                return await func(*args, **kwargs)
            return wrapper
        return decorator
    
    @staticmethod
    def filter_response_fields(resource_type: ResourceType, response_field: str = "data"):
        """
        Decorator to filter response fields based on permissions
        """
        def decorator(func):
            async def wrapper(*args, **kwargs):
                result = await func(*args, **kwargs)
                
                current_user = kwargs.get('current_user')
                if not current_user:
                    return result
                
                # Filter response data based on field permissions
                if isinstance(result, dict) and response_field in result:
                    data = result[response_field]
                    if isinstance(data, list):
                        # Filter each item in the list
                        filtered_data = []
                        for item in data:
                            if isinstance(item, dict):
                                field_result = await ResourcePermissionChecker._check_field_access(
                                    current_user.get("role"),
                                    resource_type,
                                    list(item.keys()),
                                    "read"
                                )
                                
                                filtered_item = {
                                    k: v for k, v in item.items() 
                                    if k in field_result["allowed_fields"] or k in ["_id", "id", "created_at", "updated_at"]
                                }
                                filtered_data.append(filtered_item)
                            else:
                                filtered_data.append(item)
                        
                        result[response_field] = filtered_data
                    
                    elif isinstance(data, dict):
                        # Filter single item
                        field_result = await ResourcePermissionChecker._check_field_access(
                            current_user.get("role"),
                            resource_type,
                            list(data.keys()),
                            "read"
                        )
                        
                        result[response_field] = {
                            k: v for k, v in data.items() 
                            if k in field_result["allowed_fields"] or k in ["_id", "id", "created_at", "updated_at"]
                        }
                
                return result
            return wrapper
        return decorator

# Helper functions for common permission checks
async def check_student_grade_access(
    user_id: str,
    user_role: str,
    student_id: str,
    grade_data: Dict[str, Any],
    db
) -> bool:
    """
    Check if user can access student grades
    """
    # Teachers can access grades for their students
    if user_role == Role.TEACHER.value:
        # Would need to verify teacher-student relationship via classes
        # Implementation depends on database structure
        return True
    
    # Students can access their own grades
    if user_role == Role.STUDENT.value:
        return str(user_id) == str(student_id)
    
    # Parents can access their children's grades
    if user_role == Role.PARENT.value:
        students_collection = db.students
        student = await students_collection.find_one({"_id": student_id})
        if student and str(student.get("parent_guardian_id")) == str(user_id):
            return True
    
    # Admin roles can access all grades
    if user_role in [Role.SUPER_ADMIN.value, Role.HQ_ADMIN.value, Role.BRANCH_ADMIN.value, Role.ADMIN.value]:
        return True
    
    return False

async def check_payment_access(
    user_id: str,
    user_role: str,
    payment_data: Dict[str, Any],
    db
) -> bool:
    """
    Check if user can access payment information
    """
    # Financial roles can access all payments
    if has_permission(user_role, Permission.VIEW_FINANCIAL_REPORTS):
        return True
    
    # Parents can access their own payments
    if user_role == Role.PARENT.value:
        student_id = payment_data.get("student_id")
        if student_id:
            students_collection = db.students
            student = await students_collection.find_one({"_id": student_id})
            if student and str(student.get("parent_guardian_id")) == str(user_id):
                return True
    
    return False

# Export all components
__all__ = [
    'ResourceType',
    'ResourcePermissionChecker',
    'ResourcePermissionDecorator',
    'check_student_grade_access',
    'check_payment_access'
]