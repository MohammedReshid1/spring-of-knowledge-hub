from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


class AssetCategory(str, Enum):
    FURNITURE = "furniture"
    ELECTRONICS = "electronics"
    BOOKS = "books"
    SPORTS_EQUIPMENT = "sports_equipment"
    LABORATORY = "laboratory"
    VEHICLES = "vehicles"
    OFFICE_SUPPLIES = "office_supplies"
    CLEANING_SUPPLIES = "cleaning_supplies"
    BUILDING_MAINTENANCE = "building_maintenance"
    TECHNOLOGY = "technology"
    TEACHING_MATERIALS = "teaching_materials"
    SAFETY_EQUIPMENT = "safety_equipment"
    KITCHEN_EQUIPMENT = "kitchen_equipment"
    OTHER = "other"


class AssetStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    UNDER_MAINTENANCE = "under_maintenance"
    DAMAGED = "damaged"
    LOST = "lost"
    DISPOSED = "disposed"
    ON_LOAN = "on_loan"
    RESERVED = "reserved"


class AssetCondition(str, Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    BROKEN = "broken"


class SupplyUnit(str, Enum):
    PIECES = "pieces"
    BOXES = "boxes"
    PACKS = "packs"
    BOTTLES = "bottles"
    KILOGRAMS = "kilograms"
    LITERS = "liters"
    METERS = "meters"
    SETS = "sets"


class MaintenanceType(str, Enum):
    PREVENTIVE = "preventive"
    CORRECTIVE = "corrective"
    EMERGENCY = "emergency"
    ROUTINE = "routine"


class MaintenanceStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class RequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    FULFILLED = "fulfilled"
    CANCELLED = "cancelled"


class Asset(BaseModel):
    id: Optional[str] = None
    asset_code: str = Field(..., description="Auto-generated unique asset code")
    name: str
    description: Optional[str] = None
    category: AssetCategory
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    
    # Financial Information
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    depreciation_rate: Optional[float] = None  # Annual percentage
    current_value: Optional[float] = None
    
    # Location and Assignment
    branch_id: Optional[str] = None
    location: Optional[str] = None  # Room, building, etc.
    assigned_to: Optional[str] = None  # User ID (can be teacher or student)
    assigned_to_name: Optional[str] = None
    assigned_to_type: Optional[str] = None  # "teacher", "student", "staff", "department"
    assigned_date: Optional[date] = None
    department_id: Optional[str] = None  # Department/subject assignment
    classroom_id: Optional[str] = None   # Classroom assignment
    
    # Status and Condition
    status: AssetStatus = AssetStatus.ACTIVE
    condition: AssetCondition = AssetCondition.GOOD
    condition_notes: Optional[str] = None
    
    # Specifications
    specifications: Dict[str, Any] = {}
    warranty_expiry: Optional[date] = None
    supplier: Optional[str] = None
    supplier_contact: Optional[str] = None
    
    # Documentation
    documents: List[str] = []  # File URLs
    photos: List[str] = []     # Image URLs
    manual_url: Optional[str] = None
    
    # Maintenance
    last_maintenance: Optional[date] = None
    next_maintenance: Optional[date] = None
    maintenance_frequency_days: Optional[int] = None
    maintenance_cost_total: float = 0.0
    
    # Usage Tracking
    usage_hours: Optional[int] = None
    usage_cycles: Optional[int] = None
    
    # Insurance
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[date] = None
    
    # Tags and Metadata
    tags: List[str] = []
    metadata: Dict[str, Any] = {}
    
    # Audit Trail
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AssetCreate(BaseModel):
    """Model for creating assets without auto-generated fields"""
    name: str
    description: Optional[str] = None
    category: AssetCategory
    brand: Optional[str] = None
    model: Optional[str] = None
    serial_number: Optional[str] = None
    
    # Financial Information
    purchase_price: Optional[float] = None
    purchase_date: Optional[date] = None
    depreciation_rate: Optional[float] = None
    current_value: Optional[float] = None
    
    # Location and Assignment
    branch_id: Optional[str] = None
    location: Optional[str] = None
    assigned_to: Optional[str] = None  # User ID (can be teacher or student)
    assigned_to_name: Optional[str] = None
    assigned_to_type: Optional[str] = None  # "teacher", "student", "staff", "department"
    assigned_date: Optional[date] = None
    department_id: Optional[str] = None  # Department/subject assignment
    classroom_id: Optional[str] = None   # Classroom assignment
    
    # Status and Condition
    status: AssetStatus = AssetStatus.ACTIVE
    condition: AssetCondition = AssetCondition.GOOD
    condition_notes: Optional[str] = None
    
    # Specifications
    specifications: Dict[str, Any] = {}
    warranty_expiry: Optional[date] = None
    supplier: Optional[str] = None
    supplier_contact: Optional[str] = None
    
    # Documentation
    documents: List[str] = []
    photos: List[str] = []
    manual_url: Optional[str] = None
    
    # Maintenance
    last_maintenance: Optional[date] = None
    next_maintenance: Optional[date] = None
    maintenance_frequency_days: Optional[int] = None
    maintenance_cost_total: float = 0.0
    
    # Usage Tracking
    usage_hours: Optional[int] = None
    usage_cycles: Optional[int] = None
    
    # Insurance
    insurance_policy: Optional[str] = None
    insurance_expiry: Optional[date] = None
    
    # Tags and Metadata
    tags: List[str] = []
    metadata: Dict[str, Any] = {}


class Supply(BaseModel):
    id: Optional[str] = None
    supply_code: str = Field(..., description="Auto-generated unique supply code")
    name: str
    description: Optional[str] = None
    category: AssetCategory
    
    # Inventory Details
    unit: SupplyUnit
    quantity_in_stock: int = 0
    minimum_stock_level: int = 0
    maximum_stock_level: Optional[int] = None
    reorder_point: int = 0
    
    # Financial Information
    unit_cost: Optional[float] = None
    total_value: Optional[float] = None
    
    # Location
    branch_id: Optional[str] = None
    storage_location: Optional[str] = None
    
    # Supplier Information
    supplier: Optional[str] = None
    supplier_contact: Optional[str] = None
    supplier_item_code: Optional[str] = None
    
    # Specifications
    specifications: Dict[str, Any] = {}
    expiry_date: Optional[date] = None
    batch_number: Optional[str] = None
    
    # Status
    is_active: bool = True
    last_counted: Optional[date] = None
    
    # Tags and Metadata
    tags: List[str] = []
    metadata: Dict[str, Any] = {}
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class SupplyCreate(BaseModel):
    """Model for creating supplies without auto-generated fields"""
    name: str
    description: Optional[str] = None
    category: AssetCategory
    
    # Inventory Details
    unit: SupplyUnit
    quantity_in_stock: int = 0
    minimum_stock_level: int = 0
    maximum_stock_level: Optional[int] = None
    reorder_point: int = 0
    
    # Financial Information
    unit_cost: Optional[float] = None
    total_value: Optional[float] = None
    
    # Location
    branch_id: Optional[str] = None
    storage_location: Optional[str] = None
    
    # Supplier Information
    supplier: Optional[str] = None
    supplier_contact: Optional[str] = None
    supplier_item_code: Optional[str] = None
    
    # Specifications
    specifications: Dict[str, Any] = {}
    expiry_date: Optional[date] = None
    batch_number: Optional[str] = None
    
    # Status
    is_active: bool = True
    last_counted: Optional[date] = None
    
    # Tags and Metadata
    tags: List[str] = []
    metadata: Dict[str, Any] = {}


class InventoryTransaction(BaseModel):
    id: Optional[str] = None
    transaction_code: str = Field(..., description="Auto-generated unique transaction code")
    
    # Transaction Details
    transaction_type: str  # in, out, transfer, adjustment, audit
    item_type: str  # asset, supply
    item_id: str
    item_name: str
    
    # Quantities
    quantity: int = 1  # For supplies; always 1 for assets
    unit_cost: Optional[float] = None
    total_cost: Optional[float] = None
    
    # Location Information
    from_location: Optional[str] = None
    to_location: Optional[str] = None
    branch_id: Optional[str] = None
    
    # References
    reference_type: Optional[str] = None  # purchase_order, maintenance_request, etc.
    reference_id: Optional[str] = None
    
    # Details
    reason: Optional[str] = None
    notes: Optional[str] = None
    
    # Approval
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Documentation
    documents: List[str] = []
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceRecord(BaseModel):
    id: Optional[str] = None
    maintenance_code: str = Field(..., description="Auto-generated unique maintenance code")
    asset_id: str
    asset_name: str
    branch_id: Optional[str] = None
    
    # Maintenance Details
    maintenance_type: MaintenanceType
    title: str
    description: Optional[str] = None
    
    # Scheduling
    scheduled_date: date
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED
    
    # Personnel
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    performed_by: Optional[str] = None
    performed_by_name: Optional[str] = None
    
    # Cost and Parts
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    total_cost: Optional[float] = None
    parts_used: List[Dict[str, Any]] = []  # {supply_id, quantity, cost}
    
    # Results
    work_performed: Optional[str] = None
    issues_found: Optional[str] = None
    recommendations: Optional[str] = None
    
    # Next Maintenance
    next_maintenance_date: Optional[date] = None
    maintenance_frequency_days: Optional[int] = None
    
    # Documentation
    before_photos: List[str] = []
    after_photos: List[str] = []
    documents: List[str] = []
    
    # Quality
    quality_rating: Optional[int] = None  # 1-5
    quality_notes: Optional[str] = None
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MaintenanceRecordCreate(BaseModel):
    """Model for creating maintenance records without auto-generated fields"""
    asset_id: str
    
    # Maintenance Details
    maintenance_type: MaintenanceType
    title: str
    description: Optional[str] = None
    
    # Scheduling
    scheduled_date: date
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED
    
    # Personnel
    assigned_to: Optional[str] = None
    assigned_to_name: Optional[str] = None
    performed_by: Optional[str] = None
    performed_by_name: Optional[str] = None
    
    # Cost and Parts
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    total_cost: Optional[float] = None
    parts_used: List[Dict[str, Any]] = []
    
    # Results
    work_performed: Optional[str] = None
    issues_found: Optional[str] = None
    recommendations: Optional[str] = None
    
    # Next Maintenance
    next_maintenance_date: Optional[date] = None
    maintenance_frequency_days: Optional[int] = None
    
    # Documentation
    before_photos: List[str] = []
    after_photos: List[str] = []
    documents: List[str] = []
    
    # Quality
    quality_rating: Optional[int] = None
    quality_notes: Optional[str] = None
    
    # Branch Association
    branch_id: Optional[str] = None


class InventoryRequest(BaseModel):
    id: Optional[str] = None
    request_code: str = Field(..., description="Auto-generated unique request code")
    
    # Request Details
    request_type: str  # asset_request, supply_request, maintenance_request
    title: str
    description: Optional[str] = None
    
    # Requester Information
    requested_by: str
    requested_by_name: str
    department: Optional[str] = None
    branch_id: Optional[str] = None
    
    # Items Requested
    items: List[Dict[str, Any]] = []  # {item_type, item_id, quantity, justification}
    
    # Scheduling
    requested_date: date
    required_by_date: Optional[date] = None
    
    # Approval Workflow
    status: RequestStatus = RequestStatus.PENDING
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    
    # Fulfillment
    fulfilled_by: Optional[str] = None
    fulfilled_by_name: Optional[str] = None
    fulfilled_at: Optional[datetime] = None
    fulfillment_notes: Optional[str] = None
    
    # Priority and Justification
    priority: str = "medium"  # low, medium, high, urgent
    justification: Optional[str] = None
    budget_code: Optional[str] = None
    estimated_cost: Optional[float] = None
    
    # Documentation
    documents: List[str] = []
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InventoryRequestCreate(BaseModel):
    """Model for creating inventory requests without auto-generated fields"""
    # Request Details
    request_type: str  # asset_request, supply_request, maintenance_request
    title: str
    description: Optional[str] = None
    
    # Items Requested
    items: List[Dict[str, Any]] = []  # {item_type, item_id, quantity, justification}
    
    # Scheduling
    required_by_date: Optional[date] = None
    
    # Priority and Justification
    priority: str = "medium"  # low, medium, high, urgent
    justification: Optional[str] = None
    budget_code: Optional[str] = None
    
    # Branch Association
    branch_id: Optional[str] = None
    estimated_cost: Optional[float] = None
    
    # Documentation
    documents: List[str] = []


class PurchaseOrder(BaseModel):
    id: Optional[str] = None
    po_number: str = Field(..., description="Auto-generated unique PO number")
    
    # Vendor Information
    vendor_name: str
    vendor_contact: Optional[str] = None
    vendor_email: Optional[str] = None
    vendor_phone: Optional[str] = None
    vendor_address: Optional[str] = None
    
    # Order Details
    order_date: date
    expected_delivery: Optional[date] = None
    delivery_address: Optional[str] = None
    branch_id: Optional[str] = None
    
    # Items
    items: List[Dict[str, Any]] = []  # {item_name, quantity, unit_cost, total_cost}
    
    # Financial
    subtotal: float = 0.0
    tax_amount: float = 0.0
    shipping_cost: float = 0.0
    total_amount: float = 0.0
    
    # Status
    status: str = "draft"  # draft, sent, confirmed, received, cancelled
    
    # Approval
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    
    # Delivery
    delivered_at: Optional[datetime] = None
    received_by: Optional[str] = None
    delivery_notes: Optional[str] = None
    
    # Terms and Conditions
    payment_terms: Optional[str] = None
    warranty_terms: Optional[str] = None
    special_instructions: Optional[str] = None
    
    # Documentation
    documents: List[str] = []
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InventoryAudit(BaseModel):
    id: Optional[str] = None
    audit_code: str = Field(..., description="Auto-generated unique audit code")
    
    # Audit Details
    title: str
    description: Optional[str] = None
    audit_type: str  # full, partial, cycle, spot
    
    # Scope
    branch_id: Optional[str] = None
    categories: List[AssetCategory] = []
    locations: List[str] = []
    
    # Schedule
    planned_start: date
    planned_end: date
    actual_start: Optional[date] = None
    actual_end: Optional[date] = None
    
    # Status
    status: str = "planned"  # planned, in_progress, completed, cancelled
    
    # Team
    audit_team: List[str] = []  # User IDs
    team_lead: Optional[str] = None
    team_lead_name: Optional[str] = None
    
    # Results
    items_planned: int = 0
    items_counted: int = 0
    discrepancies_found: int = 0
    
    # Summary
    total_value_book: Optional[float] = None
    total_value_actual: Optional[float] = None
    variance_amount: Optional[float] = None
    variance_percentage: Optional[float] = None
    
    # Documentation
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    action_items: List[str] = []
    
    # Reports
    report_generated: bool = False
    report_url: Optional[str] = None
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class InventoryAuditItem(BaseModel):
    id: Optional[str] = None
    audit_id: str
    
    # Item Information
    item_type: str  # asset, supply
    item_id: str
    item_name: str
    category: AssetCategory
    
    # Expected vs Actual
    book_quantity: int
    counted_quantity: int
    variance: int
    
    # Condition Assessment
    expected_condition: Optional[AssetCondition] = None
    actual_condition: Optional[AssetCondition] = None
    condition_notes: Optional[str] = None
    
    # Location
    expected_location: Optional[str] = None
    actual_location: Optional[str] = None
    
    # Financial
    unit_value: Optional[float] = None
    total_variance_value: Optional[float] = None
    
    # Status
    status: str = "pending"  # pending, counted, verified, discrepancy
    
    # Personnel
    counted_by: Optional[str] = None
    counted_by_name: Optional[str] = None
    verified_by: Optional[str] = None
    verified_by_name: Optional[str] = None
    
    # Documentation
    notes: Optional[str] = None
    photos: List[str] = []
    
    counted_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Vendor(BaseModel):
    id: Optional[str] = None
    vendor_code: str = Field(..., description="Auto-generated unique vendor code")
    
    # Basic Information
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "USA"
    
    # Business Information
    tax_id: Optional[str] = None
    business_license: Optional[str] = None
    
    # Categories and Specialties
    categories: List[AssetCategory] = []
    specialties: List[str] = []
    
    # Terms
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    minimum_order: Optional[float] = None
    
    # Performance Metrics
    rating: Optional[float] = None  # 1-5
    total_orders: int = 0
    total_amount: float = 0.0
    average_delivery_time: Optional[int] = None  # days
    
    # Status
    is_active: bool = True
    is_preferred: bool = False
    
    # Documentation
    documents: List[str] = []
    certifications: List[str] = []
    
    # Notes
    notes: Optional[str] = None
    
    created_by: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class VendorCreate(BaseModel):
    """Model for creating vendors without auto-generated fields"""
    # Basic Information
    name: str
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    
    # Address
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: str = "USA"
    
    # Business Information
    tax_id: Optional[str] = None
    business_license: Optional[str] = None
    
    # Categories and Specialties
    categories: List[AssetCategory] = []
    specialties: List[str] = []
    
    # Terms
    payment_terms: Optional[str] = None
    delivery_terms: Optional[str] = None
    minimum_order: Optional[float] = None
    
    # Performance Metrics
    rating: Optional[float] = None
    total_orders: int = 0
    total_amount: float = 0.0
    average_delivery_time: Optional[int] = None
    
    # Status
    is_active: bool = True
    is_preferred: bool = False
    
    # Documentation
    documents: List[str] = []
    certifications: List[str] = []
    
    # Notes
    notes: Optional[str] = None


class InventorySettings(BaseModel):
    id: Optional[str] = None
    organization_id: str
    
    # Code Generation
    asset_code_prefix: str = "AST"
    supply_code_prefix: str = "SUP"
    maintenance_code_prefix: str = "MNT"
    po_number_prefix: str = "PO"
    
    # Auto-numbering
    auto_generate_codes: bool = True
    next_asset_number: int = 1000
    next_supply_number: int = 1000
    next_maintenance_number: int = 1000
    next_po_number: int = 1000
    
    # Depreciation
    default_depreciation_rate: float = 10.0  # Annual percentage
    depreciation_method: str = "straight_line"
    
    # Maintenance
    default_maintenance_frequency: int = 365  # days
    maintenance_reminder_days: int = 30
    
    # Stock Levels
    low_stock_threshold_percentage: float = 20.0
    
    # Notifications
    notify_low_stock: bool = True
    notify_maintenance_due: bool = True
    notify_warranty_expiry: bool = True
    notify_insurance_expiry: bool = True
    
    # Audit
    mandatory_annual_audit: bool = True
    audit_variance_threshold: float = 5.0  # percentage
    
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
