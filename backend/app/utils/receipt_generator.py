from typing import Dict, List, Optional, Any
from datetime import datetime
from decimal import Decimal
import base64
import io
from pathlib import Path

try:
    from reportlab.lib.pagesizes import A4, letter
    from reportlab.lib.units import inch, mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
    from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
    from reportlab.pdfgen import canvas
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False

from ..models.payment_receipt import ReceiptTemplate


class ReceiptGeneratorError(Exception):
    """Custom exception for receipt generation errors"""
    pass


class PaymentReceiptGenerator:
    """Generate PDF receipts for payments"""

    def __init__(self):
        if not REPORTLAB_AVAILABLE:
            raise ReceiptGeneratorError(
                "ReportLab is required for PDF generation. Install with: pip install reportlab"
            )
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()

    def _setup_custom_styles(self):
        """Setup custom styles for receipt generation"""
        self.styles.add(ParagraphStyle(
            name='ReceiptTitle',
            parent=self.styles['Heading1'],
            alignment=TA_CENTER,
            fontSize=16,
            fontName='Helvetica-Bold',
            spaceAfter=20
        ))

        self.styles.add(ParagraphStyle(
            name='SchoolName',
            parent=self.styles['Normal'],
            alignment=TA_CENTER,
            fontSize=14,
            fontName='Helvetica-Bold',
            spaceAfter=5
        ))

        self.styles.add(ParagraphStyle(
            name='SchoolInfo',
            parent=self.styles['Normal'],
            alignment=TA_CENTER,
            fontSize=10,
            spaceAfter=10
        ))

        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Normal'],
            fontSize=12,
            fontName='Helvetica-Bold',
            spaceAfter=8
        ))

        self.styles.add(ParagraphStyle(
            name='ReceiptFooter',
            parent=self.styles['Normal'],
            alignment=TA_CENTER,
            fontSize=8,
            spaceAfter=5
        ))

    async def generate_receipt(
        self,
        payment_data: Dict[str, Any],
        payment_details: List[Dict[str, Any]],
        student_info: Dict[str, Any],
        branch_info: Dict[str, Any],
        template: Optional[ReceiptTemplate] = None
    ) -> bytes:
        """Generate PDF receipt for a payment"""

        # Debug data being passed to PDF generation
        print(f"📄 PDF Generation Debug:")
        print(f"📋 payment_data keys: {list(payment_data.keys())}")
        print(f"📋 payment_data receipt fields: receipt_no={payment_data.get('receipt_no')}, receipt_number={payment_data.get('receipt_number')}")
        print(f"👤 student_info keys: {list(student_info.keys())}")
        print(f"👤 student_info name fields: first_name={student_info.get('first_name')}, father_name={student_info.get('father_name')}, grandfather_name={student_info.get('grandfather_name')}")
        print(f"👤 student_info class fields: grade_level={student_info.get('grade_level')}, class_name={student_info.get('class_name')}, current_grade_level={student_info.get('current_grade_level')}")

        # Create PDF buffer
        buffer = io.BytesIO()

        # Determine page size
        page_size = A4
        if template and template.paper_size == "Letter":
            page_size = letter

        # Create document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=page_size,
            topMargin=template.margin_top * mm if template else 20 * mm,
            bottomMargin=template.margin_bottom * mm if template else 20 * mm,
            leftMargin=template.margin_left * mm if template else 15 * mm,
            rightMargin=template.margin_right * mm if template else 15 * mm
        )

        # Build content
        content = []

        # Header section
        if not template or template.show_logo:
            content.extend(self._build_header(branch_info, template))

        # Receipt title
        content.append(Paragraph("PAYMENT RECEIPT", self.styles['ReceiptTitle']))
        content.append(Spacer(1, 10))

        # Receipt info section
        content.extend(self._build_receipt_info(payment_data))
        content.append(Spacer(1, 15))

        # Student info section
        content.extend(self._build_student_info(student_info))
        content.append(Spacer(1, 15))

        # Payment details table
        if not template or template.show_fee_breakdown:
            content.extend(self._build_payment_details_table(payment_details, template))
            content.append(Spacer(1, 15))

        # Payment summary
        content.extend(self._build_payment_summary(payment_data, template))
        content.append(Spacer(1, 20))

        # Payment method details
        if not template or template.show_payment_method_details:
            content.extend(self._build_payment_method_details(payment_data))
            content.append(Spacer(1, 15))

        # Terms and conditions
        if not template or template.show_terms_conditions:
            content.extend(self._build_terms_and_conditions(template))

        # Signature section
        if not template or template.show_signature_line:
            content.extend(self._build_signature_section(template))

        # Footer
        content.extend(self._build_footer(template))

        # Build PDF
        doc.build(content)

        # Get PDF data
        buffer.seek(0)
        return buffer.getvalue()

    def _build_header(
        self,
        branch_info: Dict[str, Any],
        template: Optional[ReceiptTemplate]
    ) -> List[Any]:
        """Build header section"""
        content = []

        # School logo (if available)
        if template and template.logo_url:
            try:
                # This would load logo from URL or file path
                # For now, just add space
                content.append(Spacer(1, 30))
            except Exception:
                content.append(Spacer(1, 10))

        # School name
        school_name = branch_info.get("school_name", branch_info.get("name", "School Name"))
        content.append(Paragraph(school_name, self.styles['SchoolName']))

        # Branch info
        if template is None or template.show_branch_info:
            branch_name = branch_info.get("name", "")
            if branch_name != school_name:
                content.append(Paragraph(f"Branch: {branch_name}", self.styles['SchoolInfo']))

            if branch_info.get("address"):
                content.append(Paragraph(branch_info["address"], self.styles['SchoolInfo']))

            contact_info = []
            if branch_info.get("phone"):
                contact_info.append(f"Phone: {branch_info['phone']}")
            if branch_info.get("email"):
                contact_info.append(f"Email: {branch_info['email']}")

            if contact_info:
                content.append(Paragraph(" | ".join(contact_info), self.styles['SchoolInfo']))

        content.append(Spacer(1, 20))
        return content

    def _build_receipt_info(self, payment_data: Dict[str, Any]) -> List[Any]:
        """Build receipt information section"""
        content = []

        # Create receipt info table
        receipt_data = [
            ["Receipt No:", payment_data.get("receipt_number") or payment_data.get("receipt_no", "")],
            ["Date:", payment_data.get("payment_date", datetime.now()).strftime("%d/%m/%Y %H:%M")],
            ["Status:", payment_data.get("status", "").upper()]
        ]

        table = Table(receipt_data, colWidths=[2*inch, 3*inch])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        content.append(table)
        return content

    def _build_student_info(self, student_info: Dict[str, Any]) -> List[Any]:
        """Build student information section"""
        content = []

        content.append(Paragraph("STUDENT INFORMATION", self.styles['SectionHeader']))

        # Build full student name
        full_name_parts = [
            student_info.get("first_name", ""),
            student_info.get("father_name", ""),
            student_info.get("grandfather_name", "")
        ]
        full_name = " ".join(part for part in full_name_parts if part)

        # Get class/grade information - try multiple field names
        class_info = (
            student_info.get("current_class") or
            student_info.get("class_name") or
            student_info.get("current_grade_level") or
            student_info.get("grade_level", "")
        )

        student_data = [
            ["Student ID:", student_info.get("student_id", "")],
            ["Name:", full_name],
            ["Grade:", student_info.get("grade_level", "")],
            ["Class:", class_info]
        ]

        table = Table(student_data, colWidths=[2*inch, 3*inch])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        content.append(table)
        return content

    def _build_payment_details_table(
        self,
        payment_details: List[Dict[str, Any]],
        template: Optional[ReceiptTemplate]
    ) -> List[Any]:
        """Build payment details table"""
        content = []

        content.append(Paragraph("PAYMENT DETAILS", self.styles['SectionHeader']))

        # Table headers
        headers = ["Fee Category", "Qty", "Amount", "Discount", "Total"]
        if template and template.show_tax_details:
            headers.insert(-1, "Tax")

        # Table data
        table_data = [headers]

        for detail in payment_details:
            row = [
                detail.get("fee_category_name", ""),
                str(detail.get("quantity", 1)),
                f"{Decimal(str(detail.get('original_amount', 0))):,.2f}",
                f"{Decimal(str(detail.get('discount_amount', 0))):,.2f}",
            ]

            if template and template.show_tax_details:
                row.append(f"{Decimal(str(detail.get('tax_amount', 0))):,.2f}")

            row.append(f"{Decimal(str(detail.get('paid_amount', 0))):,.2f}")
            table_data.append(row)

        # Create table
        col_widths = [2.5*inch, 0.5*inch, inch, inch, inch]
        if template and template.show_tax_details:
            col_widths = [2*inch, 0.5*inch, 0.8*inch, 0.8*inch, 0.8*inch, inch]

        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), HexColor('#f0f0f0')),
            ('TEXTCOLOR', (0, 0), (-1, 0), black),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),  # Fee category left-aligned
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 0.5, black)
        ]))

        content.append(table)
        return content

    def _build_payment_summary(
        self,
        payment_data: Dict[str, Any],
        template: Optional[ReceiptTemplate]
    ) -> List[Any]:
        """Build payment summary section"""
        content = []

        # Summary data
        summary_data = []

        # Handle both old and new payment data structures
        discount = Decimal(str(payment_data.get("discount_amount", 0)))
        tax = Decimal(str(payment_data.get("tax_amount", 0)))
        late_fee = Decimal(str(payment_data.get("late_fee_amount", 0)))

        # Calculate totals properly
        if payment_data.get("subtotal") is not None:
            # Old payment structure - has subtotal and total_amount
            subtotal = Decimal(str(payment_data.get("subtotal")))
            total = Decimal(str(payment_data.get("total_amount", 0)))
        else:
            # New payment structure - only has amount (final total)
            # Calculate subtotal by adding discount back to the final amount
            total = Decimal(str(payment_data.get("amount", 0)))
            subtotal = total + discount  # Subtotal = Final amount + discount

        # Debug payment summary calculations
        print(f"💰 Payment Summary Debug:")
        print(f"💰 Raw values: subtotal_field={payment_data.get('subtotal')}, amount={payment_data.get('amount')}, total_amount={payment_data.get('total_amount')}")
        print(f"💰 Calculated: subtotal={subtotal}, discount={discount}, tax={tax}, late_fee={late_fee}, total={total}")

        summary_data.append(["Subtotal:", f"{subtotal:,.2f}"])

        if discount > 0:
            summary_data.append(["Discount:", f"({discount:,.2f})"])
            if payment_data.get("discount_reason"):
                summary_data.append(["Discount Reason:", payment_data["discount_reason"]])

        if template is None or template.show_tax_details:
            if tax > 0:
                summary_data.append(["Tax:", f"{tax:,.2f}"])

        if late_fee > 0:
            summary_data.append(["Late Fee:", f"{late_fee:,.2f}"])

        summary_data.append(["", ""])  # Separator line
        summary_data.append(["TOTAL PAID:", f"{total:,.2f}"])

        # Create table
        table = Table(summary_data, colWidths=[2*inch, 2*inch])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -2), 'Helvetica'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -2), 10),
            ('FONTSIZE', (0, -1), (-1, -1), 12),
            ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('LINEBELOW', (0, -2), (-1, -2), 1, black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        content.append(table)
        return content

    def _build_payment_method_details(self, payment_data: Dict[str, Any]) -> List[Any]:
        """Build payment method details section"""
        content = []

        content.append(Paragraph("PAYMENT METHOD", self.styles['SectionHeader']))

        method_data = [
            ["Payment Method:", payment_data.get("payment_method", "").title()]
        ]

        if payment_data.get("payment_reference"):
            method_data.append(["Reference:", payment_data["payment_reference"]])

        if payment_data.get("bank_name"):
            method_data.append(["Bank:", payment_data["bank_name"]])

        if payment_data.get("cheque_number"):
            method_data.append(["Cheque No:", payment_data["cheque_number"]])

        if payment_data.get("cheque_date"):
            method_data.append(["Cheque Date:", payment_data["cheque_date"].strftime("%d/%m/%Y")])

        table = Table(method_data, colWidths=[2*inch, 3*inch])
        table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (0, -1), 'LEFT'),
            ('ALIGN', (1, 0), (1, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))

        content.append(table)
        return content

    def _build_terms_and_conditions(self, template: Optional[ReceiptTemplate]) -> List[Any]:
        """Build terms and conditions section"""
        content = []

        content.append(Spacer(1, 10))
        content.append(Paragraph("TERMS & CONDITIONS", self.styles['SectionHeader']))

        terms = [
            "• This receipt is issued as proof of payment.",
            "• Payments are non-refundable unless otherwise stated in the refund policy.",
            "• Please keep this receipt for your records.",
            "• For any queries, please contact the school administration."
        ]

        if template and template.footer_text:
            terms.append(f"• {template.footer_text}")

        for term in terms:
            content.append(Paragraph(term, self.styles['Normal']))

        return content

    def _build_signature_section(self, template: Optional[ReceiptTemplate]) -> List[Any]:
        """Build signature section"""
        content = []

        content.append(Spacer(1, 30))

        # Signature lines
        labels = template.signature_labels if template else ["Cashier", "Parent/Guardian"]

        if len(labels) == 2:
            sig_data = [
                ["_" * 30, "", "_" * 30],
                [labels[0], "", labels[1]]
            ]

            table = Table(sig_data, colWidths=[2*inch, 1*inch, 2*inch])
            table.setStyle(TableStyle([
                ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 0), (-1, -1), 10),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))

            content.append(table)

        return content

    def _build_footer(self, template: Optional[ReceiptTemplate]) -> List[Any]:
        """Build footer section"""
        content = []

        content.append(Spacer(1, 20))

        footer_text = "Thank you for your payment!"
        if template and template.footer_text:
            footer_text = template.footer_text

        content.append(Paragraph(footer_text, self.styles['ReceiptFooter']))

        # Generation info
        gen_time = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        content.append(Paragraph(f"Generated on: {gen_time}", self.styles['ReceiptFooter']))

        return content

    async def generate_bulk_receipts(
        self,
        payments_data: List[Dict[str, Any]],
        template: Optional[ReceiptTemplate] = None
    ) -> bytes:
        """Generate bulk receipts as a single PDF"""

        # This would generate multiple receipts in one PDF file
        # For now, just generate the first receipt
        if payments_data:
            return await self.generate_receipt(
                payments_data[0]["payment"],
                payments_data[0]["details"],
                payments_data[0]["student"],
                payments_data[0]["branch"],
                template
            )

        return b""

    def generate_receipt_html(
        self,
        payment_data: Dict[str, Any],
        payment_details: List[Dict[str, Any]],
        student_info: Dict[str, Any],
        branch_info: Dict[str, Any],
        template: Optional[ReceiptTemplate] = None
    ) -> str:
        """Generate HTML version of receipt"""

        # Debug data being passed to HTML generation
        print(f"🎯 HTML Generation Debug:")
        print(f"📋 payment_data keys: {list(payment_data.keys())}")
        print(f"📋 payment_data receipt fields: receipt_no={payment_data.get('receipt_no')}, receipt_number={payment_data.get('receipt_number')}")
        print(f"👤 student_info keys: {list(student_info.keys())}")
        print(f"👤 student_info name fields: first_name={student_info.get('first_name')}, father_name={student_info.get('father_name')}, grandfather_name={student_info.get('grandfather_name')}")
        print(f"👤 student_info class fields: grade_level={student_info.get('grade_level')}, class_name={student_info.get('class_name')}, current_grade_level={student_info.get('current_grade_level')}")

        # This would generate an HTML version of the receipt
        # Useful for email or web display
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Payment Receipt</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ text-align: center; margin-bottom: 30px; }}
                .receipt-title {{ font-size: 18px; font-weight: bold; }}
                .section {{ margin-bottom: 20px; }}
                .section-header {{ font-weight: bold; margin-bottom: 10px; }}
                table {{ width: 100%; border-collapse: collapse; }}
                th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
                th {{ background-color: #f2f2f2; }}
                .total-row {{ font-weight: bold; }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="receipt-title">PAYMENT RECEIPT</div>
                <div>Receipt No: {payment_data.get('receipt_number') or payment_data.get('receipt_no', '')}</div>
            </div>

            <div class="section">
                <div class="section-header">Student Information</div>
                <p>Name: {student_info.get('first_name', '')} {student_info.get('father_name', '')} {student_info.get('grandfather_name', '')}</p>
                <p>Student ID: {student_info.get('student_id', '')}</p>
                <p>Class: {student_info.get('grade_level') or student_info.get('class_name') or student_info.get('current_grade_level', '')}</p>
            </div>

            <div class="section">
                <div class="section-header">Payment Details</div>
                <table>
                    <tr>
                        <th>Fee Category</th>
                        <th>Qty</th>
                        <th>Amount</th>
                        <th>Discount</th>
                        <th>Tax</th>
                        <th>Total</th>
                    </tr>
        """

        # Calculate totals from details
        subtotal = Decimal('0')
        total_discount = Decimal('0')
        total_tax = Decimal('0')
        total_paid = Decimal('0')

        for detail in payment_details:
            original_amount = Decimal(str(detail.get('original_amount', 0)))
            discount_amount = Decimal(str(detail.get('discount_amount', 0)))
            tax_amount = Decimal(str(detail.get('tax_amount', 0)))
            paid_amount = Decimal(str(detail.get('paid_amount', 0)))
            quantity = detail.get('quantity', 1)

            subtotal += original_amount
            total_discount += discount_amount
            total_tax += tax_amount
            total_paid += paid_amount

            html += f"""
                    <tr>
                        <td>{detail.get('fee_category_name', '')}</td>
                        <td>{quantity}</td>
                        <td>{original_amount:,.2f}</td>
                        <td>{discount_amount:,.2f}</td>
                        <td>{tax_amount:,.2f}</td>
                        <td>{paid_amount:,.2f}</td>
                    </tr>
            """

        # Use calculated totals or fallback to payment data
        final_subtotal = subtotal if subtotal > 0 else Decimal(str(payment_data.get('subtotal') or payment_data.get('amount', 0)))
        final_discount = total_discount if total_discount > 0 else Decimal(str(payment_data.get('discount_amount', 0)))
        final_total = total_paid if total_paid > 0 else Decimal(str(payment_data.get('amount') or payment_data.get('total_amount', 0)))

        html += f"""
                </table>
                <div style="margin-top: 10px; text-align: right;">
                    <p>Subtotal: {final_subtotal:,.2f}</p>
                    <p>Discount: ({final_discount:,.2f})</p>
                    <p style="font-weight: bold;">TOTAL PAID: {final_total:,.2f}</p>
                </div>
            </div>

            <div class="section">
                <p>Payment Method: {payment_data.get('payment_method', '').title()}</p>
                <p>Payment Date: {payment_data.get('payment_date', datetime.now()).strftime('%d/%m/%Y %H:%M')}</p>
            </div>
        </body>
        </html>
        """

        return html


# Helper function to create default receipt template
def create_default_receipt_template(branch_id: str) -> ReceiptTemplate:
    """Create a default receipt template"""
    return ReceiptTemplate(
        name="Default Receipt Template",
        description="Standard receipt template",
        paper_size="A4",
        orientation="portrait",
        margin_top=20,
        margin_bottom=20,
        margin_left=15,
        margin_right=15,
        show_logo=True,
        show_branch_info=True,
        show_student_photo=False,
        show_payment_method_details=True,
        show_fee_breakdown=True,
        show_tax_details=True,
        show_discount_details=True,
        show_terms_conditions=True,
        show_signature_line=True,
        signature_labels=["Cashier", "Parent/Guardian"],
        primary_color="#2563eb",
        secondary_color="#64748b",
        font_family="Arial, sans-serif",
        font_size_base=10,
        is_default=True,
        is_active=True,
        branch_id=branch_id
    )