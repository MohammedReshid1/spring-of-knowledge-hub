from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from typing import List, Optional, Dict, Any, Literal
from motor.motor_asyncio import AsyncIOMotorCollection
from bson import ObjectId
from datetime import datetime, date, timedelta
from decimal import Decimal
from bson.decimal128 import Decimal128
import io
import csv
import json
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors

from ..db import (
    get_payments_collection,
    get_payment_details_collection,
    get_students_collection,
    get_fee_categories_collection,
    get_classes_collection,
    get_branch_collection,
    validate_branch_id
)
from ..utils.rbac import get_current_user, has_permission, Permission

router = APIRouter()

def format_currency(amount: str) -> str:
    """Format currency amount to 2 decimal places"""
    try:
        # Convert to float and format to 2 decimal places
        return f"{float(amount):.2f}"
    except (ValueError, TypeError):
        return "0.00"

def format_timestamp(timestamp_str: str) -> str:
    """Format ISO timestamp to human readable format"""
    try:
        # Parse ISO timestamp and format it nicely
        dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        return dt.strftime("%B %d, %Y at %I:%M %p")
    except (ValueError, TypeError):
        return timestamp_str

async def get_branch_name(branch_id: str, branch_collection: AsyncIOMotorCollection) -> str:
    """Get branch name from branch ID, return 'All Branches' for 'all'"""
    if branch_id == "all":
        return "All Branches"

    try:
        branch = await branch_collection.find_one({"_id": ObjectId(branch_id)})
        if branch:
            return branch.get("name", "Unknown Branch")
        return "Unknown Branch"
    except:
        return "Unknown Branch"

