from typing import Optional, List, Dict, Any
from datetime import datetime
from bson import ObjectId
from fastapi import HTTPException, status
import secrets
import string

from ..models.parent import Parent, ParentCreate, ParentUpdate
from ..models.user import UserCreate, User
from ..models.student import Student
from ..db import get_db
from ..utils.websocket_manager import WebSocketManager


class ParentService:
    
    @staticmethod
    async def create_parent_from_student(
        student_data: Dict[str, Any],
        parents_collection: Any,
        users_collection: Any,
        students_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> Optional[Parent]:
        """
        Automatically create a parent account from student information.
        Returns the created parent or None if parent already exists.
        """
        
        father_name = student_data.get("father_name")
        mother_name = student_data.get("mother_name")
        student_phone = student_data.get("phone")
        student_email = student_data.get("email")
        branch_id = student_data.get("branch_id")
        student_id = str(student_data.get("_id") or student_data.get("id"))
        
        if not (father_name or mother_name):
            return None
            
        existing_parent = await parents_collection.find_one({
            "$or": [
                {"father_name": father_name, "branch_id": branch_id},
                {"mother_name": mother_name, "branch_id": branch_id}
            ]
        })
        
        if existing_parent:
            if student_id not in existing_parent.get("student_ids", []):
                await parents_collection.update_one(
                    {"_id": existing_parent["_id"]},
                    {
                        "$push": {"student_ids": student_id},
                        "$set": {"updated_at": datetime.utcnow()}
                    }
                )
            return Parent(id=str(existing_parent["_id"]), **existing_parent)
        
        parent_data = {
            "father_name": father_name,
            "father_phone": student_phone,
            "father_email": student_email,
            "mother_name": mother_name,
            "address": student_data.get("address"),
            "emergency_contact_name": student_data.get("emergency_contact_name"),
            "emergency_contact_phone": student_data.get("emergency_contact_phone"),
            "branch_id": branch_id,
            "student_ids": [student_id],
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        result = await parents_collection.insert_one(parent_data)
        parent_id = str(result.inserted_id)
        
        user_id = await ParentService._create_parent_user(
            parent_data, users_collection, parent_id
        )
        
        if user_id:
            await parents_collection.update_one(
                {"_id": result.inserted_id},
                {"$set": {"user_id": user_id}}
            )
            parent_data["user_id"] = user_id
        
        await students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {"parent_guardian_id": parent_id}}
        )
        
        created_parent = Parent(id=parent_id, **parent_data)
        
        if websocket_manager:
            await websocket_manager.broadcast_to_branch(
                branch_id,
                {
                    "type": "parent_created",
                    "data": {
                        "parent_id": parent_id,
                        "student_id": student_id,
                        "parent_name": f"{father_name or ''} {mother_name or ''}".strip()
                    }
                }
            )
        
        return created_parent
    
    @staticmethod
    async def _create_parent_user(
        parent_data: Dict[str, Any],
        users_collection: Any,
        parent_id: str
    ) -> Optional[str]:
        """Create a user account for the parent."""
        
        primary_email = parent_data.get("father_email") or parent_data.get("mother_email")
        if not primary_email:
            return None
        
        existing_user = await users_collection.find_one({"email": primary_email})
        if existing_user:
            return str(existing_user["_id"])
        
        full_name = f"{parent_data.get('father_name', '')} {parent_data.get('mother_name', '')}".strip()
        if not full_name:
            full_name = "Parent"
        
        temp_password = ParentService._generate_temp_password()
        
        user_data = {
            "email": primary_email,
            "password": temp_password,  # In real implementation, hash this
            "full_name": full_name,
            "role": "parent",
            "phone": parent_data.get("father_phone") or parent_data.get("mother_phone"),
            "branch_id": parent_data.get("branch_id"),
            "parent_id": parent_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "is_temp_password": True
        }
        
        result = await users_collection.insert_one(user_data)
        return str(result.inserted_id)
    
    @staticmethod
    def _generate_temp_password() -> str:
        """Generate a temporary password for parent accounts."""
        return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))
    
    @staticmethod
    async def link_student_to_parent(
        student_id: str,
        parent_id: str,
        parents_collection: Any,
        students_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> bool:
        """Link a student to an existing parent."""
        
        parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent not found"
            )
        
        student = await students_collection.find_one({"_id": ObjectId(student_id)})
        if not student:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Student not found"
            )
        
        if student_id not in parent.get("student_ids", []):
            await parents_collection.update_one(
                {"_id": ObjectId(parent_id)},
                {
                    "$push": {"student_ids": student_id},
                    "$set": {"updated_at": datetime.utcnow()}
                }
            )
        
        await students_collection.update_one(
            {"_id": ObjectId(student_id)},
            {"$set": {"parent_guardian_id": parent_id}}
        )
        
        if websocket_manager:
            await websocket_manager.broadcast_to_branch(
                parent.get("branch_id"),
                {
                    "type": "student_linked",
                    "data": {
                        "parent_id": parent_id,
                        "student_id": student_id
                    }
                }
            )
        
        return True
    
    @staticmethod
    async def get_parent_students(
        parent_id: str,
        parents_collection: Any,
        students_collection: Any
    ) -> List[Student]:
        """Get all students linked to a parent."""
        
        parent = await parents_collection.find_one({"_id": ObjectId(parent_id)})
        if not parent:
            return []
        
        student_ids = parent.get("student_ids", [])
        if not student_ids:
            return []
        
        students = []
        for student_id in student_ids:
            try:
                student = await students_collection.find_one({"_id": ObjectId(student_id)})
                if student:
                    student_data = {
                        "id": str(student["_id"]),
                        **{k: v for k, v in student.items() if k != "_id"}
                    }
                    students.append(Student(**student_data))
            except Exception:
                continue
        
        return students
    
    @staticmethod
    async def sync_student_data_to_parent(
        student_id: str,
        updated_fields: Dict[str, Any],
        parents_collection: Any,
        websocket_manager: Optional[WebSocketManager] = None
    ) -> None:
        """Sync relevant student data changes to parent record."""
        
        parent = await parents_collection.find_one({"student_ids": student_id})
        if not parent:
            return
        
        parent_updates = {}
        
        if "father_name" in updated_fields:
            parent_updates["father_name"] = updated_fields["father_name"]
        if "mother_name" in updated_fields:
            parent_updates["mother_name"] = updated_fields["mother_name"]
        if "phone" in updated_fields and not parent.get("father_phone"):
            parent_updates["father_phone"] = updated_fields["phone"]
        if "email" in updated_fields and not parent.get("father_email"):
            parent_updates["father_email"] = updated_fields["email"]
        if "address" in updated_fields:
            parent_updates["address"] = updated_fields["address"]
        if "emergency_contact_name" in updated_fields:
            parent_updates["emergency_contact_name"] = updated_fields["emergency_contact_name"]
        if "emergency_contact_phone" in updated_fields:
            parent_updates["emergency_contact_phone"] = updated_fields["emergency_contact_phone"]
        
        if parent_updates:
            parent_updates["updated_at"] = datetime.utcnow()
            await parents_collection.update_one(
                {"_id": parent["_id"]},
                {"$set": parent_updates}
            )
            
            if websocket_manager:
                await websocket_manager.broadcast_to_branch(
                    parent.get("branch_id"),
                    {
                        "type": "parent_updated",
                        "data": {
                            "parent_id": str(parent["_id"]),
                            "student_id": student_id,
                            "updated_fields": list(parent_updates.keys())
                        }
                    }
                )