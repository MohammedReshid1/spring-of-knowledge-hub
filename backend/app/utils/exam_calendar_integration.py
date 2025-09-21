"""
Integration utilities for automatic calendar event generation from exam operations
"""
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from ..utils.calendar_events import calendar_event_generator

logger = logging.getLogger(__name__)

async def create_exam_calendar_events(exam_data: Dict[str, Any], current_user: Dict[str, Any] = None) -> bool:
    """
    Create calendar events when a new exam is created
    """
    try:
        # Prepare exam data for calendar generation
        calendar_data = {
            "id": str(exam_data.get("_id", exam_data.get("id"))),
            "name": exam_data.get("name"),
            "exam_type": exam_data.get("exam_type"),
            "total_marks": exam_data.get("total_marks"),
            "passing_marks": exam_data.get("passing_marks"),
            "exam_date": exam_data.get("exam_date"),
            "duration_minutes": exam_data.get("duration_minutes"),
            "instructions": exam_data.get("instructions", ""),
            "subject_id": exam_data.get("subject_id"),
            "class_id": exam_data.get("class_id"),
            "teacher_id": exam_data.get("teacher_id"),
            "academic_year": exam_data.get("academic_year"),
            "term": exam_data.get("term"),
            "branch_id": exam_data.get("branch_id"),
            "created_by": current_user.get("user_id") if current_user else None
        }
        
        # Generate calendar events
        events = await calendar_event_generator.generate_exam_events(calendar_data)
        
        logger.info(f"Generated {len(events)} calendar events for exam {exam_data.get('name')}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to create calendar events for exam: {str(e)}")
        return False

async def update_exam_calendar_events(exam_id: str, updated_data: Dict[str, Any]) -> bool:
    """
    Update calendar events when exam data changes
    """
    try:
        await calendar_event_generator.update_events_from_source("exam", exam_id, updated_data)
        logger.info(f"Updated calendar events for exam {exam_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to update calendar events for exam: {str(e)}")
        return False

async def delete_exam_calendar_events(exam_id: str) -> bool:
    """
    Delete calendar events when an exam is deleted
    """
    try:
        await calendar_event_generator.delete_events_from_source("exam", exam_id)
        logger.info(f"Deleted calendar events for exam {exam_id}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to delete calendar events for exam: {str(e)}")
        return False