def convert_decimal128_to_string(obj):
    """Recursively convert Decimal128 objects to strings in nested data structures"""
    if isinstance(obj, Decimal128):
        return str(Decimal(str(obj)))
    elif isinstance(obj, dict):
        return {k: convert_decimal128_to_string(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [convert_decimal128_to_string(item) for item in obj]
    else:
        return obj

def generate_pdf_report(title: str, data: Dict[str, Any], filename: str) -> StreamingResponse:
    """Generate a PDF report from data dictionary"""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    story = []

    # Get style sheet
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        alignment=1,  # Center alignment
        spaceAfter=30
    )

    # Add title
    story.append(Paragraph(title, title_style))
    story.append(Spacer(1, 20))

    # Add report metadata
    if 'branch_name' in data:
        story.append(Paragraph(f"<b>Branch:</b> {data['branch_name']}", styles['Normal']))
    elif 'branch_id' in data:
        story.append(Paragraph(f"<b>Branch ID:</b> {data['branch_id']}", styles['Normal']))
    if 'date_from' in data and 'date_to' in data:
        story.append(Paragraph(f"<b>Date Range:</b> {data['date_from']} to {data['date_to']}", styles['Normal']))
    if 'as_of_date' in data:
        story.append(Paragraph(f"<b>As of Date:</b> {data['as_of_date']}", styles['Normal']))
    if 'generated_at' in data:
        formatted_timestamp = format_timestamp(data['generated_at'])
        story.append(Paragraph(f"<b>Generated:</b> {formatted_timestamp}", styles['Normal']))

    story.append(Spacer(1, 20))

    # Add summary statistics if available
    if 'grand_total' in data:
        formatted_total = format_currency(data['grand_total'])
        story.append(Paragraph(f"<b>Grand Total:</b> ${formatted_total}", styles['Heading2']))
    if 'total_transactions' in data:
        story.append(Paragraph(f"<b>Total Transactions:</b> {data['total_transactions']}", styles['Normal']))

    story.append(Spacer(1, 20))

    # Add table data if available
    if 'daily_breakdown' in data and data['daily_breakdown']:
        table_data = [['Date', 'Amount', 'Transactions']]
        for item in data['daily_breakdown']:
            formatted_amount = format_currency(item.get('total_amount', '0'))
            table_data.append([
                item.get('date', ''),
                f"${formatted_amount}",
                str(item.get('transaction_count', 0))
            ])

        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)

    elif 'category_analysis' in data and data['category_analysis']:
        table_data = [['Category', 'Amount', 'Payments', 'Average']]
        for item in data['category_analysis']:
            formatted_total = format_currency(item.get('total_amount', '0'))
            formatted_avg = format_currency(item.get('average_payment', '0'))
            table_data.append([
                item.get('category_name', ''),
                f"${formatted_total}",
                str(item.get('payment_count', 0)),
                f"${formatted_avg}"
            ])

        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 14),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)

    elif 'students' in data and data['students']:
        # Handle outstanding fees report with students data
        table_data = [['Student ID', 'Student Name', 'Grade', 'Expected', 'Paid', 'Outstanding']]
        for student in data['students']:
            formatted_expected = format_currency(student.get('expected_fees', '0'))
            formatted_paid = format_currency(student.get('total_paid', '0'))
            formatted_outstanding = format_currency(student.get('outstanding_amount', '0'))
            table_data.append([
                student.get('student_id', ''),
                student.get('student_name', ''),
                student.get('grade_level', ''),
                f"${formatted_expected}",
                f"${formatted_paid}",
                f"${formatted_outstanding}"
            ])

        table = Table(table_data)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(table)

        # Add summary information
        if 'total_students' in data and 'total_outstanding' in data:
            story.append(Spacer(1, 20))
            story.append(Paragraph(f"<b>Total Students:</b> {data['total_students']}", styles['Normal']))
            formatted_outstanding = format_currency(data['total_outstanding'])
            story.append(Paragraph(f"<b>Total Outstanding:</b> ${formatted_outstanding}", styles['Normal']))

    elif 'summary' in data:
        # Handle payment summary report
        summary = data['summary']

        # Add summary statistics
        story.append(Paragraph("<b>Payment Summary</b>", styles['Heading2']))
        story.append(Spacer(1, 10))
        story.append(Paragraph(f"<b>Total Payments:</b> {summary.get('total_payments', 0)}", styles['Normal']))
        formatted_total = format_currency(summary.get('total_amount', '0'))
        formatted_discount = format_currency(summary.get('total_discount', '0'))
        formatted_average = format_currency(summary.get('average_payment', '0'))
        story.append(Paragraph(f"<b>Total Amount:</b> ${formatted_total}", styles['Normal']))
        story.append(Paragraph(f"<b>Total Discount:</b> ${formatted_discount}", styles['Normal']))
        story.append(Paragraph(f"<b>Average Payment:</b> ${formatted_average}", styles['Normal']))
        story.append(Spacer(1, 20))

        # Payment method breakdown table
        if 'payment_method_breakdown' in data and data['payment_method_breakdown']:
            story.append(Paragraph("<b>Payment Method Breakdown</b>", styles['Heading3']))
            story.append(Spacer(1, 10))

            method_table_data = [['Payment Method', 'Count', 'Amount']]
            for method in data['payment_method_breakdown']:
                formatted_amount = format_currency(method.get('amount', '0'))
                method_table_data.append([
                    method.get('method', '').title(),
                    str(method.get('count', 0)),
                    f"${formatted_amount}"
                ])

            method_table = Table(method_table_data)
            method_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(method_table)
            story.append(Spacer(1, 20))

        # Payment status breakdown table
        if 'status_breakdown' in data and data['status_breakdown']:
            story.append(Paragraph("<b>Payment Status Breakdown</b>", styles['Heading3']))
            story.append(Spacer(1, 10))

            status_table_data = [['Payment Status', 'Count', 'Amount']]
            for status in data['status_breakdown']:
                formatted_amount = format_currency(status.get('amount', '0'))
                status_table_data.append([
                    status.get('status', '').title(),
                    str(status.get('count', 0)),
                    f"${formatted_amount}"
                ])

            status_table = Table(status_table_data)
            status_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(status_table)

    # Build PDF
    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(
        io.BytesIO(buffer.getvalue()),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# Route mapping to match frontend expectations
@router.get("/daily_collection")
async def get_daily_collection_report_alt(
    branch_id: str,
    date_from: str = Query(..., description="Start date"),
    date_to: str = Query(..., description="End date"),
    format: Literal["json", "csv", "pdf"] = Query("json", description="Output format"),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    branch_collection: AsyncIOMotorCollection = Depends(get_branch_collection)
):
    """Get daily collection report (frontend compatible route)"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Parse date range
    try:
        start_date = datetime.fromisoformat(date_from).date()
        end_date = datetime.fromisoformat(date_to).date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Build query for date range
    start_of_range = datetime.combine(start_date, datetime.min.time())
    end_of_range = datetime.combine(end_date, datetime.max.time())

    # Build match criteria - exclude branch_id filter if "all" is specified
    match_criteria = {
        "payment_date": {"$gte": start_of_range, "$lte": end_of_range},
        "status": {"$nin": ["cancelled", "failed"]}
    }
    if branch_id != "all":
        match_criteria["branch_id"] = branch_id

    pipeline = [
        {
            "$match": match_criteria
        },
        {
            "$addFields": {
                "date_only": {
                    "$dateToString": {
                        "format": "%Y-%m-%d",
                        "date": "$payment_date"
                    }
                }
            }
        },
        {
            "$group": {
                "_id": {
                    "date": "$date_only",
                    "payment_method": "$payment_method"
                },
                "count": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$amount"}},
                "total_discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                "receipts": {"$push": "$receipt_number"}
            }
        },
        {
            "$group": {
                "_id": "$_id.date",
                "daily_total": {"$sum": "$total_amount"},
                "daily_count": {"$sum": "$count"},
                "payment_methods": {
                    "$push": {
                        "method": "$_id.payment_method",
                        "count": "$count",
                        "amount": "$total_amount",
                        "discount": "$total_discount",
                        "receipts": "$receipts"
                    }
                }
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]

    results = await payments_collection.aggregate(pipeline).to_list(None)

    # Calculate totals
    grand_total = Decimal("0")
    total_count = 0
    daily_breakdown = []

    for result in results:
        # Convert Decimal128 to Decimal for calculations
        daily_total = result["daily_total"]
        if isinstance(daily_total, Decimal128):
            daily_total = Decimal(str(daily_total))

        # Convert payment_methods Decimal128 values to strings
        payment_methods_raw = result.get("payment_methods", {})
        payment_methods = {}

        # Handle if payment_methods is a list of dicts instead of a dict
        if isinstance(payment_methods_raw, list):
            for item in payment_methods_raw:
                if isinstance(item, dict) and "_id" in item:
                    method = item["_id"]
                    amount = item.get("total", 0)
                    if isinstance(amount, Decimal128):
                        payment_methods[method] = str(Decimal(str(amount)))
                    else:
                        payment_methods[method] = str(amount)
        elif isinstance(payment_methods_raw, dict):
            for method, amount in payment_methods_raw.items():
                if isinstance(amount, Decimal128):
                    payment_methods[method] = str(Decimal(str(amount)))
                else:
                    payment_methods[method] = str(amount)
        else:
            # If it's neither list nor dict, convert to string representation
            payment_methods = convert_decimal128_to_string(payment_methods_raw)

        daily_breakdown.append({
            "date": result["_id"],
            "total_amount": str(daily_total),
            "transaction_count": result["daily_count"],
            "payment_methods": payment_methods
        })

        grand_total += daily_total
        total_count += result["daily_count"]

    # Get branch name for display
    branch_name = await get_branch_name(branch_id, branch_collection)

    report_data = {
        "branch_id": branch_id,
        "branch_name": branch_name,
        "date_from": date_from,
        "date_to": date_to,
        "total_transactions": total_count,
        "grand_total": str(grand_total),
        "daily_breakdown": daily_breakdown,
        "generated_at": datetime.now().isoformat()
    }

    # Convert all Decimal128 objects to strings to avoid serialization issues
    report_data = convert_decimal128_to_string(report_data)

    if format == "csv":
        # Convert to CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Write headers
        writer.writerow(["Daily Collection Report"])
        writer.writerow(["From Date", date_from])
        writer.writerow(["To Date", date_to])
        writer.writerow(["Branch ID", branch_id])
        writer.writerow(["Generated At", datetime.now().isoformat()])
        writer.writerow([])
        writer.writerow(["Date", "Total Amount", "Transaction Count"])

        # Write data
        for day in daily_breakdown:
            writer.writerow([
                day["date"],
                day["total_amount"],
                day["transaction_count"]
            ])

        writer.writerow([])
        writer.writerow(["Total Transactions", total_count])
        writer.writerow(["Grand Total", str(grand_total)])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=daily_collection_{date_from}_to_{date_to}.csv"
            }
        )

    elif format == "pdf":
        return generate_pdf_report(
            "Daily Collection Report",
            report_data,
            f"daily_collection_{date_from}_to_{date_to}.pdf"
        )

    return report_data

@router.get("/outstanding_fees")
async def get_outstanding_fees_report_alt(
    branch_id: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    fee_category_id: Optional[str] = None,
    grade_level: Optional[str] = None,
    format: Literal["json", "csv", "pdf"] = Query("json"),
    current_user: dict = Depends(get_current_user),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection),
    branch_collection: AsyncIOMotorCollection = Depends(get_branch_collection)
):
    """Get outstanding fees report (frontend compatible route)"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Use current date if no date range provided
    as_of_date = date.today()
    if date_to:
        try:
            as_of_date = datetime.fromisoformat(date_to).date()
        except:
            pass

    # Get all active students
    student_query = {"branch_id": branch_id, "status": "Active"}
    if grade_level and grade_level != "all":
        student_query["grade_level"] = grade_level

    students = await students_collection.find(student_query).to_list(None)

    # Helper function to calculate expected fees for a student
    async def calculate_expected_fees(student_grade_level: str, branch_id: str) -> Decimal:
        """Calculate the total expected fees for a student based on fee categories"""
        try:
            # Query fee categories for the branch
            fee_categories_query = {
                "branch_id": branch_id,
                "is_active": True
            }

            if fee_category_id and fee_category_id != "all":
                fee_categories_query["_id"] = ObjectId(fee_category_id)

            fee_categories = await fee_categories_collection.find(fee_categories_query).to_list(None)

            # Sum up the amounts from fee categories
            total_expected = Decimal("0")
            for category in fee_categories:
                amount = category.get("amount", 0)
                if isinstance(amount, (int, float, str)):
                    total_expected += Decimal(str(amount))
                elif hasattr(amount, "__str__"):  # Handle Decimal128
                    total_expected += Decimal(str(amount))

            # If no fee categories found or total is 0, use a reasonable default based on grade level
            if total_expected == 0:
                # Different default amounts based on grade level
                grade_defaults = {
                    "grade_1": Decimal("400"),
                    "grade_2": Decimal("450"),
                    "grade_3": Decimal("500"),
                    "grade_4": Decimal("550"),
                    "grade_5": Decimal("600"),
                    "grade_6": Decimal("650"),
                    "grade_7": Decimal("700"),
                    "grade_8": Decimal("750"),
                    "grade_9": Decimal("800"),
                    "grade_10": Decimal("850"),
                    "grade_11": Decimal("900"),
                    "grade_12": Decimal("950")
                }
                return grade_defaults.get(student_grade_level.lower(), Decimal("600"))

            return total_expected

        except Exception as e:
            print(f"Error calculating expected fees for grade {student_grade_level}: {e}")
            return Decimal("600")  # Safe fallback

    outstanding_report = []

    for student in students:
        # Get the MongoDB ObjectId as string - this is what payments are linked to
        student_object_id = str(student["_id"])
        # Also get the custom student_id for display
        student_display_id = student.get("student_id", student_object_id)

        # Get all payments made by this student
        # Payments are linked by MongoDB ObjectId, not custom student_id
        payment_query = {
            "student_id": student_object_id,
            "status": {"$nin": ["cancelled", "failed"]},
            "payment_date": {"$lte": datetime.combine(as_of_date, datetime.max.time())}
        }

        print(f"🔍 Outstanding fees: Looking for payments for student {student_display_id} with ObjectId {student_object_id}")
        print(f"🔍 Payment query: {payment_query}")

        payments = await payments_collection.find(payment_query).to_list(None)

        # Calculate total paid
        total_paid = sum(Decimal(str(p.get("amount", 0))) for p in payments)

        print(f"🔍 Found {len(payments)} payments for student {student_display_id}, total paid: ${total_paid}")

        # Calculate actual expected fees based on fee structures and categories
        student_grade = student.get("grade_level", "")
        expected_fees = await calculate_expected_fees(student_grade, branch_id)

        outstanding = expected_fees - total_paid

        if outstanding > 0:
            last_payment_date = None
            if payments:
                last_payment_date = max(p["payment_date"] for p in payments)

            outstanding_report.append({
                "student_id": student_display_id,
                "student_name": f"{student.get('first_name', '')} {student.get('father_name', '')}".strip(),
                "grade_level": student.get("grade_level", ""),
                "expected_fees": str(expected_fees),
                "total_paid": str(total_paid),
                "outstanding_amount": str(outstanding),
                "last_payment_date": last_payment_date.isoformat() if last_payment_date else None
            })

    # Sort by outstanding amount
    outstanding_report.sort(key=lambda x: Decimal(x["outstanding_amount"]), reverse=True)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Outstanding Fees Report"])
        writer.writerow(["As of Date", str(as_of_date)])
        writer.writerow(["Branch ID", branch_id])
        writer.writerow([])
        writer.writerow([
            "Student ID", "Student Name", "Grade Level", "Expected Fees",
            "Total Paid", "Outstanding Amount", "Last Payment Date"
        ])

        for record in outstanding_report:
            writer.writerow([
                record["student_id"],
                record["student_name"],
                record["grade_level"],
                record["expected_fees"],
                record["total_paid"],
                record["outstanding_amount"],
                record["last_payment_date"]
            ])

        writer.writerow([])
        writer.writerow([
            "Total Outstanding",
            sum(Decimal(r["outstanding_amount"]) for r in outstanding_report)
        ])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=outstanding_fees_{as_of_date}.csv"
            }
        )

    # Get branch name for display
    branch_name = await get_branch_name(branch_id, branch_collection)

    report_data = {
        "branch_id": branch_id,
        "branch_name": branch_name,
        "as_of_date": str(as_of_date),
        "total_students": len(outstanding_report),
        "total_outstanding": str(sum(Decimal(r["outstanding_amount"]) for r in outstanding_report)),
        "students": outstanding_report,
        "generated_at": datetime.now().isoformat()
    }

    if format == "pdf":
        return generate_pdf_report(
            "Outstanding Fees Report",
            report_data,
            f"outstanding_fees_{as_of_date}.pdf"
        )

    return report_data

