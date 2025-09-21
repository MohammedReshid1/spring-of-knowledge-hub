"""
Real-time WebSocket Communication Layer
Provides real-time updates to frontend clients with proper authentication and authorization
"""
import asyncio
import json
import logging
from typing import Dict, List, Any, Optional, Set, Callable, Union
from datetime import datetime, timedelta
from fastapi import WebSocket, WebSocketDisconnect, status, Depends
from fastapi.websockets import WebSocketState
from bson import ObjectId
from enum import Enum
import jwt
import weakref
from collections import defaultdict
from dataclasses import dataclass, asdict
import time

from .audit_logger import get_audit_logger, AuditAction, AuditSeverity
from .auth import decode_access_token
from .rbac import has_permission, Permission
from .branch_context import BranchContext
from .data_sync import SyncEvent, SyncEventType, get_sync_manager

# Configure logging
logger = logging.getLogger(__name__)

class MessageType(Enum):
    # System messages
    CONNECTION_ACK = "connection_ack"
    PING = "ping"
    PONG = "pong"
    ERROR = "error"
    
    # Authentication
    AUTHENTICATE = "authenticate"
    AUTH_SUCCESS = "auth_success"
    AUTH_FAILED = "auth_failed"
    
    # Subscription management
    SUBSCRIBE = "subscribe"
    UNSUBSCRIBE = "unsubscribe"
    SUBSCRIPTION_SUCCESS = "subscription_success"
    SUBSCRIPTION_ERROR = "subscription_error"
    
    # Data updates
    DATA_UPDATE = "data_update"
    DATA_DELETE = "data_delete"
    DATA_INSERT = "data_insert"
    DATA_OPTIMISTIC = "data_optimistic"  # For optimistic UI updates
    
    # Notifications
    NOTIFICATION = "notification"
    SYSTEM_ALERT = "system_alert"
    
    # Real-time events
    USER_ACTIVITY = "user_activity"
    SYSTEM_STATUS = "system_status"
    
    # Batch updates for efficiency
    DATA_BATCH = "data_batch"
    
    # Progress indicators
    OPERATION_PROGRESS = "operation_progress"
    OPERATION_COMPLETE = "operation_complete"

class SubscriptionType(Enum):
    COLLECTION = "collection"  # Subscribe to all changes in a collection
    DOCUMENT = "document"      # Subscribe to changes in a specific document
    USER_DATA = "user_data"    # Subscribe to user-specific data
    BRANCH_DATA = "branch_data"  # Subscribe to branch-specific data
    NOTIFICATIONS = "notifications"  # Subscribe to notifications
    SYSTEM_EVENTS = "system_events"  # Subscribe to system events

@dataclass
class WebSocketMessage:
    """Represents a WebSocket message"""
    type: MessageType
    payload: Dict[str, Any]
    message_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    correlation_id: Optional[str] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
        if self.message_id is None:
            self.message_id = str(ObjectId())
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "type": self.type.value,
            "payload": self.payload,
            "message_id": self.message_id,
            "timestamp": self.timestamp.isoformat(),
            "correlation_id": self.correlation_id
        }

@dataclass
class Subscription:
    """Represents a client subscription"""
    subscription_id: str
    client_id: str
    subscription_type: SubscriptionType
    resource: str  # collection name, document ID, etc.
    filters: Dict[str, Any]
    permissions: List[str]
    created_at: datetime
    last_activity: datetime
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()
        if self.last_activity is None:
            self.last_activity = datetime.utcnow()

