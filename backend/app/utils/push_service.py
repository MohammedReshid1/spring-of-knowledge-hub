"""
Push Notification Service for Notification Engine
Handles push notifications for web, iOS, and Android
"""
import logging
from typing import List, Optional, Dict, Any
import os
import json
import asyncio
from concurrent.futures import ThreadPoolExecutor
import aiohttp
import firebase_admin
from firebase_admin import credentials, messaging
from ..db import get_db

logger = logging.getLogger(__name__)

class PushService:
    """Push notification service with Firebase support"""
    
    def __init__(self):
        self.db = get_db()
        
        # Firebase configuration
        self.firebase_credentials_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
        self.firebase_project_id = os.getenv("FIREBASE_PROJECT_ID", "")
        
        self.firebase_app = None
        self.firebase_initialized = False
        
        # Thread pool for async operations
        self.executor = ThreadPoolExecutor(max_workers=5)
        
        # Initialize Firebase if credentials are available
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            if self.firebase_credentials_path and os.path.exists(self.firebase_credentials_path):
                if not firebase_admin._apps:
                    cred = credentials.Certificate(self.firebase_credentials_path)
                    self.firebase_app = firebase_admin.initialize_app(cred)
                    self.firebase_initialized = True
                    logger.info("Firebase Admin SDK initialized successfully")
                else:
                    self.firebase_app = firebase_admin.get_app()
                    self.firebase_initialized = True
            else:
                logger.warning("Firebase credentials not found - push notifications disabled")
                
        except Exception as e:
            logger.error(f"Failed to initialize Firebase: {str(e)}")
    
    async def send_push(
        self,
        user_id: str,
        title: str,
        message: str,
        data: Optional[Dict[str, str]] = None,
        badge_count: Optional[int] = None,
        sound: str = "default",
        click_action: Optional[str] = None,
        icon: Optional[str] = None,
        image: Optional[str] = None,
        priority: str = "normal"  # normal or high
    ) -> bool:
        """
        Send push notification to user's registered devices
        
        Args:
            user_id: Target user ID
            title: Notification title
            message: Notification message
            data: Custom data payload
            badge_count: Badge count for iOS
            sound: Notification sound
            click_action: Action when notification is clicked
            icon: Notification icon URL
            image: Large image URL
            priority: Notification priority
        
        Returns:
            bool: Success status
        """
        try:
            if not self.firebase_initialized:
                logger.error("Firebase not initialized - cannot send push notifications")
                return False
            
            # Get user's registered devices
            devices = await self._get_user_devices(user_id)
            if not devices:
                logger.info(f"No registered devices found for user {user_id}")
                return True  # Not an error, just no devices
            
            # Prepare notification payload
            notification_payload = messaging.Notification(
                title=title,
                body=message,
                image=image
            )
            
            # Prepare data payload
            data_payload = data or {}
            data_payload.update({
                "notification_id": data_payload.get("notification_id", ""),
                "user_id": user_id,
                "timestamp": str(asyncio.get_event_loop().time())
            })
            
            # Send to each device
            success_count = 0
            failed_tokens = []
            
            for device in devices:
                try:
                    # Prepare platform-specific configuration
                    android_config = messaging.AndroidConfig(
                        priority=priority,
                        notification=messaging.AndroidNotification(
                            icon=icon,
                            sound=sound,
                            click_action=click_action,
                            channel_id="default"
                        ),
                        data=data_payload
                    )
                    
                    apns_config = messaging.APNSConfig(
                        payload=messaging.APNSPayload(
                            aps=messaging.Aps(
                                alert=messaging.ApsAlert(
                                    title=title,
                                    body=message
                                ),
                                badge=badge_count,
                                sound=sound,
                                category=click_action
                            ),
                            **data_payload
                        )
                    )
                    
                    webpush_config = messaging.WebpushConfig(
                        notification=messaging.WebpushNotification(
                            title=title,
                            body=message,
                            icon=icon,
                            image=image,
                            badge=icon,
                            vibrate=[200, 100, 200],
                            requireInteraction=priority == "high",
                            actions=[
                                messaging.WebpushNotificationAction(
                                    action="view",
                                    title="View"
                                )
                            ] if click_action else None
                        ),
                        data=data_payload
                    )
                    
                    # Create message
                    push_message = messaging.Message(
                        notification=notification_payload,
                        token=device["device_token"],
                        android=android_config if device["device_type"] == "android" else None,
                        apns=apns_config if device["device_type"] == "ios" else None,
                        webpush=webpush_config if device["device_type"] == "web" else None,
                        data=data_payload
                    )
                    
                    # Send message
                    response = await asyncio.get_event_loop().run_in_executor(
                        self.executor,
                        messaging.send,
                        push_message
                    )
                    
                    success_count += 1
                    logger.info(f"Push sent to device {device['device_token'][-10:]}: {response}")
                    
                    # Update device last_used
                    await self.db.push_devices.update_one(
                        {"_id": device["_id"]},
                        {"$set": {"last_used": asyncio.get_event_loop().time()}}
                    )
                    
                except messaging.UnregisteredError:
                    # Device token is invalid - mark for cleanup
                    failed_tokens.append(device["device_token"])
                    logger.info(f"Device token {device['device_token'][-10:]} is unregistered")
                    
                except Exception as e:
                    logger.error(f"Failed to send push to device {device['device_token'][-10:]}: {str(e)}")
            
            # Clean up invalid tokens
            if failed_tokens:
                await self._cleanup_invalid_tokens(failed_tokens)
            
            return success_count > 0
            
        except Exception as e:
            logger.error(f"Failed to send push notification to user {user_id}: {str(e)}")
            return False
    
    async def send_bulk_push(
        self,
        user_ids: List[str],
        title: str,
        message: str,
        data: Optional[Dict[str, str]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Send push notifications to multiple users"""
        results = {"sent": 0, "failed": 0, "errors": []}
        
        # Process in batches
        batch_size = 20
        for i in range(0, len(user_ids), batch_size):
            batch = user_ids[i:i + batch_size]
            
            tasks = []
            for user_id in batch:
                task = self.send_push(user_id, title, message, data, **kwargs)
                tasks.append((user_id, task))
            
            # Execute batch
            batch_results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
            
            for (user_id, _), result in zip(tasks, batch_results):
                if isinstance(result, Exception):
                    results["failed"] += 1
                    results["errors"].append(f"{user_id}: {str(result)}")
                elif result:
                    results["sent"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(f"{user_id}: Unknown error")
            
            # Small delay between batches
            await asyncio.sleep(0.1)
        
        return results
    
    async def send_topic_push(
        self,
        topic: str,
        title: str,
        message: str,
        data: Optional[Dict[str, str]] = None,
        condition: Optional[str] = None,
        **kwargs
    ) -> bool:
        """Send push notification to a topic or condition"""
        try:
            if not self.firebase_initialized:
                logger.error("Firebase not initialized")
                return False
            
            # Prepare notification
            notification_payload = messaging.Notification(
                title=title,
                body=message
            )
            
            # Create message
            if condition:
                # Use condition-based targeting
                push_message = messaging.Message(
                    notification=notification_payload,
                    condition=condition,
                    data=data or {}
                )
            else:
                # Use topic-based targeting
                push_message = messaging.Message(
                    notification=notification_payload,
                    topic=topic,
                    data=data or {}
                )
            
            # Send message
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                messaging.send,
                push_message
            )
            
            logger.info(f"Topic push sent to {topic or condition}: {response}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send topic push: {str(e)}")
            return False
    
    async def register_device(
        self,
        user_id: str,
        device_token: str,
        device_type: str,  # ios, android, web
        device_name: Optional[str] = None,
        app_version: Optional[str] = None,
        os_version: Optional[str] = None,
        timezone: Optional[str] = None
    ) -> bool:
        """Register a device for push notifications"""
        try:
            # Check if device already exists
            existing_device = await self.db.push_devices.find_one({
                "user_id": user_id,
                "device_token": device_token
            })
            
            if existing_device:
                # Update existing device
                await self.db.push_devices.update_one(
                    {"_id": existing_device["_id"]},
                    {
                        "$set": {
                            "device_name": device_name,
                            "app_version": app_version,
                            "os_version": os_version,
                            "timezone": timezone,
                            "is_active": True,
                            "last_used": asyncio.get_event_loop().time(),
                            "updated_at": asyncio.get_event_loop().time()
                        }
                    }
                )
            else:
                # Create new device record
                device_doc = {
                    "user_id": user_id,
                    "device_token": device_token,
                    "device_type": device_type,
                    "device_name": device_name,
                    "is_active": True,
                    "app_version": app_version,
                    "os_version": os_version,
                    "timezone": timezone,
                    "last_used": asyncio.get_event_loop().time(),
                    "created_at": asyncio.get_event_loop().time(),
                    "updated_at": asyncio.get_event_loop().time()
                }
                
                await self.db.push_devices.insert_one(device_doc)
            
            logger.info(f"Device registered for user {user_id}: {device_type}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to register device: {str(e)}")
            return False
    
    async def unregister_device(self, user_id: str, device_token: str) -> bool:
        """Unregister a device"""
        try:
            result = await self.db.push_devices.update_one(
                {"user_id": user_id, "device_token": device_token},
                {"$set": {"is_active": False}}
            )
            
            return result.modified_count > 0
            
        except Exception as e:
            logger.error(f"Failed to unregister device: {str(e)}")
            return False
    
    async def subscribe_to_topic(self, device_tokens: List[str], topic: str) -> Dict[str, Any]:
        """Subscribe devices to a topic"""
        try:
            if not self.firebase_initialized:
                return {"success": False, "error": "Firebase not initialized"}
            
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                messaging.subscribe_to_topic,
                device_tokens,
                topic
            )
            
            return {
                "success": True,
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "errors": [error.reason for error in response.errors] if response.errors else []
            }
            
        except Exception as e:
            logger.error(f"Failed to subscribe to topic {topic}: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def unsubscribe_from_topic(self, device_tokens: List[str], topic: str) -> Dict[str, Any]:
        """Unsubscribe devices from a topic"""
        try:
            if not self.firebase_initialized:
                return {"success": False, "error": "Firebase not initialized"}
            
            response = await asyncio.get_event_loop().run_in_executor(
                self.executor,
                messaging.unsubscribe_from_topic,
                device_tokens,
                topic
            )
            
            return {
                "success": True,
                "success_count": response.success_count,
                "failure_count": response.failure_count,
                "errors": [error.reason for error in response.errors] if response.errors else []
            }
            
        except Exception as e:
            logger.error(f"Failed to unsubscribe from topic {topic}: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def _get_user_devices(self, user_id: str) -> List[Dict[str, Any]]:
        """Get active devices for a user"""
        devices_cursor = self.db.push_devices.find({
            "user_id": user_id,
            "is_active": True
        })
        
        return await devices_cursor.to_list(None)
    
    async def _cleanup_invalid_tokens(self, invalid_tokens: List[str]):
        """Remove invalid device tokens"""
        try:
            result = await self.db.push_devices.update_many(
                {"device_token": {"$in": invalid_tokens}},
                {"$set": {"is_active": False}}
            )
            
            logger.info(f"Cleaned up {result.modified_count} invalid device tokens")
            
        except Exception as e:
            logger.error(f"Failed to cleanup invalid tokens: {str(e)}")
    
    async def validate_push_settings(self) -> Dict[str, Any]:
        """Validate push notification configuration"""
        try:
            if not self.firebase_initialized:
                return {
                    "valid": False,
                    "error": "Firebase not initialized",
                    "provider": "firebase"
                }
            
            # Test by sending a dry run message
            test_message = messaging.Message(
                notification=messaging.Notification(
                    title="Test",
                    body="Configuration test"
                ),
                token="test_token"  # This will fail but test configuration
            )
            
            try:
                await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    messaging.send,
                    test_message,
                    True  # dry_run=True
                )
            except messaging.UnregisteredError:
                # This is expected with test token - means configuration is working
                pass
            
            return {
                "valid": True,
                "provider": "firebase",
                "project_id": self.firebase_project_id
            }
            
        except Exception as e:
            return {
                "valid": False,
                "error": str(e),
                "provider": "firebase"
            }