"""
Invoice Generation and Management Service
Handles invoice creation, sending, and tracking
"""
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timedelta
from bson import ObjectId
from ..models.payment import (
    Invoice, InvoiceCreate, InvoiceUpdate, InvoiceStatus,
    InvoiceItemBase, FeeTemplate, FeeStructure,
    Currency, PaymentStatus
)
from ..utils.notification_engine import NotificationEngine
import asyncio
import secrets
from jinja2 import Template
try:
    import pdfkit  # For PDF generation
    PDFKIT_AVAILABLE = True
except ImportError:
    PDFKIT_AVAILABLE = False
    print("Warning: pdfkit not available. PDF generation will be disabled.")
import io
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication

class InvoiceService:
    """Service for invoice generation and management"""
    
    def __init__(self, db):
        self.db = db
        self.notification_engine = NotificationEngine()
    
    async def generate_invoice(
        self,
        student_id: str,
        fee_structure_ids: List[str],
        branch_id: str,
        user_id: str,
        custom_items: Optional[List[InvoiceItemBase]] = None,
        due_date: Optional[date] = None
    ) -> Invoice:
        """
        Generate an invoice for a student
        """
        try:
            # Get student information
            student = await self.db.students.find_one({
                "_id": ObjectId(student_id),
                "branch_id": branch_id
            })
            
            if not student:
                raise ValueError(f"Student {student_id} not found")
            
            # Generate invoice number
            invoice_number = self.generate_invoice_number(branch_id)
            
            # Prepare invoice items
            items = []
            subtotal = 0
            
            # Add items from fee structures
            for fee_structure_id in fee_structure_ids:
                fee_structure = await self.db.fee_structures.find_one({
                    "_id": ObjectId(fee_structure_id),
                    "student_id": student_id,
                    "branch_id": branch_id
                })
                
                if fee_structure:
                    # Get fee template for details
                    template = await self.db.fee_templates.find_one({
                        "_id": ObjectId(fee_structure["fee_template_id"])
                    })
                    
                    if template:
                        item = InvoiceItemBase(
                            description=template["name"],
                            fee_type=template["fee_type"],
                            quantity=1,
                            unit_price=fee_structure.get("total_amount", template["amount"]),
                            discount_amount=fee_structure.get("discount_amount", 0),
                            tax_amount=0,
                            total_amount=fee_structure.get("balance", fee_structure.get("total_amount"))
                        )
                        items.append(item)
                        subtotal += item.total_amount
            
            # Add custom items if provided
            if custom_items:
                for item in custom_items:
                    items.append(item)
                    subtotal += item.total_amount
            
            # Calculate totals
            discount_amount = sum(item.discount_amount for item in items)
            tax_amount = sum(item.tax_amount for item in items)
            total_amount = subtotal - discount_amount + tax_amount
            
            # Set due date
            if not due_date:
                due_date = datetime.now().date() + timedelta(days=30)  # Default 30 days
            
            # Prepare invoice data
            invoice_data = {
                "invoice_number": invoice_number,
                "student_id": student_id,
                "branch_id": branch_id,
                "invoice_date": datetime.now().date(),
                "due_date": due_date,
                "currency": Currency.USD,  # Default, should be configurable
                "items": [item.dict() for item in items],
                "subtotal": subtotal,
                "discount_amount": discount_amount,
                "tax_amount": tax_amount,
                "total_amount": total_amount,
                "paid_amount": 0,
                "balance": total_amount,
                "status": InvoiceStatus.DRAFT,
                "created_by": user_id,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "reminder_count": 0
            }
            
            # Add billing information
            parent = await self.db.parents.find_one({
                "_id": ObjectId(student.get("parent_guardian_id"))
            }) if student.get("parent_guardian_id") else None
            
            if parent:
                invoice_data.update({
                    "bill_to_name": parent.get("name", f"{student.get('first_name')} Guardian"),
                    "bill_to_email": parent.get("email"),
                    "bill_to_phone": parent.get("phone"),
                    "bill_to_address": parent.get("address")
                })
            else:
                invoice_data.update({
                    "bill_to_name": student.get("first_name"),
                    "bill_to_email": student.get("email"),
                    "bill_to_phone": student.get("phone"),
                    "bill_to_address": student.get("address")
                })
            
            # Insert invoice
            result = await self.db.invoices.insert_one(invoice_data)
            invoice_data["id"] = str(result.inserted_id)
            invoice_data["_id"] = result.inserted_id
            
            # Link invoice to fee structures
            if fee_structure_ids:
                await self.db.fee_structures.update_many(
                    {"_id": {"$in": [ObjectId(fid) for fid in fee_structure_ids]}},
                    {"$set": {"invoice_id": str(result.inserted_id)}}
                )
            
            return Invoice(**invoice_data)
            
        except Exception as e:
            raise
    
    async def send_invoice(
        self,
        invoice_id: str,
        branch_id: str,
        send_email: bool = True,
        send_sms: bool = False
    ) -> bool:
        """
        Send invoice to student/parent
        """
        try:
            # Get invoice
            invoice = await self.db.invoices.find_one({
                "_id": ObjectId(invoice_id),
                "branch_id": branch_id
            })
            
            if not invoice:
                return False
            
            # Update invoice status
            await self.db.invoices.update_one(
                {"_id": ObjectId(invoice_id)},
                {
                    "$set": {
                        "status": InvoiceStatus.SENT,
                        "sent_date": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                }
            )
            
            # Generate PDF
            pdf_content = await self.generate_invoice_pdf(invoice)
            
            # Send notifications
            if send_email and invoice.get("bill_to_email"):
                await self.send_invoice_email(
                    invoice.get("bill_to_email"),
                    invoice,
                    pdf_content
                )
            
            if send_sms and invoice.get("bill_to_phone"):
                await self.send_invoice_sms(
                    invoice.get("bill_to_phone"),
                    invoice
                )
            
            return True
            
        except Exception as e:
            raise
    
    async def send_payment_reminders(
        self,
        branch_id: str,
        days_before_due: int = 7
    ) -> Dict:
        """
        Send payment reminders for upcoming due invoices
        """
        reminder_date = datetime.now().date() + timedelta(days=days_before_due)
        
        # Find invoices due soon
        invoices = await self.db.invoices.find({
            "branch_id": branch_id,
            "status": {"$in": [InvoiceStatus.SENT, InvoiceStatus.VIEWED]},
            "due_date": {
                "$gte": datetime.now().date(),
                "$lte": reminder_date
            }
        }).to_list(length=None)
        
        results = {
            "reminders_sent": 0,
            "failed": []
        }
        
        for invoice in invoices:
            try:
                # Send reminder
                if invoice.get("bill_to_email"):
                    await self.send_reminder_email(invoice)
                
                # Update reminder count
                await self.db.invoices.update_one(
                    {"_id": invoice["_id"]},
                    {
                        "$inc": {"reminder_count": 1},
                        "$set": {
                            "last_reminder_date": datetime.utcnow()
                        }
                    }
                )
                
                results["reminders_sent"] += 1
                
            except Exception as e:
                results["failed"].append({
                    "invoice_number": invoice.get("invoice_number"),
                    "error": str(e)
                })
        
        return results
    
    async def mark_overdue_invoices(self, branch_id: str) -> int:
        """
        Mark overdue invoices
        """
        result = await self.db.invoices.update_many(
            {
                "branch_id": branch_id,
                "status": {"$in": [InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.PARTIALLY_PAID]},
                "due_date": {"$lt": datetime.now()}
            },
            {
                "$set": {
                    "status": InvoiceStatus.OVERDUE,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        return result.modified_count
    
    async def generate_batch_invoices(
        self,
        grade_level: str,
        fee_template_id: str,
        branch_id: str,
        user_id: str,
        academic_year: str
    ) -> Dict:
        """
        Generate invoices in batch for a grade level
        """
        results = {
            "generated": [],
            "failed": [],
            "total": 0
        }
        
        # Get all students in the grade level
        students = await self.db.students.find({
            "grade_level": grade_level,
            "branch_id": branch_id,
            "status": "Active"
        }).to_list(length=None)
        
        for student in students:
            try:
                # Check if fee structure exists
                fee_structure = await self.db.fee_structures.find_one({
                    "student_id": str(student["_id"]),
                    "fee_template_id": fee_template_id,
                    "academic_year": academic_year,
                    "branch_id": branch_id
                })
                
                if not fee_structure:
                    # Create fee structure first
                    template = await self.db.fee_templates.find_one({
                        "_id": ObjectId(fee_template_id)
                    })
                    
                    if template:
                        fee_structure_data = {
                            "student_id": str(student["_id"]),
                            "fee_template_id": fee_template_id,
                            "academic_year": academic_year,
                            "total_amount": template["amount"],
                            "paid_amount": 0,
                            "balance": template["amount"],
                            "status": PaymentStatus.PENDING,
                            "due_date": datetime.now().date() + timedelta(days=30),
                            "branch_id": branch_id,
                            "created_at": datetime.utcnow(),
                            "updated_at": datetime.utcnow()
                        }
                        
                        result = await self.db.fee_structures.insert_one(fee_structure_data)
                        fee_structure = fee_structure_data
                        fee_structure["_id"] = result.inserted_id
                
                if fee_structure:
                    # Generate invoice
                    invoice = await self.generate_invoice(
                        student_id=str(student["_id"]),
                        fee_structure_ids=[str(fee_structure["_id"])],
                        branch_id=branch_id,
                        user_id=user_id
                    )
                    
                    results["generated"].append(invoice.invoice_number)
                    results["total"] += 1
                    
            except Exception as e:
                results["failed"].append({
                    "student_id": str(student["_id"]),
                    "error": str(e)
                })
        
        return results
    
    async def generate_invoice_pdf(self, invoice: Dict) -> bytes:
        """
        Generate PDF for invoice
        """
        # HTML template for invoice
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; }
                .invoice-header { text-align: center; margin-bottom: 30px; }
                .invoice-details { margin-bottom: 20px; }
                .invoice-table { width: 100%; border-collapse: collapse; }
                .invoice-table th, .invoice-table td { 
                    border: 1px solid #ddd; 
                    padding: 8px; 
                    text-align: left; 
                }
                .invoice-table th { background-color: #f2f2f2; }
                .total-section { text-align: right; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="invoice-header">
                <h1>INVOICE</h1>
                <p>Invoice Number: {{ invoice.invoice_number }}</p>
                <p>Date: {{ invoice.invoice_date }}</p>
            </div>
            
            <div class="invoice-details">
                <h3>Bill To:</h3>
                <p>{{ invoice.bill_to_name }}</p>
                <p>{{ invoice.bill_to_address }}</p>
                <p>{{ invoice.bill_to_email }}</p>
                <p>{{ invoice.bill_to_phone }}</p>
            </div>
            
            <table class="invoice-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Discount</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    {% for item in invoice.items %}
                    <tr>
                        <td>{{ item.description }}</td>
                        <td>{{ item.quantity }}</td>
                        <td>{{ item.unit_price }}</td>
                        <td>{{ item.discount_amount }}</td>
                        <td>{{ item.total_amount }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
            
            <div class="total-section">
                <p>Subtotal: {{ invoice.currency }} {{ invoice.subtotal }}</p>
                <p>Discount: {{ invoice.currency }} {{ invoice.discount_amount }}</p>
                <p>Tax: {{ invoice.currency }} {{ invoice.tax_amount }}</p>
                <h3>Total: {{ invoice.currency }} {{ invoice.total_amount }}</h3>
                <p>Due Date: {{ invoice.due_date }}</p>
            </div>
        </body>
        </html>
        """
        
        template = Template(html_template)
        html_content = template.render(invoice=invoice)
        
        # Convert HTML to PDF (requires wkhtmltopdf installed)
        if PDFKIT_AVAILABLE:
            try:
                pdf = pdfkit.from_string(html_content, False)
                return pdf
            except:
                # Fallback to simple text representation
                return html_content.encode('utf-8')
        else:
            # PDF generation not available, return HTML as bytes
            return html_content.encode('utf-8')
    
    async def send_invoice_email(
        self,
        email: str,
        invoice: Dict,
        pdf_content: bytes
    ):
        """
        Send invoice via email
        """
        # This would integrate with your email service
        # For now, we'll create the structure
        subject = f"Invoice {invoice['invoice_number']} - Due {invoice['due_date']}"
        body = f"""
        Dear {invoice.get('bill_to_name', 'Customer')},
        
        Please find attached your invoice {invoice['invoice_number']}.
        
        Amount Due: {invoice['currency']} {invoice['total_amount']}
        Due Date: {invoice['due_date']}
        
        Thank you for your business.
        """
        
        # Create notification
        await self.notification_engine.send_notification(
            recipient_id=invoice['student_id'],
            notification_type="invoice",
            title=subject,
            message=body,
            data={
                "invoice_id": str(invoice['_id']),
                "invoice_number": invoice['invoice_number'],
                "amount": invoice['total_amount']
            }
        )
    
    async def send_invoice_sms(self, phone: str, invoice: Dict):
        """
        Send invoice notification via SMS
        """
        message = f"Invoice {invoice['invoice_number']} for {invoice['currency']} {invoice['total_amount']} is due on {invoice['due_date']}. Please make payment to avoid late fees."
        
        # This would integrate with your SMS service
        pass
    
    async def send_reminder_email(self, invoice: Dict):
        """
        Send payment reminder email
        """
        subject = f"Payment Reminder - Invoice {invoice['invoice_number']}"
        body = f"""
        This is a reminder that your invoice {invoice['invoice_number']} 
        for {invoice['currency']} {invoice['balance']} is due on {invoice['due_date']}.
        
        Please make payment to avoid late fees.
        """
        
        if invoice.get('bill_to_email'):
            # Send email
            pass
    
    def generate_invoice_number(self, branch_id: str) -> str:
        """Generate unique invoice number"""
        timestamp = datetime.utcnow().strftime("%Y%m")
        random_part = secrets.token_hex(3).upper()
        branch_code = branch_id[:4].upper() if len(branch_id) >= 4 else branch_id.upper()
        return f"INV-{branch_code}-{timestamp}-{random_part}"