class WebSocketConnection:
    """Represents a WebSocket connection with a client"""
    
    def __init__(self, websocket: WebSocket, connection_id: str):
        self.websocket = websocket
        self.connection_id = connection_id
        self.user_id: Optional[str] = None
        self.user_role: Optional[str] = None
        self.branch_id: Optional[str] = None
        self.authenticated = False
        self.connected_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.subscriptions: Dict[str, Subscription] = {}
        self.message_queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self.is_active = True
        self.ping_interval = 30  # seconds
        self.last_ping = datetime.utcnow()
        
        # Rate limiting
        self.message_count = 0
        self.rate_limit_reset = datetime.utcnow() + timedelta(minutes=1)
        self.max_messages_per_minute = 60
        
    async def authenticate(self, token: str) -> bool:
        """Authenticate the WebSocket connection"""
        try:
            payload = decode_access_token(token)
            if payload:
                self.user_id = payload.get("user_id")
                self.user_role = payload.get("role")
                self.branch_id = payload.get("branch_id")
                self.authenticated = True
                
                logger.info(f"WebSocket authenticated for user {self.user_id}")
                return True
            else:
                return False
            
        except Exception as e:
            logger.error(f"WebSocket authentication failed: {e}")
            return False
    
    def check_permission(self, permission: Permission) -> bool:
        """Check if the authenticated user has a specific permission"""
        if not self.authenticated:
            return False
        return has_permission(self.user_role, permission)
    
    def check_rate_limit(self) -> bool:
        """Check if client is within rate limits"""
        now = datetime.utcnow()
        
        # Reset counter if minute has passed
        if now > self.rate_limit_reset:
            self.message_count = 0
            self.rate_limit_reset = now + timedelta(minutes=1)
        
        # Check limit
        if self.message_count >= self.max_messages_per_minute:
            return False
        
        self.message_count += 1
        return True
    
    async def send_message(self, message: WebSocketMessage) -> bool:
        """Send a message to the client"""
        if not self.is_active or self.websocket.client_state != WebSocketState.CONNECTED:
            return False
        
        try:
            await self.websocket.send_json(message.to_dict())
            self.last_activity = datetime.utcnow()
            return True
        except Exception as e:
            logger.error(f"Error sending message to {self.connection_id}: {e}")
            self.is_active = False
            return False
    
    async def close(self, code: int = 1000, reason: str = "Connection closed"):
        """Close the WebSocket connection"""
        try:
            if self.websocket.client_state == WebSocketState.CONNECTED:
                await self.websocket.close(code=code, reason=reason)
        except Exception as e:
            logger.error(f"Error closing WebSocket {self.connection_id}: {e}")
        finally:
            self.is_active = False

