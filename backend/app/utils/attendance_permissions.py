"""
Attendance-specific permission decorators and helper functions
"""
from typing import Dict, Any, Optional
from fastapi import HTTPException, Depends, status
from functools import wraps

from .rbac import get_current_user, require_permission, Permission, Role
from ..db import get_db
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

class AttendancePermissions:
    """Helper class for attendance-related permission checks"""
    
    @staticmethod
    async def can_create_attendance(current_user: Dict[str, Any]) -> bool:
        """Check if user can create attendance records"""
        return current_user.get("role") in ["admin", "teacher", "superadmin", "branch_admin", "hq_admin"]
    
    @staticmethod
    async def can_bulk_attendance(current_user: Dict[str, Any]) -> bool:
        """Check if user can create bulk attendance records"""
        return current_user.get("role") in ["admin", "teacher", "superadmin", "branch_admin", "hq_admin"]
    
    @staticmethod
    async def can_view_attendance_summary(current_user: Dict[str, Any], student_id: str = None) -> bool:
        """Check if user can view attendance summary"""
        user_role = current_user.get("role")
        user_id = str(current_user.get("user_id"))
        
        # Admins and teachers can view all summaries
        if user_role in ["admin", "teacher", "superadmin", "branch_admin", "hq_admin"]:
            return True
        
        # Parents can only view their children's summaries
        if user_role == "parent" and student_id:
            return await AttendancePermissions._is_parent_of_student(user_id, student_id)
        
        # Students can only view their own summary
        if user_role == "student" and student_id:
            return await AttendancePermissions._is_same_student(user_id, student_id)
        
        return False
    
    @staticmethod
    async def can_manage_alerts(current_user: Dict[str, Any]) -> bool:
        """Check if user can manage attendance alerts"""
        return current_user.get("role") in ["admin", "superadmin", "branch_admin", "hq_admin", "principal"]
    
    @staticmethod
    async def can_view_patterns(current_user: Dict[str, Any], student_id: str = None) -> bool:
        """Check if user can view attendance patterns"""
        user_role = current_user.get("role")
        
        # Staff can view patterns for monitoring purposes
        if user_role in ["admin", "teacher", "superadmin", "branch_admin", "hq_admin", "principal", "counselor"]:
            return True
        
        return False
    
    @staticmethod
    async def can_generate_reports(current_user: Dict[str, Any]) -> bool:
        """Check if user can generate attendance reports"""
        return current_user.get("role") in ["admin", "teacher", "superadmin", "branch_admin", "hq_admin", "principal"]
    
    @staticmethod
    async def can_configure_settings(current_user: Dict[str, Any]) -> bool:
        """Check if user can configure attendance settings"""
        return current_user.get("role") in ["admin", "superadmin", "branch_admin", "hq_admin"]
    
    @staticmethod
    async def can_access_class_attendance(current_user: Dict[str, Any], class_id: str) -> bool:
        """Check if user can access attendance for a specific class"""
        user_role = current_user.get("role")
        user_id = str(current_user.get("user_id"))
        
        # Admins have full access
        if user_role in ["admin", "superadmin", "branch_admin", "hq_admin"]:
            return True
        
        # Teachers can access classes they teach
        if user_role == "teacher":
            return await AttendancePermissions._teaches_class(user_id, class_id)
        
        return False
    
    @staticmethod
    async def filter_students_by_access(current_user: Dict[str, Any], student_ids: list) -> list:
        """Filter student IDs based on user access permissions"""
        user_role = current_user.get("role")
        user_id = str(current_user.get("user_id"))
        
        # Admins and teachers have access to all students in their branch
        if user_role in ["admin", "teacher", "superadmin", "branch_admin", "hq_admin"]:
            # Apply branch filtering if not superadmin
            if user_role != "superadmin":
                branch_id = current_user.get("branch_id")
                if branch_id:
                    return await AttendancePermissions._filter_students_by_branch(student_ids, branch_id)
            return student_ids
        
        # Parents can only access their children
        if user_role == "parent":
            return await AttendancePermissions._get_parent_children(user_id, student_ids)
        
        # Students can only access themselves
        if user_role == "student":
            student_record = await AttendancePermissions._get_student_by_user_id(user_id)
            if student_record and str(student_record["_id"]) in student_ids:
                return [str(student_record["_id"])]
        
        return []
    
    # Helper methods for database checks
    @staticmethod
    async def _is_parent_of_student(parent_user_id: str, student_id: str) -> bool:
        """Check if user is parent of the student"""
        try:
            db = get_db()
            parent = await db.users.find_one({
                "_id": ObjectId(parent_user_id),
                "role": "parent",
                "children_ids": student_id
            })
            return parent is not None
        except Exception as e:
            logger.error(f"Error checking parent-student relationship: {str(e)}")
            return False
    
    @staticmethod
    async def _is_same_student(user_id: str, student_id: str) -> bool:
        """Check if user_id corresponds to the same student"""
        try:
            db = get_db()
            student = await db.students.find_one({
                "_id": ObjectId(student_id),
                "user_id": user_id
            })
            return student is not None
        except Exception as e:
            logger.error(f"Error checking student identity: {str(e)}")
            return False
    
    @staticmethod
    async def _teaches_class(teacher_user_id: str, class_id: str) -> bool:
        """Check if teacher teaches the specified class"""
        try:
            db = get_db()
            # Check if teacher is assigned to this class
            class_assignment = await db.class_assignments.find_one({
                "teacher_id": teacher_user_id,
                "class_id": class_id
            })
            if class_assignment:
                return True
            
            # Also check if teacher is the main class teacher
            class_info = await db.classes.find_one({
                "_id": ObjectId(class_id),
                "teacher_id": teacher_user_id
            })
            return class_info is not None
        except Exception as e:
            logger.error(f"Error checking teacher-class relationship: {str(e)}")
            return False
    
    @staticmethod
    async def _filter_students_by_branch(student_ids: list, branch_id: str) -> list:
        """Filter students by branch"""
        try:
            db = get_db()
            students = await db.students.find({
                "_id": {"$in": [ObjectId(sid) for sid in student_ids]},
                "branch_id": branch_id
            }).to_list(None)
            
            return [str(student["_id"]) for student in students]
        except Exception as e:
            logger.error(f"Error filtering students by branch: {str(e)}")
            return []
    
    @staticmethod
    async def _get_parent_children(parent_user_id: str, student_ids: list) -> list:
        """Get parent's children from the provided student IDs"""
        try:
            db = get_db()
            parent = await db.users.find_one({
                "_id": ObjectId(parent_user_id),
                "role": "parent"
            })
            
            if not parent:
                return []
            
            children_ids = parent.get("children_ids", [])
            return [sid for sid in student_ids if sid in children_ids]
        except Exception as e:
            logger.error(f"Error getting parent children: {str(e)}")
            return []
    
    @staticmethod
    async def _get_student_by_user_id(user_id: str) -> Optional[Dict[str, Any]]:
        """Get student record by user ID"""
        try:
            db = get_db()
            student = await db.students.find_one({"user_id": user_id})
            return student
        except Exception as e:
            logger.error(f"Error getting student by user ID: {str(e)}")
            return None

# Decorators for common attendance permission checks
def require_attendance_create():
    """Decorator to require attendance creation permissions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user') or args[-1]  # Assume current_user is last arg
            
            if not await AttendancePermissions.can_create_attendance(current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to create attendance records"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_attendance_bulk():
    """Decorator to require bulk attendance permissions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user') or args[-1]
            
            if not await AttendancePermissions.can_bulk_attendance(current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions for bulk attendance operations"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator

def require_attendance_management():
    """Decorator to require attendance management permissions"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            current_user = kwargs.get('current_user') or args[-1]
            
            if not await AttendancePermissions.can_manage_alerts(current_user):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions for attendance management"
                )
            
            return await func(*args, **kwargs)
        return wrapper
    return decorator