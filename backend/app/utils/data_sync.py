"""
Real-time Data Synchronization System
Handles event-driven data propagation across all modules using MongoDB change streams
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional, Set, Callable, Union
from datetime import datetime, timedelta
from bson import ObjectId
from pymongo import MongoClient
from pymongo.errors import InvalidOperation, PyMongoError
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorChangeStream
import json
from enum import Enum
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import weakref
import time

from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .data_validation import DataValidator, ValidationContext

# Configure logging
logger = logging.getLogger(__name__)

class SyncEventType(Enum):
    INSERT = "insert"
    UPDATE = "update" 
    DELETE = "delete"
    REPLACE = "replace"

class SyncPriority(Enum):
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4

class SyncStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"

@dataclass
class SyncEvent:
    """Represents a synchronization event"""
    event_id: str
    event_type: SyncEventType
    collection_name: str
    document_id: str
    full_document: Optional[Dict[str, Any]] = None
    full_document_before_change: Optional[Dict[str, Any]] = None
    updated_fields: Optional[Dict[str, Any]] = None
    timestamp: datetime = None
    priority: SyncPriority = SyncPriority.MEDIUM
    status: SyncStatus = SyncStatus.PENDING
    retry_count: int = 0
    max_retries: int = 3
    branch_id: Optional[str] = None
    user_id: Optional[str] = None
    correlation_id: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.event_id is None:
            self.event_id = str(ObjectId())

@dataclass
class SyncRule:
    """Defines synchronization rules for collections"""
    source_collection: str
    target_collections: List[str]
    field_mappings: Dict[str, str]  # source_field -> target_field
    conditions: Optional[Dict[str, Any]] = None
    transform_function: Optional[Callable] = None
    priority: SyncPriority = SyncPriority.MEDIUM
    enabled: bool = True
    bidirectional: bool = False

class DataSyncManager:
    """
    Manages real-time data synchronization across collections
    """
    
    def __init__(self, db_client: AsyncIOMotorClient, db_name: str):
        self.db_client = db_client
        self.db = db_client[db_name]
        self.change_streams: Dict[str, AsyncIOMotorChangeStream] = {}
        self.sync_rules: Dict[str, List[SyncRule]] = {}
        self.event_queue: asyncio.Queue = asyncio.Queue(maxsize=10000)
        self.event_processors: List[asyncio.Task] = []
        self.event_listeners: List[asyncio.Task] = []
        self.is_running = False
        self.sync_stats = {
            "events_processed": 0,
            "events_failed": 0,
            "last_sync_time": None,
            "active_listeners": 0
        }
        self.data_validator = DataValidator()
        self.audit_logger = get_audit_logger()
        self.performance_metrics = {}
        self.event_handlers: Dict[str, List[Callable]] = {}
        
        # Thread pool for CPU-intensive sync operations
        self.executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="sync-worker")
        
        # Initialize default sync rules
        self._initialize_default_sync_rules()
    
    def _initialize_default_sync_rules(self):
        """Initialize default synchronization rules"""
        
        # Student-related synchronizations
        self.add_sync_rule(SyncRule(
            source_collection="students",
            target_collections=["enrollments", "attendance", "grades", "fees"],
            field_mappings={"_id": "student_id", "name": "student_name", "branch_id": "branch_id"},
            priority=SyncPriority.HIGH
        ))
        
        # Teacher-related synchronizations  
        self.add_sync_rule(SyncRule(
            source_collection="teachers",
            target_collections=["classes", "subjects", "grades", "attendance", "users"],
            field_mappings={"_id": "teacher_id", "name": "teacher_name", "branch_id": "branch_id"},
            priority=SyncPriority.HIGH,
            transform_function=self._transform_teacher_assignment_sync
        ))
        
        # Class-related synchronizations
        self.add_sync_rule(SyncRule(
            source_collection="classes",
            target_collections=["enrollments", "attendance", "grades", "timetables", "teachers"],
            field_mappings={"_id": "class_id", "class_name": "class_name", "teacher_id": "teacher_id", "grade_level": "grade_level"},
            priority=SyncPriority.HIGH,
            transform_function=self._transform_class_teacher_sync
        ))
        
        # Parent-student synchronizations
        self.add_sync_rule(SyncRule(
            source_collection="students",
            target_collections=["parents"],
            field_mappings={
                "_id": "student_id", 
                "branch_id": "branch_id",
                "father_name": "father_name",
                "mother_name": "mother_name",
                "phone": "father_phone",
                "email": "father_email",
                "address": "address"
            },
            priority=SyncPriority.MEDIUM,
            transform_function=self._transform_student_to_parent_sync
        ))
        
        # Parent-student bidirectional sync
        self.add_sync_rule(SyncRule(
            source_collection="parents",
            target_collections=["students"],
            field_mappings={
                "_id": "parent_guardian_id",
                "father_name": "father_name", 
                "mother_name": "mother_name",
                "father_phone": "phone",
                "father_email": "email",
                "address": "address"
            },
            priority=SyncPriority.MEDIUM,
            bidirectional=True,
            transform_function=self._transform_parent_to_student_sync
        ))
        
        # Fee-related synchronizations
        self.add_sync_rule(SyncRule(
            source_collection="fee_structures",
            target_collections=["fees", "payments"],
            field_mappings={"_id": "fee_structure_id", "amount": "fee_amount"},
            priority=SyncPriority.HIGH
        ))
        
        # Academic calendar synchronizations
        self.add_sync_rule(SyncRule(
            source_collection="academic_calendar",
            target_collections=["grades", "attendance", "exams", "classes"],
            field_mappings={"academic_year": "academic_year", "term": "term"},
            priority=SyncPriority.CRITICAL
        ))
        
        # Branch-related synchronizations
        self.add_sync_rule(SyncRule(
            source_collection="branches", 
            target_collections=["students", "teachers", "classes", "fees"],
            field_mappings={"_id": "branch_id", "name": "branch_name"},
            priority=SyncPriority.CRITICAL
        ))
        
        # Cross-Module Business Rules
        
        # Student status changes affecting multiple modules
        self.add_sync_rule(SyncRule(
            source_collection="students",
            target_collections=["fees", "attendance", "grades", "parent_student_links"],
            field_mappings={
                "_id": "student_id", 
                "status": "student_status",
                "graduation_date": "student_graduation_date",
                "withdrawal_date": "student_withdrawal_date"
            },
            conditions={"status": {"$in": ["inactive", "graduated", "withdrawn"]}},
            transform_function=self._transform_student_status_change,
            priority=SyncPriority.HIGH
        ))
        
        # Fee payment updates affecting student balances and parent notifications
        self.add_sync_rule(SyncRule(
            source_collection="payments",
            target_collections=["fees", "students", "parent_student_links"],
            field_mappings={
                "student_id": "student_id",
                "amount": "payment_amount", 
                "payment_date": "last_payment_date",
                "status": "payment_status"
            },
            transform_function=self._transform_payment_update,
            priority=SyncPriority.HIGH
        ))
        
        # Attendance affecting parent notifications and dashboard stats
        self.add_sync_rule(SyncRule(
            source_collection="attendance",
            target_collections=["students", "parent_student_links", "dashboard_stats"],
            field_mappings={
                "student_id": "student_id",
                "date": "last_attendance_date",
                "status": "attendance_status",
                "class_id": "class_id"
            },
            transform_function=self._transform_attendance_update,
            priority=SyncPriority.MEDIUM
        ))
        
        # Grade entries affecting student records and parent portal
        self.add_sync_rule(SyncRule(
            source_collection="grades",
            target_collections=["students", "parent_student_links", "academic_progress"],
            field_mappings={
                "student_id": "student_id",
                "subject_id": "subject_id",
                "grade": "latest_grade",
                "grade_date": "last_grade_date",
                "semester": "current_semester"
            },
            transform_function=self._transform_grade_update,
            priority=SyncPriority.MEDIUM
        ))
        
        # Exam results affecting multiple reporting modules
        self.add_sync_rule(SyncRule(
            source_collection="exam_results",
            target_collections=["students", "academic_progress", "parent_student_links", "class_performance"],
            field_mappings={
                "student_id": "student_id",
                "exam_id": "exam_id",
                "score": "exam_score",
                "percentage": "exam_percentage",
                "grade": "exam_grade"
            },
            transform_function=self._transform_exam_result,
            priority=SyncPriority.MEDIUM
        ))
        
        # Class enrollment changes affecting multiple modules
        self.add_sync_rule(SyncRule(
            source_collection="enrollments",
            target_collections=["students", "classes", "attendance", "fees"],
            field_mappings={
                "student_id": "student_id",
                "class_id": "class_id", 
                "enrollment_date": "class_enrollment_date",
                "status": "enrollment_status"
            },
            transform_function=self._transform_enrollment_change,
            priority=SyncPriority.HIGH
        ))
    
    def add_sync_rule(self, rule: SyncRule):
        """Add a synchronization rule"""
        if rule.source_collection not in self.sync_rules:
            self.sync_rules[rule.source_collection] = []
        self.sync_rules[rule.source_collection].append(rule)
        
        logger.info(f"Added sync rule: {rule.source_collection} -> {rule.target_collections}")
    
    def remove_sync_rule(self, source_collection: str, target_collection: str):
        """Remove a synchronization rule"""
        if source_collection in self.sync_rules:
            self.sync_rules[source_collection] = [
                rule for rule in self.sync_rules[source_collection]
                if target_collection not in rule.target_collections
            ]
    
    def add_event_handler(self, event_type: str, handler: Callable):
        """Add custom event handler"""
        if event_type not in self.event_handlers:
            self.event_handlers[event_type] = []
        self.event_handlers[event_type].append(handler)
    
    async def start_sync(self):
        """Start the synchronization system"""
        if self.is_running:
            logger.warning("Sync system is already running")
            return
        
        self.is_running = True
        logger.info("Starting data synchronization system")
        
        # Start event processors
        for i in range(3):  # 3 concurrent processors
            processor = asyncio.create_task(self._process_events())
            self.event_processors.append(processor)
        
        # Start change stream listeners for collections with sync rules
        for collection_name in self.sync_rules.keys():
            listener = asyncio.create_task(self._listen_to_changes(collection_name))
            self.event_listeners.append(listener)
        
        # Start metrics collector
        asyncio.create_task(self._collect_metrics())
        
        await self.audit_logger.log_system_event(
            event_type="sync_system_started",
            component="data_sync",
            details={"collections": list(self.sync_rules.keys())},
            severity=AuditSeverity.INFO
        )
    
    async def stop_sync(self):
        """Stop the synchronization system"""
        if not self.is_running:
            return
            
        self.is_running = False
        logger.info("Stopping data synchronization system")
        
        # Cancel all tasks
        for task in self.event_processors + self.event_listeners:
            if not task.done():
                task.cancel()
        
        # Close change streams
        for stream in self.change_streams.values():
            if stream:
                await stream.close()
        
        self.change_streams.clear()
        
        await self.audit_logger.log_system_event(
            event_type="sync_system_stopped",
            component="data_sync",
            severity=AuditSeverity.INFO
        )
    
    async def _listen_to_changes(self, collection_name: str):
        """Listen to changes in a specific collection"""
        try:
            collection = self.db[collection_name]
            
            # Create change stream with full document lookup
            pipeline = [
                {"$match": {"operationType": {"$in": ["insert", "update", "replace", "delete"]}}}
            ]
            
            change_stream = collection.watch(
                pipeline,
                full_document="updateLookup",
                full_document_before_change="whenAvailable"
            )
            
            self.change_streams[collection_name] = change_stream
            self.sync_stats["active_listeners"] += 1
            
            logger.info(f"Started listening to changes in {collection_name}")
            
            async for change in change_stream:
                if not self.is_running:
                    break
                
                try:
                    sync_event = await self._create_sync_event(change, collection_name)
                    if sync_event:
                        await self.event_queue.put(sync_event)
                        
                except Exception as e:
                    logger.error(f"Error creating sync event for {collection_name}: {e}")
                    await self.audit_logger.log_system_event(
                        event_type="sync_event_creation_error",
                        component="data_sync",
                        details={"collection": collection_name, "error": str(e)},
                        severity=AuditSeverity.ERROR
                    )
        
        except Exception as e:
            logger.error(f"Error in change stream listener for {collection_name}: {e}")
            self.sync_stats["active_listeners"] -= 1
            
            # Attempt to restart listener after delay
            if self.is_running:
                await asyncio.sleep(5)
                asyncio.create_task(self._listen_to_changes(collection_name))
    
    async def _create_sync_event(self, change: Dict[str, Any], collection_name: str) -> Optional[SyncEvent]:
        """Create a sync event from a change stream event"""
        try:
            operation_type = change.get("operationType")
            document_key = change.get("documentKey", {})
            full_document = change.get("fullDocument")
            full_document_before = change.get("fullDocumentBeforeChange")
            updated_fields = change.get("updateDescription", {}).get("updatedFields")
            
            # Determine priority based on collection and operation
            priority = self._determine_event_priority(collection_name, operation_type)
            
            # Extract branch_id and user_id if available
            branch_id = None
            user_id = None
            if full_document:
                branch_id = full_document.get("branch_id")
                user_id = full_document.get("created_by") or full_document.get("updated_by")
            elif full_document_before:
                branch_id = full_document_before.get("branch_id") 
                user_id = full_document_before.get("created_by") or full_document_before.get("updated_by")
            
            sync_event = SyncEvent(
                event_id=str(ObjectId()),
                event_type=SyncEventType(operation_type),
                collection_name=collection_name,
                document_id=str(document_key.get("_id")),
                full_document=full_document,
                full_document_before_change=full_document_before,
                updated_fields=updated_fields,
                priority=priority,
                branch_id=branch_id,
                user_id=user_id,
                correlation_id=change.get("_id", {}).get("$oid")
            )
            
            return sync_event
            
        except Exception as e:
            logger.error(f"Error creating sync event: {e}")
            return None
    
    def _determine_event_priority(self, collection_name: str, operation_type: str) -> SyncPriority:
        """Determine event priority based on collection and operation"""
        # Critical collections that affect system integrity
        critical_collections = ["branches", "academic_calendar", "users"]
        high_priority_collections = ["students", "teachers", "classes", "fees"]
        
        if collection_name in critical_collections:
            return SyncPriority.CRITICAL
        elif collection_name in high_priority_collections:
            return SyncPriority.HIGH
        elif operation_type == "delete":
            return SyncPriority.HIGH  # Deletions are always high priority
        else:
            return SyncPriority.MEDIUM
    
    async def _process_events(self):
        """Process events from the queue"""
        while self.is_running:
            try:
                # Get event with timeout to allow periodic checks
                sync_event = await asyncio.wait_for(
                    self.event_queue.get(), 
                    timeout=1.0
                )
                
                start_time = time.time()
                sync_event.status = SyncStatus.PROCESSING
                
                try:
                    await self._synchronize_event(sync_event)
                    sync_event.status = SyncStatus.COMPLETED
                    self.sync_stats["events_processed"] += 1
                    
                except Exception as e:
                    logger.error(f"Error processing sync event {sync_event.event_id}: {e}")
                    sync_event.status = SyncStatus.FAILED
                    sync_event.retry_count += 1
                    self.sync_stats["events_failed"] += 1
                    
                    # Retry if under limit
                    if sync_event.retry_count < sync_event.max_retries:
                        sync_event.status = SyncStatus.RETRYING
                        await asyncio.sleep(2 ** sync_event.retry_count)  # Exponential backoff
                        await self.event_queue.put(sync_event)
                    
                    await self.audit_logger.log_system_event(
                        event_type="sync_event_failed",
                        component="data_sync",
                        details={
                            "event_id": sync_event.event_id,
                            "collection": sync_event.collection_name,
                            "error": str(e),
                            "retry_count": sync_event.retry_count
                        },
                        severity=AuditSeverity.ERROR
                    )
                
                # Record performance metrics
                processing_time = time.time() - start_time
                self._record_performance_metric(sync_event.collection_name, processing_time)
                
                self.event_queue.task_done()
                
            except asyncio.TimeoutError:
                continue  # No events to process, continue loop
            except Exception as e:
                logger.error(f"Unexpected error in event processor: {e}")
    
    async def _synchronize_event(self, sync_event: SyncEvent):
        """Synchronize a single event across target collections"""
        rules = self.sync_rules.get(sync_event.collection_name, [])
        
        for rule in rules:
            if not rule.enabled:
                continue
            
            # Check conditions
            if rule.conditions and not self._check_conditions(sync_event, rule.conditions):
                continue
            
            for target_collection in rule.target_collections:
                try:
                    await self._sync_to_target(sync_event, rule, target_collection)
                except Exception as e:
                    logger.error(f"Error syncing to {target_collection}: {e}")
                    raise
        
        # Trigger custom event handlers
        await self._trigger_event_handlers(sync_event)
        
        # Update sync timestamp
        self.sync_stats["last_sync_time"] = datetime.utcnow()
    
    async def _sync_to_target(self, sync_event: SyncEvent, rule: SyncRule, target_collection: str):
        """Synchronize event data to a target collection"""
        target_col = self.db[target_collection]
        
        if sync_event.event_type == SyncEventType.INSERT:
            await self._handle_insert_sync(sync_event, rule, target_col)
        elif sync_event.event_type == SyncEventType.UPDATE:
            await self._handle_update_sync(sync_event, rule, target_col)
        elif sync_event.event_type == SyncEventType.DELETE:
            await self._handle_delete_sync(sync_event, rule, target_col)
    
    async def _handle_insert_sync(self, sync_event: SyncEvent, rule: SyncRule, target_collection):
        """Handle insert synchronization"""
        if not sync_event.full_document:
            return
        
        # Build update data based on field mappings
        update_data = self._build_mapped_data(sync_event.full_document, rule.field_mappings)
        
        if not update_data:
            return
        
        # Apply transform function if provided
        if rule.transform_function:
            update_data = rule.transform_function(update_data, sync_event)
        
        # Add sync metadata
        update_data.update({
            "updated_at": datetime.utcnow(),
            "sync_event_id": sync_event.event_id,
            "synced_from": sync_event.collection_name
        })
        
        # Update all matching documents
        filter_query = self._build_filter_query(sync_event, rule)
        
        result = await target_collection.update_many(
            filter_query,
            {"$set": update_data},
            upsert=False
        )
        
        if result.modified_count > 0:
            logger.debug(f"Updated {result.modified_count} documents in {target_collection.name}")
    
    async def _handle_update_sync(self, sync_event: SyncEvent, rule: SyncRule, target_collection):
        """Handle update synchronization"""
        if not sync_event.updated_fields and not sync_event.full_document:
            return
        
        # Use updated fields if available, otherwise full document
        source_data = sync_event.updated_fields or sync_event.full_document
        update_data = self._build_mapped_data(source_data, rule.field_mappings)
        
        if not update_data:
            return
        
        # Apply transform function if provided
        if rule.transform_function:
            update_data = rule.transform_function(update_data, sync_event)
        
        # Add sync metadata
        update_data.update({
            "updated_at": datetime.utcnow(),
            "sync_event_id": sync_event.event_id
        })
        
        # Update all matching documents
        filter_query = self._build_filter_query(sync_event, rule)
        
        result = await target_collection.update_many(
            filter_query,
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            logger.debug(f"Updated {result.modified_count} documents in {target_collection.name}")
    
    async def _handle_delete_sync(self, sync_event: SyncEvent, rule: SyncRule, target_collection):
        """Handle delete synchronization"""
        # For deletes, we typically update status rather than hard delete
        # to maintain referential integrity
        
        filter_query = self._build_filter_query(sync_event, rule)
        
        update_data = {
            "status": "inactive",
            "deleted_at": datetime.utcnow(),
            "sync_event_id": sync_event.event_id,
            "deleted_reference": sync_event.document_id
        }
        
        result = await target_collection.update_many(
            filter_query,
            {"$set": update_data}
        )
        
        if result.modified_count > 0:
            logger.debug(f"Marked {result.modified_count} documents as deleted in {target_collection.name}")
    
    def _build_mapped_data(self, source_data: Dict[str, Any], field_mappings: Dict[str, str]) -> Dict[str, Any]:
        """Build mapped data based on field mappings"""
        mapped_data = {}
        
        for source_field, target_field in field_mappings.items():
            if source_field in source_data:
                mapped_data[target_field] = source_data[source_field]
        
        return mapped_data
    
    def _build_filter_query(self, sync_event: SyncEvent, rule: SyncRule) -> Dict[str, Any]:
        """Build filter query for target collection"""
        # Default filter based on document ID mapping
        primary_mapping = next(iter(rule.field_mappings.items()), ("_id", "source_id"))
        source_field, target_field = primary_mapping
        
        filter_query = {target_field: sync_event.document_id}
        
        # Add branch filter if available
        if sync_event.branch_id:
            filter_query["branch_id"] = sync_event.branch_id
        
        # Add additional conditions from rule
        if rule.conditions:
            filter_query.update(rule.conditions)
        
        return filter_query
    
    def _check_conditions(self, sync_event: SyncEvent, conditions: Dict[str, Any]) -> bool:
        """Check if sync event meets the specified conditions"""
        if not sync_event.full_document:
            return False
        
        for field, expected_value in conditions.items():
            if sync_event.full_document.get(field) != expected_value:
                return False
        
        return True
    
    async def _trigger_event_handlers(self, sync_event: SyncEvent):
        """Trigger custom event handlers"""
        event_key = f"{sync_event.collection_name}:{sync_event.event_type.value}"
        handlers = self.event_handlers.get(event_key, [])
        
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(sync_event)
                else:
                    handler(sync_event)
            except Exception as e:
                logger.error(f"Error in event handler: {e}")
    
    def _record_performance_metric(self, collection_name: str, processing_time: float):
        """Record performance metrics"""
        if collection_name not in self.performance_metrics:
            self.performance_metrics[collection_name] = {
                "total_time": 0,
                "count": 0,
                "avg_time": 0,
                "max_time": 0
            }
        
        metrics = self.performance_metrics[collection_name]
        metrics["total_time"] += processing_time
        metrics["count"] += 1
        metrics["avg_time"] = metrics["total_time"] / metrics["count"]
        metrics["max_time"] = max(metrics["max_time"], processing_time)
    
    async def _collect_metrics(self):
        """Collect and log performance metrics periodically"""
        while self.is_running:
            await asyncio.sleep(300)  # Every 5 minutes
            
            await self.audit_logger.log_system_event(
                event_type="sync_metrics",
                component="data_sync",
                details={
                    "stats": self.sync_stats,
                    "performance": self.performance_metrics,
                    "queue_size": self.event_queue.qsize()
                },
                severity=AuditSeverity.INFO
            )
    
    async def get_sync_status(self) -> Dict[str, Any]:
        """Get current synchronization status"""
        return {
            "is_running": self.is_running,
            "stats": self.sync_stats,
            "queue_size": self.event_queue.qsize(),
            "active_rules": len(self.sync_rules),
            "performance_metrics": self.performance_metrics,
            "active_collections": list(self.sync_rules.keys())
        }
    
    # Business Logic Transform Functions
    
    def _transform_student_status_change(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform student status changes for cross-module updates"""
        try:
            student_status = sync_event.full_document.get("status", "active")
            
            # Add business logic based on student status
            if student_status == "inactive":
                update_data.update({
                    "is_active": False,
                    "deactivation_date": datetime.utcnow(),
                    "should_stop_fees": True,
                    "attendance_required": False
                })
            elif student_status == "graduated":
                update_data.update({
                    "is_graduated": True,
                    "graduation_date": sync_event.full_document.get("graduation_date", datetime.utcnow()),
                    "final_status": "completed",
                    "should_archive": True
                })
            elif student_status == "withdrawn":
                update_data.update({
                    "is_withdrawn": True,
                    "withdrawal_date": sync_event.full_document.get("withdrawal_date", datetime.utcnow()),
                    "final_status": "withdrawn",
                    "should_refund": True
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in student status transform: {e}")
            return update_data
    
    def _transform_payment_update(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform payment updates for fee balance and parent notification"""
        try:
            payment_doc = sync_event.full_document
            payment_amount = float(payment_doc.get("amount", 0))
            payment_status = payment_doc.get("status", "pending")
            
            if payment_status == "completed":
                update_data.update({
                    "total_payments": payment_amount,
                    "last_payment_amount": payment_amount,
                    "payment_count": 1,  # This would be calculated properly in real implementation
                    "balance_updated": True,
                    "notify_parent": True,
                    "payment_notification": {
                        "type": "payment_received",
                        "amount": payment_amount,
                        "date": payment_doc.get("payment_date", datetime.utcnow()),
                        "method": payment_doc.get("payment_method", "cash")
                    }
                })
            elif payment_status == "failed":
                update_data.update({
                    "failed_payment": True,
                    "notify_parent": True,
                    "payment_notification": {
                        "type": "payment_failed",
                        "amount": payment_amount,
                        "reason": payment_doc.get("failure_reason", "Unknown error")
                    }
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in payment transform: {e}")
            return update_data
    
    def _transform_attendance_update(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform attendance updates for parent notifications and stats"""
        try:
            attendance_doc = sync_event.full_document
            attendance_status = attendance_doc.get("status", "present")
            attendance_date = attendance_doc.get("date", datetime.utcnow())
            
            update_data.update({
                "attendance_updated": True,
                "last_attendance_check": attendance_date
            })
            
            if attendance_status == "absent":
                update_data.update({
                    "absence_count": 1,  # This would be calculated properly
                    "notify_parent": True,
                    "attendance_notification": {
                        "type": "student_absent",
                        "date": attendance_date,
                        "class": attendance_doc.get("class_name", "Unknown"),
                        "reason": attendance_doc.get("absence_reason", "Not specified")
                    }
                })
            elif attendance_status == "late":
                update_data.update({
                    "late_count": 1,  # This would be calculated properly
                    "notify_parent": True,
                    "attendance_notification": {
                        "type": "student_late", 
                        "date": attendance_date,
                        "minutes_late": attendance_doc.get("minutes_late", 0)
                    }
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in attendance transform: {e}")
            return update_data
    
    def _transform_grade_update(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform grade updates for student records and parent portal"""
        try:
            grade_doc = sync_event.full_document
            grade_value = grade_doc.get("grade", 0)
            subject = grade_doc.get("subject_name", "Unknown Subject")
            
            update_data.update({
                "grade_updated": True,
                "last_grade_entry": datetime.utcnow(),
                "subject_grades": {
                    subject: {
                        "grade": grade_value,
                        "date": grade_doc.get("grade_date", datetime.utcnow()),
                        "teacher": grade_doc.get("teacher_name", ""),
                        "comments": grade_doc.get("comments", "")
                    }
                }
            })
            
            # Check for significant grade changes that warrant parent notification
            previous_grade = grade_doc.get("previous_grade", 0)
            if abs(grade_value - previous_grade) > 20:  # 20% change
                update_data.update({
                    "notify_parent": True,
                    "grade_notification": {
                        "type": "significant_grade_change",
                        "subject": subject,
                        "new_grade": grade_value,
                        "previous_grade": previous_grade,
                        "change": grade_value - previous_grade
                    }
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in grade transform: {e}")
            return update_data
    
    def _transform_exam_result(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform exam results for academic progress tracking"""
        try:
            exam_doc = sync_event.full_document
            exam_score = float(exam_doc.get("score", 0))
            exam_percentage = float(exam_doc.get("percentage", 0))
            exam_name = exam_doc.get("exam_name", "Exam")
            
            update_data.update({
                "exam_completed": True,
                "last_exam_date": exam_doc.get("exam_date", datetime.utcnow()),
                "exam_results": {
                    exam_name: {
                        "score": exam_score,
                        "percentage": exam_percentage,
                        "grade": exam_doc.get("grade", ""),
                        "rank": exam_doc.get("class_rank", 0),
                        "subject": exam_doc.get("subject_name", "")
                    }
                }
            })
            
            # Determine if this is a significant result that needs parent notification
            if exam_percentage >= 90:
                notification_type = "excellent_performance"
            elif exam_percentage < 50:
                notification_type = "needs_attention"
            else:
                notification_type = None
            
            if notification_type:
                update_data.update({
                    "notify_parent": True,
                    "exam_notification": {
                        "type": notification_type,
                        "exam_name": exam_name,
                        "percentage": exam_percentage,
                        "grade": exam_doc.get("grade", ""),
                        "subject": exam_doc.get("subject_name", "")
                    }
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in exam result transform: {e}")
            return update_data
    
    def _transform_enrollment_change(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform enrollment changes affecting fees and attendance"""
        try:
            enrollment_doc = sync_event.full_document
            enrollment_status = enrollment_doc.get("status", "active")
            class_name = enrollment_doc.get("class_name", "Unknown Class")
            
            update_data.update({
                "enrollment_updated": True,
                "class_enrollment_date": enrollment_doc.get("enrollment_date", datetime.utcnow()),
                "current_class": class_name
            })
            
            if enrollment_status == "enrolled":
                update_data.update({
                    "is_enrolled": True,
                    "should_generate_fees": True,
                    "attendance_required": True,
                    "enrollment_notification": {
                        "type": "enrollment_confirmed",
                        "class": class_name,
                        "date": enrollment_doc.get("enrollment_date", datetime.utcnow())
                    }
                })
            elif enrollment_status == "dropped":
                update_data.update({
                    "is_enrolled": False,
                    "should_stop_fees": True,
                    "attendance_required": False,
                    "drop_date": enrollment_doc.get("drop_date", datetime.utcnow()),
                    "enrollment_notification": {
                        "type": "class_dropped",
                        "class": class_name,
                        "reason": enrollment_doc.get("drop_reason", "Not specified")
                    }
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in enrollment transform: {e}")
            return update_data
    
    def _transform_student_to_parent_sync(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform student data changes for parent record sync"""
        try:
            student_doc = sync_event.full_document
            
            # Only sync if student has parent information
            if not (student_doc.get("father_name") or student_doc.get("mother_name")):
                return {}
            
            # Add parent-specific fields
            update_data.update({
                "student_sync_event": sync_event.event_id,
                "last_student_update": datetime.utcnow()
            })
            
            # Handle student status changes affecting parent view
            student_status = student_doc.get("status", "active")
            if student_status in ["inactive", "graduated", "withdrawn"]:
                update_data["student_status_alert"] = {
                    "type": "status_change",
                    "new_status": student_status,
                    "date": datetime.utcnow(),
                    "requires_action": student_status == "withdrawn"
                }
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in student to parent sync transform: {e}")
            return update_data
    
    def _transform_parent_to_student_sync(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform parent data changes for student record sync"""
        try:
            parent_doc = sync_event.full_document
            
            # Add sync metadata
            update_data.update({
                "parent_sync_event": sync_event.event_id,
                "last_parent_update": datetime.utcnow()
            })
            
            # Handle emergency contact updates
            if "emergency_contact_name" in update_data or "emergency_contact_phone" in update_data:
                update_data.update({
                    "emergency_contact_name": parent_doc.get("emergency_contact_name"),
                    "emergency_contact_phone": parent_doc.get("emergency_contact_phone")
                })
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in parent to student sync transform: {e}")
            return update_data
    
    def _transform_teacher_assignment_sync(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform teacher data changes for class assignment sync"""
        try:
            teacher_doc = sync_event.full_document
            
            # Add teacher-specific sync metadata
            update_data.update({
                "teacher_sync_event": sync_event.event_id,
                "last_teacher_update": datetime.utcnow()
            })
            
            # Handle teacher status changes affecting class assignments
            teacher_status = teacher_doc.get("status", "active")
            if teacher_status in ["inactive", "terminated", "on_leave"]:
                update_data["teacher_availability"] = {
                    "status": teacher_status,
                    "effective_date": datetime.utcnow(),
                    "requires_reassignment": teacher_status in ["terminated", "inactive"]
                }
                
                # If teacher is terminated/inactive, mark for class reassignment
                if teacher_status in ["terminated", "inactive"]:
                    update_data["pending_reassignment"] = True
                    update_data["reassignment_priority"] = "high"
            
            # Handle teacher subject specialization changes
            if "subject_specialization" in teacher_doc:
                update_data["teacher_subjects"] = teacher_doc.get("subject_specialization", [])
                update_data["specialization_updated"] = True
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in teacher assignment sync transform: {e}")
            return update_data
    
    def _transform_class_teacher_sync(self, update_data: Dict[str, Any], sync_event: SyncEvent) -> Dict[str, Any]:
        """Transform class data changes for teacher assignment sync"""
        try:
            class_doc = sync_event.full_document
            
            # Add class-specific sync metadata
            update_data.update({
                "class_sync_event": sync_event.event_id,
                "last_class_update": datetime.utcnow()
            })
            
            # Handle teacher assignment changes
            teacher_id = class_doc.get("teacher_id")
            if teacher_id:
                update_data.update({
                    "assigned_teacher": teacher_id,
                    "class_assignment_active": True,
                    "assignment_date": datetime.utcnow(),
                    "requires_roster_sync": True
                })
                
                # If this is an update event, check for teacher changes
                if sync_event.event_type == SyncEventType.UPDATE:
                    old_teacher = sync_event.full_document_before_change.get("teacher_id") if sync_event.full_document_before_change else None
                    if old_teacher and old_teacher != teacher_id:
                        update_data.update({
                            "previous_teacher": old_teacher,
                            "teacher_changed": True,
                            "change_reason": "reassignment",
                            "permission_transfer_required": True
                        })
            else:
                # No teacher assigned
                update_data.update({
                    "assigned_teacher": None,
                    "class_assignment_active": False,
                    "requires_teacher_assignment": True,
                    "assignment_priority": "medium"
                })
            
            # Handle class capacity and enrollment sync
            max_capacity = class_doc.get("max_capacity", 25)
            current_enrollment = class_doc.get("current_enrollment", 0)
            
            if current_enrollment > max_capacity:
                update_data["enrollment_alert"] = {
                    "type": "over_capacity",
                    "current": current_enrollment,
                    "max": max_capacity,
                    "requires_attention": True
                }
            
            return update_data
            
        except Exception as e:
            logger.error(f"Error in class teacher sync transform: {e}")
            return update_data
    
    async def force_sync(self, collection_name: str, document_id: str, event_type: str = "update"):
        """Force synchronization of a specific document"""
        try:
            collection = self.db[collection_name]
            document = await collection.find_one({"_id": ObjectId(document_id)})
            
            if not document:
                raise ValueError(f"Document {document_id} not found in {collection_name}")
            
            sync_event = SyncEvent(
                event_id=str(ObjectId()),
                event_type=SyncEventType(event_type),
                collection_name=collection_name,
                document_id=document_id,
                full_document=document,
                priority=SyncPriority.HIGH
            )
            
            await self.event_queue.put(sync_event)
            
            return {"message": f"Forced sync initiated for {collection_name}:{document_id}"}
            
        except Exception as e:
            logger.error(f"Error in force sync: {e}")
            raise

# Global sync manager instance
_sync_manager_instance = None

def get_sync_manager(db_client: AsyncIOMotorClient = None, db_name: str = "school_management") -> DataSyncManager:
    """Get the global sync manager instance"""
    global _sync_manager_instance
    
    if _sync_manager_instance is None:
        if db_client is None:
            raise ValueError("db_client is required for first initialization")
        _sync_manager_instance = DataSyncManager(db_client, db_name)
    
    return _sync_manager_instance

async def initialize_sync_system(db_client: AsyncIOMotorClient, db_name: str = "school_management"):
    """Initialize and start the synchronization system"""
    sync_manager = get_sync_manager(db_client, db_name)
    await sync_manager.start_sync()
    return sync_manager

async def shutdown_sync_system():
    """Shutdown the synchronization system"""
    global _sync_manager_instance
    if _sync_manager_instance:
        await _sync_manager_instance.stop_sync()
        _sync_manager_instance = None

# Export main components
__all__ = [
    'DataSyncManager',
    'SyncEvent', 
    'SyncRule',
    'SyncEventType',
    'SyncPriority',
    'SyncStatus',
    'get_sync_manager',
    'initialize_sync_system',
    'shutdown_sync_system'
]