@router.get("/payment_summary")
async def get_payment_summary_report(
    branch_id: str,
    date_from: str = Query(..., description="Start date"),
    date_to: str = Query(..., description="End date"),
    fee_category_id: Optional[str] = None,
    grade_level: Optional[str] = None,
    format: Literal["json", "csv", "pdf"] = Query("json"),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    branch_collection: AsyncIOMotorCollection = Depends(get_branch_collection)
):
    """Get payment summary report"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Parse date range
    try:
        start_date = datetime.fromisoformat(date_from)
        end_date = datetime.fromisoformat(date_to)
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Build base query
    base_query = {
        "branch_id": branch_id,
        "payment_date": {"$gte": start_date, "$lte": end_date},
        "status": {"$nin": ["cancelled", "failed"]}
    }

    # Summary statistics pipeline
    summary_pipeline = [
        {"$match": base_query},
        {
            "$group": {
                "_id": None,
                "total_payments": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$amount"}},
                "total_discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                "average_payment": {"$avg": {"$toDecimal": "$amount"}},
                "payment_methods": {"$addToSet": "$payment_method"},
                "statuses": {"$addToSet": "$status"}
            }
        }
    ]

    # Payment method breakdown
    method_pipeline = [
        {"$match": base_query},
        {
            "$group": {
                "_id": "$payment_method",
                "count": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$amount"}}
            }
        },
        {"$sort": {"total_amount": -1}}
    ]

    # Status breakdown
    status_pipeline = [
        {"$match": base_query},
        {
            "$group": {
                "_id": "$status",
                "count": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$amount"}}
            }
        }
    ]

    # Execute aggregations
    summary_result = await payments_collection.aggregate(summary_pipeline).to_list(None)
    method_results = await payments_collection.aggregate(method_pipeline).to_list(None)
    status_results = await payments_collection.aggregate(status_pipeline).to_list(None)

    # Process results
    summary = summary_result[0] if summary_result else {
        "total_payments": 0,
        "total_amount": Decimal("0"),
        "total_discount": Decimal("0"),
        "average_payment": Decimal("0")
    }

    # Get branch name for display
    branch_name = await get_branch_name(branch_id, branch_collection)

    report_data = {
        "branch_id": branch_id,
        "branch_name": branch_name,
        "date_from": date_from,
        "date_to": date_to,
        "summary": {
            "total_payments": summary["total_payments"],
            "total_amount": str(summary["total_amount"]),
            "total_discount": str(summary.get("total_discount", 0)),
            "average_payment": str(summary.get("average_payment", 0))
        },
        "payment_method_breakdown": [
            {
                "method": result["_id"],
                "count": result["count"],
                "amount": str(result["total_amount"])
            }
            for result in method_results
        ],
        "status_breakdown": [
            {
                "status": result["_id"],
                "count": result["count"],
                "amount": str(result["total_amount"])
            }
            for result in status_results
        ],
        "generated_at": datetime.now().isoformat()
    }

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Payment Summary Report"])
        writer.writerow(["From Date", date_from])
        writer.writerow(["To Date", date_to])
        writer.writerow(["Branch ID", branch_id])
        writer.writerow([])

        writer.writerow(["Summary"])
        writer.writerow(["Total Payments", summary["total_payments"]])
        writer.writerow(["Total Amount", str(summary["total_amount"])])
        writer.writerow(["Average Payment", str(summary.get("average_payment", 0))])
        writer.writerow([])

        writer.writerow(["Payment Method Breakdown"])
        writer.writerow(["Method", "Count", "Amount"])
        for method in report_data["payment_method_breakdown"]:
            writer.writerow([method["method"], method["count"], method["amount"]])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=payment_summary_{date_from}_to_{date_to}.csv"
            }
        )

    elif format == "pdf":
        return generate_pdf_report(
            "Payment Summary Report",
            report_data,
            f"payment_summary_{date_from}_to_{date_to}.pdf"
        )

    return report_data

@router.get("/fee_category_analysis")
async def get_fee_category_analysis_report(
    branch_id: str,
    date_from: str = Query(..., description="Start date"),
    date_to: str = Query(..., description="End date"),
    fee_category_id: Optional[str] = None,
    grade_level: Optional[str] = None,
    format: Literal["json", "csv", "pdf"] = Query("json"),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection),
    branch_collection: AsyncIOMotorCollection = Depends(get_branch_collection)
):
    """Get fee category analysis report"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Parse date range
    try:
        start_date = datetime.fromisoformat(date_from)
        end_date = datetime.fromisoformat(date_to)
    except:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # Build query
    base_query = {
        "branch_id": branch_id,
        "payment_date": {"$gte": start_date, "$lte": end_date},
        "status": {"$nin": ["cancelled", "failed"]}
    }

    if fee_category_id and fee_category_id != "all":
        base_query["category"] = fee_category_id

    # Category analysis pipeline
    pipeline = [
        {"$match": base_query},
        {
            "$group": {
                "_id": "$category",
                "payment_count": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$amount"}},
                "total_discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                "average_payment": {"$avg": {"$toDecimal": "$amount"}},
                "min_payment": {"$min": {"$toDecimal": "$amount"}},
                "max_payment": {"$max": {"$toDecimal": "$amount"}}
            }
        },
        {"$sort": {"total_amount": -1}}
    ]

    results = await payments_collection.aggregate(pipeline).to_list(None)

    # Get fee category names
    fee_categories = {}
    if results:
        category_ids = [r["_id"] for r in results if r["_id"]]
        # Filter valid ObjectIds and handle string category names
        valid_object_ids = []
        for cat_id in category_ids:
            if cat_id and isinstance(cat_id, str):
                try:
                    valid_object_ids.append(ObjectId(cat_id))
                except Exception:
                    # Skip invalid ObjectIds (likely string category names)
                    pass

        fee_docs = await fee_categories_collection.find({
            "_id": {"$in": valid_object_ids},
            "branch_id": branch_id
        }).to_list(None)
        fee_categories = {str(doc["_id"]): doc.get("name", "Unknown") for doc in fee_docs}

    # Process results
    category_analysis = []
    grand_total = Decimal("0")
    total_payments = 0

    for result in results:
        category_name = fee_categories.get(result["_id"], result["_id"] or "Uncategorized")

        analysis = {
            "category_id": result["_id"],
            "category_name": category_name,
            "payment_count": result["payment_count"],
            "total_amount": str(result["total_amount"]),
            "total_discount": str(result.get("total_discount", 0)),
            "average_payment": str(result["average_payment"]),
            "min_payment": str(result["min_payment"]),
            "max_payment": str(result["max_payment"])
        }

        category_analysis.append(analysis)
        total_amount = result["total_amount"]
        if isinstance(total_amount, Decimal128):
            total_amount = Decimal(str(total_amount))
        grand_total += total_amount
        total_payments += result["payment_count"]

    # Get branch name for display
    branch_name = await get_branch_name(branch_id, branch_collection)

    report_data = {
        "branch_id": branch_id,
        "branch_name": branch_name,
        "date_from": date_from,
        "date_to": date_to,
        "total_payments": total_payments,
        "grand_total": str(grand_total),
        "category_analysis": category_analysis,
        "generated_at": datetime.now().isoformat()
    }

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Fee Category Analysis Report"])
        writer.writerow(["From Date", date_from])
        writer.writerow(["To Date", date_to])
        writer.writerow(["Branch ID", branch_id])
        writer.writerow([])

        writer.writerow([
            "Category", "Payment Count", "Total Amount", "Average Payment",
            "Min Payment", "Max Payment"
        ])

        for analysis in category_analysis:
            writer.writerow([
                analysis["category_name"],
                analysis["payment_count"],
                analysis["total_amount"],
                analysis["average_payment"],
                analysis["min_payment"],
                analysis["max_payment"]
            ])

        writer.writerow([])
        writer.writerow(["Total Payments", total_payments])
        writer.writerow(["Grand Total", str(grand_total)])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=fee_category_analysis_{date_from}_to_{date_to}.csv"
            }
        )

    elif format == "pdf":
        return generate_pdf_report(
            "Fee Category Analysis Report",
            report_data,
            f"fee_category_analysis_{date_from}_to_{date_to}.pdf"
        )

    return report_data

