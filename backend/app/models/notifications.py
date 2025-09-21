from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


class NotificationType(str, Enum):
    ANNOUNCEMENT = "announcement"
    EMERGENCY = "emergency"
    EVENT = "event"
    ACADEMIC = "academic"
    PAYMENT_REMINDER = "payment_reminder"
    ATTENDANCE_ALERT = "attendance_alert"
    EXAM_NOTIFICATION = "exam_notification"
    ASSIGNMENT_DUE = "assignment_due"
    DISCIPLINARY = "disciplinary"
    TRANSPORT = "transport"
    LIBRARY = "library"
    SYSTEM = "system"


class NotificationPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class NotificationChannel(str, Enum):
    IN_APP = "in_app"
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"
    WHATSAPP = "whatsapp"


class NotificationStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"
    CANCELLED = "cancelled"


class RecipientType(str, Enum):
    ALL_USERS = "all_users"
    STUDENTS = "students"
    PARENTS = "parents"
    TEACHERS = "teachers"
    ADMINS = "admins"
    BRANCH_USERS = "branch_users"
    CLASS_USERS = "class_users"
    CUSTOM = "custom"


class NotificationTemplate(BaseModel):
    id: Optional[str] = None
    template_code: str = Field(..., description="Auto-generated unique template code")
    name: str
    description: Optional[str] = None
    notification_type: NotificationType
    
    # Template Content
    title_template: str
    message_template: str
    variables: List[str] = []  # Available variables like {student_name}, {amount}
    
    # Default Settings
    default_priority: NotificationPriority = NotificationPriority.MEDIUM
    default_channels: List[NotificationChannel] = [NotificationChannel.IN_APP]
    
    # Customization
    icon: Optional[str] = None
    color: str = "#3B82F6"  # Default blue
    category: Optional[str] = None
    
    # Access Control
    created_by: str
    branch_access: List[str] = []  # Branches that can use this template
    is_system_template: bool = False
    
    # Status
    is_active: bool = True
    usage_count: int = 0
    last_used: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Notification(BaseModel):
    id: Optional[str] = None
    notification_code: str = Field(..., description="Auto-generated unique notification code")
    title: str
    message: str
    notification_type: NotificationType
    priority: NotificationPriority = NotificationPriority.MEDIUM
    
    # Sender Information
    sender_id: str
    sender_name: str
    sender_role: str
    branch_id: Optional[str] = None
    
    # Content and Media
    content: Optional[str] = None  # Rich text content
    attachments: List[str] = []  # File URLs
    action_url: Optional[str] = None  # Deep link or URL
    action_text: Optional[str] = None  # Button text
    
    # Targeting
    recipient_type: RecipientType
    target_users: List[str] = []  # Specific user IDs
    target_roles: List[str] = []  # Target roles
    target_branches: List[str] = []  # Target branches
    target_classes: List[str] = []  # Target classes
    target_grade_levels: List[str] = []  # Target grade levels
    
    # Delivery Settings
    channels: List[NotificationChannel] = [NotificationChannel.IN_APP]
    scheduled_for: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    
    # Template Reference
    template_id: Optional[str] = None
    template_variables: Dict[str, str] = {}
    
    # Status Tracking
    status: NotificationStatus = NotificationStatus.DRAFT
    sent_at: Optional[datetime] = None
    total_recipients: int = 0
    delivered_count: int = 0
    read_count: int = 0
    failed_count: int = 0
    
    # Metadata
    tags: List[str] = []
    metadata: Dict[str, Any] = {}
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationRecipient(BaseModel):
    id: Optional[str] = None
    notification_id: str
    user_id: str
    user_name: str
    user_role: str
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    
    # Delivery Status per Channel
    in_app_status: NotificationStatus = NotificationStatus.SENT
    email_status: Optional[NotificationStatus] = None
    sms_status: Optional[NotificationStatus] = None
    push_status: Optional[NotificationStatus] = None
    whatsapp_status: Optional[NotificationStatus] = None
    
    # Timestamps
    sent_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    
    # Interaction
    clicked: bool = False
    clicked_at: Optional[datetime] = None
    
    # Error Handling
    error_message: Optional[str] = None
    retry_count: int = 0
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationPreference(BaseModel):
    id: Optional[str] = None
    user_id: str
    
    # Channel Preferences
    email_enabled: bool = True
    sms_enabled: bool = True
    push_enabled: bool = True
    whatsapp_enabled: bool = False
    in_app_enabled: bool = True
    
    # Type Preferences
    announcements: bool = True
    emergency: bool = True
    events: bool = True
    academic: bool = True
    payment_reminders: bool = True
    attendance_alerts: bool = True
    exam_notifications: bool = True
    assignment_due: bool = True
    disciplinary: bool = True
    transport: bool = True
    library: bool = True
    system: bool = False
    
    # Time Preferences
    quiet_hours_start: Optional[str] = "22:00"  # 10 PM
    quiet_hours_end: Optional[str] = "07:00"    # 7 AM
    weekend_notifications: bool = False
    
    # Digest Settings
    daily_digest: bool = False
    weekly_digest: bool = False
    digest_time: str = "09:00"  # 9 AM
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationQueue(BaseModel):
    id: Optional[str] = None
    notification_id: str
    recipient_id: str
    channel: NotificationChannel
    priority: NotificationPriority
    
    # Content
    title: str
    message: str
    payload: Dict[str, Any] = {}
    
    # Scheduling
    scheduled_for: datetime
    attempts: int = 0
    max_attempts: int = 3
    
    # Status
    status: NotificationStatus = NotificationStatus.SCHEDULED
    error_message: Optional[str] = None
    
    # Processing
    processing_started_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationBatch(BaseModel):
    id: Optional[str] = None
    batch_code: str = Field(..., description="Auto-generated unique batch code")
    name: str
    description: Optional[str] = None
    
    # Batch Configuration
    notification_template_id: Optional[str] = None
    notification_type: NotificationType
    priority: NotificationPriority
    channels: List[NotificationChannel]
    
    # Recipients
    recipient_type: RecipientType
    recipient_count: int = 0
    
    # Processing Status
    status: str = "pending"  # pending, processing, completed, failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Results
    total_notifications: int = 0
    successful_deliveries: int = 0
    failed_deliveries: int = 0
    
    # Error Handling
    error_message: Optional[str] = None
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationCampaign(BaseModel):
    id: Optional[str] = None
    campaign_code: str = Field(..., description="Auto-generated unique campaign code")
    name: str
    description: Optional[str] = None
    
    # Campaign Configuration
    start_date: date
    end_date: Optional[date] = None
    target_audience: RecipientType
    
    # Content Strategy
    notifications: List[str] = []  # Notification IDs
    template_ids: List[str] = []   # Template IDs used
    
    # Analytics
    total_notifications_sent: int = 0
    total_recipients_reached: int = 0
    engagement_rate: float = 0.0
    click_through_rate: float = 0.0
    
    # Status
    status: str = "draft"  # draft, active, paused, completed
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None
    
    # Goals and KPIs
    target_reach: Optional[int] = None
    target_engagement: Optional[float] = None
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationAnalytics(BaseModel):
    id: Optional[str] = None
    notification_id: str
    
    # Delivery Metrics
    total_sent: int = 0
    total_delivered: int = 0
    total_read: int = 0
    total_clicked: int = 0
    total_failed: int = 0
    
    # Channel Performance
    channel_performance: Dict[str, Dict[str, int]] = {}
    
    # Time-based Analytics
    hourly_delivery: Dict[str, int] = {}
    daily_engagement: Dict[str, int] = {}
    
    # User Engagement
    engagement_by_role: Dict[str, float] = {}
    engagement_by_branch: Dict[str, float] = {}
    
    # Calculated Metrics
    delivery_rate: float = 0.0
    open_rate: float = 0.0
    click_rate: float = 0.0
    engagement_score: float = 0.0
    
    # Comparisons
    vs_previous_campaign: Optional[float] = None
    vs_average_performance: Optional[float] = None
    
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PushNotificationDevice(BaseModel):
    id: Optional[str] = None
    user_id: str
    device_token: str
    device_type: str  # ios, android, web
    device_name: Optional[str] = None
    
    # Status
    is_active: bool = True
    last_used: datetime = Field(default_factory=datetime.utcnow)
    
    # Metadata
    app_version: Optional[str] = None
    os_version: Optional[str] = None
    timezone: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NotificationSettings(BaseModel):
    id: Optional[str] = None
    organization_id: str
    
    # Provider Configurations
    email_provider: str = "smtp"  # smtp, sendgrid, mailgun
    sms_provider: str = "twilio"  # twilio, aws_sns
    push_provider: str = "firebase"  # firebase, apns
    
    # Rate Limiting
    max_notifications_per_hour: int = 1000
    max_notifications_per_user_per_hour: int = 10
    
    # Retry Settings
    max_retry_attempts: int = 3
    retry_delay_minutes: int = 5
    
    # Content Policies
    max_title_length: int = 100
    max_message_length: int = 500
    allow_html_content: bool = False
    content_moderation_enabled: bool = True
    
    # Scheduling
    timezone: str = "UTC"
    business_hours_start: str = "09:00"
    business_hours_end: str = "17:00"
    
    # Analytics
    analytics_retention_days: int = 90
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)