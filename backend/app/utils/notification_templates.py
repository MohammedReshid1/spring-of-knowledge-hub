"""
Notification Template Seeding and Management
Pre-built templates for all modules with common scenarios
"""
import asyncio
import logging
from typing import Dict, List, Any
from datetime import datetime
from bson import ObjectId

from ..models.notifications import (
    NotificationTemplate, NotificationType, NotificationPriority, 
    NotificationChannel
)
from ..db import get_db

logger = logging.getLogger(__name__)

class NotificationTemplateManager:
    """Manages notification templates for all modules"""
    
    def __init__(self):
        self.db = get_db()
    
    async def seed_default_templates(self, branch_id: str = None) -> Dict[str, Any]:
        """Seed all default notification templates"""
        try:
            templates_created = 0
            templates_updated = 0
            templates_skipped = 0
            
            for template_data in self.get_default_templates():
                # Check if template already exists
                existing = await self.db.notification_templates.find_one({
                    "template_code": template_data["template_code"]
                })
                
                if existing:
                    # Update existing template, making it global
                    await self.db.notification_templates.update_one(
                        {"_id": existing["_id"]},
                        {
                            "$set": {
                                **template_data,
                                "branch_access": [],  # Make updated templates global too
                                "is_active": True,  # Ensure template is active
                                "updated_at": datetime.utcnow(),
                                "usage_count": existing.get("usage_count", 0),
                                "last_used": existing.get("last_used")
                            }
                        }
                    )
                    templates_updated += 1
                else:
                    # Create new template
                    template_data.update({
                        "_id": ObjectId(),
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "usage_count": 0,
                        "branch_access": [],  # Make all seeded templates global by default
                        "is_active": True,  # Ensure new templates are active
                        "created_by": "system"
                    })
                    
                    await self.db.notification_templates.insert_one(template_data)
                    templates_created += 1
            
            logger.info(f"Template seeding completed: {templates_created} created, {templates_updated} updated")
            
            return {
                "success": True,
                "templates_created": templates_created,
                "templates_updated": templates_updated,
                "total_templates": len(self.get_default_templates())
            }
            
        except Exception as e:
            logger.error(f"Failed to seed templates: {str(e)}")
            return {"success": False, "error": str(e)}
    
    def get_default_templates(self) -> List[Dict[str, Any]]:
        """Get all default notification templates"""
        templates = []
        
        # Academic/Grade Templates
        templates.extend([
            {
                "template_code": "GRADE_PUBLISHED",
                "name": "Grade Published Notification",
                "description": "Notify students/parents when new grades are published",
                "notification_type": NotificationType.ACADEMIC,
                "title_template": "New Grade Available - {{subject_name}}",
                "message_template": "{{student_name}} has received a new grade for {{subject_name}}: {{grade}}/{{total_marks}}. {{teacher_comments}}",
                "variables": ["student_name", "subject_name", "grade", "total_marks", "teacher_comments", "exam_name"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#10B981",
                "category": "academic",
                "is_system_template": True
            },
            {
                "template_code": "REPORT_CARD_READY",
                "name": "Report Card Ready",
                "description": "Notify when report card is ready for download",
                "notification_type": NotificationType.ACADEMIC,
                "title_template": "{{term_name}} Report Card Ready",
                "message_template": "{{student_name}}'s {{term_name}} report card is now available for download. Overall grade: {{overall_grade}}",
                "variables": ["student_name", "term_name", "overall_grade", "download_url"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
                "color": "#8B5CF6",
                "category": "academic",
                "is_system_template": True
            }
        ])
        
        # Attendance Templates
        templates.extend([
            {
                "template_code": "ATTENDANCE_ALERT_ABSENT",
                "name": "Student Absence Alert",
                "description": "Alert parents when student is marked absent",
                "notification_type": NotificationType.ATTENDANCE_ALERT,
                "title_template": "Attendance Alert - {{student_name}}",
                "message_template": "{{student_name}} was marked absent today ({{date}}). If this is unexpected, please contact the school immediately.",
                "variables": ["student_name", "date", "class_name", "period"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
                "color": "#EF4444",
                "category": "attendance",
                "is_system_template": True
            },
            {
                "template_code": "ATTENDANCE_LOW_WARNING",
                "name": "Low Attendance Warning",
                "description": "Warning when student attendance falls below threshold",
                "notification_type": NotificationType.ATTENDANCE_ALERT,
                "title_template": "Low Attendance Warning - {{student_name}}",
                "message_template": "{{student_name}}'s attendance has fallen to {{attendance_percentage}}%. Minimum required: {{minimum_required}}%. Please ensure regular attendance.",
                "variables": ["student_name", "attendance_percentage", "minimum_required", "absent_days", "total_days"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
                "color": "#F59E0B",
                "category": "attendance",
                "is_system_template": True
            }
        ])
        
        # Payment Templates
        templates.extend([
            {
                "template_code": "FEE_DUE_REMINDER",
                "name": "Fee Due Reminder",
                "description": "Reminder for upcoming fee payment",
                "notification_type": NotificationType.PAYMENT_REMINDER,
                "title_template": "Fee Payment Due - {{fee_type}}",
                "message_template": "{{student_name}}'s {{fee_type}} payment of ${{amount}} is due on {{due_date}}. Please make payment to avoid late fees.",
                "variables": ["student_name", "fee_type", "amount", "due_date", "payment_url"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#06B6D4",
                "category": "payment",
                "is_system_template": True
            },
            {
                "template_code": "PAYMENT_OVERDUE",
                "name": "Payment Overdue Notice",
                "description": "Notice for overdue payments",
                "notification_type": NotificationType.PAYMENT_REMINDER,
                "title_template": "OVERDUE: {{fee_type}} Payment",
                "message_template": "{{student_name}}'s {{fee_type}} payment of ${{amount}} was due on {{due_date}} and is now overdue. Late fee of ${{late_fee}} may apply.",
                "variables": ["student_name", "fee_type", "amount", "due_date", "late_fee", "days_overdue"],
                "default_priority": NotificationPriority.URGENT,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
                "color": "#DC2626",
                "category": "payment",
                "is_system_template": True
            },
            {
                "template_code": "PAYMENT_CONFIRMATION",
                "name": "Payment Confirmation",
                "description": "Confirmation when payment is received",
                "notification_type": NotificationType.PAYMENT_REMINDER,
                "title_template": "Payment Received - {{fee_type}}",
                "message_template": "Thank you! Payment of ${{amount}} for {{student_name}}'s {{fee_type}} has been received. Receipt #{{receipt_number}}",
                "variables": ["student_name", "fee_type", "amount", "receipt_number", "payment_date", "payment_method"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#10B981",
                "category": "payment",
                "is_system_template": True
            }
        ])
        
        # Exam Templates
        templates.extend([
            {
                "template_code": "EXAM_SCHEDULE_RELEASED",
                "name": "Exam Schedule Released",
                "description": "Notify when exam schedule is published",
                "notification_type": NotificationType.EXAM_NOTIFICATION,
                "title_template": "{{exam_type}} Schedule Released",
                "message_template": "The {{exam_type}} schedule for {{grade_level}} has been released. {{student_name}}'s first exam: {{first_exam_subject}} on {{first_exam_date}}",
                "variables": ["exam_type", "grade_level", "student_name", "first_exam_subject", "first_exam_date", "schedule_url"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#8B5CF6",
                "category": "exam",
                "is_system_template": True
            },
            {
                "template_code": "EXAM_REMINDER_24H",
                "name": "24 Hour Exam Reminder",
                "description": "Reminder 24 hours before exam",
                "notification_type": NotificationType.EXAM_NOTIFICATION,
                "title_template": "Exam Tomorrow - {{subject_name}}",
                "message_template": "Reminder: {{student_name}} has {{subject_name}} exam tomorrow ({{exam_date}}) at {{exam_time}}. Duration: {{duration}} minutes. Good luck!",
                "variables": ["student_name", "subject_name", "exam_date", "exam_time", "duration", "exam_room", "instructions"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
                "color": "#F59E0B",
                "category": "exam",
                "is_system_template": True
            }
        ])
        
        # Assignment Templates
        templates.extend([
            {
                "template_code": "ASSIGNMENT_DUE_REMINDER",
                "name": "Assignment Due Reminder",
                "description": "Reminder for upcoming assignment deadline",
                "notification_type": NotificationType.ASSIGNMENT_DUE,
                "title_template": "Assignment Due - {{assignment_title}}",
                "message_template": "{{student_name}}, your {{subject_name}} assignment '{{assignment_title}}' is due on {{due_date}}. {{remaining_days}} days remaining.",
                "variables": ["student_name", "subject_name", "assignment_title", "due_date", "remaining_days", "teacher_name"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#3B82F6",
                "category": "assignment",
                "is_system_template": True
            },
            {
                "template_code": "ASSIGNMENT_SUBMITTED",
                "name": "Assignment Submission Confirmation",
                "description": "Confirm assignment submission",
                "notification_type": NotificationType.ASSIGNMENT_DUE,
                "title_template": "Assignment Submitted - {{assignment_title}}",
                "message_template": "{{student_name}}'s assignment '{{assignment_title}}' for {{subject_name}} has been submitted successfully on {{submission_date}}",
                "variables": ["student_name", "subject_name", "assignment_title", "submission_date", "teacher_name"],
                "default_priority": NotificationPriority.LOW,
                "default_channels": [NotificationChannel.IN_APP],
                "color": "#10B981",
                "category": "assignment",
                "is_system_template": True
            }
        ])
        
        # Timetable Templates
        templates.extend([
            {
                "template_code": "TIMETABLE_UPDATED",
                "name": "Timetable Updated",
                "description": "Notify when class timetable is updated",
                "notification_type": NotificationType.ACADEMIC,
                "title_template": "Timetable Updated - {{class_name}}",
                "message_template": "The timetable for {{class_name}} has been updated. Changes effective from {{effective_date}}. Please check the new schedule.",
                "variables": ["class_name", "effective_date", "changed_subjects", "grade_level"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#6366F1",
                "category": "timetable",
                "is_system_template": True
            },
            {
                "template_code": "CLASS_CANCELLED",
                "name": "Class Cancelled",
                "description": "Notify when a class is cancelled",
                "notification_type": NotificationType.ACADEMIC,
                "title_template": "Class Cancelled - {{subject_name}}",
                "message_template": "{{subject_name}} class for {{class_name}} on {{date}} at {{time}} has been cancelled. {{reason}}",
                "variables": ["subject_name", "class_name", "date", "time", "reason", "teacher_name", "makeup_date"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL],
                "color": "#EF4444",
                "category": "timetable",
                "is_system_template": True
            }
        ])
        
        # General Templates
        templates.extend([
            {
                "template_code": "GENERAL_ANNOUNCEMENT",
                "name": "General Announcement",
                "description": "General school announcements",
                "notification_type": NotificationType.ANNOUNCEMENT,
                "title_template": "{{announcement_title}}",
                "message_template": "{{announcement_content}}",
                "variables": ["announcement_title", "announcement_content", "sender_name", "expiry_date", "action_required"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#6B7280",
                "category": "general",
                "is_system_template": True
            },
            {
                "template_code": "EMERGENCY_ALERT",
                "name": "Emergency Alert",
                "description": "Emergency notifications",
                "notification_type": NotificationType.EMERGENCY,
                "title_template": "EMERGENCY: {{alert_title}}",
                "message_template": "EMERGENCY ALERT: {{alert_message}}. Please follow instructions immediately. Contact: {{emergency_contact}}",
                "variables": ["alert_title", "alert_message", "emergency_contact", "location", "instructions"],
                "default_priority": NotificationPriority.URGENT,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.SMS, NotificationChannel.EMAIL, NotificationChannel.PUSH],
                "color": "#DC2626",
                "category": "emergency",
                "is_system_template": True
            },
            {
                "template_code": "WELCOME_NEW_USER",
                "name": "Welcome New User",
                "description": "Welcome message for new users",
                "notification_type": NotificationType.SYSTEM,
                "title_template": "Welcome to {{school_name}}!",
                "message_template": "Welcome {{user_name}}! Your {{role}} account has been created. Login with your credentials to access the Spring of Knowledge Hub.",
                "variables": ["user_name", "school_name", "role", "login_url", "support_contact"],
                "default_priority": NotificationPriority.MEDIUM,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                "color": "#10B981",
                "category": "system",
                "is_system_template": True
            }
        ])
        
        # Parent-specific Templates
        templates.extend([
            {
                "template_code": "PARENT_TEACHER_MEETING",
                "name": "Parent-Teacher Meeting Reminder",
                "description": "Reminder for parent-teacher meetings",
                "notification_type": NotificationType.EVENT,
                "title_template": "Parent-Teacher Meeting - {{student_name}}",
                "message_template": "You have a scheduled meeting with {{teacher_name}} for {{student_name}} on {{meeting_date}} at {{meeting_time}}. {{meeting_details}}",
                "variables": ["student_name", "teacher_name", "meeting_date", "meeting_time", "meeting_details", "location"],
                "default_priority": NotificationPriority.HIGH,
                "default_channels": [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
                "color": "#8B5CF6",
                "category": "parent",
                "is_system_template": True
            }
        ])
        
        # Teacher-specific Templates
        templates.extend([
            {
                "template_code": "TEACHER_DAILY_SUMMARY",
                "name": "Daily Teacher Summary",
                "description": "Daily summary for teachers",
                "notification_type": NotificationType.SYSTEM,
                "title_template": "Daily Summary - {{date}}",
                "message_template": "Today's classes: {{total_classes}}, Present students: {{total_present}}, Absent: {{total_absent}}, Assignments due: {{assignments_due}}",
                "variables": ["date", "total_classes", "total_present", "total_absent", "assignments_due", "teacher_name"],
                "default_priority": NotificationPriority.LOW,
                "default_channels": [NotificationChannel.IN_APP],
                "color": "#6B7280",
                "category": "teacher",
                "is_system_template": True
            }
        ])
        
        return templates
    
    async def get_template_by_code(self, template_code: str, branch_id: str = None) -> Dict[str, Any]:
        """Get template by code"""
        try:
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
            
            template = await self.db.notification_templates.find_one(query)
            
            if template:
                template["id"] = str(template["_id"])
                return template
            
            return None
            
        except Exception as e:
            logger.error(f"Failed to get template {template_code}: {str(e)}")
            return None
    
    async def create_custom_template(
        self,
        template_data: Dict[str, Any],
        created_by: str,
        branch_id: str = None
    ) -> Dict[str, Any]:
        """Create a custom notification template"""
        try:
            # Check if template code already exists
            existing = await self.db.notification_templates.find_one({
                "template_code": template_data["template_code"]
            })
            
            if existing:
                return {"success": False, "error": "Template code already exists"}
            
            # Create template
            template_doc = {
                **template_data,
                "_id": ObjectId(),
                "created_by": created_by,
                "branch_access": [branch_id] if branch_id else [],
                "is_system_template": False,
                "is_active": True,
                "usage_count": 0,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await self.db.notification_templates.insert_one(template_doc)
            
            return {
                "success": True,
                "template_id": str(template_doc["_id"]),
                "template_code": template_data["template_code"]
            }
            
        except Exception as e:
            logger.error(f"Failed to create custom template: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def update_template(
        self,
        template_id: str,
        update_data: Dict[str, Any],
        updated_by: str
    ) -> Dict[str, Any]:
        """Update an existing template"""
        try:
            # Don't allow updating system templates
            template = await self.db.notification_templates.find_one({
                "_id": ObjectId(template_id)
            })
            
            if not template:
                return {"success": False, "error": "Template not found"}
            
            if template.get("is_system_template", False):
                return {"success": False, "error": "Cannot update system templates"}
            
            # Update template
            await self.db.notification_templates.update_one(
                {"_id": ObjectId(template_id)},
                {
                    "$set": {
                        **update_data,
                        "updated_at": datetime.utcnow(),
                        "updated_by": updated_by
                    }
                }
            )
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to update template: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def delete_template(self, template_id: str) -> Dict[str, Any]:
        """Delete a custom template"""
        try:
            # Don't allow deleting system templates
            template = await self.db.notification_templates.find_one({
                "_id": ObjectId(template_id)
            })
            
            if not template:
                return {"success": False, "error": "Template not found"}
            
            if template.get("is_system_template", False):
                return {"success": False, "error": "Cannot delete system templates"}
            
            # Soft delete
            await self.db.notification_templates.update_one(
                {"_id": ObjectId(template_id)},
                {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
            )
            
            return {"success": True}
            
        except Exception as e:
            logger.error(f"Failed to delete template: {str(e)}")
            return {"success": False, "error": str(e)}
    
    async def list_templates(
        self,
        category: str = None,
        notification_type: NotificationType = None,
        branch_id: str = None,
        include_system: bool = True,
        include_custom: bool = True
    ) -> List[Dict[str, Any]]:
        """List notification templates with filtering"""
        try:
            query = {"is_active": True}
            
            if category:
                query["category"] = category
            
            if notification_type:
                query["notification_type"] = notification_type
            
            # Filter by template type
            system_filter = []
            if include_system:
                system_filter.append(True)
            if include_custom:
                system_filter.append(False)
            
            if system_filter:
                query["is_system_template"] = {"$in": system_filter}
            
            # Branch access filter for custom templates
            if branch_id and include_custom:
                query = {
                    "$and": [
                        query,
                        {
                            "$or": [
                                {"is_system_template": True},
                                {"branch_access": {"$in": [branch_id]}}
                            ]
                        }
                    ]
                }
            
            templates_cursor = self.db.notification_templates.find(query).sort([
                ("is_system_template", -1),  # System templates first
                ("category", 1),
                ("name", 1)
            ])
            
            templates = []
            async for template in templates_cursor:
                template["id"] = str(template["_id"])
                templates.append(template)
            
            return templates
            
        except Exception as e:
            logger.error(f"Failed to list templates: {str(e)}")
            return []

# Global instance
template_manager = NotificationTemplateManager()