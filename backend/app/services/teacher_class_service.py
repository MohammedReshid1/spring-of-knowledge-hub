from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException, status
import logging

from ..models.teacher import Teacher
from ..models.school_class import SchoolClass
from ..models.student import Student
from ..utils.websocket_manager import WebSocketManager
from ..utils.audit_logger import get_audit_logger, AuditAction, AuditSeverity

logger = logging.getLogger(__name__)

class TeacherClassService:
    """Service for managing teacher-class assignments and permissions"""
    
    @staticmethod
    async def assign_teacher_to_class(
        class_id: str,
        teacher_id: str,
        classes_collection: Any,
        teachers_collection: Any,
        students_collection: Any,
        users_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Dict[str, Any]:
        """
        Assign a teacher to a class and automatically grant necessary permissions
        """
        audit_logger = get_audit_logger()
        
        try:
            # Validate class exists
            class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
            if not class_doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Class not found"
                )
            
            # Validate teacher exists  
            teacher_doc = await teachers_collection.find_one({"_id": ObjectId(teacher_id)})
            if not teacher_doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Teacher not found"
                )
            
            # Check if teacher is already assigned to another class in same time slot
            existing_assignment = await classes_collection.find_one({
                "teacher_id": teacher_id,
                "academic_year": class_doc["academic_year"],
                "_id": {"$ne": ObjectId(class_id)}
            })
            
            if existing_assignment:
                logger.warning(f"Teacher {teacher_id} already assigned to class {existing_assignment['_id']}")
            
            # Update class with teacher assignment
            await classes_collection.update_one(
                {"_id": ObjectId(class_id)},
                {
                    "$set": {
                        "teacher_id": teacher_id,
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Update teacher's assigned classes
            await teachers_collection.update_one(
                {"_id": ObjectId(teacher_id)},
                {
                    "$addToSet": {"assigned_classes": class_id},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            # Grant teacher access to class students
            await TeacherClassService._grant_teacher_class_permissions(
                teacher_id, class_id, class_doc, users_collection, audit_logger
            )
            
            # Get class students for roster sync
            students = await students_collection.find({"class_id": class_id}).to_list(None)
            student_count = len(students)
            
            # Update teacher's student roster access
            student_ids = [str(s["_id"]) for s in students]
            await teachers_collection.update_one(
                {"_id": ObjectId(teacher_id)},
                {
                    "$addToSet": {"accessible_students": {"$each": student_ids}},
                    "$set": {"last_roster_sync": datetime.utcnow()}
                }
            )
            
            # Log the assignment
            await audit_logger.log_user_action(
                user_id=teacher_id,
                action=AuditAction.ASSIGN,
                resource_type="class",
                resource_id=class_id,
                details={
                    "class_name": class_doc.get("class_name"),
                    "student_count": student_count,
                    "academic_year": class_doc.get("academic_year")
                },
                severity=AuditSeverity.INFO
            )
            
            # Broadcast real-time update
            if websocket_manager:
                await websocket_manager.broadcast_to_branch(
                    class_doc.get("branch_id"),
                    {
                        "type": "teacher_assigned",
                        "data": {
                            "teacher_id": teacher_id,
                            "teacher_name": teacher_doc.get("name", ""),
                            "class_id": class_id,
                            "class_name": class_doc.get("class_name"),
                            "student_count": student_count
                        }
                    }
                )
            
            return {
                "message": "Teacher successfully assigned to class",
                "class_id": class_id,
                "teacher_id": teacher_id,
                "student_count": student_count,
                "permissions_granted": True
            }
            
        except Exception as e:
            logger.error(f"Error assigning teacher to class: {e}")
            await audit_logger.log_system_event(
                event_type="teacher_assignment_failed",
                component="teacher_class_service",
                details={
                    "teacher_id": teacher_id,
                    "class_id": class_id,
                    "error": str(e)
                },
                severity=AuditSeverity.ERROR
            )
            raise
    
    @staticmethod
    async def unassign_teacher_from_class(
        class_id: str,
        classes_collection: Any,
        teachers_collection: Any,
        users_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Dict[str, Any]:
        """
        Remove teacher assignment from class and revoke permissions
        """
        audit_logger = get_audit_logger()
        
        try:
            # Get current class info
            class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
            if not class_doc:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Class not found"
                )
            
            current_teacher_id = class_doc.get("teacher_id")
            if not current_teacher_id:
                return {"message": "No teacher currently assigned to this class"}
            
            # Remove teacher from class
            await classes_collection.update_one(
                {"_id": ObjectId(class_id)},
                {
                    "$unset": {"teacher_id": ""},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            # Remove class from teacher's assignments
            await teachers_collection.update_one(
                {"_id": ObjectId(current_teacher_id)},
                {
                    "$pull": {"assigned_classes": class_id},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
            
            # Revoke class-specific permissions
            await TeacherClassService._revoke_teacher_class_permissions(
                current_teacher_id, class_id, users_collection, audit_logger
            )
            
            # Log the unassignment
            await audit_logger.log_user_action(
                user_id=current_teacher_id,
                action=AuditAction.UNASSIGN,
                resource_type="class",
                resource_id=class_id,
                details={
                    "class_name": class_doc.get("class_name"),
                    "reason": "manual_unassignment"
                },
                severity=AuditSeverity.INFO
            )
            
            # Broadcast update
            if websocket_manager:
                await websocket_manager.broadcast_to_branch(
                    class_doc.get("branch_id"),
                    {
                        "type": "teacher_unassigned",
                        "data": {
                            "teacher_id": current_teacher_id,
                            "class_id": class_id,
                            "class_name": class_doc.get("class_name")
                        }
                    }
                )
            
            return {
                "message": "Teacher successfully unassigned from class",
                "class_id": class_id,
                "former_teacher_id": current_teacher_id,
                "permissions_revoked": True
            }
            
        except Exception as e:
            logger.error(f"Error unassigning teacher from class: {e}")
            raise
    
    @staticmethod
    async def sync_class_roster(
        class_id: str,
        classes_collection: Any,
        teachers_collection: Any,
        students_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Dict[str, Any]:
        """
        Synchronize teacher access to current class roster
        """
        try:
            # Get class and teacher info
            class_doc = await classes_collection.find_one({"_id": ObjectId(class_id)})
            if not class_doc or not class_doc.get("teacher_id"):
                return {"message": "No teacher assigned to this class"}
            
            teacher_id = class_doc["teacher_id"]
            
            # Get current students in class
            students = await students_collection.find({"class_id": class_id}).to_list(None)
            current_student_ids = [str(s["_id"]) for s in students]
            
            # Get teacher's current accessible students for this class
            teacher_doc = await teachers_collection.find_one({"_id": ObjectId(teacher_id)})
            if not teacher_doc:
                return {"message": "Teacher not found"}
            
            previous_student_ids = set(teacher_doc.get("accessible_students", []))
            current_student_ids_set = set(current_student_ids)
            
            # Calculate changes
            added_students = current_student_ids_set - previous_student_ids
            removed_students = previous_student_ids - current_student_ids_set
            
            # Update teacher's accessible students
            await teachers_collection.update_one(
                {"_id": ObjectId(teacher_id)},
                {
                    "$set": {
                        "accessible_students": current_student_ids,
                        "last_roster_sync": datetime.utcnow()
                    }
                }
            )
            
            # Broadcast roster changes
            if websocket_manager and (added_students or removed_students):
                await websocket_manager.broadcast_to_user(
                    teacher_id,
                    {
                        "type": "roster_updated",
                        "data": {
                            "class_id": class_id,
                            "class_name": class_doc.get("class_name"),
                            "total_students": len(current_student_ids),
                            "added_students": len(added_students),
                            "removed_students": len(removed_students)
                        }
                    }
                )
            
            return {
                "message": "Class roster synchronized",
                "class_id": class_id,
                "teacher_id": teacher_id,
                "total_students": len(current_student_ids),
                "added_students": len(added_students),
                "removed_students": len(removed_students),
                "last_sync": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error syncing class roster: {e}")
            raise
    
    @staticmethod
    async def get_teacher_classes(
        teacher_id: str,
        classes_collection: Any,
        students_collection: Any
    ) -> List[Dict[str, Any]]:
        """
        Get all classes assigned to a teacher with student counts
        """
        try:
            # Find classes where teacher is assigned (support string/ObjectId storage)
            # Build flexible filter to also include subject-level teacher mappings
            or_filters = [{"teacher_id": teacher_id}, {"subject_teachers": {"$elemMatch": {"teacher_id": teacher_id}}}]
            if ObjectId.is_valid(teacher_id):
                or_filters.append({"teacher_id": ObjectId(teacher_id)})
                or_filters.append({"subject_teachers": {"$elemMatch": {"teacher_id": ObjectId(teacher_id)}}})

            classes = await classes_collection.find({"$or": or_filters}).to_list(None)
            
            teacher_classes = []
            for class_doc in classes:
                class_id = str(class_doc["_id"])
                
                # Get current enrollment
                student_count = await students_collection.count_documents({"class_id": class_id})
                
                # Get recent students (for dashboard preview)
                recent_students = await students_collection.find(
                    {"class_id": class_id}
                ).limit(5).to_list(None)
                
                teacher_classes.append({
                    "id": class_id,
                    "class_name": class_doc.get("class_name"),
                    "grade_level_id": class_doc.get("grade_level_id"),
                    "academic_year": class_doc.get("academic_year"),
                    "max_capacity": class_doc.get("max_capacity", 25),
                    "current_enrollment": student_count,
                    "branch_id": class_doc.get("branch_id"),
                    "created_at": class_doc.get("created_at"),
                    "updated_at": class_doc.get("updated_at"),
                    "recent_students": [
                        {
                            "id": str(s["_id"]),
                            "name": s.get("first_name", ""),
                            "student_id": s.get("student_id")
                        }
                        for s in recent_students
                    ]
                })
            
            return teacher_classes
            
        except Exception as e:
            logger.error(f"Error getting teacher classes: {e}")
            return []
    
    @staticmethod
    async def _grant_teacher_class_permissions(
        teacher_id: str,
        class_id: str,
        class_doc: Dict[str, Any],
        users_collection: Any,
        audit_logger: Any
    ) -> None:
        """Grant teacher necessary permissions for the assigned class"""
        try:
            # Find teacher's user account
            teacher_user = await users_collection.find_one({"teacher_id": teacher_id})
            if not teacher_user:
                logger.warning(f"No user account found for teacher {teacher_id}")
                return
            
            # Define class-specific permissions
            class_permissions = [
                f"read_class_{class_id}",
                f"update_attendance_{class_id}",
                f"read_students_{class_id}",
                f"create_grades_{class_id}",
                f"update_grades_{class_id}",
                f"read_grades_{class_id}"
            ]
            
            # Add permissions to user account
            await users_collection.update_one(
                {"_id": teacher_user["_id"]},
                {
                    "$addToSet": {"class_permissions": {"$each": class_permissions}},
                    "$set": {"last_permission_update": datetime.utcnow()}
                }
            )
            
            await audit_logger.log_user_action(
                user_id=teacher_id,
                action=AuditAction.GRANT_PERMISSION,
                resource_type="class_permissions",
                resource_id=class_id,
                details={
                    "permissions": class_permissions,
                    "class_name": class_doc.get("class_name")
                },
                severity=AuditSeverity.INFO
            )
            
        except Exception as e:
            logger.error(f"Error granting teacher class permissions: {e}")
            raise
    
    @staticmethod
    async def _revoke_teacher_class_permissions(
        teacher_id: str,
        class_id: str,
        users_collection: Any,
        audit_logger: Any
    ) -> None:
        """Revoke teacher's class-specific permissions"""
        try:
            # Find teacher's user account
            teacher_user = await users_collection.find_one({"teacher_id": teacher_id})
            if not teacher_user:
                return
            
            # Remove class-specific permissions
            class_permission_pattern = f"_{class_id}"
            current_permissions = teacher_user.get("class_permissions", [])
            
            # Filter out permissions for this class
            remaining_permissions = [
                perm for perm in current_permissions 
                if not perm.endswith(class_permission_pattern)
            ]
            
            await users_collection.update_one(
                {"_id": teacher_user["_id"]},
                {
                    "$set": {
                        "class_permissions": remaining_permissions,
                        "last_permission_update": datetime.utcnow()
                    }
                }
            )
            
            revoked_permissions = len(current_permissions) - len(remaining_permissions)
            
            await audit_logger.log_user_action(
                user_id=teacher_id,
                action=AuditAction.REVOKE_PERMISSION,
                resource_type="class_permissions",
                resource_id=class_id,
                details={
                    "revoked_count": revoked_permissions,
                    "remaining_permissions": len(remaining_permissions)
                },
                severity=AuditSeverity.INFO
            )
            
        except Exception as e:
            logger.error(f"Error revoking teacher class permissions: {e}")
            raise
