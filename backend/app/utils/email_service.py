"""
Email Service for Notification Engine
Handles email delivery with multiple provider support
"""
import logging
from typing import List, Optional, Dict, Any
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor
import aiohttp

logger = logging.getLogger(__name__)

class EmailService:
    """Email delivery service with multiple provider support"""
    
    def __init__(self):
        self.provider = os.getenv("EMAIL_PROVIDER", "smtp").lower()
        self.smtp_config = {
            "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
            "port": int(os.getenv("SMTP_PORT", "587")),
            "username": os.getenv("SMTP_USERNAME", ""),
            "password": os.getenv("SMTP_PASSWORD", ""),
            "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() == "true",
            "from_email": os.getenv("FROM_EMAIL", "noreply@school.edu"),
            "from_name": os.getenv("FROM_NAME", "Spring of Knowledge Hub")
        }
        
        # SendGrid configuration
        self.sendgrid_api_key = os.getenv("SENDGRID_API_KEY", "")
        
        # Thread pool for async email sending
        self.executor = ThreadPoolExecutor(max_workers=10)
    
    async def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: List[str] = None,
        reply_to: Optional[str] = None,
        cc: List[str] = None,
        bcc: List[str] = None
    ) -> bool:
        """
        Send email using configured provider
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML content
            text_content: Plain text content (optional)
            attachments: List of attachment file paths
            reply_to: Reply-to email address
            cc: CC recipients
            bcc: BCC recipients
        
        Returns:
            bool: Success status
        """
        try:
            if self.provider == "sendgrid":
                return await self._send_via_sendgrid(
                    to_email, subject, html_content, text_content,
                    attachments, reply_to, cc, bcc
                )
            else:
                return await self._send_via_smtp(
                    to_email, subject, html_content, text_content,
                    attachments, reply_to, cc, bcc
                )
                
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    async def _send_via_smtp(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: List[str] = None,
        reply_to: Optional[str] = None,
        cc: List[str] = None,
        bcc: List[str] = None
    ) -> bool:
        """Send email via SMTP"""
        try:
            # Run SMTP sending in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(
                self.executor,
                self._smtp_send_sync,
                to_email, subject, html_content, text_content,
                attachments, reply_to, cc, bcc
            )
        except Exception as e:
            logger.error(f"SMTP send error: {str(e)}")
            return False
    
    def _smtp_send_sync(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: List[str] = None,
        reply_to: Optional[str] = None,
        cc: List[str] = None,
        bcc: List[str] = None
    ) -> bool:
        """Synchronous SMTP sending"""
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.smtp_config['from_name']} <{self.smtp_config['from_email']}>"
            message["To"] = to_email
            
            if reply_to:
                message["Reply-To"] = reply_to
            if cc:
                message["Cc"] = ", ".join(cc)
            
            # Add text content
            if text_content:
                text_part = MIMEText(text_content, "plain", "utf-8")
                message.attach(text_part)
            
            # Add HTML content
            html_part = MIMEText(html_content, "html", "utf-8")
            message.attach(html_part)
            
            # Add attachments
            if attachments:
                for attachment_path in attachments:
                    if os.path.exists(attachment_path):
                        with open(attachment_path, "rb") as attachment:
                            part = MIMEBase("application", "octet-stream")
                            part.set_payload(attachment.read())
                        
                        encoders.encode_base64(part)
                        part.add_header(
                            "Content-Disposition",
                            f"attachment; filename= {os.path.basename(attachment_path)}"
                        )
                        message.attach(part)
            
            # Prepare recipient list
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            # Send email
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.smtp_config["host"], self.smtp_config["port"]) as server:
                if self.smtp_config["use_tls"]:
                    server.starttls(context=context)
                
                if self.smtp_config["username"]:
                    server.login(self.smtp_config["username"], self.smtp_config["password"])
                
                server.sendmail(
                    self.smtp_config["from_email"],
                    recipients,
                    message.as_string()
                )
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"SMTP send error: {str(e)}")
            return False
    
    async def _send_via_sendgrid(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        attachments: List[str] = None,
        reply_to: Optional[str] = None,
        cc: List[str] = None,
        bcc: List[str] = None
    ) -> bool:
        """Send email via SendGrid API"""
        try:
            if not self.sendgrid_api_key:
                logger.error("SendGrid API key not configured")
                return False
            
            # Prepare SendGrid payload
            payload = {
                "personalizations": [{
                    "to": [{"email": to_email}],
                    "subject": subject
                }],
                "from": {
                    "email": self.smtp_config["from_email"],
                    "name": self.smtp_config["from_name"]
                },
                "content": [
                    {
                        "type": "text/html",
                        "value": html_content
                    }
                ]
            }
            
            # Add text content if provided
            if text_content:
                payload["content"].insert(0, {
                    "type": "text/plain",
                    "value": text_content
                })
            
            # Add CC/BCC if provided
            if cc:
                payload["personalizations"][0]["cc"] = [{"email": email} for email in cc]
            if bcc:
                payload["personalizations"][0]["bcc"] = [{"email": email} for email in bcc]
            
            # Add reply-to if provided
            if reply_to:
                payload["reply_to"] = {"email": reply_to}
            
            # TODO: Handle attachments for SendGrid
            # This would require base64 encoding the files
            
            # Send via SendGrid API
            headers = {
                "Authorization": f"Bearer {self.sendgrid_api_key}",
                "Content-Type": "application/json"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.sendgrid.com/v3/mail/send",
                    json=payload,
                    headers=headers
                ) as response:
                    if response.status == 202:  # SendGrid success status
                        logger.info(f"Email sent successfully via SendGrid to {to_email}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"SendGrid error: {response.status} - {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"SendGrid send error: {str(e)}")
            return False
    
    async def send_bulk_email(
        self,
        recipients: List[Dict[str, str]],  # [{"email": "...", "name": "..."}]
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        personalization_data: Optional[Dict[str, Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Send bulk emails with optional personalization
        
        Args:
            recipients: List of recipient dictionaries
            subject: Email subject
            html_content: HTML content with optional template variables
            text_content: Plain text content
            personalization_data: Per-recipient personalization data
        
        Returns:
            Dict with success/failure counts
        """
        results = {"sent": 0, "failed": 0, "errors": []}
        
        # Process in batches to avoid overwhelming the server
        batch_size = 50
        for i in range(0, len(recipients), batch_size):
            batch = recipients[i:i + batch_size]
            
            tasks = []
            for recipient in batch:
                email = recipient["email"]
                
                # Apply personalization if available
                personalized_html = html_content
                personalized_subject = subject
                
                if personalization_data and email in personalization_data:
                    for key, value in personalization_data[email].items():
                        personalized_html = personalized_html.replace(f"{{{key}}}", value)
                        personalized_subject = personalized_subject.replace(f"{{{key}}}", value)
                
                task = self.send_email(
                    to_email=email,
                    subject=personalized_subject,
                    html_content=personalized_html,
                    text_content=text_content
                )
                tasks.append((email, task))
            
            # Execute batch
            batch_results = await asyncio.gather(*[task for _, task in tasks], return_exceptions=True)
            
            for (email, _), result in zip(tasks, batch_results):
                if isinstance(result, Exception):
                    results["failed"] += 1
                    results["errors"].append(f"{email}: {str(result)}")
                elif result:
                    results["sent"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(f"{email}: Unknown error")
            
            # Small delay between batches
            await asyncio.sleep(0.1)
        
        return results
    
    async def validate_email_settings(self) -> Dict[str, Any]:
        """Validate email configuration"""
        try:
            if self.provider == "smtp":
                # Test SMTP connection
                loop = asyncio.get_event_loop()
                return await loop.run_in_executor(
                    self.executor,
                    self._test_smtp_connection
                )
            elif self.provider == "sendgrid":
                return await self._test_sendgrid_connection()
            else:
                return {"valid": False, "error": f"Unknown provider: {self.provider}"}
                
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def _test_smtp_connection(self) -> Dict[str, Any]:
        """Test SMTP connection synchronously"""
        try:
            context = ssl.create_default_context()
            
            with smtplib.SMTP(self.smtp_config["host"], self.smtp_config["port"]) as server:
                if self.smtp_config["use_tls"]:
                    server.starttls(context=context)
                
                if self.smtp_config["username"]:
                    server.login(self.smtp_config["username"], self.smtp_config["password"])
                
                return {"valid": True, "provider": "smtp"}
                
        except Exception as e:
            return {"valid": False, "error": str(e), "provider": "smtp"}
    
    async def _test_sendgrid_connection(self) -> Dict[str, Any]:
        """Test SendGrid connection"""
        try:
            if not self.sendgrid_api_key:
                return {"valid": False, "error": "API key not configured", "provider": "sendgrid"}
            
            headers = {
                "Authorization": f"Bearer {self.sendgrid_api_key}"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.sendgrid.com/v3/user/profile",
                    headers=headers
                ) as response:
                    if response.status == 200:
                        return {"valid": True, "provider": "sendgrid"}
                    else:
                        error_text = await response.text()
                        return {"valid": False, "error": error_text, "provider": "sendgrid"}
                        
        except Exception as e:
            return {"valid": False, "error": str(e), "provider": "sendgrid"}