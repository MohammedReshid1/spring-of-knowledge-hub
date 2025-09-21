from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

class MessageCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    message_type: str = Field(..., description="announcement, notice, alert, reminder, feedback")
    priority: str = Field(..., description="low, medium, high, urgent")
    recipients: List[str] = Field(..., description="List of user IDs")
    recipient_type: str = Field(..., description="individual, class, grade, all_students, all_teachers, all_parents")
    class_ids: Optional[List[str]] = []
    grade_level: Optional[str] = None
    attachments: Optional[List[str]] = []
    scheduled_send_time: Optional[datetime] = None
    requires_acknowledgment: bool = False
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Message(MessageCreate):
    id: str
    sender_id: str
    sent_at: Optional[datetime] = None
    is_sent: bool = False
    created_at: datetime
    updated_at: datetime

class MessageUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=200)
    content: Optional[str] = Field(None, min_length=1)
    message_type: Optional[str] = None
    priority: Optional[str] = None
    recipients: Optional[List[str]] = None
    recipient_type: Optional[str] = None
    class_ids: Optional[List[str]] = None
    grade_level: Optional[str] = None
    attachments: Optional[List[str]] = None
    scheduled_send_time: Optional[datetime] = None
    requires_acknowledgment: Optional[bool] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class MessageRecipientCreate(BaseModel):
    message_id: str
    recipient_id: str
    recipient_type: str = Field(..., description="student, parent, teacher, admin")
    
class MessageRecipient(MessageRecipientCreate):
    id: str
    is_read: bool = False
    read_at: Optional[datetime] = None
    is_acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

class NotificationCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    message: str = Field(..., min_length=1)
    notification_type: str = Field(..., description="info, success, warning, error")
    user_id: str
    related_entity_type: Optional[str] = None  # exam, assignment, payment, etc.
    related_entity_id: Optional[str] = None
    action_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Notification(NotificationCreate):
    id: str
    is_read: bool = False
    read_at: Optional[datetime] = None
    created_at: datetime

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=1)
    announcement_type: str = Field(..., description="general, academic, event, holiday, emergency")
    priority: str = Field(..., description="low, medium, high, urgent")
    target_audience: str = Field(..., description="all, students, parents, teachers, staff")
    class_ids: Optional[List[str]] = []
    grade_levels: Optional[List[str]] = []
    publish_date: datetime
    expiry_date: Optional[datetime] = None
    attachments: Optional[List[str]] = []
    is_pinned: bool = False
    branch_id: Optional[str] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class Announcement(AnnouncementCreate):
    id: str
    author_id: str
    is_published: bool = False
    view_count: int = 0
    created_at: datetime
    updated_at: datetime

class ParentStudentLinkCreate(BaseModel):
    parent_user_id: str
    student_id: str
    relationship: str = Field(..., description="father, mother, guardian, sibling, other")
    is_primary_contact: bool = False
    can_view_grades: bool = True
    can_view_attendance: bool = True
    can_view_assignments: bool = True
    can_view_fees: bool = True
    can_receive_notifications: bool = True

class ParentStudentLink(ParentStudentLinkCreate):
    id: str
    verified: bool = False
    verified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

class CommunicationSettingsCreate(BaseModel):
    user_id: str
    email_notifications: bool = True
    sms_notifications: bool = False
    push_notifications: bool = True
    notification_types: List[str] = ["announcements", "grades", "attendance", "assignments", "fees"]
    quiet_hours_start: Optional[str] = None  # HH:MM format
    quiet_hours_end: Optional[str] = None    # HH:MM format
    language_preference: str = "en"

class CommunicationSettings(CommunicationSettingsCreate):
    id: str
    created_at: datetime
    updated_at: datetime

class MessageStats(BaseModel):
    message_id: str
    total_recipients: int
    delivered_count: int
    read_count: int
    acknowledged_count: int
    delivery_rate: float
    read_rate: float
    acknowledgment_rate: float