class WebSocketManager:
    """Manages WebSocket connections and real-time communication"""
    
    def __init__(self, db):
        self.db = db
        self.connections: Dict[str, WebSocketConnection] = {}
        self.subscriptions: Dict[str, Set[str]] = defaultdict(set)  # resource -> connection_ids
        self.user_connections: Dict[str, Set[str]] = defaultdict(set)  # user_id -> connection_ids
        self.branch_connections: Dict[str, Set[str]] = defaultdict(set)  # branch_id -> connection_ids
        self.audit_logger = get_audit_logger()
        
        # Background tasks
        self.cleanup_task: Optional[asyncio.Task] = None
        self.ping_task: Optional[asyncio.Task] = None
        self.batch_task: Optional[asyncio.Task] = None
        self.is_running = False
        
        # Statistics
        self.stats = {
            "total_connections": 0,
            "active_connections": 0,
            "messages_sent": 0,
            "messages_failed": 0,
            "subscriptions_active": 0,
            "batched_messages": 0,
            "optimistic_updates": 0,
            "grade_notifications": 0,
            "report_notifications": 0,
            "exam_notifications": 0
        }
        
        # Message batching for efficient updates
        self.batch_queue = defaultdict(list)
        self.batch_timer = None
        self.batch_interval = 0.1  # 100ms batching window
        
        # Optimistic update tracking
        self.pending_operations = {}  # track operations waiting for confirmation
        
        # Message handlers
        self.message_handlers: Dict[MessageType, Callable] = {
            MessageType.AUTHENTICATE: self._handle_authenticate,
            MessageType.SUBSCRIBE: self._handle_subscribe,
            MessageType.UNSUBSCRIBE: self._handle_unsubscribe,
            MessageType.PING: self._handle_ping,
        }
        
        # Setup sync integration
        self._setup_sync_integration()
    
    def _setup_sync_integration(self):
        """Setup integration with the data sync system"""
        try:
            # This will be connected later when sync manager is available
            logger.info("WebSocket manager will integrate with data sync system when available")
        except Exception as e:
            logger.warning(f"Could not integrate with sync system: {e}")
            
    def connect_to_sync_manager(self, sync_manager):
        """Connect to the sync manager after it's initialized"""
        try:
            # Add event handlers for each collection we want to broadcast
            collections = ["students", "teachers", "classes", "grades", "attendance", "fees", "exams"]
            for collection in collections:
                for event_type in ["insert", "update", "delete"]:
                    event_key = f"{collection}:{event_type}"
                    sync_manager.add_event_handler(event_key, self._handle_sync_event)
            
            logger.info("WebSocket manager connected to data sync system")
        except Exception as e:
            logger.error(f"Error connecting to sync manager: {e}")
    
    async def start(self):
        """Start the WebSocket manager"""
        if self.is_running:
            return
            
        self.is_running = True
        
        # Start background tasks
        self.cleanup_task = asyncio.create_task(self._cleanup_connections())
        self.ping_task = asyncio.create_task(self._ping_connections())
        self.batch_task = asyncio.create_task(self._process_batched_messages())
        
        logger.info("WebSocket manager started")
    
    async def stop(self):
        """Stop the WebSocket manager"""
        if not self.is_running:
            return
            
        self.is_running = False
        
        # Cancel background tasks
        if self.cleanup_task:
            self.cleanup_task.cancel()
        if self.ping_task:
            self.ping_task.cancel()
        if self.batch_task:
            self.batch_task.cancel()
        
        # Close all connections
        for connection in list(self.connections.values()):
            await connection.close(code=1001, reason="Server shutdown")
        
        self.connections.clear()
        self.subscriptions.clear()
        self.user_connections.clear()
        self.branch_connections.clear()
        
        logger.info("WebSocket manager stopped")
    
    async def connect_client(self, websocket: WebSocket) -> str:
        """Handle new WebSocket connection"""
        connection_id = str(ObjectId())
        
        try:
            await websocket.accept()
            
            connection = WebSocketConnection(websocket, connection_id)
            self.connections[connection_id] = connection
            
            self.stats["total_connections"] += 1
            self.stats["active_connections"] = len(self.connections)
            
            # Send connection acknowledgment
            ack_message = WebSocketMessage(
                type=MessageType.CONNECTION_ACK,
                payload={
                    "connection_id": connection_id,
                    "server_time": datetime.utcnow().isoformat()
                }
            )
            await connection.send_message(ack_message)
            
            logger.info(f"New WebSocket connection: {connection_id}")
            
            # Start message handler for this connection
            asyncio.create_task(self._handle_connection(connection))
            
            return connection_id
            
        except Exception as e:
            logger.error(f"Error accepting WebSocket connection: {e}")
            raise
    
    async def disconnect_client(self, connection_id: str, code: int = 1000, reason: str = "Client disconnected"):
        """Handle client disconnection"""
        connection = self.connections.get(connection_id)
        if not connection:
            return
        
        try:
            # Remove from all tracking structures
            if connection.user_id:
                self.user_connections[connection.user_id].discard(connection_id)
            if connection.branch_id:
                self.branch_connections[connection.branch_id].discard(connection_id)
            
            # Remove subscriptions
            for subscription_id in list(connection.subscriptions.keys()):
                await self._remove_subscription(connection, subscription_id)
            
            # Close connection
            await connection.close(code, reason)
            
            # Remove from connections
            del self.connections[connection_id]
            
            self.stats["active_connections"] = len(self.connections)
            
            # Log disconnect
            await self.audit_logger.log_user_activity(
                user_id=connection.user_id,
                activity_type="websocket_disconnect",
                details={"connection_id": connection_id, "reason": reason},
                severity=AuditSeverity.INFO
            )
            
            logger.info(f"WebSocket disconnected: {connection_id}")
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket {connection_id}: {e}")
    
    async def _handle_connection(self, connection: WebSocketConnection):
        """Handle messages from a WebSocket connection"""
        try:
            while connection.is_active and self.is_running:
                try:
                    # Receive message with timeout
                    raw_data = await asyncio.wait_for(
                        connection.websocket.receive_json(),
                        timeout=60.0
                    )
                    
                    # Check rate limiting
                    if not connection.check_rate_limit():
                        await connection.send_message(WebSocketMessage(
                            type=MessageType.ERROR,
                            payload={"error": "Rate limit exceeded"}
                        ))
                        continue
                    
                    # Parse message
                    message_type = MessageType(raw_data.get("type"))
                    payload = raw_data.get("payload", {})
                    
                    # Handle message
                    handler = self.message_handlers.get(message_type)
                    if handler:
                        await handler(connection, payload)
                    else:
                        await connection.send_message(WebSocketMessage(
                            type=MessageType.ERROR,
                            payload={"error": f"Unknown message type: {message_type.value}"}
                        ))
                
                except asyncio.TimeoutError:
                    # Send ping to check connection
                    if datetime.utcnow() - connection.last_ping > timedelta(seconds=connection.ping_interval):
                        await connection.send_message(WebSocketMessage(
                            type=MessageType.PING,
                            payload={}
                        ))
                        connection.last_ping = datetime.utcnow()
                
                except WebSocketDisconnect:
                    break
                
                except Exception as e:
                    logger.error(f"Error handling WebSocket message from {connection.connection_id}: {e}")
                    await connection.send_message(WebSocketMessage(
                        type=MessageType.ERROR,
                        payload={"error": "Internal server error"}
                    ))
        
        except Exception as e:
            logger.error(f"Error in WebSocket connection handler: {e}")
        
        finally:
            # Clean up connection
            await self.disconnect_client(connection.connection_id)
    
    async def _handle_authenticate(self, connection: WebSocketConnection, payload: Dict[str, Any]):
        """Handle authentication message"""
        token = payload.get("token")
        if not token:
            await connection.send_message(WebSocketMessage(
                type=MessageType.AUTH_FAILED,
                payload={"error": "Token required"}
            ))
            return
        
        if await connection.authenticate(token):
            # Track by user and branch
            if connection.user_id:
                self.user_connections[connection.user_id].add(connection.connection_id)
            if connection.branch_id:
                self.branch_connections[connection.branch_id].add(connection.connection_id)
            
            await connection.send_message(WebSocketMessage(
                type=MessageType.AUTH_SUCCESS,
                payload={
                    "user_id": connection.user_id,
                    "role": connection.user_role,
                    "branch_id": connection.branch_id
                }
            ))
            
            # Log authentication
            await self.audit_logger.log_user_activity(
                user_id=connection.user_id,
                activity_type="websocket_authenticate",
                details={"connection_id": connection.connection_id},
                severity=AuditSeverity.INFO
            )
        else:
            await connection.send_message(WebSocketMessage(
                type=MessageType.AUTH_FAILED,
                payload={"error": "Authentication failed"}
            ))
    
    async def _handle_subscribe(self, connection: WebSocketConnection, payload: Dict[str, Any]):
        """Handle subscription message"""
        if not connection.authenticated:
            await connection.send_message(WebSocketMessage(
                type=MessageType.SUBSCRIPTION_ERROR,
                payload={"error": "Authentication required"}
            ))
            return
        
        try:
            subscription_type = SubscriptionType(payload.get("type"))
            resource = payload.get("resource")
            filters = payload.get("filters", {})
            
            # Validate subscription permissions
            if not await self._validate_subscription_permissions(connection, subscription_type, resource):
                await connection.send_message(WebSocketMessage(
                    type=MessageType.SUBSCRIPTION_ERROR,
                    payload={"error": "Insufficient permissions"}
                ))
                return
            
            # Create subscription
            subscription_id = str(ObjectId())
            subscription = Subscription(
                subscription_id=subscription_id,
                client_id=connection.connection_id,
                subscription_type=subscription_type,
                resource=resource,
                filters=filters,
                permissions=self._get_user_permissions(connection),
                created_at=datetime.utcnow(),
                last_activity=datetime.utcnow()
            )
            
            connection.subscriptions[subscription_id] = subscription
            self.subscriptions[resource].add(connection.connection_id)
            
            self.stats["subscriptions_active"] = sum(len(subs) for subs in self.subscriptions.values())
            
            await connection.send_message(WebSocketMessage(
                type=MessageType.SUBSCRIPTION_SUCCESS,
                payload={
                    "subscription_id": subscription_id,
                    "resource": resource,
                    "type": subscription_type.value
                }
            ))
            
            logger.debug(f"Client {connection.connection_id} subscribed to {resource}")
            
        except Exception as e:
            await connection.send_message(WebSocketMessage(
                type=MessageType.SUBSCRIPTION_ERROR,
                payload={"error": str(e)}
            ))
    
    async def _handle_unsubscribe(self, connection: WebSocketConnection, payload: Dict[str, Any]):
        """Handle unsubscribe message"""
        subscription_id = payload.get("subscription_id")
        if subscription_id in connection.subscriptions:
            await self._remove_subscription(connection, subscription_id)
            await connection.send_message(WebSocketMessage(
                type=MessageType.SUBSCRIPTION_SUCCESS,
                payload={"subscription_id": subscription_id, "action": "unsubscribed"}
            ))
    
    async def _handle_ping(self, connection: WebSocketConnection, payload: Dict[str, Any]):
        """Handle ping message"""
        await connection.send_message(WebSocketMessage(
            type=MessageType.PONG,
            payload={"timestamp": datetime.utcnow().isoformat()}
        ))
    
    async def _validate_subscription_permissions(self, connection: WebSocketConnection, 
                                               subscription_type: SubscriptionType, 
                                               resource: str) -> bool:
        """Validate if user has permission to subscribe to a resource"""
        
        if subscription_type == SubscriptionType.COLLECTION:
            # Check collection-specific permissions
            collection_permissions = {
                "students": Permission.READ_STUDENT,
                "teachers": Permission.READ_TEACHER,
                "classes": Permission.READ_CLASS,
                "grades": Permission.READ_GRADE,
                "attendance": Permission.READ_ATTENDANCE,
                "fees": Permission.READ_PAYMENT,
                "assignments": Permission.READ_ASSIGNMENT,
                "exams": Permission.READ_EXAM
            }
            
            required_permission = collection_permissions.get(resource)
            if required_permission and not connection.check_permission(required_permission):
                return False
        
        elif subscription_type == SubscriptionType.BRANCH_DATA:
            # Check if user can access the branch
            if resource != connection.branch_id and connection.user_role not in ["superadmin", "hq_admin"]:
                return False
        
        elif subscription_type == SubscriptionType.USER_DATA:
            # Users can only subscribe to their own data unless they're admin
            if resource != connection.user_id and connection.user_role not in ["admin", "superadmin", "hq_admin"]:
                return False
        
        return True
    
    def _get_user_permissions(self, connection: WebSocketConnection) -> List[str]:
        """Get list of permissions for the user"""
        # This would integrate with the RBAC system
        # For now, return basic permissions based on role
        role_permissions = {
            "student": ["read_own_data"],
            "parent": ["read_child_data"],
            "teacher": ["read_class_data", "read_student_data"],
            "admin": ["read_all", "write_all"],
            "superadmin": ["read_all", "write_all", "delete_all"]
        }
        return role_permissions.get(connection.user_role, [])
    
    async def _remove_subscription(self, connection: WebSocketConnection, subscription_id: str):
        """Remove a subscription"""
        subscription = connection.subscriptions.get(subscription_id)
        if subscription:
            self.subscriptions[subscription.resource].discard(connection.connection_id)
            if not self.subscriptions[subscription.resource]:
                del self.subscriptions[subscription.resource]
            del connection.subscriptions[subscription_id]
    
    async def _handle_sync_event(self, sync_event: SyncEvent):
        """Handle sync events and broadcast to relevant clients"""
        try:
            # Determine which clients should receive this update
            resource_key = f"{sync_event.collection_name}"
            connection_ids = self.subscriptions.get(resource_key, set())
            
            if not connection_ids:
                return
            
            # Create WebSocket message based on sync event
            message_type = {
                SyncEventType.INSERT: MessageType.DATA_INSERT,
                SyncEventType.UPDATE: MessageType.DATA_UPDATE,
                SyncEventType.DELETE: MessageType.DATA_DELETE,
                SyncEventType.REPLACE: MessageType.DATA_UPDATE
            }.get(sync_event.event_type, MessageType.DATA_UPDATE)
            
            message = WebSocketMessage(
                type=message_type,
                payload={
                    "collection": sync_event.collection_name,
                    "document_id": sync_event.document_id,
                    "event_type": sync_event.event_type.value,
                    "data": sync_event.full_document,
                    "branch_id": sync_event.branch_id,
                    "timestamp": sync_event.timestamp.isoformat() if sync_event.timestamp else None
                },
                correlation_id=sync_event.correlation_id
            )
            
            # Broadcast to relevant clients
            await self._broadcast_message(connection_ids, message, sync_event.branch_id)
            
        except Exception as e:
            logger.error(f"Error handling sync event: {e}")
    
    async def _broadcast_message(self, connection_ids: Set[str], message: WebSocketMessage, 
                               branch_filter: Optional[str] = None, batch: bool = False):
        """Broadcast message to multiple connections"""
        if batch and len(connection_ids) > 1:
            # Add to batch queue instead of sending immediately
            self._add_to_batch_queue(connection_ids, message, branch_filter)
            return
            
        successful_sends = 0
        failed_sends = 0
        
        for connection_id in list(connection_ids):
            connection = self.connections.get(connection_id)
            if not connection or not connection.is_active:
                continue
            
            # Apply branch filtering
            if branch_filter and connection.branch_id != branch_filter:
                # Skip if connection is not from the same branch (unless admin)
                if connection.user_role not in ["superadmin", "hq_admin"]:
                    continue
            
            if await connection.send_message(message):
                successful_sends += 1
            else:
                failed_sends += 1
                # Remove inactive connection
                self.subscriptions.get(message.payload.get("collection", ""), set()).discard(connection_id)
        
        self.stats["messages_sent"] += successful_sends
        self.stats["messages_failed"] += failed_sends
        
    def _add_to_batch_queue(self, connection_ids: Set[str], message: WebSocketMessage, 
                           branch_filter: Optional[str] = None):
        """Add message to batch queue for efficient sending"""
        batch_key = f"{message.type.value}:{message.payload.get('collection', 'unknown')}"
        
        self.batch_queue[batch_key].append({
            "connection_ids": connection_ids,
            "message": message,
            "branch_filter": branch_filter,
            "timestamp": datetime.utcnow()
        })
        
    async def _process_batched_messages(self):
        """Process batched messages periodically"""
        while self.is_running:
            try:
                await asyncio.sleep(self.batch_interval)
                
                if not self.batch_queue:
                    continue
                
                # Process all batched messages
                current_batches = dict(self.batch_queue)
                self.batch_queue.clear()
                
                for batch_key, messages in current_batches.items():
                    if not messages:
                        continue
                        
                    # Combine messages of the same type for the same collection
                    await self._send_batched_messages(batch_key, messages)
                    self.stats["batched_messages"] += len(messages)
                
            except Exception as e:
                logger.error(f"Error in batch message processing: {e}")
    
    async def _send_batched_messages(self, batch_key: str, messages: List[Dict]):
        """Send a batch of messages efficiently"""
        try:
            if not messages:
                return
                
            # Group by collection and create batch message
            collection_data = defaultdict(list)
            all_connection_ids = set()
            branch_filter = None
            
            for msg_info in messages:
                collection = msg_info["message"].payload.get("collection", "unknown")
                collection_data[collection].append(msg_info["message"].payload)
                all_connection_ids.update(msg_info["connection_ids"])
                if msg_info["branch_filter"]:
                    branch_filter = msg_info["branch_filter"]
            
            # Create batch message
            batch_message = WebSocketMessage(
                type=MessageType.DATA_BATCH,
                payload={
                    "batch_type": batch_key,
                    "collections": dict(collection_data),
                    "message_count": len(messages),
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            
            # Send to all relevant connections
            await self._broadcast_message(all_connection_ids, batch_message, branch_filter, batch=False)
            
        except Exception as e:
            logger.error(f"Error sending batched messages: {e}")
            
    async def send_optimistic_update(self, collection: str, operation: str, 
                                   data: Dict[str, Any], user_id: str,
                                   operation_id: str = None) -> str:
        """Send optimistic update immediately, before database operation"""
        try:
            if operation_id is None:
                operation_id = str(ObjectId())
            
            # Track pending operation
            self.pending_operations[operation_id] = {
                "collection": collection,
                "operation": operation,
                "data": data,
                "user_id": user_id,
                "timestamp": datetime.utcnow()
            }
            
            # Create optimistic update message
            message = WebSocketMessage(
                type=MessageType.DATA_OPTIMISTIC,
                payload={
                    "collection": collection,
                    "operation": operation,
                    "data": data,
                    "operation_id": operation_id,
                    "optimistic": True,
                    "timestamp": datetime.utcnow().isoformat()
                },
                correlation_id=operation_id
            )
            
            # Send to user's connections
            user_connections = self.user_connections.get(user_id, set())
            if user_connections:
                await self._broadcast_message(user_connections, message)
                self.stats["optimistic_updates"] += 1
            
            return operation_id
            
        except Exception as e:
            logger.error(f"Error sending optimistic update: {e}")
            return ""
    
    async def confirm_operation(self, operation_id: str, success: bool, 
                              actual_data: Optional[Dict[str, Any]] = None):
        """Confirm or rollback optimistic operation"""
        try:
            if operation_id not in self.pending_operations:
                return
                
            pending_op = self.pending_operations.pop(operation_id)
            
            # Create confirmation message
            message = WebSocketMessage(
                type=MessageType.OPERATION_COMPLETE,
                payload={
                    "operation_id": operation_id,
                    "success": success,
                    "collection": pending_op["collection"],
                    "operation": pending_op["operation"],
                    "actual_data": actual_data if success else None,
                    "rollback": not success,
                    "timestamp": datetime.utcnow().isoformat()
                },
                correlation_id=operation_id
            )
            
            # Send to user's connections
            user_connections = self.user_connections.get(pending_op["user_id"], set())
            if user_connections:
                await self._broadcast_message(user_connections, message)
            
        except Exception as e:
            logger.error(f"Error confirming operation {operation_id}: {e}")
    
    async def broadcast_notification(self, user_ids: List[str], notification: Dict[str, Any]):
        """Broadcast notification to specific users"""
        message = WebSocketMessage(
            type=MessageType.NOTIFICATION,
            payload=notification
        )
        
        connection_ids = set()
        for user_id in user_ids:
            connection_ids.update(self.user_connections.get(user_id, set()))
        
        await self._broadcast_message(connection_ids, message)
    
    async def broadcast_grade_notification(self, parent_ids: List[str], grade_data: Dict[str, Any], student_name: str):
        """Broadcast grade notification to parents"""
        notification = {
            "type": "grade_update",
            "title": f"New Grade Posted for {student_name}",
            "message": f"A new grade has been posted for {student_name} in {grade_data.get('subject_name', 'Unknown Subject')}",
            "data": grade_data,
            "timestamp": datetime.utcnow().isoformat(),
            "priority": "high" if grade_data.get('grade') in ['F', 'D'] else "normal",
            "action_required": grade_data.get('status') == 'fail',
            "category": "academic"
        }
        
        await self.broadcast_notification(parent_ids, notification)
    
    async def broadcast_report_notification(self, parent_ids: List[str], report_data: Dict[str, Any], student_name: str):
        """Broadcast report card notification to parents"""
        notification = {
            "type": "report_card",
            "title": f"Report Card Available for {student_name}",
            "message": f"The {report_data.get('term', 'term')} report card for {student_name} is now available",
            "data": {
                "report_id": report_data.get('id'),
                "student_id": report_data.get('student_id'),
                "term": report_data.get('term'),
                "academic_year": report_data.get('academic_year'),
                "overall_grade": report_data.get('overall_grade'),
                "overall_percentage": report_data.get('overall_percentage'),
                "class_rank": report_data.get('class_rank'),
                "total_students": report_data.get('total_students')
            },
            "timestamp": datetime.utcnow().isoformat(),
            "priority": "high",
            "action_required": False,
            "category": "academic"
        }
        
        await self.broadcast_notification(parent_ids, notification)
    
    async def broadcast_exam_notification(self, parent_ids: List[str], exam_data: Dict[str, Any], student_name: str):
        """Broadcast exam result notification to parents"""
        notification = {
            "type": "exam_result",
            "title": f"Exam Result Posted for {student_name}",
            "message": f"{student_name} scored {exam_data.get('marks_obtained', 0)}/{exam_data.get('total_marks', 0)} in {exam_data.get('exam_name', 'exam')}",
            "data": {
                "exam_name": exam_data.get('exam_name'),
                "subject_name": exam_data.get('subject_name'),
                "marks_obtained": exam_data.get('marks_obtained'),
                "total_marks": exam_data.get('total_marks'),
                "percentage": exam_data.get('percentage'),
                "grade": exam_data.get('grade'),
                "status": exam_data.get('status'),
                "exam_date": exam_data.get('exam_date'),
                "feedback": exam_data.get('feedback')
            },
            "timestamp": datetime.utcnow().isoformat(),
            "priority": "high" if exam_data.get('status') == 'fail' else "normal",
            "action_required": exam_data.get('status') == 'fail',
            "category": "academic"
        }
        
        await self.broadcast_notification(parent_ids, notification)
    
    async def broadcast_system_alert(self, alert: Dict[str, Any], branch_id: Optional[str] = None):
        """Broadcast system alert to all relevant users"""
        message = WebSocketMessage(
            type=MessageType.SYSTEM_ALERT,
            payload=alert
        )
        
        if branch_id:
            connection_ids = self.branch_connections.get(branch_id, set())
        else:
            connection_ids = set(self.connections.keys())
        
        await self._broadcast_message(connection_ids, message, branch_id)
    
    async def send_user_activity_update(self, user_id: str, activity: Dict[str, Any]):
        """Send user activity update to relevant connections"""
        message = WebSocketMessage(
            type=MessageType.USER_ACTIVITY,
            payload=activity
        )
        
        connection_ids = self.user_connections.get(user_id, set())
        await self._broadcast_message(connection_ids, message)
    
    async def send_progress_update(self, user_ids: List[str], operation_id: str, progress: int, message: str = ""):
        """Send operation progress update to users"""
        progress_message = WebSocketMessage(
            type=MessageType.OPERATION_PROGRESS,
            payload={
                "operation_id": operation_id,
                "progress": min(100, max(0, progress)),
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            },
            correlation_id=operation_id
        )
        
        connection_ids = set()
        for user_id in user_ids:
            connection_ids.update(self.user_connections.get(user_id, set()))
        
        await self._broadcast_message(connection_ids, progress_message)
    
    async def _cleanup_connections(self):
        """Periodically clean up inactive connections"""
        while self.is_running:
            try:
                await asyncio.sleep(60)  # Run every minute
                
                current_time = datetime.utcnow()
                inactive_connections = []
                
                for connection_id, connection in self.connections.items():
                    # Check if connection is inactive
                    if (current_time - connection.last_activity > timedelta(minutes=5) or
                        not connection.is_active or 
                        connection.websocket.client_state != WebSocketState.CONNECTED):
                        
                        inactive_connections.append(connection_id)
                
                # Remove inactive connections
                for connection_id in inactive_connections:
                    await self.disconnect_client(connection_id, code=1001, reason="Inactive connection")
                
                if inactive_connections:
                    logger.info(f"Cleaned up {len(inactive_connections)} inactive WebSocket connections")
                
            except Exception as e:
                logger.error(f"Error in connection cleanup: {e}")
    
    async def _ping_connections(self):
        """Send periodic pings to maintain connections"""
        while self.is_running:
            try:
                await asyncio.sleep(30)  # Ping every 30 seconds
                
                ping_message = WebSocketMessage(
                    type=MessageType.PING,
                    payload={"server_time": datetime.utcnow().isoformat()}
                )
                
                for connection in list(self.connections.values()):
                    if (connection.is_active and 
                        datetime.utcnow() - connection.last_ping > timedelta(seconds=30)):
                        
                        await connection.send_message(ping_message)
                        connection.last_ping = datetime.utcnow()
                
            except Exception as e:
                logger.error(f"Error in ping task: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get WebSocket connection statistics"""
        return {
            **self.stats,
            "connections_by_role": {
                role: len([c for c in self.connections.values() if c.user_role == role])
                for role in ["student", "parent", "teacher", "admin", "superadmin"]
            },
            "connections_by_branch": {
                branch_id: len(connection_ids)
                for branch_id, connection_ids in self.branch_connections.items()
            },
            "authenticated_connections": len([c for c in self.connections.values() if c.authenticated]),
            "subscriptions_by_type": {
                sub_type.value: len([
                    s for conn in self.connections.values() 
                    for s in conn.subscriptions.values() 
                    if s.subscription_type == sub_type
                ])
                for sub_type in SubscriptionType
            },
            "notification_stats": {
                "grade_notifications_sent": self.stats.get("grade_notifications", 0),
                "report_notifications_sent": self.stats.get("report_notifications", 0),
                "exam_notifications_sent": self.stats.get("exam_notifications", 0)
            }
        }

# Global WebSocket manager instance
_websocket_manager = None

def get_websocket_manager(db) -> WebSocketManager:
    """Get global WebSocket manager instance"""
    global _websocket_manager
    if _websocket_manager is None:
        _websocket_manager = WebSocketManager(db)
    return _websocket_manager

# WebSocket endpoint dependency
async def websocket_endpoint(websocket: WebSocket, db=Depends(lambda: None)):  # Replace with actual DB dependency
    """WebSocket endpoint for handling client connections"""
    manager = get_websocket_manager(db)
    connection_id = await manager.connect_client(websocket)
    
    # Connection will be handled by the manager
    # This function just establishes the connection

# Export components
__all__ = [
    'WebSocketManager',
    'WebSocketConnection', 
    'WebSocketMessage',
    'MessageType',
    'SubscriptionType',
    'get_websocket_manager',
    'websocket_endpoint'
]