"""
Centralized Notification Engine
Handles template-based notifications across all modules with multi-channel delivery
"""
import asyncio
import logging
from typing import Dict, List, Any, Optional, Union
from datetime import datetime, timedelta
import jinja2
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from ..models.notifications import (
    Notification, NotificationTemplate, NotificationRecipient, 
    NotificationPreference, NotificationQueue, NotificationBatch,
    NotificationType, NotificationPriority, NotificationChannel, 
    NotificationStatus, RecipientType
)
from ..db import get_db
from .email_service import EmailService
from .sms_service import SMSService
from .push_service import PushService
from .websocket_manager import get_websocket_manager

logger = logging.getLogger(__name__)

class NotificationEngine:
    """Centralized notification engine for all modules"""
    
    def __init__(self):
        self.db = get_db()
        self.email_service = EmailService()
        self.sms_service = SMSService()
        self.push_service = PushService()
        self.jinja_env = jinja2.Environment(
            loader=jinja2.DictLoader({}),
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )
        
        # Template cache for performance
        self._template_cache = {}
        self._cache_expiry = {}
    
    async def send_notification(
        self,
        template_code: str,
        recipients: Union[List[str], str, RecipientType],
        variables: Dict[str, Any] = None,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        channels: List[NotificationChannel] = None,
        sender_id: str = None,
        sender_name: str = "System",
        sender_role: str = "system",
        branch_id: str = None,
        scheduled_for: datetime = None,
        action_url: str = None,
        action_text: str = None,
        attachments: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Send a notification using a template
        
        Args:
            template_code: Template identifier
            recipients: User IDs, RecipientType, or custom list
            variables: Template variables for personalization
            priority: Notification priority
            channels: Delivery channels
            sender_id: Sender user ID
            sender_name: Sender display name
            sender_role: Sender role
            branch_id: Branch context
            scheduled_for: Schedule for later delivery
            action_url: Deep link or URL
            action_text: Action button text
            attachments: File attachments
            metadata: Additional metadata
        
        Returns:
            Dict with notification details and delivery status
        """
        try:
            # Get template
            template = await self._get_template(template_code, branch_id)
            if not template:
                raise ValueError(f"Template {template_code} not found")
            
            # Resolve recipients
            resolved_recipients = await self._resolve_recipients(
                recipients, template.notification_type, branch_id
            )
            
            if not resolved_recipients:
                logger.warning(f"No recipients found for notification {template_code}")
                return {
                    "success": False,
                    "message": "No recipients found",
                    "notification_id": None,
                    "recipient_count": 0
                }
            
            # Create notification record
            notification_id = str(ObjectId())
            notification_code = f"NOTIF-{datetime.now().strftime('%Y%m%d%H%M%S')}-{notification_id[-8:].upper()}"
            
            # Use template defaults if not specified
            if channels is None:
                channels = template.default_channels
            if priority == NotificationPriority.MEDIUM and template.default_priority:
                priority = template.default_priority
            
            # Prepare variables
            variables = variables or {}
            variables.update({
                'sender_name': sender_name,
                'current_date': datetime.now().strftime('%Y-%m-%d'),
                'current_time': datetime.now().strftime('%H:%M:%S'),
                'current_year': str(datetime.now().year)
            })
            
            # Render templates
            title = self._render_template(template.title_template, variables)
            message = self._render_template(template.message_template, variables)
            
            # Create notification document
            notification = Notification(
                id=notification_id,
                notification_code=notification_code,
                title=title,
                message=message,
                notification_type=template.notification_type,
                priority=priority,
                sender_id=sender_id or "system",
                sender_name=sender_name,
                sender_role=sender_role,
                branch_id=branch_id,
                recipient_type=RecipientType.CUSTOM if isinstance(recipients, list) else recipients,
                target_users=[r["user_id"] for r in resolved_recipients],
                channels=channels,
                scheduled_for=scheduled_for or datetime.utcnow(),
                action_url=action_url,
                action_text=action_text,
                attachments=attachments or [],
                template_id=template.id,
                template_variables=variables,
                total_recipients=len(resolved_recipients),
                metadata=metadata or {},
                status=NotificationStatus.SCHEDULED if scheduled_for else NotificationStatus.SENT
            )
            
            # Save notification
            notification_dict = notification.dict()
            notification_dict["_id"] = ObjectId(notification_id)
            await self.db.notifications.insert_one(notification_dict)
            
            # Create recipient records and queue items
            delivery_results = await self._process_notification_delivery(
                notification, resolved_recipients, template
            )
            
            # Update template usage
            await self.db.notification_templates.update_one(
                {"_id": ObjectId(template.id)},
                {
                    "$inc": {"usage_count": 1},
                    "$set": {"last_used": datetime.utcnow()}
                }
            )
            
            return {
                "success": True,
                "notification_id": notification_id,
                "notification_code": notification_code,
                "recipient_count": len(resolved_recipients),
                "delivery_results": delivery_results,
                "scheduled_for": scheduled_for
            }
            
        except Exception as e:
            logger.error(f"Failed to send notification {template_code}: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "notification_id": None,
                "recipient_count": 0
            }
    
    async def send_immediate_notification(
        self,
        title: str,
        message: str,
        recipients: Union[List[str], RecipientType],
        notification_type: NotificationType = NotificationType.SYSTEM,
        priority: NotificationPriority = NotificationPriority.MEDIUM,
        channels: List[NotificationChannel] = None,
        sender_id: str = "system",
        sender_name: str = "System",
        branch_id: str = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Send immediate notification without template"""
        try:
            # Resolve recipients
            resolved_recipients = await self._resolve_recipients(
                recipients, notification_type, branch_id
            )
            
            if not resolved_recipients:
                return {
                    "success": False,
                    "message": "No recipients found",
                    "notification_id": None
                }
            
            # Create notification
            notification_id = str(ObjectId())
            notification_code = f"IMMED-{datetime.now().strftime('%Y%m%d%H%M%S')}-{notification_id[-8:].upper()}"
            
            notification = Notification(
                id=notification_id,
                notification_code=notification_code,
                title=title,
                message=message,
                notification_type=notification_type,
                priority=priority,
                sender_id=sender_id,
                sender_name=sender_name,
                sender_role=kwargs.get("sender_role", "system"),
                branch_id=branch_id,
                recipient_type=RecipientType.CUSTOM if isinstance(recipients, list) else recipients,
                target_users=[r["user_id"] for r in resolved_recipients],
                channels=channels or [NotificationChannel.IN_APP],
                total_recipients=len(resolved_recipients),
                status=NotificationStatus.SENT,
                **{k: v for k, v in kwargs.items() if k in ['action_url', 'action_text', 'attachments', 'metadata']}
            )
            
            # Save and process
            notification_dict = notification.dict()
            notification_dict["_id"] = ObjectId(notification_id)
            await self.db.notifications.insert_one(notification_dict)
            
            delivery_results = await self._process_notification_delivery(
                notification, resolved_recipients, None
            )
            
            return {
                "success": True,
                "notification_id": notification_id,
                "notification_code": notification_code,
                "recipient_count": len(resolved_recipients),
                "delivery_results": delivery_results
            }
            
        except Exception as e:
            logger.error(f"Failed to send immediate notification: {str(e)}")
            return {"success": False, "message": str(e), "notification_id": None}
    
    async def _get_template(self, template_code: str, branch_id: str = None) -> Optional[NotificationTemplate]:
        """Get template with caching"""
        cache_key = f"{template_code}:{branch_id or 'global'}"
        
        # Check cache
        if cache_key in self._template_cache:
            cache_time = self._cache_expiry.get(cache_key, datetime.min)
            if datetime.now() - cache_time < timedelta(minutes=30):  # 30 min cache
                return self._template_cache[cache_key]
        
        # Fetch from database with branch access check
        query = {
            "template_code": template_code,
            "is_active": True
        }
        
        # If branch_id is provided, check branch access
        if branch_id:
            query["$or"] = [
                {"branch_access": {"$size": 0}},  # Global templates
                {"branch_access": branch_id}       # Branch-specific templates
            ]
        
        template_doc = await self.db.notification_templates.find_one(query)
        
        if template_doc:
            template_doc["id"] = str(template_doc["_id"])
            template = NotificationTemplate(**template_doc)
            
            # Cache it
            self._template_cache[cache_key] = template
            self._cache_expiry[cache_key] = datetime.now()
            
            return template
        
        return None
    
    async def _resolve_recipients(
        self,
        recipients: Union[List[str], RecipientType],
        notification_type: NotificationType,
        branch_id: str = None
    ) -> List[Dict[str, Any]]:
        """Resolve recipients based on type or list"""
        resolved = []
        
        if isinstance(recipients, list):
            # Direct user ID list
            users_cursor = self.db.users.find({"_id": {"$in": [ObjectId(uid) for uid in recipients]}})
            async for user in users_cursor:
                # Check user preferences
                if await self._should_send_to_user(str(user["_id"]), notification_type):
                    resolved.append({
                        "user_id": str(user["_id"]),
                        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "user_role": user.get("role", "user"),
                        "user_email": user.get("email"),
                        "user_phone": user.get("phone_number"),
                        "branch_id": user.get("branch_id")
                    })
                    
        elif recipients == RecipientType.ALL_USERS:
            query = {"branch_id": branch_id} if branch_id else {}
            users_cursor = self.db.users.find(query)
            async for user in users_cursor:
                if await self._should_send_to_user(str(user["_id"]), notification_type):
                    resolved.append({
                        "user_id": str(user["_id"]),
                        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "user_role": user.get("role", "user"),
                        "user_email": user.get("email"),
                        "user_phone": user.get("phone_number"),
                        "branch_id": user.get("branch_id")
                    })
                    
        elif recipients in [RecipientType.STUDENTS, RecipientType.PARENTS, RecipientType.TEACHERS, RecipientType.ADMINS]:
            role_map = {
                RecipientType.STUDENTS: ["student"],
                RecipientType.PARENTS: ["parent"],
                RecipientType.TEACHERS: ["teacher"],
                RecipientType.ADMINS: ["admin", "superadmin", "branch_admin", "hq_admin"]
            }
            
            roles = role_map[recipients]
            query = {"role": {"$in": roles}}
            if branch_id:
                query["branch_id"] = branch_id
                
            users_cursor = self.db.users.find(query)
            async for user in users_cursor:
                if await self._should_send_to_user(str(user["_id"]), notification_type):
                    resolved.append({
                        "user_id": str(user["_id"]),
                        "user_name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                        "user_role": user.get("role", "user"),
                        "user_email": user.get("email"),
                        "user_phone": user.get("phone_number"),
                        "branch_id": user.get("branch_id")
                    })
        
        return resolved
    
    async def _should_send_to_user(self, user_id: str, notification_type: NotificationType) -> bool:
        """Check if user should receive this notification type"""
        prefs = await self.db.notification_preferences.find_one({"user_id": user_id})
        
        if not prefs:
            # Create default preferences
            default_prefs = NotificationPreference(user_id=user_id)
            await self.db.notification_preferences.insert_one(default_prefs.model_dump())
            return True
        
        # Check type preferences
        type_field = notification_type.value
        result = prefs.get(type_field, True)
        logger.debug(f"User {user_id} preference for {type_field}: {result} (prefs has system: {prefs.get('system')})")
        return result
    
    def _render_template(self, template_str: str, variables: Dict[str, Any]) -> str:
        """Render Jinja2 template with variables"""
        try:
            template = self.jinja_env.from_string(template_str)
            return template.render(**variables)
        except Exception as e:
            logger.error(f"Template rendering error: {str(e)}")
            return template_str  # Return original if rendering fails
    
    async def _process_notification_delivery(
        self,
        notification: Notification,
        recipients: List[Dict[str, Any]],
        template: Optional[NotificationTemplate]
    ) -> Dict[str, Any]:
        """Process notification delivery across all channels"""
        delivery_results = {
            "in_app": {"sent": 0, "failed": 0},
            "email": {"sent": 0, "failed": 0},
            "sms": {"sent": 0, "failed": 0},
            "push": {"sent": 0, "failed": 0}
        }
        
        # Create recipient records
        recipient_docs = []
        queue_items = []
        
        for recipient in recipients:
            recipient_id = str(ObjectId())
            
            # Get user preferences
            user_prefs = await self._get_user_channel_preferences(recipient["user_id"])
            
            # Determine which channels to use for this recipient
            active_channels = []
            for channel in notification.channels:
                if self._should_use_channel(channel, user_prefs):
                    active_channels.append(channel)
            
            # Create recipient record
            recipient_record = NotificationRecipient(
                id=recipient_id,
                notification_id=notification.id,
                user_id=recipient["user_id"],
                user_name=recipient["user_name"],
                user_role=recipient["user_role"],
                user_email=recipient.get("user_email"),
                user_phone=recipient.get("user_phone"),
                in_app_status=NotificationStatus.SENT if NotificationChannel.IN_APP in active_channels else None,
                email_status=NotificationStatus.SCHEDULED if NotificationChannel.EMAIL in active_channels else None,
                sms_status=NotificationStatus.SCHEDULED if NotificationChannel.SMS in active_channels else None,
                push_status=NotificationStatus.SCHEDULED if NotificationChannel.PUSH in active_channels else None
            )
            
            recipient_docs.append(recipient_record.dict())
            
            # Create queue items for each channel
            for channel in active_channels:
                if channel == NotificationChannel.IN_APP:
                    # Send in-app immediately
                    await self._send_in_app_notification(notification, recipient)
                    delivery_results["in_app"]["sent"] += 1
                else:
                    # Queue for background processing
                    queue_item = NotificationQueue(
                        id=str(ObjectId()),
                        notification_id=notification.id,
                        recipient_id=recipient["user_id"],
                        channel=channel,
                        priority=notification.priority,
                        title=notification.title,
                        message=notification.message,
                        payload={
                            "recipient": recipient,
                            "action_url": notification.action_url,
                            "action_text": notification.action_text,
                            "attachments": notification.attachments
                        },
                        scheduled_for=notification.scheduled_for or datetime.utcnow()
                    )
                    queue_items.append(queue_item.dict())
        
        # Bulk insert recipients and queue items
        if recipient_docs:
            await self.db.notification_recipients.insert_many(recipient_docs)
        
        if queue_items:
            await self.db.notification_queue.insert_many(queue_items)
            # Trigger background processing
            asyncio.create_task(self._process_notification_queue())
        
        return delivery_results
    
    async def _get_user_channel_preferences(self, user_id: str) -> Dict[str, bool]:
        """Get user's channel preferences"""
        prefs = await self.db.notification_preferences.find_one({"user_id": user_id})
        
        if not prefs:
            return {
                "email_enabled": True,
                "sms_enabled": True,
                "push_enabled": True,
                "in_app_enabled": True
            }
        
        return {
            "email_enabled": prefs.get("email_enabled", True),
            "sms_enabled": prefs.get("sms_enabled", True),
            "push_enabled": prefs.get("push_enabled", True),
            "in_app_enabled": prefs.get("in_app_enabled", True)
        }
    
    def _should_use_channel(self, channel: NotificationChannel, user_prefs: Dict[str, bool]) -> bool:
        """Check if channel should be used for user"""
        channel_prefs = {
            NotificationChannel.EMAIL: user_prefs.get("email_enabled", True),
            NotificationChannel.SMS: user_prefs.get("sms_enabled", True),
            NotificationChannel.PUSH: user_prefs.get("push_enabled", True),
            NotificationChannel.IN_APP: user_prefs.get("in_app_enabled", True)
        }
        
        return channel_prefs.get(channel, True)
    
    async def _send_in_app_notification(self, notification: Notification, recipient: Dict[str, Any]):
        """Send in-app notification immediately via WebSocket"""
        try:
            ws_manager = get_websocket_manager(self.db)
            await ws_manager.broadcast_notification(
                [recipient["user_id"]],
                {
                    "type": "notification",
                    "id": notification.id,
                    "title": notification.title,
                    "message": notification.message,
                    "notification_type": notification.notification_type,
                    "priority": notification.priority,
                    "action_url": notification.action_url,
                    "action_text": notification.action_text,
                    "created_at": notification.created_at.isoformat(),
                    "sender_name": notification.sender_name
                }
            )
        except Exception as e:
            logger.error(f"Failed to send in-app notification: {str(e)}")
    
    async def _process_notification_queue(self):
        """Background task to process notification queue"""
        try:
            # Get pending queue items
            queue_items = await self.db.notification_queue.find({
                "status": NotificationStatus.SCHEDULED,
                "scheduled_for": {"$lte": datetime.utcnow()},
                "attempts": {"$lt": 3}  # Max 3 attempts
            }).limit(100).to_list(None)  # Process 100 at a time
            
            for item in queue_items:
                try:
                    # Mark as processing
                    await self.db.notification_queue.update_one(
                        {"_id": item["_id"]},
                        {
                            "$set": {"processing_started_at": datetime.utcnow()},
                            "$inc": {"attempts": 1}
                        }
                    )
                    
                    success = False
                    error_message = None
                    
                    # Send based on channel
                    if item["channel"] == NotificationChannel.EMAIL:
                        success, error_message = await self._send_email_notification(item)
                    elif item["channel"] == NotificationChannel.SMS:
                        success, error_message = await self._send_sms_notification(item)
                    elif item["channel"] == NotificationChannel.PUSH:
                        success, error_message = await self._send_push_notification(item)
                    
                    # Update status
                    if success:
                        await self.db.notification_queue.update_one(
                            {"_id": item["_id"]},
                            {
                                "$set": {
                                    "status": NotificationStatus.DELIVERED,
                                    "processed_at": datetime.utcnow()
                                }
                            }
                        )
                        
                        # Update recipient status
                        await self._update_recipient_status(
                            item["notification_id"],
                            item["recipient_id"],
                            item["channel"],
                            NotificationStatus.DELIVERED
                        )
                    else:
                        status = NotificationStatus.FAILED if item["attempts"] >= 3 else NotificationStatus.SCHEDULED
                        update_data = {
                            "status": status,
                            "error_message": error_message
                        }
                        
                        if status == NotificationStatus.FAILED:
                            update_data["processed_at"] = datetime.utcnow()
                        else:
                            # Retry later
                            update_data["scheduled_for"] = datetime.utcnow() + timedelta(minutes=5 * item["attempts"])
                        
                        await self.db.notification_queue.update_one(
                            {"_id": item["_id"]},
                            {"$set": update_data}
                        )
                        
                        if status == NotificationStatus.FAILED:
                            await self._update_recipient_status(
                                item["notification_id"],
                                item["recipient_id"],
                                item["channel"],
                                NotificationStatus.FAILED
                            )
                
                except Exception as e:
                    logger.error(f"Error processing queue item {item['_id']}: {str(e)}")
                    await self.db.notification_queue.update_one(
                        {"_id": item["_id"]},
                        {
                            "$set": {
                                "status": NotificationStatus.FAILED,
                                "error_message": str(e),
                                "processed_at": datetime.utcnow()
                            }
                        }
                    )
                    
        except Exception as e:
            logger.error(f"Error in notification queue processing: {str(e)}")
    
    async def _send_email_notification(self, queue_item: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Send email notification"""
        try:
            recipient = queue_item["payload"]["recipient"]
            if not recipient.get("user_email"):
                return False, "No email address found"
            
            success = await self.email_service.send_email(
                to_email=recipient["user_email"],
                subject=queue_item["title"],
                html_content=queue_item["message"],
                attachments=queue_item["payload"].get("attachments", [])
            )
            
            return success, None if success else "Email delivery failed"
            
        except Exception as e:
            return False, str(e)
    
    async def _send_sms_notification(self, queue_item: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Send SMS notification"""
        try:
            recipient = queue_item["payload"]["recipient"]
            if not recipient.get("user_phone"):
                return False, "No phone number found"
            
            success = await self.sms_service.send_sms(
                to_phone=recipient["user_phone"],
                message=f"{queue_item['title']}: {queue_item['message']}"
            )
            
            return success, None if success else "SMS delivery failed"
            
        except Exception as e:
            return False, str(e)
    
    async def _send_push_notification(self, queue_item: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """Send push notification"""
        try:
            recipient = queue_item["payload"]["recipient"]
            
            success = await self.push_service.send_push(
                user_id=recipient["user_id"],
                title=queue_item["title"],
                message=queue_item["message"],
                data={
                    "action_url": queue_item["payload"].get("action_url"),
                    "notification_id": queue_item["notification_id"]
                }
            )
            
            return success, None if success else "Push delivery failed"
            
        except Exception as e:
            return False, str(e)
    
    async def _update_recipient_status(
        self,
        notification_id: str,
        recipient_id: str,
        channel: NotificationChannel,
        status: NotificationStatus
    ):
        """Update recipient delivery status"""
        channel_field = f"{channel.value}_status"
        timestamp_field = "delivered_at" if status == NotificationStatus.DELIVERED else None
        
        update_data = {channel_field: status}
        if timestamp_field:
            update_data[timestamp_field] = datetime.utcnow()
        
        await self.db.notification_recipients.update_one(
            {
                "notification_id": notification_id,
                "user_id": recipient_id
            },
            {"$set": update_data}
        )

# Global instance
notification_engine = NotificationEngine()