"""
Referential Integrity System
Maintains data consistency and relationship integrity across MongoDB collections
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional, Set, Tuple, Union
from datetime import datetime
from bson import ObjectId
from enum import Enum
from dataclasses import dataclass
from abc import ABC, abstractmethod
import networkx as nx
from collections import defaultdict, deque

from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .data_validation import DataValidator, ValidationResult
from .data_sync import SyncEvent, SyncEventType

# Configure logging
logger = logging.getLogger(__name__)

class ReferenceType(Enum):
    ONE_TO_ONE = "one_to_one"
    ONE_TO_MANY = "one_to_many"
    MANY_TO_MANY = "many_to_many"
    WEAK_REFERENCE = "weak_reference"  # Optional reference

class CascadeAction(Enum):
    CASCADE_DELETE = "cascade_delete"  # Delete dependent records
    SET_NULL = "set_null"  # Set foreign key to null
    RESTRICT = "restrict"  # Prevent deletion if references exist
    NO_ACTION = "no_action"  # Do nothing

@dataclass
class ReferenceDefinition:
    """Defines a referential relationship between collections"""
    name: str
    parent_collection: str
    parent_field: str
    child_collection: str
    child_field: str
    reference_type: ReferenceType
    cascade_on_delete: CascadeAction = CascadeAction.RESTRICT
    cascade_on_update: CascadeAction = CascadeAction.NO_ACTION
    is_required: bool = True
    validation_rules: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.validation_rules is None:
            self.validation_rules = {}

@dataclass
class IntegrityViolation:
    """Represents a referential integrity violation"""
    violation_type: str
    description: str
    parent_collection: str
    parent_id: str
    child_collection: str
    child_id: Optional[str] = None
    reference_name: str = ""
    severity: str = "error"
    suggested_action: Optional[str] = None
    auto_fixable: bool = False

class ReferentialIntegrityManager:
    """Manages referential integrity across all collections"""
    
    def __init__(self, db):
        self.db = db
        self.references: Dict[str, ReferenceDefinition] = {}
        self.dependency_graph = nx.DiGraph()
        self.audit_logger = get_audit_logger()
        self.data_validator = DataValidator()
        self.integrity_cache = {}
        self.cache_ttl = 300  # 5 minutes
        
        # Initialize reference definitions
        self._initialize_references()
        self._build_dependency_graph()
    
    def _initialize_references(self):
        """Initialize all referential relationships"""
        
        # Student -> User relationship
        self.add_reference(ReferenceDefinition(
            name="student_user",
            parent_collection="users",
            parent_field="_id",
            child_collection="students",
            child_field="user_id",
            reference_type=ReferenceType.ONE_TO_ONE,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Teacher -> User relationship
        self.add_reference(ReferenceDefinition(
            name="teacher_user",
            parent_collection="users",
            parent_field="_id",
            child_collection="teachers",
            child_field="user_id",
            reference_type=ReferenceType.ONE_TO_ONE,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Parent -> User relationship
        self.add_reference(ReferenceDefinition(
            name="parent_user",
            parent_collection="users",
            parent_field="_id",
            child_collection="parents",
            child_field="user_id",
            reference_type=ReferenceType.ONE_TO_ONE,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Student -> Branch relationship
        self.add_reference(ReferenceDefinition(
            name="student_branch",
            parent_collection="branches",
            parent_field="_id",
            child_collection="students",
            child_field="branch_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.RESTRICT
        ))
        
        # Teacher -> Branch relationship
        self.add_reference(ReferenceDefinition(
            name="teacher_branch",
            parent_collection="branches",
            parent_field="_id",
            child_collection="teachers",
            child_field="branch_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.RESTRICT
        ))
        
        # Class -> Branch relationship
        self.add_reference(ReferenceDefinition(
            name="class_branch",
            parent_collection="branches",
            parent_field="_id",
            child_collection="classes",
            child_field="branch_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.RESTRICT
        ))
        
        # Class -> Teacher relationship
        self.add_reference(ReferenceDefinition(
            name="class_teacher",
            parent_collection="teachers",
            parent_field="_id",
            child_collection="classes",
            child_field="teacher_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.SET_NULL,
            is_required=False
        ))
        
        # Enrollment -> Student relationship
        self.add_reference(ReferenceDefinition(
            name="enrollment_student",
            parent_collection="students",
            parent_field="_id",
            child_collection="enrollments",
            child_field="student_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Enrollment -> Class relationship
        self.add_reference(ReferenceDefinition(
            name="enrollment_class",
            parent_collection="classes",
            parent_field="_id",
            child_collection="enrollments",
            child_field="class_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Grade -> Student relationship
        self.add_reference(ReferenceDefinition(
            name="grade_student",
            parent_collection="students",
            parent_field="_id",
            child_collection="grades",
            child_field="student_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Grade -> Class relationship
        self.add_reference(ReferenceDefinition(
            name="grade_class",
            parent_collection="classes",
            parent_field="_id",
            child_collection="grades",
            child_field="class_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Attendance -> Student relationship
        self.add_reference(ReferenceDefinition(
            name="attendance_student",
            parent_collection="students",
            parent_field="_id",
            child_collection="attendance",
            child_field="student_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Attendance -> Class relationship
        self.add_reference(ReferenceDefinition(
            name="attendance_class",
            parent_collection="classes",
            parent_field="_id",
            child_collection="attendance",
            child_field="class_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Fee -> Student relationship
        self.add_reference(ReferenceDefinition(
            name="fee_student",
            parent_collection="students",
            parent_field="_id",
            child_collection="fees",
            child_field="student_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Payment -> Fee relationship
        self.add_reference(ReferenceDefinition(
            name="payment_fee",
            parent_collection="fees",
            parent_field="_id",
            child_collection="payments",
            child_field="fee_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Parent-Student Link relationships
        self.add_reference(ReferenceDefinition(
            name="parent_link_parent",
            parent_collection="parents",
            parent_field="_id",
            child_collection="parent_student_links",
            child_field="parent_user_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        self.add_reference(ReferenceDefinition(
            name="parent_link_student",
            parent_collection="students",
            parent_field="_id",
            child_collection="parent_student_links",
            child_field="student_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        # Auto-create parent accounts when parent info is added to students
        self.add_reference(ReferenceDefinition(
            name="student_parent_auto_create",
            parent_collection="students",
            parent_field="_id", 
            child_collection="parents",
            child_field="related_student_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.SET_NULL,
            is_required=False,
            validation_rules={"auto_create_parent": True}
        ))
        
        # Subject relationships
        self.add_reference(ReferenceDefinition(
            name="grade_subject",
            parent_collection="subjects",
            parent_field="_id",
            child_collection="grades",
            child_field="subject_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.RESTRICT
        ))
        
        # Assignment relationships
        self.add_reference(ReferenceDefinition(
            name="assignment_class",
            parent_collection="classes",
            parent_field="_id",
            child_collection="assignments",
            child_field="class_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        self.add_reference(ReferenceDefinition(
            name="assignment_subject",
            parent_collection="subjects",
            parent_field="_id",
            child_collection="assignments",
            child_field="subject_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.SET_NULL,
            is_required=False
        ))
        
        # Exam relationships
        self.add_reference(ReferenceDefinition(
            name="exam_class",
            parent_collection="classes",
            parent_field="_id",
            child_collection="exams",
            child_field="class_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.CASCADE_DELETE
        ))
        
        self.add_reference(ReferenceDefinition(
            name="exam_subject",
            parent_collection="subjects",
            parent_field="_id",
            child_collection="exams",
            child_field="subject_id",
            reference_type=ReferenceType.ONE_TO_MANY,
            cascade_on_delete=CascadeAction.SET_NULL,
            is_required=False
        ))
    
    def add_reference(self, reference: ReferenceDefinition):
        """Add a reference definition"""
        self.references[reference.name] = reference
        logger.debug(f"Added reference: {reference.name}")
    
    def remove_reference(self, reference_name: str):
        """Remove a reference definition"""
        if reference_name in self.references:
            del self.references[reference_name]
            logger.debug(f"Removed reference: {reference_name}")
    
    def _build_dependency_graph(self):
        """Build dependency graph for cascade operations"""
        self.dependency_graph.clear()
        
        for ref in self.references.values():
            # Add edge from parent to child (dependency direction)
            self.dependency_graph.add_edge(
                ref.parent_collection, 
                ref.child_collection,
                reference=ref
            )
    
    async def validate_reference_integrity(self, 
                                         collection_name: str, 
                                         document: Dict[str, Any],
                                         operation: str = "insert") -> List[IntegrityViolation]:
        """Validate referential integrity for a document"""
        violations = []
        
        # Check outgoing references (this document references others)
        for ref in self._get_outgoing_references(collection_name):
            if ref.child_field in document:
                violation = await self._validate_parent_reference(document, ref)
                if violation:
                    violations.append(violation)
        
        # For updates/deletes, check incoming references
        if operation in ["update", "delete"]:
            document_id = str(document.get("_id", ""))
            incoming_violations = await self._check_incoming_references(collection_name, document_id)
            violations.extend(incoming_violations)
        
        # Handle auto-creation logic (like parent accounts)
        if operation in ["insert", "update"]:
            await self._handle_auto_creation(collection_name, document, operation)
        
        return violations
    
    async def _handle_auto_creation(self, collection_name: str, document: Dict[str, Any], operation: str):
        """Handle automatic creation of related records"""
        try:
            # Check if this is a student with parent information
            if collection_name == "students" and self._has_parent_info(document):
                await self._auto_create_parent_account(document, operation)
        except Exception as e:
            logger.error(f"Error in auto-creation logic: {e}")
    
    def _has_parent_info(self, student_document: Dict[str, Any]) -> bool:
        """Check if student document has parent information that warrants account creation"""
        parent_fields = [
            "father_name", "mother_name", "guardian_name",
            "father_phone", "mother_phone", "guardian_phone",
            "father_email", "mother_email", "guardian_email"
        ]
        
        # Check if any parent fields are present and not empty
        for field in parent_fields:
            if student_document.get(field) and str(student_document[field]).strip():
                return True
        return False
    
    async def _auto_create_parent_account(self, student_document: Dict[str, Any], operation: str):
        """Automatically create parent account when student has parent information"""
        try:
            student_id = str(student_document["_id"])
            branch_id = student_document.get("branch_id")
            
            parents_collection = self.db["parents"]
            users_collection = self.db["users"]
            parent_student_links_collection = self.db["parent_student_links"]
            
            # Check if parent account already exists
            existing_link = await parent_student_links_collection.find_one({"student_id": ObjectId(student_id)})
            if existing_link and operation == "update":
                # Update existing parent info
                parent_id = existing_link.get("parent_user_id")
                if parent_id:
                    await self._update_parent_account(parent_id, student_document)
                return
            
            # Create parent accounts for father, mother, and/or guardian
            created_parents = []
            
            # Create father account
            if student_document.get("father_name"):
                father_user_id = await self._create_parent_user_account(
                    name=student_document["father_name"],
                    phone=student_document.get("father_phone", ""),
                    email=student_document.get("father_email", ""),
                    relation="father",
                    student_id=student_id,
                    branch_id=branch_id
                )
                if father_user_id:
                    created_parents.append({"type": "father", "user_id": father_user_id})
            
            # Create mother account  
            if student_document.get("mother_name"):
                mother_user_id = await self._create_parent_user_account(
                    name=student_document["mother_name"],
                    phone=student_document.get("mother_phone", ""),
                    email=student_document.get("mother_email", ""),
                    relation="mother",
                    student_id=student_id,
                    branch_id=branch_id
                )
                if mother_user_id:
                    created_parents.append({"type": "mother", "user_id": mother_user_id})
            
            # Create guardian account if different from father/mother
            if student_document.get("guardian_name"):
                guardian_name = student_document["guardian_name"]
                father_name = student_document.get("father_name", "")
                mother_name = student_document.get("mother_name", "")
                
                if guardian_name != father_name and guardian_name != mother_name:
                    guardian_user_id = await self._create_parent_user_account(
                        name=guardian_name,
                        phone=student_document.get("guardian_phone", ""),
                        email=student_document.get("guardian_email", ""),
                        relation="guardian",
                        student_id=student_id,
                        branch_id=branch_id
                    )
                    if guardian_user_id:
                        created_parents.append({"type": "guardian", "user_id": guardian_user_id})
            
            # Create parent-student links
            for parent_info in created_parents:
                await parent_student_links_collection.insert_one({
                    "parent_user_id": ObjectId(parent_info["user_id"]),
                    "student_id": ObjectId(student_id),
                    "relationship": parent_info["type"],
                    "branch_id": ObjectId(branch_id) if branch_id else None,
                    "created_at": datetime.utcnow(),
                    "auto_created": True
                })
            
            if created_parents:
                await self.audit_logger.log_data_event(
                    event_type="parent_accounts_auto_created",
                    details={
                        "student_id": student_id,
                        "created_parents": len(created_parents),
                        "parent_types": [p["type"] for p in created_parents]
                    },
                    severity=AuditSeverity.INFO
                )
            
        except Exception as e:
            logger.error(f"Error creating parent accounts for student {student_id}: {e}")
            
    async def _create_parent_user_account(self, name: str, phone: str, email: str, 
                                        relation: str, student_id: str, branch_id: str) -> Optional[str]:
        """Create a user account for a parent"""
        try:
            if not name.strip():
                return None
                
            users_collection = self.db["users"]
            parents_collection = self.db["parents"]
            
            # Generate username from name and relation
            username = f"{name.lower().replace(' ', '_')}_{relation}_{student_id[:8]}"
            
            # Check if user already exists
            existing_user = await users_collection.find_one({
                "$or": [
                    {"username": username},
                    {"email": email} if email else {"_id": None}
                ]
            })
            
            if existing_user:
                return str(existing_user["_id"])
            
            # Create user account
            user_data = {
                "username": username,
                "password": f"temp_{ObjectId()}",  # Temporary password - should be changed
                "role": "parent",
                "email": email or "",
                "phone": phone or "",
                "full_name": name,
                "branch_id": ObjectId(branch_id) if branch_id else None,
                "is_active": True,
                "created_at": datetime.utcnow(),
                "auto_created": True,
                "password_change_required": True
            }
            
            user_result = await users_collection.insert_one(user_data)
            user_id = str(user_result.inserted_id)
            
            # Create parent record
            parent_data = {
                "user_id": ObjectId(user_id),
                "name": name,
                "phone": phone or "",
                "email": email or "",
                "relationship": relation,
                "branch_id": ObjectId(branch_id) if branch_id else None,
                "related_student_id": ObjectId(student_id),
                "created_at": datetime.utcnow(),
                "auto_created": True
            }
            
            await parents_collection.insert_one(parent_data)
            
            return user_id
            
        except Exception as e:
            logger.error(f"Error creating parent user account: {e}")
            return None
            
    async def _update_parent_account(self, parent_user_id: str, student_document: Dict[str, Any]):
        """Update existing parent account with new information"""
        try:
            parents_collection = self.db["parents"]
            users_collection = self.db["users"]
            
            # Update parent record
            parent_updates = {}
            user_updates = {}
            
            # Map student parent fields to parent fields
            field_mappings = {
                "father_name": "name", "father_phone": "phone", "father_email": "email",
                "mother_name": "name", "mother_phone": "phone", "mother_email": "email",
                "guardian_name": "name", "guardian_phone": "phone", "guardian_email": "email"
            }
            
            for student_field, parent_field in field_mappings.items():
                if student_field in student_document and student_document[student_field]:
                    parent_updates[parent_field] = student_document[student_field]
                    if parent_field in ["phone", "email", "name"]:
                        user_updates[parent_field if parent_field != "name" else "full_name"] = student_document[student_field]
            
            if parent_updates:
                parent_updates["updated_at"] = datetime.utcnow()
                await parents_collection.update_one(
                    {"user_id": ObjectId(parent_user_id)},
                    {"$set": parent_updates}
                )
            
            if user_updates:
                user_updates["updated_at"] = datetime.utcnow()
                await users_collection.update_one(
                    {"_id": ObjectId(parent_user_id)},
                    {"$set": user_updates}
                )
                
        except Exception as e:
            logger.error(f"Error updating parent account {parent_user_id}: {e}")
    
    async def _validate_parent_reference(self, 
                                       document: Dict[str, Any], 
                                       ref: ReferenceDefinition) -> Optional[IntegrityViolation]:
        """Validate that a parent reference exists"""
        foreign_key_value = document.get(ref.child_field)
        
        if foreign_key_value is None:
            if ref.is_required:
                return IntegrityViolation(
                    violation_type="missing_required_reference",
                    description=f"Required reference {ref.child_field} is missing",
                    parent_collection=ref.parent_collection,
                    parent_id="",
                    child_collection=ref.child_collection,
                    reference_name=ref.name,
                    severity="error"
                )
            return None
        
        # Convert to ObjectId if needed
        try:
            if isinstance(foreign_key_value, str) and ObjectId.is_valid(foreign_key_value):
                foreign_key_value = ObjectId(foreign_key_value)
        except:
            pass
        
        # Check if parent exists
        parent_collection = self.db[ref.parent_collection]
        parent_exists = await parent_collection.find_one({ref.parent_field: foreign_key_value})
        
        if not parent_exists:
            return IntegrityViolation(
                violation_type="orphaned_reference",
                description=f"Referenced {ref.parent_collection} with {ref.parent_field}={foreign_key_value} does not exist",
                parent_collection=ref.parent_collection,
                parent_id=str(foreign_key_value),
                child_collection=ref.child_collection,
                child_id=str(document.get("_id", "")),
                reference_name=ref.name,
                severity="error",
                suggested_action="Create the referenced record or remove the reference",
                auto_fixable=ref.cascade_on_delete == CascadeAction.SET_NULL
            )
        
        return None
    
    async def _check_incoming_references(self, 
                                       collection_name: str, 
                                       document_id: str) -> List[IntegrityViolation]:
        """Check for incoming references that would be violated"""
        violations = []
        
        for ref in self._get_incoming_references(collection_name):
            child_collection = self.db[ref.child_collection]
            
            # Convert document_id to ObjectId if needed
            search_id = ObjectId(document_id) if ObjectId.is_valid(document_id) else document_id
            
            # Count dependent records
            dependent_count = await child_collection.count_documents({
                ref.child_field: search_id,
                "status": {"$ne": "inactive"}  # Don't count inactive records
            })
            
            if dependent_count > 0:
                if ref.cascade_on_delete == CascadeAction.RESTRICT:
                    violations.append(IntegrityViolation(
                        violation_type="restrict_violation",
                        description=f"Cannot delete/update {collection_name}:{document_id} - {dependent_count} dependent records exist in {ref.child_collection}",
                        parent_collection=collection_name,
                        parent_id=document_id,
                        child_collection=ref.child_collection,
                        reference_name=ref.name,
                        severity="error",
                        suggested_action=f"Delete dependent records first or change cascade action"
                    ))
                elif ref.cascade_on_delete in [CascadeAction.CASCADE_DELETE, CascadeAction.SET_NULL]:
                    # These will be handled automatically, just log
                    violations.append(IntegrityViolation(
                        violation_type="cascade_warning",
                        description=f"Deleting {collection_name}:{document_id} will affect {dependent_count} records in {ref.child_collection}",
                        parent_collection=collection_name,
                        parent_id=document_id,
                        child_collection=ref.child_collection,
                        reference_name=ref.name,
                        severity="warning",
                        auto_fixable=True
                    ))
        
        return violations
    
    def _get_outgoing_references(self, collection_name: str) -> List[ReferenceDefinition]:
        """Get references where this collection is the child (has foreign keys)"""
        return [ref for ref in self.references.values() if ref.child_collection == collection_name]
    
    def _get_incoming_references(self, collection_name: str) -> List[ReferenceDefinition]:
        """Get references where this collection is the parent (is referenced by others)"""
        return [ref for ref in self.references.values() if ref.parent_collection == collection_name]
    
    async def execute_cascade_operations(self, 
                                       collection_name: str, 
                                       document_id: str, 
                                       operation: str) -> Dict[str, Any]:
        """Execute cascade operations for a document"""
        results = {
            "cascaded_deletes": [],
            "nullified_references": [],
            "errors": []
        }
        
        for ref in self._get_incoming_references(collection_name):
            try:
                if operation == "delete":
                    if ref.cascade_on_delete == CascadeAction.CASCADE_DELETE:
                        deleted_count = await self._cascade_delete(ref, document_id)
                        results["cascaded_deletes"].append({
                            "reference": ref.name,
                            "collection": ref.child_collection,
                            "count": deleted_count
                        })
                    elif ref.cascade_on_delete == CascadeAction.SET_NULL:
                        nullified_count = await self._set_null_reference(ref, document_id)
                        results["nullified_references"].append({
                            "reference": ref.name,
                            "collection": ref.child_collection,
                            "count": nullified_count
                        })
                
            except Exception as e:
                logger.error(f"Error in cascade operation for {ref.name}: {e}")
                results["errors"].append({
                    "reference": ref.name,
                    "error": str(e)
                })
        
        # Log cascade results
        if results["cascaded_deletes"] or results["nullified_references"]:
            await self.audit_logger.log_data_event(
                event_type="cascade_operation",
                details={
                    "collection": collection_name,
                    "document_id": document_id,
                    "operation": operation,
                    "results": results
                },
                severity=AuditSeverity.INFO
            )
        
        return results
    
    async def _cascade_delete(self, ref: ReferenceDefinition, parent_id: str) -> int:
        """Execute cascade delete operation"""
        child_collection = self.db[ref.child_collection]
        
        # Convert parent_id to ObjectId if needed
        search_id = ObjectId(parent_id) if ObjectId.is_valid(parent_id) else parent_id
        
        # Soft delete instead of hard delete to maintain audit trail
        result = await child_collection.update_many(
            {ref.child_field: search_id, "status": {"$ne": "inactive"}},
            {
                "$set": {
                    "status": "inactive",
                    "deleted_at": datetime.utcnow(),
                    "deletion_reason": "cascade_delete",
                    "cascade_reference": ref.name
                }
            }
        )
        
        logger.info(f"Cascade deleted {result.modified_count} records from {ref.child_collection}")
        return result.modified_count
    
    async def _set_null_reference(self, ref: ReferenceDefinition, parent_id: str) -> int:
        """Set foreign key references to null"""
        child_collection = self.db[ref.child_collection]
        
        # Convert parent_id to ObjectId if needed
        search_id = ObjectId(parent_id) if ObjectId.is_valid(parent_id) else parent_id
        
        result = await child_collection.update_many(
            {ref.child_field: search_id},
            {
                "$unset": {ref.child_field: ""},
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "nullified_reason": "cascade_set_null",
                    "nullified_reference": ref.name
                }
            }
        )
        
        logger.info(f"Nullified {result.modified_count} references in {ref.child_collection}")
        return result.modified_count
    
    async def check_database_integrity(self, collections: Optional[List[str]] = None) -> Dict[str, Any]:
        """Perform comprehensive integrity check across the database"""
        if collections is None:
            collections = list(set([ref.parent_collection for ref in self.references.values()] + 
                                 [ref.child_collection for ref in self.references.values()]))
        
        integrity_report = {
            "checked_at": datetime.utcnow(),
            "collections_checked": collections,
            "violations": [],
            "statistics": {},
            "recommendations": []
        }
        
        for collection_name in collections:
            try:
                collection_violations = await self._check_collection_integrity(collection_name)
                integrity_report["violations"].extend(collection_violations)
                
                # Collect statistics
                integrity_report["statistics"][collection_name] = {
                    "total_documents": await self.db[collection_name].count_documents({}),
                    "violations_found": len(collection_violations),
                    "violation_types": list(set([v.violation_type for v in collection_violations]))
                }
                
            except Exception as e:
                logger.error(f"Error checking integrity for {collection_name}: {e}")
                integrity_report["violations"].append(IntegrityViolation(
                    violation_type="check_error",
                    description=f"Error checking {collection_name}: {str(e)}",
                    parent_collection=collection_name,
                    parent_id="",
                    child_collection="",
                    severity="error"
                ))
        
        # Generate recommendations
        integrity_report["recommendations"] = self._generate_integrity_recommendations(
            integrity_report["violations"]
        )
        
        # Log integrity check
        await self.audit_logger.log_system_event(
            event_type="integrity_check_completed",
            component="referential_integrity",
            details={
                "collections_checked": len(collections),
                "violations_found": len(integrity_report["violations"]),
                "auto_fixable_violations": len([v for v in integrity_report["violations"] if v.auto_fixable])
            },
            severity=AuditSeverity.INFO
        )
        
        return integrity_report
    
    async def _check_collection_integrity(self, collection_name: str) -> List[IntegrityViolation]:
        """Check integrity for a specific collection"""
        violations = []
        collection = self.db[collection_name]
        
        # Check outgoing references (foreign keys in this collection)
        outgoing_refs = self._get_outgoing_references(collection_name)
        
        for ref in outgoing_refs:
            # Find documents with invalid references
            pipeline = [
                {"$match": {ref.child_field: {"$exists": True, "$ne": None}}},
                {
                    "$lookup": {
                        "from": ref.parent_collection,
                        "localField": ref.child_field,
                        "foreignField": ref.parent_field,
                        "as": "parent_check"
                    }
                },
                {"$match": {"parent_check": {"$size": 0}}}
            ]
            
            async for doc in collection.aggregate(pipeline):
                violations.append(IntegrityViolation(
                    violation_type="orphaned_reference",
                    description=f"Document has invalid reference {ref.child_field}={doc.get(ref.child_field)}",
                    parent_collection=ref.parent_collection,
                    parent_id=str(doc.get(ref.child_field, "")),
                    child_collection=collection_name,
                    child_id=str(doc["_id"]),
                    reference_name=ref.name,
                    severity="error",
                    auto_fixable=True
                ))
        
        return violations
    
    def _generate_integrity_recommendations(self, violations: List[IntegrityViolation]) -> List[str]:
        """Generate recommendations based on violations"""
        recommendations = []
        
        # Group violations by type
        violation_groups = defaultdict(list)
        for violation in violations:
            violation_groups[violation.violation_type].append(violation)
        
        for violation_type, violations_list in violation_groups.items():
            count = len(violations_list)
            
            if violation_type == "orphaned_reference":
                recommendations.append(
                    f"Found {count} orphaned references. Consider running cleanup operations "
                    f"or setting cascade rules to SET_NULL for non-critical references."
                )
            elif violation_type == "restrict_violation":
                recommendations.append(
                    f"Found {count} restrict violations. Review cascade rules or clean up "
                    f"dependent records before deletion operations."
                )
            elif violation_type == "missing_required_reference":
                recommendations.append(
                    f"Found {count} missing required references. Ensure all required foreign "
                    f"keys are properly set during document creation."
                )
        
        # Add general recommendations
        if len(violations) > 100:
            recommendations.append(
                "High number of integrity violations detected. Consider implementing "
                "stricter validation rules and regular integrity checks."
            )
        
        auto_fixable = len([v for v in violations if v.auto_fixable])
        if auto_fixable > 0:
            recommendations.append(
                f"{auto_fixable} violations can be automatically fixed. "
                f"Consider running auto-repair operations."
            )
        
        return recommendations
    
    async def auto_repair_violations(self, violations: List[IntegrityViolation]) -> Dict[str, Any]:
        """Automatically repair violations where possible"""
        repair_results = {
            "repaired_count": 0,
            "failed_repairs": [],
            "operations": []
        }
        
        for violation in violations:
            if not violation.auto_fixable:
                continue
            
            try:
                if violation.violation_type == "orphaned_reference":
                    await self._repair_orphaned_reference(violation)
                    repair_results["operations"].append(f"Repaired orphaned reference: {violation.reference_name}")
                    repair_results["repaired_count"] += 1
                
            except Exception as e:
                repair_results["failed_repairs"].append({
                    "violation": violation.reference_name,
                    "error": str(e)
                })
        
        # Log repair results
        await self.audit_logger.log_system_event(
            event_type="integrity_auto_repair",
            component="referential_integrity",
            details=repair_results,
            severity=AuditSeverity.INFO
        )
        
        return repair_results
    
    async def _repair_orphaned_reference(self, violation: IntegrityViolation):
        """Repair an orphaned reference by setting it to null"""
        collection = self.db[violation.child_collection]
        
        child_id = ObjectId(violation.child_id) if ObjectId.is_valid(violation.child_id) else violation.child_id
        
        # Get the reference definition
        ref = self.references.get(violation.reference_name)
        if not ref:
            raise ValueError(f"Reference {violation.reference_name} not found")
        
        # Set the orphaned reference to null
        await collection.update_one(
            {"_id": child_id},
            {
                "$unset": {ref.child_field: ""},
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "auto_repaired_at": datetime.utcnow(),
                    "repair_reason": "orphaned_reference_cleanup"
                }
            }
        )
    
    async def get_dependency_chain(self, collection_name: str, document_id: str) -> List[Dict[str, Any]]:
        """Get the full dependency chain for a document"""
        dependency_chain = []
        visited = set()
        
        async def _build_chain(coll_name: str, doc_id: str, level: int = 0):
            if (coll_name, doc_id) in visited:
                return
            visited.add((coll_name, doc_id))
            
            # Get incoming references (documents that depend on this one)
            for ref in self._get_incoming_references(coll_name):
                child_collection = self.db[ref.child_collection]
                search_id = ObjectId(doc_id) if ObjectId.is_valid(doc_id) else doc_id
                
                async for dependent_doc in child_collection.find({ref.child_field: search_id}):
                    dependency_info = {
                        "level": level,
                        "collection": ref.child_collection,
                        "document_id": str(dependent_doc["_id"]),
                        "reference_name": ref.name,
                        "cascade_action": ref.cascade_on_delete.value,
                        "document_preview": {
                            k: v for k, v in dependent_doc.items() 
                            if k in ["_id", "name", "title", "status", "created_at"]
                        }
                    }
                    dependency_chain.append(dependency_info)
                    
                    # Recursively find dependencies
                    await _build_chain(ref.child_collection, str(dependent_doc["_id"]), level + 1)
        
        await _build_chain(collection_name, document_id)
        return dependency_chain
    
    def get_integrity_status(self) -> Dict[str, Any]:
        """Get current integrity system status"""
        return {
            "total_references": len(self.references),
            "reference_types": {
                ref_type.value: len([r for r in self.references.values() if r.reference_type == ref_type])
                for ref_type in ReferenceType
            },
            "cascade_actions": {
                action.value: len([r for r in self.references.values() if r.cascade_on_delete == action])
                for action in CascadeAction
            },
            "collections_involved": len(set([ref.parent_collection for ref in self.references.values()] + 
                                         [ref.child_collection for ref in self.references.values()])),
            "dependency_graph_nodes": len(self.dependency_graph.nodes),
            "dependency_graph_edges": len(self.dependency_graph.edges)
        }

# Integration Functions

async def validate_document_integrity(db, collection_name: str, document: Dict[str, Any], 
                                    operation: str = "insert") -> List[IntegrityViolation]:
    """Validate referential integrity for a document"""
    manager = get_integrity_manager(db)
    return await manager.validate_reference_integrity(collection_name, document, operation)

async def execute_cascade_operations(db, collection_name: str, document_id: str, 
                                   operation: str) -> Dict[str, Any]:
    """Execute cascade operations"""
    manager = get_integrity_manager(db)
    return await manager.execute_cascade_operations(collection_name, document_id, operation)

# Global instance
_integrity_manager = None

def get_integrity_manager(db) -> ReferentialIntegrityManager:
    """Get global integrity manager instance"""
    global _integrity_manager
    if _integrity_manager is None:
        _integrity_manager = ReferentialIntegrityManager(db)
    return _integrity_manager

# Export components
__all__ = [
    'ReferentialIntegrityManager',
    'ReferenceDefinition',
    'IntegrityViolation',
    'ReferenceType',
    'CascadeAction',
    'get_integrity_manager',
    'validate_document_integrity',
    'execute_cascade_operations'
]