@router.get("/daily-collection")
async def get_daily_collection_report(
    branch_id: str,
    report_date: date = Query(..., description="Date for the report"),
    format: Literal["json", "csv"] = Query("json", description="Output format"),
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection)
):
    """Get daily collection report"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Build query for the specific date
    start_of_day = datetime.combine(report_date, datetime.min.time())
    end_of_day = datetime.combine(report_date, datetime.max.time())

    pipeline = [
        {
            "$match": {
                "branch_id": branch_id,
                "payment_date": {"$gte": start_of_day, "$lte": end_of_day},
                "status": {"$nin": ["cancelled", "failed"]}
            }
        },
        {
            "$group": {
                "_id": "$payment_method",
                "count": {"$sum": 1},
                "total_amount": {"$sum": {"$toDecimal": "$total_amount"}},
                "total_discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                "total_tax": {"$sum": {"$toDecimal": "$tax_amount"}},
                "receipts": {"$push": "$receipt_no"}
            }
        },
        {
            "$sort": {"_id": 1}
        }
    ]

    results = await payments_collection.aggregate(pipeline).to_list(None)

    # Calculate totals
    grand_total = Decimal("0")
    total_count = 0
    method_breakdown = []

    for result in results:
        method_breakdown.append({
            "payment_method": result["_id"],
            "count": result["count"],
            "amount": str(result["total_amount"]),
            "discount": str(result["total_discount"]),
            "tax": str(result["total_tax"]),
            "receipts": result["receipts"]
        })
        total_amount = result["total_amount"]
        if isinstance(total_amount, Decimal128):
            total_amount = Decimal(str(total_amount))
        grand_total += total_amount
        total_count += result["count"]

    report_data = {
        "branch_id": branch_id,
        "report_date": str(report_date),
        "total_transactions": total_count,
        "grand_total": str(grand_total),
        "payment_methods": method_breakdown,
        "generated_at": datetime.now().isoformat()
    }

    if format == "csv":
        # Convert to CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Write headers
        writer.writerow(["Daily Collection Report"])
        writer.writerow(["Date", str(report_date)])
        writer.writerow(["Branch ID", branch_id])
        writer.writerow(["Generated At", datetime.now().isoformat()])
        writer.writerow([])
        writer.writerow(["Payment Method", "Count", "Amount", "Discount", "Tax"])

        # Write data
        for method in method_breakdown:
            writer.writerow([
                method["payment_method"],
                method["count"],
                method["amount"],
                method["discount"],
                method["tax"]
            ])

        writer.writerow([])
        writer.writerow(["Total Transactions", total_count])
        writer.writerow(["Grand Total", str(grand_total)])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=daily_collection_{report_date}.csv"
            }
        )

    return report_data

@router.get("/outstanding-fees")
async def get_outstanding_fees_report(
    branch_id: str,
    grade_level_id: Optional[str] = None,
    class_id: Optional[str] = None,
    as_of_date: date = Query(default_factory=date.today),
    format: Literal["json", "csv"] = Query("json"),
    current_user: dict = Depends(get_current_user),
    students_collection: AsyncIOMotorCollection = Depends(get_students_collection),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    fee_categories_collection: AsyncIOMotorCollection = Depends(get_fee_categories_collection)
):
    """Get outstanding fees report"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Get all active students
    student_query = {"branch_id": branch_id, "status": "Active"}
    if grade_level_id:
        student_query["grade_level"] = grade_level_id
    if class_id:
        student_query["class_id"] = class_id

    students = await students_collection.find(student_query).to_list(None)

    # Get all mandatory fees for the current academic year
    fee_categories = await fee_categories_collection.find({
        "branch_id": branch_id,
        "fee_type": {"$in": ["mandatory", "recurring"]},
        "is_active": True
    }).to_list(None)

    outstanding_report = []

    for student in students:
        student_id = student.get("student_id") or str(student["_id"])

        # Get all payments made by this student
        payments = await payments_collection.find({
            "student_id": student_id,
            "status": {"$nin": ["cancelled", "failed"]},
            "payment_date": {"$lte": datetime.combine(as_of_date, datetime.max.time())}
        }).to_list(None)

        # Calculate total paid
        total_paid = sum(Decimal(str(p.get("total_amount", 0))) for p in payments)

        # Calculate total fees due
        applicable_fees = [
            f for f in fee_categories
            if not f.get("grade_level_id") or f.get("grade_level_id") == student.get("grade_level")
        ]

        total_due = sum(Decimal(str(f.get("amount", 0))) for f in applicable_fees)

        # Calculate outstanding
        outstanding = total_due - total_paid

        if outstanding > 0:
            outstanding_report.append({
                "student_id": student_id,
                "student_name": student.get("first_name", ""),
                "grade_level": student.get("grade_level", ""),
                "class_id": student.get("class_id", ""),
                "total_due": str(total_due),
                "total_paid": str(total_paid),
                "outstanding_amount": str(outstanding),
                "last_payment_date": max(
                    (p["payment_date"] for p in payments),
                    default=None
                )
            })

    # Sort by outstanding amount
    outstanding_report.sort(key=lambda x: Decimal(x["outstanding_amount"]), reverse=True)

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow(["Outstanding Fees Report"])
        writer.writerow(["As of Date", str(as_of_date)])
        writer.writerow(["Branch ID", branch_id])
        writer.writerow([])
        writer.writerow([
            "Student ID", "Student Name", "Grade Level", "Class ID",
            "Total Due", "Total Paid", "Outstanding Amount", "Last Payment Date"
        ])

        for record in outstanding_report:
            writer.writerow([
                record["student_id"],
                record["student_name"],
                record["grade_level"],
                record["class_id"],
                record["total_due"],
                record["total_paid"],
                record["outstanding_amount"],
                record["last_payment_date"]
            ])

        writer.writerow([])
        writer.writerow([
            "Total Outstanding",
            sum(Decimal(r["outstanding_amount"]) for r in outstanding_report)
        ])

        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode()),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename=outstanding_fees_{as_of_date}.csv"
            }
        )

    return {
        "branch_id": branch_id,
        "as_of_date": str(as_of_date),
        "total_students": len(outstanding_report),
        "total_outstanding": str(sum(Decimal(r["outstanding_amount"]) for r in outstanding_report)),
        "students": outstanding_report,
        "generated_at": datetime.now().isoformat()
    }

