"""
SMS Service for Notification Engine
Handles SMS delivery with multiple provider support
"""
import logging
from typing import List, Optional, Dict, Any
import os
import aiohttp
from twilio.rest import Client as TwilioClient
import asyncio
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

class SMSService:
    """SMS delivery service with multiple provider support"""
    
    def __init__(self):
        self.provider = os.getenv("SMS_PROVIDER", "twilio").lower()
        
        # Twilio configuration
        self.twilio_account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
        self.twilio_auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
        self.twilio_from_number = os.getenv("TWILIO_FROM_NUMBER", "")
        self.twilio_client = None
        
        if self.twilio_account_sid and self.twilio_auth_token:
            self.twilio_client = TwilioClient(
                self.twilio_account_sid,
                self.twilio_auth_token
            )
        
        # AWS SNS configuration
        self.aws_access_key = os.getenv("AWS_ACCESS_KEY_ID", "")
        self.aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY", "")
        self.aws_region = os.getenv("AWS_REGION", "us-east-1")
        
        # Thread pool for async operations
        self.executor = ThreadPoolExecutor(max_workers=5)
    
    async def send_sms(
        self,
        to_phone: str,
        message: str,
        from_number: Optional[str] = None
    ) -> bool:
        """
        Send SMS using configured provider
        
        Args:
            to_phone: Recipient phone number (E.164 format recommended)
            message: SMS message content
            from_number: Override sender number
        
        Returns:
            bool: Success status
        """
        try:
            # Normalize phone number
            to_phone = self._normalize_phone_number(to_phone)
            
            # Truncate message if too long (160 chars for single SMS)
            if len(message) > 160:
                message = message[:157] + "..."
                logger.warning(f"SMS message truncated to 160 characters")
            
            if self.provider == "twilio":
                return await self._send_via_twilio(to_phone, message, from_number)
            elif self.provider == "aws_sns":
                return await self._send_via_aws_sns(to_phone, message)
            else:
                logger.error(f"Unsupported SMS provider: {self.provider}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send SMS to {to_phone}: {str(e)}")
            return False
    
    async def _send_via_twilio(
        self,
        to_phone: str,
        message: str,
        from_number: Optional[str] = None
    ) -> bool:
        """Send SMS via Twilio"""
        try:
            if not self.twilio_client:
                logger.error("Twilio client not configured")
                return False
            
            if not self.twilio_from_number and not from_number:
                logger.error("No Twilio sender number configured")
                return False
            
            sender = from_number or self.twilio_from_number
            
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._twilio_send_sync,
                to_phone, message, sender
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Twilio send error: {str(e)}")
            return False
    
    def _twilio_send_sync(self, to_phone: str, message: str, from_number: str) -> bool:
        """Synchronous Twilio SMS sending"""
        try:
            message_obj = self.twilio_client.messages.create(
                body=message,
                from_=from_number,
                to=to_phone
            )
            
            logger.info(f"SMS sent via Twilio to {to_phone}, SID: {message_obj.sid}")
            return True
            
        except Exception as e:
            logger.error(f"Twilio sync send error: {str(e)}")
            return False
    
    async def _send_via_aws_sns(self, to_phone: str, message: str) -> bool:
        """Send SMS via AWS SNS"""
        try:
            import boto3
            
            if not self.aws_access_key or not self.aws_secret_key:
                logger.error("AWS credentials not configured")
                return False
            
            # Create SNS client
            sns = boto3.client(
                'sns',
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.aws_region
            )
            
            # Run in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._sns_send_sync,
                sns, to_phone, message
            )
            
            return result
            
        except ImportError:
            logger.error("boto3 not installed. Install with: pip install boto3")
            return False
        except Exception as e:
            logger.error(f"AWS SNS send error: {str(e)}")
            return False
    
    def _sns_send_sync(self, sns_client, to_phone: str, message: str) -> bool:
        """Synchronous AWS SNS SMS sending"""
        try:
            response = sns_client.publish(
                PhoneNumber=to_phone,
                Message=message,
                MessageAttributes={
                    'AWS.SNS.SMS.SMSType': {
                        'DataType': 'String',
                        'StringValue': 'Transactional'
                    }
                }
            )
            
            logger.info(f"SMS sent via AWS SNS to {to_phone}, MessageId: {response['MessageId']}")
            return True
            
        except Exception as e:
            logger.error(f"SNS sync send error: {str(e)}")
            return False
    
    def _normalize_phone_number(self, phone: str) -> str:
        """Normalize phone number to E.164 format"""
        # Remove all non-digit characters
        digits = ''.join(filter(str.isdigit, phone))
        
        # If no country code, assume US/Canada (+1)
        if len(digits) == 10:
            digits = '1' + digits
        
        # Add + prefix if not present
        if not digits.startswith('+'):
            digits = '+' + digits
        
        return digits
    
    async def send_bulk_sms(
        self,
        recipients: List[Dict[str, str]],  # [{"phone": "...", "name": "..."}]
        message: str,
        personalization_data: Optional[Dict[str, Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Send bulk SMS with optional personalization
        
        Args:
            recipients: List of recipient dictionaries
            message: SMS message content
            personalization_data: Per-recipient personalization data
        
        Returns:
            Dict with success/failure counts
        """
        results = {"sent": 0, "failed": 0, "errors": []}
        
        # Process in smaller batches for SMS (stricter rate limits)
        batch_size = 10
        for i in range(0, len(recipients), batch_size):
            batch = recipients[i:i + batch_size]
            
            tasks = []
            for recipient in batch:
                phone = recipient["phone"]
                
                # Apply personalization if available
                personalized_message = message
                if personalization_data and phone in personalization_data:
                    for key, value in personalization_data[phone].items():
                        personalized_message = personalized_message.replace(f"{{{key}}}", value)
                
                task = self.send_sms(to_phone=phone, message=personalized_message)
                tasks.append((phone, task))
            
            # Execute batch
            batch_results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
            
            for (phone, _), result in zip(tasks, batch_results):
                if isinstance(result, Exception):
                    results["failed"] += 1
                    results["errors"].append(f"{phone}: {str(result)}")
                elif result:
                    results["sent"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(f"{phone}: Unknown error")
            
            # Longer delay between SMS batches (rate limiting)
            await asyncio.sleep(1.0)
        
        return results
    
    async def validate_sms_settings(self) -> Dict[str, Any]:
        """Validate SMS configuration"""
        try:
            if self.provider == "twilio":
                return await self._test_twilio_connection()
            elif self.provider == "aws_sns":
                return await self._test_aws_sns_connection()
            else:
                return {"valid": False, "error": f"Unknown provider: {self.provider}"}
                
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    async def _test_twilio_connection(self) -> Dict[str, Any]:
        """Test Twilio connection"""
        try:
            if not self.twilio_client:
                return {"valid": False, "error": "Twilio credentials not configured", "provider": "twilio"}
            
            if not self.twilio_from_number:
                return {"valid": False, "error": "Twilio sender number not configured", "provider": "twilio"}
            
            # Run test in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._twilio_test_sync
            )
            
            return result
            
        except Exception as e:
            return {"valid": False, "error": str(e), "provider": "twilio"}
    
    def _twilio_test_sync(self) -> Dict[str, Any]:
        """Test Twilio connection synchronously"""
        try:
            # Test by fetching account info
            account = self.twilio_client.api.accounts(self.twilio_account_sid).fetch()
            
            return {
                "valid": True,
                "provider": "twilio",
                "account_name": account.friendly_name,
                "status": account.status
            }
            
        except Exception as e:
            return {"valid": False, "error": str(e), "provider": "twilio"}
    
    async def _test_aws_sns_connection(self) -> Dict[str, Any]:
        """Test AWS SNS connection"""
        try:
            import boto3
            
            if not self.aws_access_key or not self.aws_secret_key:
                return {"valid": False, "error": "AWS credentials not configured", "provider": "aws_sns"}
            
            # Create SNS client and test
            sns = boto3.client(
                'sns',
                aws_access_key_id=self.aws_access_key,
                aws_secret_access_key=self.aws_secret_key,
                region_name=self.aws_region
            )
            
            # Run test in thread pool
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._sns_test_sync,
                sns
            )
            
            return result
            
        except ImportError:
            return {"valid": False, "error": "boto3 not installed", "provider": "aws_sns"}
        except Exception as e:
            return {"valid": False, "error": str(e), "provider": "aws_sns"}
    
    def _sns_test_sync(self, sns_client) -> Dict[str, Any]:
        """Test AWS SNS connection synchronously"""
        try:
            # Test by listing topics (minimal operation)
            response = sns_client.list_topics()
            
            return {
                "valid": True,
                "provider": "aws_sns",
                "region": self.aws_region
            }
            
        except Exception as e:
            return {"valid": False, "error": str(e), "provider": "aws_sns"}
    
    async def get_delivery_status(self, message_id: str) -> Dict[str, Any]:
        """Get SMS delivery status (Twilio only)"""
        try:
            if self.provider != "twilio" or not self.twilio_client:
                return {"status": "unknown", "error": "Status check not supported"}
            
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                self.executor,
                self._get_twilio_status_sync,
                message_id
            )
            
            return result
            
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def _get_twilio_status_sync(self, message_sid: str) -> Dict[str, Any]:
        """Get Twilio message status synchronously"""
        try:
            message = self.twilio_client.messages(message_sid).fetch()
            
            return {
                "status": message.status,
                "error_code": message.error_code,
                "error_message": message.error_message,
                "price": message.price,
                "direction": message.direction,
                "date_sent": message.date_sent.isoformat() if message.date_sent else None
            }
            
        except Exception as e:
            return {"status": "error", "error": str(e)}