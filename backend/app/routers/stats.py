from fastapi import APIRouter, Depends
from typing import Any, Dict
from ..db import get_db

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard_stats(db = Depends(get_db)):
    """
    Get public dashboard statistics without requiring authentication
    """
    try:
        # Get basic counts from all collections
        branches_count = await db["branches"].count_documents({})
        students_count = await db["students"].count_documents({})
        classes_count = await db["classes"].count_documents({})
        grade_levels_count = await db["grade_levels"].count_documents({})
        subjects_count = await db["subjects"].count_documents({})
        payment_modes_count = await db["payment_mode"].count_documents({})
        
        # Get active students count
        active_students = await db["students"].count_documents({"status": "active"})
        
        # Get recent activity (last 10 items across collections)
        recent_students = await db["students"].find().sort([("created_at", -1)]).limit(5).to_list(5)
        recent_classes = await db["classes"].find().sort([("created_at", -1)]).limit(5).to_list(5)
        
        # Basic payment stats
        paid_fees = await db["fees"].count_documents({"status": "paid"})
        unpaid_fees = await db["fees"].count_documents({"status": "unpaid"})
        
        # Calculate total revenue (mock calculation)
        total_revenue = 0.0  # Would be calculated from actual payment records
        
        return {
            "success": True,
            "data": {
                "overview": {
                    "total_students": students_count,
                    "active_students": active_students,
                    "total_classes": classes_count,
                    "total_branches": branches_count,
                    "total_revenue": total_revenue
                },
                "academic": {
                    "grade_levels": grade_levels_count,
                    "subjects": subjects_count,
                    "classes": classes_count
                },
                "financial": {
                    "paid_fees": paid_fees,
                    "unpaid_fees": unpaid_fees,
                    "payment_completion_rate": (paid_fees / max(paid_fees + unpaid_fees, 1)) * 100
                },
                "system": {
                    "payment_modes": payment_modes_count,
                    "database_status": "connected"
                },
                "recent_activity": {
                    "recent_students": len(recent_students),
                    "recent_classes": len(recent_classes),
                    "total_recent": len(recent_students) + len(recent_classes)
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
                    "total_branches": 0,
                    "total_revenue": 0.0
                },
                "academic": {
                    "grade_levels": 0,
                    "subjects": 0,
                    "classes": 0
                },
                "financial": {
                    "paid_fees": 0,
                    "unpaid_fees": 0,
                    "payment_completion_rate": 0
                },
                "system": {
                    "payment_modes": 0,
                    "database_status": "error"
                },
                "recent_activity": {
                    "recent_students": 0,
                    "recent_classes": 0,
                    "total_recent": 0
                }
            }
        }