@router.get("/fee-collection-summary")
async def get_fee_collection_summary(
    branch_id: str,
    from_date: date,
    to_date: date,
    group_by: Literal["day", "month", "fee_category", "grade_level"] = "month",
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection)
):
    """Get fee collection summary report"""
    if not has_permission(current_user.get("role"), Permission.VIEW_REPORTS):
        raise HTTPException(status_code=403, detail="Permission denied")
    await validate_branch_id(branch_id)

    # Build date range query
    date_query = {
        "payment_date": {
            "$gte": datetime.combine(from_date, datetime.min.time()),
            "$lte": datetime.combine(to_date, datetime.max.time())
        }
    }

    if group_by == "day":
        # Group by day
        pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    **date_query,
                    "status": {"$nin": ["cancelled", "failed"]}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m-%d",
                            "date": "$payment_date"
                        }
                    },
                    "count": {"$sum": 1},
                    "total": {"$sum": {"$toDecimal": "$total_amount"}},
                    "discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                    "tax": {"$sum": {"$toDecimal": "$tax_amount"}}
                }
            },
            {"$sort": {"_id": 1}}
        ]
    elif group_by == "month":
        # Group by month
        pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    **date_query,
                    "status": {"$nin": ["cancelled", "failed"]}
                }
            },
            {
                "$group": {
                    "_id": {
                        "$dateToString": {
                            "format": "%Y-%m",
                            "date": "$payment_date"
                        }
                    },
                    "count": {"$sum": 1},
                    "total": {"$sum": {"$toDecimal": "$total_amount"}},
                    "discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                    "tax": {"$sum": {"$toDecimal": "$tax_amount"}}
                }
            },
            {"$sort": {"_id": 1}}
        ]
    elif group_by == "fee_category":
        # Group by fee category - requires joining with payment details
        pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    **date_query,
                    "status": {"$nin": ["cancelled", "failed"]}
                }
            },
            {
                "$lookup": {
                    "from": "payment_details",
                    "localField": "_id",
                    "foreignField": "payment_id",
                    "as": "details"
                }
            },
            {"$unwind": "$details"},
            {
                "$group": {
                    "_id": "$details.fee_category_name",
                    "count": {"$sum": 1},
                    "total": {"$sum": {"$toDecimal": "$details.paid_amount"}},
                    "discount": {"$sum": {"$toDecimal": "$details.discount_amount"}},
                    "tax": {"$sum": {"$toDecimal": "$details.tax_amount"}}
                }
            },
            {"$sort": {"total": -1}}
        ]
    else:
        # Group by grade level - requires joining with students
        pipeline = [
            {
                "$match": {
                    "branch_id": branch_id,
                    **date_query,
                    "status": {"$nin": ["cancelled", "failed"]}
                }
            },
            {
                "$lookup": {
                    "from": "students",
                    "localField": "student_id",
                    "foreignField": "student_id",
                    "as": "student_info"
                }
            },
            {"$unwind": "$student_info"},
            {
                "$group": {
                    "_id": "$student_info.grade_level",
                    "count": {"$sum": 1},
                    "total": {"$sum": {"$toDecimal": "$total_amount"}},
                    "discount": {"$sum": {"$toDecimal": "$discount_amount"}},
                    "tax": {"$sum": {"$toDecimal": "$tax_amount"}}
                }
            },
            {"$sort": {"_id": 1}}
        ]

    results = await payments_collection.aggregate(pipeline).to_list(None)

    # Format results
    summary = []
    grand_total = Decimal("0")

    for result in results:
        summary.append({
            "period": result["_id"],
            "transaction_count": result["count"],
            "total_collected": str(result["total"]),
            "total_discount": str(result.get("discount", 0)),
            "total_tax": str(result.get("tax", 0))
        })
        total = result["total"]
        if isinstance(total, Decimal128):
            total = Decimal(str(total))
        grand_total += total

    return {
        "branch_id": branch_id,
        "from_date": str(from_date),
        "to_date": str(to_date),
        "group_by": group_by,
        "grand_total": str(grand_total),
        "summary": summary,
        "generated_at": datetime.now().isoformat()
    }

