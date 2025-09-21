"""
Integration utilities for automatic calendar event generation from attendance operations
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta

from ..utils.calendar_events import calendar_event_generator

logger = logging.getLogger(__name__)

async def create_attendance_calendar_events(attendance_data: Dict[str, Any], student_info: Dict[str, Any]) -> bool:
    """
    Create calendar events for attendance-related follow-ups and reminders
    """
    try:
        status = attendance_data.get('status')
        student_name = student_info.get('full_name', 'Student')
        attendance_date = attendance_data.get('attendance_date')
        
        # Create events based on attendance status
        if status == 'absent':
            # Create follow-up event for staff
            followup_data = {
                "id": f"attendance-absent-followup-{attendance_data.get('id')}",
                "title": f"Follow up on {student_name}'s absence",
                "description": f"Student {student_name} was absent on {attendance_date}. Follow up with parent/guardian and check for patterns.",
                "event_type": "attendance_followup",
                "start_date": (datetime.now() + timedelta(days=1)).isoformat(),
                "duration_minutes": 15,
                "target_audience": "staff",
                "visibility_roles": ["admin", "teacher", "principal"],
                "send_notifications": True,
                "priority": "medium",
                "metadata": {
                    "student_id": str(student_info.get('_id')),
                    "attendance_issue": "absence",
                    "original_date": attendance_date.isoformat() if isinstance(attendance_date, date) else attendance_date,
                    "class_id": attendance_data.get('class_id'),
                    "branch_id": attendance_data.get('branch_id')
                }
            }
            
            await calendar_event_generator.generate_general_events([followup_data])
            
        elif status in ['late', 'tardy']:
            # Create reminder for patterns if student has multiple late arrivals
            late_pattern_data = {
                "id": f"attendance-late-pattern-{attendance_data.get('id')}",
                "title": f"Monitor {student_name}'s punctuality pattern",
                "description": f"Student {student_name} arrived late on {attendance_date}. Monitor for patterns and consider parent meeting if continues.",
                "event_type": "attendance_monitoring",
                "start_date": (datetime.now() + timedelta(days=7)).isoformat(),
                "duration_minutes": 10,
                "target_audience": "staff",
                "visibility_roles": ["admin", "teacher", "principal"],
                "send_notifications": False,  # Low priority, no immediate notification
                "priority": "low",
                "metadata": {
                    "student_id": str(student_info.get('_id')),
                    "attendance_issue": "late_arrival",
                    "pattern_monitoring": True
                }
            }
            
            await calendar_event_generator.generate_general_events([late_pattern_data])
        
        logger.info(f"Created attendance calendar events for student {student_name} - {status}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create attendance calendar events: {str(e)}")
        return False

async def create_attendance_pattern_events(student_id: str, pattern_type: str, pattern_data: Dict[str, Any]) -> bool:
    """
    Create calendar events for attendance pattern interventions
    """
    try:
        from ..db import get_db
        db = get_db()
        
        # Get student information
        from bson import ObjectId
        student = await db.students.find_one({"_id": ObjectId(student_id)})
        if not student:
            logger.error(f"Student not found: {student_id}")
            return False
        
        student_name = student.get('full_name', 'Student')
        severity = pattern_data.get('severity', 'medium')
        
        # Create intervention event based on pattern type
        if pattern_type == 'consecutive_absence':
            consecutive_days = pattern_data.get('consecutive_days', 0)
            
            intervention_data = {
                "id": f"attendance-intervention-consecutive-{student_id}",
                "title": f"Urgent: {student_name} - {consecutive_days} consecutive absences",
                "description": f"Student {student_name} has been absent for {consecutive_days} consecutive days. Immediate intervention required - contact parents, check welfare, and arrange support.",
                "event_type": "attendance_intervention",
                "start_date": (datetime.now() + timedelta(hours=2)).isoformat(),  # Schedule soon
                "duration_minutes": 30,
                "target_audience": "staff",
                "visibility_roles": ["admin", "principal", "counselor"],
                "send_notifications": True,
                "priority": "high" if consecutive_days >= 5 else "medium",
                "metadata": {
                    "student_id": student_id,
                    "intervention_type": "consecutive_absence",
                    "severity": severity,
                    "consecutive_days": consecutive_days,
                    "requires_parent_contact": True,
                    "requires_welfare_check": consecutive_days >= 5
                }
            }
            
        elif pattern_type == 'low_attendance':
            attendance_percentage = pattern_data.get('percentage', 0)
            
            intervention_data = {
                "id": f"attendance-intervention-low-{student_id}",
                "title": f"Meeting Required: {student_name} - Low Attendance ({attendance_percentage:.1f}%)",
                "description": f"Student {student_name} has {attendance_percentage:.1f}% attendance rate. Schedule parent meeting to discuss attendance improvement plan.",
                "event_type": "attendance_meeting",
                "start_date": (datetime.now() + timedelta(days=3)).isoformat(),
                "duration_minutes": 45,
                "target_audience": "staff",
                "visibility_roles": ["admin", "principal", "counselor", "teacher"],
                "send_notifications": True,
                "priority": "high" if attendance_percentage < 75 else "medium",
                "metadata": {
                    "student_id": student_id,
                    "intervention_type": "low_attendance_meeting",
                    "attendance_percentage": attendance_percentage,
                    "requires_parent_meeting": True,
                    "improvement_plan_needed": True
                }
            }
            
        elif pattern_type == 'frequent_lateness':
            late_percentage = pattern_data.get('late_percentage', 0)
            
            intervention_data = {
                "id": f"attendance-intervention-lateness-{student_id}",
                "title": f"Punctuality Support: {student_name} - Frequent Late Arrivals",
                "description": f"Student {student_name} has been late {late_percentage:.1f}% of the time. Discuss punctuality strategies with family.",
                "event_type": "attendance_support",
                "start_date": (datetime.now() + timedelta(days=2)).isoformat(),
                "duration_minutes": 20,
                "target_audience": "staff",
                "visibility_roles": ["admin", "teacher", "counselor"],
                "send_notifications": True,
                "priority": "medium",
                "metadata": {
                    "student_id": student_id,
                    "intervention_type": "punctuality_support",
                    "late_percentage": late_percentage,
                    "requires_parent_discussion": True
                }
            }
        else:
            # Generic pattern intervention
            intervention_data = {
                "id": f"attendance-intervention-{pattern_type}-{student_id}",
                "title": f"Attendance Pattern Review: {student_name}",
                "description": f"Review attendance pattern for {student_name}: {pattern_type}",
                "event_type": "attendance_review",
                "start_date": (datetime.now() + timedelta(days=1)).isoformat(),
                "duration_minutes": 15,
                "target_audience": "staff",
                "visibility_roles": ["admin", "teacher"],
                "send_notifications": True,
                "priority": "low",
                "metadata": {
                    "student_id": student_id,
                    "pattern_type": pattern_type,
                    "pattern_data": pattern_data
                }
            }
        
        await calendar_event_generator.generate_general_events([intervention_data])
        
        logger.info(f"Created pattern intervention calendar event for {student_name} - {pattern_type}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create attendance pattern events: {str(e)}")
        return False

async def create_attendance_report_reminders(report_type: str, schedule_date: date, target_roles: list = None) -> bool:
    """
    Create calendar reminders for attendance report generation
    """
    try:
        if target_roles is None:
            target_roles = ["admin", "principal"]
        
        report_reminder_data = {
            "id": f"attendance-report-{report_type}-{schedule_date.isoformat()}",
            "title": f"Generate {report_type.replace('_', ' ').title()} Attendance Report",
            "description": f"Time to generate the {report_type} attendance report. Review attendance patterns, identify concerns, and prepare intervention strategies.",
            "event_type": "report_generation",
            "start_date": datetime.combine(schedule_date, datetime.min.time().replace(hour=9)).isoformat(),
            "duration_minutes": 60,
            "target_audience": "staff",
            "visibility_roles": target_roles,
            "send_notifications": True,
            "priority": "medium",
            "metadata": {
                "report_type": report_type,
                "automated_reminder": True,
                "recurring": True if report_type in ['weekly', 'monthly'] else False
            }
        }
        
        await calendar_event_generator.generate_general_events([report_reminder_data])
        
        logger.info(f"Created attendance report reminder for {report_type}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create attendance report reminder: {str(e)}")
        return False

async def schedule_attendance_improvement_followups(student_id: str, improvement_plan: Dict[str, Any]) -> bool:
    """
    Schedule follow-up events for attendance improvement plans
    """
    try:
        from ..db import get_db
        db = get_db()
        
        # Get student information
        from bson import ObjectId
        student = await db.students.find_one({"_id": ObjectId(student_id)})
        if not student:
            logger.error(f"Student not found: {student_id}")
            return False
        
        student_name = student.get('full_name', 'Student')
        plan_duration_weeks = improvement_plan.get('duration_weeks', 4)
        
        # Schedule weekly check-ins
        for week in range(1, plan_duration_weeks + 1):
            checkin_date = datetime.now() + timedelta(weeks=week)
            
            checkin_data = {
                "id": f"attendance-improvement-checkin-{student_id}-week-{week}",
                "title": f"Week {week} Attendance Check: {student_name}",
                "description": f"Review {student_name}'s attendance progress for week {week} of improvement plan. Check attendance rate, discuss challenges, and adjust support as needed.",
                "event_type": "attendance_checkin",
                "start_date": checkin_date.isoformat(),
                "duration_minutes": 20,
                "target_audience": "staff",
                "visibility_roles": ["admin", "counselor", "teacher"],
                "send_notifications": True,
                "priority": "medium",
                "metadata": {
                    "student_id": student_id,
                    "improvement_plan_id": improvement_plan.get('plan_id'),
                    "week_number": week,
                    "total_weeks": plan_duration_weeks,
                    "checkin_type": "progress_review"
                }
            }
            
            await calendar_event_generator.generate_general_events([checkin_data])
        
        # Schedule final evaluation
        final_eval_date = datetime.now() + timedelta(weeks=plan_duration_weeks + 1)
        final_eval_data = {
            "id": f"attendance-improvement-final-eval-{student_id}",
            "title": f"Final Attendance Evaluation: {student_name}",
            "description": f"Complete final evaluation of {student_name}'s attendance improvement plan. Assess overall progress, determine next steps, and celebrate successes.",
            "event_type": "attendance_evaluation",
            "start_date": final_eval_date.isoformat(),
            "duration_minutes": 45,
            "target_audience": "staff",
            "visibility_roles": ["admin", "principal", "counselor", "teacher"],
            "send_notifications": True,
            "priority": "high",
            "metadata": {
                "student_id": student_id,
                "improvement_plan_id": improvement_plan.get('plan_id'),
                "evaluation_type": "final_assessment",
                "requires_parent_meeting": True
            }
        }
        
        await calendar_event_generator.generate_general_events([final_eval_data])
        
        logger.info(f"Scheduled attendance improvement follow-ups for {student_name}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to schedule attendance improvement follow-ups: {str(e)}")
        return False

async def update_attendance_calendar_events(attendance_id: str, updated_data: Dict[str, Any]) -> bool:
    """
    Update calendar events when attendance data changes
    """
    try:
        await calendar_event_generator.update_events_from_source("attendance", attendance_id, updated_data)
        logger.info(f"Updated calendar events for attendance {attendance_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to update attendance calendar events: {str(e)}")
        return False

async def delete_attendance_calendar_events(attendance_id: str) -> bool:
    """
    Delete calendar events when attendance record is deleted or corrected
    """
    try:
        await calendar_event_generator.delete_events_from_source("attendance", attendance_id)
        logger.info(f"Deleted calendar events for attendance {attendance_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete attendance calendar events: {str(e)}")
        return False