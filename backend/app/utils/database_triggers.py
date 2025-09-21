"""
Database Triggers and Event Listeners System
Handles complex business logic, referential integrity, and custom event processing
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional, Callable, Union, Set
from datetime import datetime, timedelta
from bson import ObjectId
from enum import Enum
from dataclasses import dataclass
from abc import ABC, abstractmethod
import inspect
from functools import wraps

from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .data_validation import DataValidator, ValidationContext, ValidationResult
from .data_sync import get_sync_manager, SyncEvent, SyncEventType

# Configure logging
logger = logging.getLogger(__name__)

class TriggerTiming(Enum):
    BEFORE_INSERT = "before_insert"
    AFTER_INSERT = "after_insert"
    BEFORE_UPDATE = "before_update"
    AFTER_UPDATE = "after_update"
    BEFORE_DELETE = "before_delete"
    AFTER_DELETE = "after_delete"
    ON_CHANGE = "on_change"

class TriggerPriority(Enum):
    HIGHEST = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4
    LOWEST = 5

@dataclass
class TriggerContext:
    """Context information for trigger execution"""
    collection_name: str
    operation: str
    document_id: str
    old_document: Optional[Dict[str, Any]] = None
    new_document: Optional[Dict[str, Any]] = None
    changed_fields: Optional[Set[str]] = None
    user_id: Optional[str] = None
    branch_id: Optional[str] = None
    timestamp: datetime = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.metadata is None:
            self.metadata = {}

class BaseTrigger(ABC):
    """Base class for all database triggers"""
    
    def __init__(self, name: str, collection: str, timing: TriggerTiming, priority: TriggerPriority = TriggerPriority.MEDIUM):
        self.name = name
        self.collection = collection
        self.timing = timing
        self.priority = priority
        self.enabled = True
        self.execution_stats = {
            "executions": 0,
            "failures": 0,
            "total_time": 0,
            "avg_time": 0
        }
    
    @abstractmethod
    async def execute(self, context: TriggerContext, db) -> bool:
        """Execute the trigger logic. Return True if successful, False to cancel operation"""
        pass
    
    def should_execute(self, context: TriggerContext) -> bool:
        """Determine if trigger should execute based on context"""
        return self.enabled
    
    async def validate_execution(self, context: TriggerContext, db) -> List[str]:
        """Validate if trigger can execute. Return list of error messages"""
        return []

class DatabaseTriggerManager:
    """Manages and executes database triggers"""
    
    def __init__(self, db):
        self.db = db
        self.triggers: Dict[str, List[BaseTrigger]] = {}  # collection -> list of triggers
        self.global_triggers: List[BaseTrigger] = []
        self.audit_logger = get_audit_logger()
        self.data_validator = DataValidator()
        
        # Initialize built-in triggers
        self._register_builtin_triggers()
    
    def register_trigger(self, trigger: BaseTrigger):
        """Register a trigger for a specific collection"""
        if trigger.collection not in self.triggers:
            self.triggers[trigger.collection] = []
        
        self.triggers[trigger.collection].append(trigger)
        
        # Sort by priority (highest first)
        self.triggers[trigger.collection].sort(key=lambda t: t.priority.value)
        
        logger.info(f"Registered trigger: {trigger.name} for {trigger.collection}")
    
    def register_global_trigger(self, trigger: BaseTrigger):
        """Register a global trigger that applies to all collections"""
        self.global_triggers.append(trigger)
        self.global_triggers.sort(key=lambda t: t.priority.value)
        
        logger.info(f"Registered global trigger: {trigger.name}")
    
    def unregister_trigger(self, collection: str, trigger_name: str):
        """Unregister a trigger"""
        if collection in self.triggers:
            self.triggers[collection] = [
                t for t in self.triggers[collection] if t.name != trigger_name
            ]
    
    async def execute_triggers(self, context: TriggerContext) -> bool:
        """Execute all relevant triggers for the given context"""
        try:
            # Get collection-specific triggers
            collection_triggers = self.triggers.get(context.collection_name, [])
            
            # Filter triggers by timing and enabled status
            relevant_triggers = [
                t for t in collection_triggers + self.global_triggers
                if t.timing == TriggerTiming(context.operation) and t.should_execute(context)
            ]
            
            if not relevant_triggers:
                return True
            
            # Execute triggers in priority order
            for trigger in relevant_triggers:
                try:
                    start_time = datetime.utcnow()
                    
                    # Validate trigger execution
                    validation_errors = await trigger.validate_execution(context, self.db)
                    if validation_errors:
                        logger.warning(f"Trigger {trigger.name} validation failed: {validation_errors}")
                        continue
                    
                    # Execute trigger
                    success = await trigger.execute(context, self.db)
                    
                    # Update stats
                    execution_time = (datetime.utcnow() - start_time).total_seconds()
                    trigger.execution_stats["executions"] += 1
                    trigger.execution_stats["total_time"] += execution_time
                    trigger.execution_stats["avg_time"] = (
                        trigger.execution_stats["total_time"] / trigger.execution_stats["executions"]
                    )
                    
                    if not success:
                        logger.warning(f"Trigger {trigger.name} returned False, cancelling operation")
                        return False
                    
                except Exception as e:
                    trigger.execution_stats["failures"] += 1
                    logger.error(f"Error executing trigger {trigger.name}: {e}")
                    
                    # Log audit event
                    await self.audit_logger.log_system_event(
                        event_type="trigger_execution_error",
                        component="database_triggers",
                        details={
                            "trigger_name": trigger.name,
                            "collection": context.collection_name,
                            "error": str(e),
                            "context": context.metadata
                        },
                        severity=AuditSeverity.ERROR
                    )
                    
                    # For critical operations, fail fast
                    if trigger.priority in [TriggerPriority.HIGHEST, TriggerPriority.HIGH]:
                        return False
            
            return True
            
        except Exception as e:
            logger.error(f"Error in trigger execution: {e}")
            return False
    
    def _register_builtin_triggers(self):
        """Register built-in system triggers"""
        
        # Student enrollment validation
        self.register_trigger(StudentEnrollmentTrigger())
        
        # Academic year validation 
        self.register_trigger(AcademicYearValidationTrigger())
        
        # Fee calculation trigger
        self.register_trigger(FeeCalculationTrigger())
        
        # Parent-student relationship trigger
        self.register_trigger(ParentStudentLinkTrigger())
        
        # Class capacity validation
        self.register_trigger(ClassCapacityTrigger())
        
        # Teacher assignment validation
        self.register_trigger(TeacherAssignmentTrigger())
        
        # Grade level progression
        self.register_trigger(GradeLevelProgressionTrigger())
        
        # Branch isolation enforcement
        self.register_trigger(BranchIsolationTrigger())
        
        # Attendance consistency
        self.register_trigger(AttendanceConsistencyTrigger())
        
        # Payment validation
        self.register_trigger(PaymentValidationTrigger())

# Built-in Trigger Implementations

class StudentEnrollmentTrigger(BaseTrigger):
    """Validates student enrollment business rules"""
    
    def __init__(self):
        super().__init__("student_enrollment", "enrollments", TriggerTiming.BEFORE_INSERT, TriggerPriority.HIGH)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        enrollment_data = context.new_document
        
        # Check if student exists
        student = await db.students.find_one({"_id": ObjectId(enrollment_data["student_id"])})
        if not student:
            logger.error(f"Student {enrollment_data['student_id']} not found")
            return False
        
        # Check if class exists and has capacity
        class_doc = await db.classes.find_one({"_id": ObjectId(enrollment_data["class_id"])})
        if not class_doc:
            logger.error(f"Class {enrollment_data['class_id']} not found")
            return False
        
        # Check current enrollment count
        current_enrollments = await db.enrollments.count_documents({
            "class_id": enrollment_data["class_id"],
            "status": "active"
        })
        
        if current_enrollments >= class_doc.get("max_capacity", 30):
            logger.error(f"Class {enrollment_data['class_id']} is at capacity")
            return False
        
        # Check for duplicate enrollment
        existing = await db.enrollments.find_one({
            "student_id": enrollment_data["student_id"],
            "class_id": enrollment_data["class_id"],
            "academic_year": enrollment_data["academic_year"],
            "status": "active"
        })
        
        if existing:
            logger.error(f"Student already enrolled in class for academic year")
            return False
        
        # Validate branch consistency
        if student.get("branch_id") != class_doc.get("branch_id"):
            logger.error("Student and class must be in the same branch")
            return False
        
        return True

class AcademicYearValidationTrigger(BaseTrigger):
    """Validates academic year consistency across operations"""
    
    def __init__(self):
        super().__init__("academic_year_validation", "*", TriggerTiming.BEFORE_INSERT, TriggerPriority.HIGH)
        self.collections_with_academic_year = [
            "enrollments", "grades", "attendance", "exams", "assignments", "fees"
        ]
    
    def should_execute(self, context: TriggerContext) -> bool:
        return context.collection_name in self.collections_with_academic_year
    
    async def execute(self, context: TriggerContext, db) -> bool:
        document = context.new_document
        
        if "academic_year" not in document:
            return True  # Skip if no academic year specified
        
        # Validate academic year format (e.g., "2024-2025")
        academic_year = document["academic_year"]
        if not self._validate_academic_year_format(academic_year):
            logger.error(f"Invalid academic year format: {academic_year}")
            return False
        
        # Check if academic year is active
        calendar = await db.academic_calendar.find_one({
            "academic_year": academic_year,
            "status": "active"
        })
        
        if not calendar:
            logger.error(f"Academic year {academic_year} is not active")
            return False
        
        return True
    
    def _validate_academic_year_format(self, academic_year: str) -> bool:
        """Validate academic year format YYYY-YYYY"""
        try:
            parts = academic_year.split("-")
            if len(parts) != 2:
                return False
            
            start_year = int(parts[0])
            end_year = int(parts[1])
            
            return end_year == start_year + 1 and start_year >= 2020
        except (ValueError, IndexError):
            return False

class FeeCalculationTrigger(BaseTrigger):
    """Automatically calculates fees when enrollment is created"""
    
    def __init__(self):
        super().__init__("fee_calculation", "enrollments", TriggerTiming.AFTER_INSERT, TriggerPriority.MEDIUM)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        enrollment = context.new_document
        
        try:
            # Get class information
            class_doc = await db.classes.find_one({"_id": ObjectId(enrollment["class_id"])})
            if not class_doc:
                return True  # Skip if class not found
            
            # Get fee structure for the grade level
            fee_structure = await db.fee_structures.find_one({
                "grade_level": class_doc["grade_level"],
                "academic_year": enrollment["academic_year"],
                "branch_id": enrollment["branch_id"],
                "status": "active"
            })
            
            if not fee_structure:
                logger.warning(f"No fee structure found for grade {class_doc['grade_level']}")
                return True
            
            # Create fee records
            for fee_type in fee_structure.get("fee_types", []):
                fee_data = {
                    "_id": ObjectId(),
                    "student_id": enrollment["student_id"],
                    "enrollment_id": context.document_id,
                    "fee_type": fee_type["name"],
                    "amount": fee_type["amount"],
                    "due_date": fee_type.get("due_date"),
                    "status": "pending",
                    "academic_year": enrollment["academic_year"],
                    "branch_id": enrollment["branch_id"],
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                
                await db.fees.insert_one(fee_data)
            
            logger.info(f"Created fee records for enrollment {context.document_id}")
            
        except Exception as e:
            logger.error(f"Error in fee calculation trigger: {e}")
            # Don't fail the enrollment if fee calculation fails
        
        return True

class ParentStudentLinkTrigger(BaseTrigger):
    """Validates parent-student relationships"""
    
    def __init__(self):
        super().__init__("parent_student_link", "parent_student_links", TriggerTiming.BEFORE_INSERT, TriggerPriority.HIGH)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        link_data = context.new_document
        
        # Validate parent exists
        parent = await db.parents.find_one({"_id": ObjectId(link_data["parent_user_id"])})
        if not parent:
            logger.error(f"Parent {link_data['parent_user_id']} not found")
            return False
        
        # Validate student exists
        student = await db.students.find_one({"_id": ObjectId(link_data["student_id"])})
        if not student:
            logger.error(f"Student {link_data['student_id']} not found")
            return False
        
        # Check branch consistency
        if parent.get("branch_id") != student.get("branch_id"):
            logger.error("Parent and student must be in the same branch")
            return False
        
        # Check for duplicate primary contact
        if link_data.get("is_primary_contact"):
            existing_primary = await db.parent_student_links.find_one({
                "student_id": link_data["student_id"],
                "is_primary_contact": True,
                "status": "active"
            })
            
            if existing_primary:
                logger.error("Student already has a primary contact")
                return False
        
        return True

class ClassCapacityTrigger(BaseTrigger):
    """Validates class capacity limits"""
    
    def __init__(self):
        super().__init__("class_capacity", "classes", TriggerTiming.BEFORE_UPDATE, TriggerPriority.MEDIUM)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        if "max_capacity" not in context.changed_fields:
            return True
        
        new_capacity = context.new_document.get("max_capacity", 30)
        
        # Check current enrollment count
        current_enrollments = await db.enrollments.count_documents({
            "class_id": context.document_id,
            "status": "active"
        })
        
        if new_capacity < current_enrollments:
            logger.error(f"Cannot reduce capacity below current enrollment count ({current_enrollments})")
            return False
        
        return True

class TeacherAssignmentTrigger(BaseTrigger):
    """Validates teacher assignments"""
    
    def __init__(self):
        super().__init__("teacher_assignment", "classes", TriggerTiming.BEFORE_INSERT, TriggerPriority.MEDIUM)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        class_data = context.new_document
        
        if "teacher_id" not in class_data:
            return True
        
        # Validate teacher exists
        teacher = await db.teachers.find_one({"_id": ObjectId(class_data["teacher_id"])})
        if not teacher:
            logger.error(f"Teacher {class_data['teacher_id']} not found")
            return False
        
        # Check branch consistency
        if teacher.get("branch_id") != class_data.get("branch_id"):
            logger.error("Teacher and class must be in the same branch")
            return False
        
        # Check teacher workload (maximum 6 classes per academic year)
        teacher_classes = await db.classes.count_documents({
            "teacher_id": class_data["teacher_id"],
            "academic_year": class_data["academic_year"],
            "status": "active"
        })
        
        if teacher_classes >= 6:
            logger.warning(f"Teacher {class_data['teacher_id']} already has maximum classes")
            # Don't fail, just log warning
        
        return True

class GradeLevelProgressionTrigger(BaseTrigger):
    """Handles grade level progression logic"""
    
    def __init__(self):
        super().__init__("grade_progression", "students", TriggerTiming.AFTER_UPDATE, TriggerPriority.LOW)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        if "grade_level" not in context.changed_fields:
            return True
        
        student_id = context.document_id
        old_grade = context.old_document.get("grade_level")
        new_grade = context.new_document.get("grade_level")
        
        try:
            # Log grade progression
            await db.student_progression_history.insert_one({
                "_id": ObjectId(),
                "student_id": student_id,
                "from_grade": old_grade,
                "to_grade": new_grade,
                "progression_date": datetime.utcnow(),
                "academic_year": context.new_document.get("academic_year"),
                "branch_id": context.new_document.get("branch_id"),
                "created_at": datetime.utcnow()
            })
            
            # Update related records (enrollments, etc.)
            # This will be handled by the sync system
            
        except Exception as e:
            logger.error(f"Error in grade progression trigger: {e}")
        
        return True

class BranchIsolationTrigger(BaseTrigger):
    """Enforces branch isolation rules"""
    
    def __init__(self):
        super().__init__("branch_isolation", "*", TriggerTiming.BEFORE_INSERT, TriggerPriority.HIGHEST)
    
    def should_execute(self, context: TriggerContext) -> bool:
        # Apply to collections that should have branch_id
        collections_with_branches = [
            "students", "teachers", "classes", "parents", "enrollments",
            "fees", "grades", "attendance", "assignments", "exams"
        ]
        return context.collection_name in collections_with_branches
    
    async def execute(self, context: TriggerContext, db) -> bool:
        document = context.new_document
        
        # Ensure branch_id is present
        if "branch_id" not in document:
            logger.error(f"branch_id is required for {context.collection_name}")
            return False
        
        # Validate branch exists
        branch = await db.branches.find_one({"_id": ObjectId(document["branch_id"])})
        if not branch:
            logger.error(f"Branch {document['branch_id']} not found")
            return False
        
        # Validate branch is active
        if branch.get("status") != "active":
            logger.error(f"Branch {document['branch_id']} is not active")
            return False
        
        return True

class AttendanceConsistencyTrigger(BaseTrigger):
    """Ensures attendance consistency"""
    
    def __init__(self):
        super().__init__("attendance_consistency", "attendance", TriggerTiming.BEFORE_INSERT, TriggerPriority.MEDIUM)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        attendance_data = context.new_document
        
        # Check if student is enrolled in the class
        enrollment = await db.enrollments.find_one({
            "student_id": attendance_data["student_id"],
            "class_id": attendance_data["class_id"],
            "academic_year": attendance_data["academic_year"],
            "status": "active"
        })
        
        if not enrollment:
            logger.error("Cannot record attendance for non-enrolled student")
            return False
        
        # Check for duplicate attendance record
        existing = await db.attendance.find_one({
            "student_id": attendance_data["student_id"],
            "class_id": attendance_data["class_id"],
            "date": attendance_data["date"]
        })
        
        if existing:
            logger.error("Attendance already recorded for this date")
            return False
        
        return True

class PaymentValidationTrigger(BaseTrigger):
    """Validates payment operations"""
    
    def __init__(self):
        super().__init__("payment_validation", "payments", TriggerTiming.BEFORE_INSERT, TriggerPriority.HIGH)
    
    async def execute(self, context: TriggerContext, db) -> bool:
        payment_data = context.new_document
        
        # Validate fee exists and is pending
        fee = await db.fees.find_one({"_id": ObjectId(payment_data["fee_id"])})
        if not fee:
            logger.error(f"Fee {payment_data['fee_id']} not found")
            return False
        
        if fee.get("status") != "pending":
            logger.error("Cannot pay fee that is not pending")
            return False
        
        # Validate payment amount
        if payment_data["amount"] <= 0:
            logger.error("Payment amount must be positive")
            return False
        
        if payment_data["amount"] > fee["amount"]:
            logger.error("Payment amount cannot exceed fee amount")
            return False
        
        return True

# Event Listener System

class EventListener(ABC):
    """Base class for event listeners"""
    
    def __init__(self, name: str, event_types: List[str]):
        self.name = name
        self.event_types = event_types
        self.enabled = True
    
    @abstractmethod
    async def handle_event(self, event: SyncEvent, db) -> None:
        """Handle the event"""
        pass

class DatabaseEventManager:
    """Manages database event listeners"""
    
    def __init__(self, db):
        self.db = db
        self.listeners: Dict[str, List[EventListener]] = {}
        self.audit_logger = get_audit_logger()
        
        # Register built-in listeners
        self._register_builtin_listeners()
    
    def register_listener(self, listener: EventListener):
        """Register an event listener"""
        for event_type in listener.event_types:
            if event_type not in self.listeners:
                self.listeners[event_type] = []
            self.listeners[event_type].append(listener)
        
        logger.info(f"Registered event listener: {listener.name}")
    
    async def handle_event(self, event: SyncEvent):
        """Handle an event by triggering all relevant listeners"""
        event_key = f"{event.collection_name}:{event.event_type.value}"
        listeners = self.listeners.get(event_key, [])
        
        for listener in listeners:
            if listener.enabled:
                try:
                    await listener.handle_event(event, self.db)
                except Exception as e:
                    logger.error(f"Error in event listener {listener.name}: {e}")
    
    def _register_builtin_listeners(self):
        """Register built-in event listeners"""
        
        # Student deletion cleanup
        self.register_listener(StudentDeletionListener())
        
        # Fee status updates
        self.register_listener(FeeStatusUpdateListener())
        
        # Notification triggers
        self.register_listener(NotificationTriggerListener())

# Built-in Event Listeners

class StudentDeletionListener(EventListener):
    """Handles cleanup when a student is deleted"""
    
    def __init__(self):
        super().__init__("student_deletion", ["students:delete"])
    
    async def handle_event(self, event: SyncEvent, db):
        student_id = event.document_id
        
        # Cleanup related records (soft delete)
        collections_to_update = [
            "enrollments", "attendance", "grades", "fees", 
            "assignments", "disciplinary_actions", "parent_student_links"
        ]
        
        for collection_name in collections_to_update:
            collection = db[collection_name]
            await collection.update_many(
                {"student_id": student_id},
                {
                    "$set": {
                        "status": "inactive",
                        "deactivated_at": datetime.utcnow(),
                        "deactivated_reason": "student_deleted"
                    }
                }
            )
        
        logger.info(f"Cleaned up records for deleted student {student_id}")

class FeeStatusUpdateListener(EventListener):
    """Updates fee status based on payments"""
    
    def __init__(self):
        super().__init__("fee_status_update", ["payments:insert"])
    
    async def handle_event(self, event: SyncEvent, db):
        payment = event.full_document
        fee_id = payment.get("fee_id")
        
        if not fee_id:
            return
        
        # Calculate total paid amount
        total_paid = await db.payments.aggregate([
            {"$match": {"fee_id": fee_id, "status": "completed"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        total_paid_amount = total_paid[0]["total"] if total_paid else 0
        
        # Get original fee amount
        fee = await db.fees.find_one({"_id": ObjectId(fee_id)})
        if not fee:
            return
        
        # Update fee status
        if total_paid_amount >= fee["amount"]:
            new_status = "paid"
        elif total_paid_amount > 0:
            new_status = "partial"
        else:
            new_status = "pending"
        
        await db.fees.update_one(
            {"_id": ObjectId(fee_id)},
            {
                "$set": {
                    "status": new_status,
                    "paid_amount": total_paid_amount,
                    "updated_at": datetime.utcnow()
                }
            }
        )

class NotificationTriggerListener(EventListener):
    """Triggers notifications for important events"""
    
    def __init__(self):
        super().__init__("notification_trigger", [
            "fees:insert", "grades:insert", "attendance:insert",
            "disciplinary_actions:insert", "announcements:insert"
        ])
    
    async def handle_event(self, event: SyncEvent, db):
        # Create appropriate notifications based on event type
        if event.collection_name == "fees" and event.event_type == SyncEventType.INSERT:
            await self._create_fee_notification(event, db)
        elif event.collection_name == "grades" and event.event_type == SyncEventType.INSERT:
            await self._create_grade_notification(event, db)
        # Add more notification types as needed
    
    async def _create_fee_notification(self, event: SyncEvent, db):
        """Create notification for new fee"""
        fee = event.full_document
        
        # Get student information
        student = await db.students.find_one({"_id": ObjectId(fee["student_id"])})
        if not student:
            return
        
        # Create notification for student
        notification_data = {
            "_id": ObjectId(),
            "title": f"New Fee: {fee['fee_type']}",
            "message": f"A new fee of ${fee['amount']} has been assigned to you.",
            "notification_type": "info",
            "user_id": student.get("user_id"),
            "related_entity_type": "fee",
            "related_entity_id": str(fee["_id"]),
            "created_at": datetime.utcnow()
        }
        
        await db.notifications.insert_one(notification_data)
    
    async def _create_grade_notification(self, event: SyncEvent, db):
        """Create notification for new grade"""
        grade = event.full_document
        
        # Get student information
        student = await db.students.find_one({"_id": ObjectId(grade["student_id"])})
        if not student:
            return
        
        # Create notification
        notification_data = {
            "_id": ObjectId(),
            "title": "New Grade Posted",
            "message": f"You have received a grade for {grade.get('subject', 'a subject')}.",
            "notification_type": "info",
            "user_id": student.get("user_id"),
            "related_entity_type": "grade",
            "related_entity_id": str(grade["_id"]),
            "created_at": datetime.utcnow()
        }
        
        await db.notifications.insert_one(notification_data)

# Integration with Sync System
def setup_trigger_integration():
    """Setup integration between triggers and sync system"""
    
    def trigger_aware_sync_handler(sync_event: SyncEvent):
        """Handler that integrates with trigger system"""
        # This would be called by the sync system
        # Implementation would depend on the specific sync system architecture
        pass
    
    # Register with sync system
    sync_manager = get_sync_manager()
    if sync_manager:
        sync_manager.add_event_handler("trigger_integration", trigger_aware_sync_handler)

# Global instances
_trigger_manager = None
_event_manager = None

def get_trigger_manager(db) -> DatabaseTriggerManager:
    """Get global trigger manager instance"""
    global _trigger_manager
    if _trigger_manager is None:
        _trigger_manager = DatabaseTriggerManager(db)
    return _trigger_manager

def get_event_manager(db) -> DatabaseEventManager:
    """Get global event manager instance"""
    global _event_manager
    if _event_manager is None:
        _event_manager = DatabaseEventManager(db)
    return _event_manager

# Export components
__all__ = [
    'BaseTrigger',
    'TriggerContext',
    'TriggerTiming',
    'TriggerPriority',
    'DatabaseTriggerManager',
    'EventListener',
    'DatabaseEventManager',
    'get_trigger_manager',
    'get_event_manager',
    'setup_trigger_integration'
]