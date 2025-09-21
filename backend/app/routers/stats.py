from fastapi import APIRouter, Depends, Query
from typing import Any, Dict, Optional
from datetime import datetime, timedelta
from bson import ObjectId
from ..db import get_db
from ..utils.rbac import get_current_user
from ..models.user import User

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_stats(
    branch_id: Optional[str] = Query(None, description="Filter by branch ID"),
    current_user: User = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Get comprehensive dashboard statistics with optional branch filtering
    """
    try:
        # Build branch filter
        branch_filter = {}
        if branch_id and branch_id != 'all':
            branch_filter = {"branch_id": branch_id}
        
        # Get basic counts with branch filtering
        branches_count = await db["branches"].count_documents({})
        students_count = await db["students"].count_documents(branch_filter)
        classes_count = await db["classes"].count_documents(branch_filter)
        teachers_count = await db["teachers"].count_documents(branch_filter)
        grade_levels_count = await db["grade_levels"].count_documents({})
        subjects_count = await db["subjects"].count_documents({})
        payment_modes_count = await db["payment_mode"].count_documents({})
        
        # Get active students count
        active_students_filter = {**branch_filter, "status": "Active"}
        active_students = await db["students"].count_documents(active_students_filter)
        
        # Get student status breakdown
        pipeline = [
            {"$match": branch_filter} if branch_filter else {"$match": {}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}}
        ]
        status_breakdown = await db["students"].aggregate(pipeline).to_list(None)
        status_counts = {item["_id"]: item["count"] for item in status_breakdown}
        
        # Get grade level utilization
        grade_pipeline = [
            {"$match": branch_filter} if branch_filter else {"$match": {}},
            {"$group": {"_id": "$grade_level", "count": {"$sum": 1}}}
        ]
        grade_breakdown = await db["students"].aggregate(grade_pipeline).to_list(None)
        grade_utilization = [
            {
                "grade": item["_id"] or "Unknown",
                "enrolled": item["count"],
                "capacity": max(item["count"], 10),  # Default capacity
                "utilization": 100  # Simplified for now
            }
            for item in grade_breakdown
        ]
        
        # Get recent registrations (this month)
        this_month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        recent_registrations_filter = {
            **branch_filter,
            "created_at": {"$gte": this_month_start}
        }
        recent_registrations = await db["students"].count_documents(recent_registrations_filter)
        
        # Get payment statistics
        # Registration payments
        reg_payments_filter = branch_filter if branch_filter else {}
        reg_payments = await db["registration_payments"].find(reg_payments_filter).to_list(None)
        
        # Fees
        fees_filter = branch_filter if branch_filter else {}
        fees = await db["fees"].find(fees_filter).to_list(None)
        
        # Calculate payment stats
        total_revenue = 0
        paid_count = 0
        unpaid_count = 0
        pending_count = 0
        
        # Process registration payments
        for payment in reg_payments:
            total_revenue += payment.get("amount_paid", 0)
            status = payment.get("payment_status", "Unpaid")
            if status == "Paid":
                paid_count += 1
            elif status == "Unpaid":
                unpaid_count += 1
            elif status in ["Partial", "Pending"]:
                pending_count += 1
        
        # Process fees
        for fee in fees:
            if fee.get("status") == "paid":
                total_revenue += fee.get("amount", 0)
                paid_count += 1
            elif fee.get("status") == "unpaid":
                unpaid_count += 1
            elif fee.get("status") == "pending":
                pending_count += 1
        
        # Get recent activity
        recent_students = await db["students"].find(branch_filter).sort([("created_at", -1)]).limit(5).to_list(5)
        recent_classes = await db["classes"].find(branch_filter).sort([("created_at", -1)]).limit(5).to_list(5)
        recent_payments = await db["registration_payments"].find(branch_filter).sort([("created_at", -1)]).limit(5).to_list(5)
        
        # Calculate enrollment rate
        total_capacity = sum(grade["capacity"] for grade in grade_utilization)
        enrollment_rate = (students_count / total_capacity * 100) if total_capacity > 0 else 0
        
        # Get attendance stats for today
        today = datetime.now().date()
        today_attendance_filter = {
            **branch_filter,
            "attendance_date": {
                "$gte": datetime.combine(today, datetime.min.time()),
                "$lt": datetime.combine(today + timedelta(days=1), datetime.min.time())
            }
        }
        today_attendance = await db["attendance"].find(today_attendance_filter).to_list(None)
        # Count present/absent directly
        present_today = len([a for a in today_attendance if a.get("status") == "present"])
        explicit_absent_today = len([a for a in today_attendance if a.get("status") == "absent"])
        # Derive absent from active students if no explicit absent records exist
        # This helps when only presents are recorded and missing entries imply absence.
        if explicit_absent_today > 0:
            absent_today = explicit_absent_today
        else:
            absent_today = max(active_students - present_today, 0)
        
        return {
            "success": True,
            "data": {
                "overview": {
                    "total_students": students_count,
                    "active_students": active_students,
                    "total_classes": classes_count,
                    "total_teachers": teachers_count,
                    "total_branches": branches_count,
                    "total_revenue": total_revenue,
                    "enrollment_rate": enrollment_rate,
                    "recent_registrations": recent_registrations
                },
                "academic": {
                    "grade_levels": grade_levels_count,
                    "subjects": subjects_count,
                    "classes": classes_count,
                    "grade_utilization": grade_utilization,
                    "status_counts": status_counts
                },
                "financial": {
                    "paid_count": paid_count,
                    "unpaid_count": unpaid_count,
                    "pending_count": pending_count,
                    "total_revenue": total_revenue,
                    "payment_completion_rate": (paid_count / max(paid_count + unpaid_count + pending_count, 1)) * 100
                },
                "attendance": {
                    "present_today": present_today,
                    "absent_today": absent_today,
                    # Use active_students as denominator when available for a more stable rate
                    "attendance_rate": (present_today / max(active_students, 1)) * 100 if active_students > 0 else 0
                },
                "system": {
                    "payment_modes": payment_modes_count,
                    "database_status": "connected",
                    "branch_filter": branch_id
                },
                "recent_activity": {
                    "recent_students": len(recent_students),
                    "recent_classes": len(recent_classes),
                    "recent_payments": len(recent_payments),
                    "total_recent": len(recent_students) + len(recent_classes) + len(recent_payments)
                }
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to fetch dashboard stats: {str(e)}",
            "data": {
                "overview": {
                    "total_students": 0,
                    "active_students": 0,
                    "total_classes": 0,
                    "total_teachers": 0,
                    "total_branches": 0,
                    "total_revenue": 0.0,
                    "enrollment_rate": 0,
                    "recent_registrations": 0
                },
                "academic": {
                    "grade_levels": 0,
                    "subjects": 0,
                    "classes": 0,
                    "grade_utilization": [],
                    "status_counts": {}
                },
                "financial": {
                    "paid_count": 0,
                    "unpaid_count": 0,
                    "pending_count": 0,
                    "total_revenue": 0.0,
                    "payment_completion_rate": 0
                },
                "attendance": {
                    "present_today": 0,
                    "absent_today": 0,
                    "attendance_rate": 0
                },
                "system": {
                    "payment_modes": 0,
                    "database_status": "error",
                    "branch_filter": branch_id
                },
                "recent_activity": {
                    "recent_students": 0,
                    "recent_classes": 0,
                    "recent_payments": 0,
                    "total_recent": 0
                }
            }
        }
