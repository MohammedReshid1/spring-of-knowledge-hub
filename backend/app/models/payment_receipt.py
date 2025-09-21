from pydantic import BaseModel, Field
from typing import Optional, Literal, List, Dict, Any
from datetime import datetime
from decimal import Decimal

class ReceiptTemplate(BaseModel):
    """Template configuration for receipt generation"""
    name: str = Field(..., description="Template name")
    arabic_name: Optional[str] = Field(None, description="Arabic template name")
    description: Optional[str] = Field(None, description="Template description")

    # Layout configuration
    paper_size: Literal["A4", "Letter", "A5"] = Field(default="A4", description="Paper size")
    orientation: Literal["portrait", "landscape"] = Field(default="portrait", description="Page orientation")
    margin_top: int = Field(default=20, description="Top margin in mm")
    margin_bottom: int = Field(default=20, description="Bottom margin in mm")
    margin_left: int = Field(default=15, description="Left margin in mm")
    margin_right: int = Field(default=15, description="Right margin in mm")

    # Header configuration
    show_logo: bool = Field(default=True, description="Show school logo")
    logo_url: Optional[str] = Field(None, description="Logo URL")
    header_text: Optional[str] = Field(None, description="Custom header text")
    header_text_arabic: Optional[str] = Field(None, description="Arabic header text")
    show_branch_info: bool = Field(default=True, description="Show branch information")

    # Content configuration
    show_student_photo: bool = Field(default=False, description="Include student photo")
    show_payment_method_details: bool = Field(default=True, description="Show payment method details")
    show_fee_breakdown: bool = Field(default=True, description="Show detailed fee breakdown")
    show_tax_details: bool = Field(default=True, description="Show tax calculation details")
    show_discount_details: bool = Field(default=True, description="Show discount details")
    show_terms_conditions: bool = Field(default=True, description="Include terms and conditions")

    # Footer configuration
    footer_text: Optional[str] = Field(None, description="Custom footer text")
    footer_text_arabic: Optional[str] = Field(None, description="Arabic footer text")
    show_signature_line: bool = Field(default=True, description="Include signature line")
    signature_labels: List[str] = Field(default=["Cashier", "Parent/Guardian"], description="Signature line labels")

    # Styling
    primary_color: str = Field(default="#2563eb", description="Primary color (hex)")
    secondary_color: str = Field(default="#64748b", description="Secondary color (hex)")
    font_family: str = Field(default="Arial, sans-serif", description="Font family")
    font_size_base: int = Field(default=10, description="Base font size in pt")

    # Custom fields
    custom_fields: Optional[Dict[str, Any]] = Field(None, description="Additional custom fields")

    is_default: bool = Field(default=False, description="Default template for receipts")
    is_active: bool = Field(default=True, description="Template is active")
    branch_id: str = Field(..., description="Branch identifier")

class PaymentReceiptBase(BaseModel):
    payment_id: str = Field(..., description="Reference to payment document")
    receipt_number: str = Field(..., description="Receipt number (same as payment receipt_no)")
    template_id: Optional[str] = Field(None, description="Template used for generation")

    # Generation metadata
    generated_at: datetime = Field(default_factory=datetime.now, description="When receipt was generated")
    generated_by: str = Field(..., description="User who generated the receipt")
    generation_type: Literal["manual", "automatic", "reprint"] = Field(
        default="manual",
        description="How receipt was generated"
    )

    # File information
    file_url: Optional[str] = Field(None, description="URL to generated PDF file")
    file_size: Optional[int] = Field(None, description="File size in bytes")
    file_hash: Optional[str] = Field(None, description="File hash for verification")

    # Email/SMS delivery
    sent_via_email: bool = Field(default=False, description="Receipt sent via email")
    email_sent_to: Optional[List[str]] = Field(None, description="Email addresses receipt was sent to")
    email_sent_at: Optional[datetime] = Field(None, description="When email was sent")

    sent_via_sms: bool = Field(default=False, description="Receipt notification sent via SMS")
    sms_sent_to: Optional[List[str]] = Field(None, description="Phone numbers SMS was sent to")
    sms_sent_at: Optional[datetime] = Field(None, description="When SMS was sent")

    # WhatsApp delivery
    sent_via_whatsapp: bool = Field(default=False, description="Receipt sent via WhatsApp")
    whatsapp_sent_to: Optional[List[str]] = Field(None, description="WhatsApp numbers")
    whatsapp_sent_at: Optional[datetime] = Field(None, description="When WhatsApp message was sent")

    # Print tracking
    print_count: int = Field(default=0, description="Number of times printed")
    last_printed_at: Optional[datetime] = Field(None, description="Last print timestamp")
    last_printed_by: Optional[str] = Field(None, description="User who last printed")

    # Download tracking
    download_count: int = Field(default=0, description="Number of times downloaded")
    last_downloaded_at: Optional[datetime] = Field(None, description="Last download timestamp")
    last_downloaded_by: Optional[str] = Field(None, description="User who last downloaded")

    # Status
    status: Literal["draft", "final", "cancelled", "archived"] = Field(
        default="final",
        description="Receipt status"
    )
    cancellation_reason: Optional[str] = Field(None, description="Reason for cancellation")
    cancelled_by: Optional[str] = Field(None, description="User who cancelled")
    cancelled_at: Optional[datetime] = Field(None, description="Cancellation timestamp")

    # Additional metadata
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional receipt metadata")
    branch_id: str = Field(..., description="Branch identifier for data isolation")

class PaymentReceiptCreate(PaymentReceiptBase):
    pass

class PaymentReceipt(PaymentReceiptBase):
    id: str = Field(..., alias="_id")
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        populate_by_name = True

class PaymentReceiptUpdate(BaseModel):
    status: Optional[Literal["draft", "final", "cancelled", "archived"]] = None
    file_url: Optional[str] = None
    sent_via_email: Optional[bool] = None
    sent_via_sms: Optional[bool] = None
    sent_via_whatsapp: Optional[bool] = None
    metadata: Optional[Dict[str, Any]] = None

class ReceiptGenerationRequest(BaseModel):
    """Request to generate a receipt"""
    payment_id: str = Field(..., description="Payment ID to generate receipt for")
    template_id: Optional[str] = Field(None, description="Template to use (uses default if not specified)")
    language: Literal["en", "ar", "bilingual"] = Field(default="en", description="Receipt language")
    format: Literal["pdf", "html", "png"] = Field(default="pdf", description="Output format")
    send_email: bool = Field(default=False, description="Send receipt via email")
    email_addresses: Optional[List[str]] = Field(None, description="Email addresses to send to")
    send_sms: bool = Field(default=False, description="Send SMS notification")
    phone_numbers: Optional[List[str]] = Field(None, description="Phone numbers for SMS")
    send_whatsapp: bool = Field(default=False, description="Send via WhatsApp")
    whatsapp_numbers: Optional[List[str]] = Field(None, description="WhatsApp numbers")

class BulkReceiptGenerationRequest(BaseModel):
    """Request to generate multiple receipts"""
    payment_ids: List[str] = Field(..., description="List of payment IDs")
    template_id: Optional[str] = Field(None, description="Template to use for all receipts")
    language: Literal["en", "ar", "bilingual"] = Field(default="en", description="Receipt language")
    format: Literal["pdf", "html", "png"] = Field(default="pdf", description="Output format")
    combine_pdf: bool = Field(default=False, description="Combine all receipts into one PDF")
    send_notifications: bool = Field(default=False, description="Send notifications to parents")