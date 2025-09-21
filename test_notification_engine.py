#!/usr/bin/env python3
"""
End-to-end test for the Centralized Notification Engine
Tests template seeding, notification sending, and multi-channel delivery
"""
import asyncio
import logging
from datetime import datetime
from bson import ObjectId

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logging.getLogger("backend.app.utils.notification_engine").setLevel(logging.DEBUG)

# Import our notification system
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from backend.app.utils.notification_engine import notification_engine
from backend.app.utils.notification_templates import template_manager
from backend.app.utils.notification_integrations import notify
from backend.app.db import get_db
from backend.app.models.notifications import NotificationPreference, RecipientType, NotificationPriority, NotificationChannel

def get_database():
    """Wrapper function to match the expected interface"""
    return get_db()

class NotificationEngineTest:
    def __init__(self):
        self.db = get_database()
        self.test_user_id = str(ObjectId())
        self.test_student_id = str(ObjectId())
        self.test_parent_id = str(ObjectId())
        self.branch_id = "test_branch_notifications"
    
    async def setup_test_data(self):
        """Set up test users and data"""
        logger.info("Setting up test data...")
        
        # Create test users
        test_users = [
            {
                "_id": ObjectId(self.test_user_id),
                "user_id": "TEST001",
                "first_name": "Test",
                "last_name": "User",
                "email": "test@notification.test",
                "phone_number": "+1234567890",
                "role": "admin",
                "branch_id": self.branch_id,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(self.test_student_id),
                "user_id": "STU001", 
                "first_name": "John",
                "last_name": "Student",
                "email": "student@notification.test",
                "role": "student",
                "branch_id": self.branch_id,
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(self.test_parent_id),
                "user_id": "PAR001",
                "first_name": "Jane", 
                "last_name": "Parent",
                "email": "parent@notification.test",
                "phone_number": "+1987654321",
                "role": "parent",
                "branch_id": self.branch_id,
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        ]
        
        # Clean up existing test data
        await self.cleanup_test_data()
        
        # Insert test users
        await self.db.users.insert_many(test_users)
        
        # Create test student record
        student_record = {
            "_id": ObjectId(self.test_student_id),
            "student_id": "STU001",
            "first_name": "John",
            "last_name": "Student",
            "primary_parent_id": ObjectId(self.test_parent_id),
            "branch_id": self.branch_id,
            "current_class_id": "test_class_001",
            "created_at": datetime.utcnow()
        }
        
        await self.db.students.insert_one(student_record)
        
        logger.info("Test data setup completed")
    
    async def test_template_seeding(self):
        """Test notification template seeding"""
        logger.info("Testing template seeding...")
        
        result = await template_manager.seed_default_templates(self.branch_id)
        
        assert result["success"], f"Template seeding failed: {result.get('error')}"
        assert (result["templates_created"] + result["templates_updated"]) > 0, "No templates were created or updated"
        
        # Verify a specific template exists
        template = await template_manager.get_template_by_code("GRADE_PUBLISHED")
        
        # Debug: List all templates in database
        if template is None:
            all_templates = await self.db.notification_templates.find({}).to_list(None)
            template_codes = [t.get("template_code") for t in all_templates]
            logger.error(f"Available templates: {template_codes}")
            logger.error(f"Looking for GRADE_PUBLISHED but found: {[t for t in all_templates if 'GRADE' in t.get('template_code', '')]}")
        
        assert template is not None, "GRADE_PUBLISHED template not found"
        
        logger.info(f"✓ Template seeding successful: {result['templates_created']} templates created")
        return True
    
    async def test_direct_notification(self):
        """Test sending direct notification"""
        logger.info("Testing direct notification...")
        
        result = await notification_engine.send_immediate_notification(
            title="Test Notification",
            message="This is a test notification from the engine",
            recipients=[self.test_user_id],
            notification_type="system",
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            sender_name="Test System",
            branch_id=self.branch_id
        )
        
        assert result["success"], f"Direct notification failed: {result.get('message')}"
        assert result["recipient_count"] == 1, "Wrong recipient count"
        
        logger.info(f"✓ Direct notification sent: {result['notification_code']}")
        return True
    
    async def test_template_notification(self):
        """Test sending template-based notification"""
        logger.info("Testing template-based notification...")
        
        result = await notification_engine.send_notification(
            template_code="GRADE_PUBLISHED",
            recipients=[self.test_student_id, self.test_parent_id],
            variables={
                "student_name": "John Student",
                "subject_name": "Mathematics",
                "grade": "85",
                "total_marks": "100",
                "teacher_comments": "Excellent work!"
            },
            priority=NotificationPriority.MEDIUM,
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            sender_name="Math Teacher",
            branch_id=self.branch_id
        )
        
        assert result["success"], f"Template notification failed: {result.get('message')}"
        assert result["recipient_count"] == 2, "Wrong recipient count"
        
        logger.info(f"✓ Template notification sent: {result['notification_code']}")
        return True
    
    async def test_integration_helper(self):
        """Test notification integration helper"""
        logger.info("Testing integration helper...")
        
        result = await notify.notify_grade_published(
            student_id=self.test_student_id,
            student_name="John Student",
            subject_name="Science",
            grade="92",
            total_marks="100",
            teacher_comments="Outstanding performance!",
            exam_name="Mid-term Exam",
            branch_id=self.branch_id
        )
        
        assert result["success"], f"Integration helper failed: {result.get('message')}"
        
        logger.info(f"✓ Integration helper notification sent: {result['notification_code']}")
        return True
    
    async def test_user_preferences(self):
        """Test user notification preferences"""
        logger.info("Testing user preferences...")
        
        # Create default preferences for test user
        preferences = NotificationPreference(
            user_id=self.test_user_id,
            email_enabled=True,
            sms_enabled=False,  # Disable SMS
            push_enabled=True,
            in_app_enabled=True,
            academic=True,
            system=True
        )
        
        await self.db.notification_preferences.insert_one(preferences.model_dump())
        
        # Send notification - should respect preferences
        result = await notification_engine.send_notification(
            template_code="WELCOME_NEW_USER",
            recipients=[self.test_user_id],
            variables={
                "user_name": "Test User",
                "school_name": "Test School",
                "role": "Admin",
                "login_url": "https://test.school.edu/login",
                "support_contact": "support@test.school.edu"
            },
            channels=[NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
            branch_id=self.branch_id
        )
        
        assert result["success"], f"Preferences test failed: {result.get('message')}"
        
        logger.info("✓ User preferences test passed")
        return True
    
    async def test_emergency_notification(self):
        """Test emergency notification to all users"""
        logger.info("Testing emergency notification...")
        
        result = await notify.notify_emergency(
            alert_title="Test Emergency",
            alert_message="This is a test emergency alert",
            emergency_contact="911",
            location="Test Building",
            instructions="Follow emergency procedures",
            target_audience=RecipientType.ALL_USERS,
            branch_id=self.branch_id
        )
        
        assert result["success"], f"Emergency notification failed: {result.get('message')}"
        
        logger.info(f"✓ Emergency notification sent to all users: {result['notification_code']}")
        return True
    
    async def test_notification_queue_processing(self):
        """Test that notification queue is processed"""
        logger.info("Testing notification queue processing...")
        
        # Send a notification that will be queued for email/SMS
        result = await notification_engine.send_notification(
            template_code="FEE_DUE_REMINDER",
            recipients=[self.test_parent_id],
            variables={
                "student_name": "John Student",
                "fee_type": "Tuition Fee",
                "amount": "500.00",
                "due_date": "2024-01-15",
                "payment_url": "https://test.school.edu/pay"
            },
            channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
            branch_id=self.branch_id
        )
        
        assert result["success"], f"Queue test failed: {result.get('message')}"
        
        # Check that queue items were created
        queue_count = await self.db.notification_queue.count_documents({
            "notification_id": result["notification_id"]
        })
        
        assert queue_count > 0, "No queue items created"
        
        logger.info(f"✓ Notification queue processing test passed: {queue_count} items queued")
        return True
    
    async def verify_notifications_created(self):
        """Verify notifications were actually saved"""
        logger.info("Verifying created notifications...")
        
        # Count notifications in database
        total_notifications = await self.db.notifications.count_documents({
            "branch_id": self.branch_id
        })
        
        total_recipients = await self.db.notification_recipients.count_documents({})
        
        logger.info(f"✓ Found {total_notifications} notifications and {total_recipients} recipient records")
        
        # Get a sample notification and verify fields
        sample_notification = await self.db.notifications.find_one({
            "branch_id": self.branch_id
        })
        
        if sample_notification:
            required_fields = ["title", "message", "notification_type", "created_at", "sender_name"]
            for field in required_fields:
                assert field in sample_notification, f"Missing required field: {field}"
            
            logger.info("✓ Notification structure validation passed")
        
        return True
    
    async def cleanup_test_data(self):
        """Clean up test data"""
        logger.info("Cleaning up test data...")
        
        # Clean up collections
        collections_to_clean = [
            "users", "students", "notifications", "notification_recipients",
            "notification_queue", "notification_preferences", "notification_templates"
        ]
        
        for collection_name in collections_to_clean:
            await self.db[collection_name].delete_many({"branch_id": self.branch_id})
            # Also clean test user records
            await self.db[collection_name].delete_many({
                "_id": {"$in": [
                    ObjectId(self.test_user_id),
                    ObjectId(self.test_student_id), 
                    ObjectId(self.test_parent_id)
                ]}
            })
        
        logger.info("Test data cleanup completed")
    
    async def run_all_tests(self):
        """Run all notification engine tests"""
        logger.info("Starting Centralized Notification Engine tests...")
        
        try:
            await self.setup_test_data()
            
            tests = [
                ("Template Seeding", self.test_template_seeding),
                ("Direct Notification", self.test_direct_notification),
                ("Template Notification", self.test_template_notification),
                ("Integration Helper", self.test_integration_helper),
                ("User Preferences", self.test_user_preferences),
                ("Emergency Notification", self.test_emergency_notification),
                ("Queue Processing", self.test_notification_queue_processing),
                ("Verification", self.verify_notifications_created)
            ]
            
            passed = 0
            failed = 0
            
            for test_name, test_func in tests:
                try:
                    await test_func()
                    passed += 1
                    logger.info(f"✅ {test_name} - PASSED")
                except Exception as e:
                    failed += 1
                    logger.error(f"❌ {test_name} - FAILED: {str(e)}")
            
            logger.info(f"\n🎯 Test Results: {passed} passed, {failed} failed")
            
            if failed == 0:
                logger.info("🎉 All notification engine tests PASSED! System is working correctly.")
            else:
                logger.error(f"❌ {failed} tests FAILED. Please review the notification system.")
            
            return failed == 0
            
        finally:
            await self.cleanup_test_data()

async def main():
    """Main test runner"""
    tester = NotificationEngineTest()
    success = await tester.run_all_tests()
    return success

if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)