@router.get("/student-payment-history/{student_id}")
async def get_student_payment_history(
    student_id: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: dict = Depends(get_current_user),
    payments_collection: AsyncIOMotorCollection = Depends(get_payments_collection),
    payment_details_collection: AsyncIOMotorCollection = Depends(get_payment_details_collection)
):
    """Get detailed payment history for a specific student"""
    if not has_permission(current_user.get("role"), Permission.READ_PAYMENT):
        raise HTTPException(status_code=403, detail="Permission denied")

    # Build query
    query = {"student_id": student_id}

    if from_date or to_date:
        date_filter = {}
        if from_date:
            date_filter["$gte"] = datetime.combine(from_date, datetime.min.time())
        if to_date:
            date_filter["$lte"] = datetime.combine(to_date, datetime.max.time())
        query["payment_date"] = date_filter

    # Get payments
    payments = await payments_collection.find(query).sort("payment_date", -1).to_list(None)

    # Get details for each payment
    payment_history = []
    total_paid = Decimal("0")
    total_discount = Decimal("0")

    for payment in payments:
        payment_id = str(payment["_id"])

        # Get payment details
        details = await payment_details_collection.find({"payment_id": payment_id}).to_list(None)

        payment_history.append({
            "payment_id": payment_id,
            "receipt_no": payment["receipt_no"],
            "payment_date": payment["payment_date"],
            "payment_method": payment["payment_method"],
            "status": payment["status"],
            "total_amount": str(payment.get("total_amount", 0)),
            "discount_amount": str(payment.get("discount_amount", 0)),
            "fee_items": [
                {
                    "fee_category": d.get("fee_category_name"),
                    "amount": str(d.get("paid_amount", 0))
                }
                for d in details
            ]
        })

        if payment["status"] not in ["cancelled", "failed"]:
            total_paid += Decimal(str(payment.get("total_amount", 0)))
            total_discount += Decimal(str(payment.get("discount_amount", 0)))

    return {
        "student_id": student_id,
        "total_payments": len(payment_history),
        "total_paid": str(total_paid),
        "total_discount": str(total_discount),
        "payment_history": payment_history,
        "generated_at": datetime.now().isoformat()
    }