from typing import List, Dict, Any, Optional
from datetime import datetime, date, timedelta, time
import logging
from bson import ObjectId
from app.models.academic_calendar import AcademicEventCreate, AcademicEvent
from ..db import get_db

logger = logging.getLogger(__name__)

class CalendarEventGenerator:
    """Handles automatic generation of calendar events from other modules"""
    
    def __init__(self):
        self.db = get_db()
        
    async def generate_exam_events(self, exam_data: Dict[str, Any]) -> List[AcademicEvent]:
        """Generate calendar events for exam scheduling"""
        events = []
        
        try:
            # Main exam event
            exam_event = AcademicEventCreate(
                title=f"Exam: {exam_data.get('name', 'Unknown Exam')}",
                description=f"{exam_data.get('exam_type', 'Exam')} - {exam_data.get('total_marks', 0)} marks",
                event_type="exam",
                start_date=datetime.fromisoformat(exam_data['exam_date']) if exam_data.get('exam_date') else datetime.now(),
                end_date=None,
                is_all_day=False,
                academic_year_id=exam_data.get('academic_year', ''),
                term_id=exam_data.get('term', ''),
                class_ids=[exam_data.get('class_id')] if exam_data.get('class_id') else [],
                branch_id=exam_data.get('branch_id'),
                color="#ff9800",  # Orange for exams
                source_type="exam",
                source_id=exam_data.get('id'),
                auto_generated=True,
                visibility_roles=["admin", "principal", "teacher", "parent", "student"],
                target_audience="all",
                send_notifications=True,
                metadata={
                    "exam_type": exam_data.get('exam_type'),
                    "total_marks": exam_data.get('total_marks'),
                    "passing_marks": exam_data.get('passing_marks'),
                    "duration_minutes": exam_data.get('duration_minutes'),
                    "subject_id": exam_data.get('subject_id'),
                    "teacher_id": exam_data.get('teacher_id'),
                    "instructions": exam_data.get('instructions', '')
                }
            )
            
            # Insert exam event
            result = await self.db.academic_events.insert_one(exam_event.dict())
            exam_event_id = str(result.inserted_id)
            
            events.append(AcademicEvent(
                id=exam_event_id,
                **exam_event.dict(),
                created_at=datetime.now()
            ))
            
            # Generate reminder event (3 days before exam)
            exam_date = datetime.fromisoformat(exam_data['exam_date']) if exam_data.get('exam_date') else datetime.now()
            reminder_date = exam_date - timedelta(days=3)
            
            if reminder_date > datetime.now():
                reminder_event = AcademicEventCreate(
                    title=f"Exam Reminder: {exam_data.get('name', 'Unknown Exam')}",
                    description=f"Reminder: {exam_data.get('exam_type', 'Exam')} in 3 days",
                    event_type="deadline",
                    start_date=reminder_date,
                    is_all_day=True,
                    academic_year_id=exam_data.get('academic_year', ''),
                    term_id=exam_data.get('term', ''),
                    class_ids=[exam_data.get('class_id')] if exam_data.get('class_id') else [],
                    branch_id=exam_data.get('branch_id'),
                    color="#f44336",  # Red for reminders
                    source_type="exam",
                    source_id=exam_data.get('id'),
                    auto_generated=True,
                    visibility_roles=["admin", "principal", "teacher", "parent", "student"],
                    target_audience="all",
                    send_notifications=True,
                    metadata={
                        "reminder_type": "exam_reminder",
                        "original_exam_id": exam_data.get('id'),
                        "days_before": 3
                    }
                )
                
                result = await self.db.academic_events.insert_one(reminder_event.dict())
                reminder_event_id = str(result.inserted_id)
                
                events.append(AcademicEvent(
                    id=reminder_event_id,
                    **reminder_event.dict(),
                    created_at=datetime.now()
                ))
                
        except Exception as e:
            logger.error(f"Error generating exam events: {str(e)}")
            
        return events
    
    async def generate_payment_events(self, payment_data: Dict[str, Any]) -> List[AcademicEvent]:
        """Generate calendar events for payment due dates"""
        events = []
        
        try:
            # Payment due event
            due_date = datetime.fromisoformat(payment_data['due_date']) if payment_data.get('due_date') else datetime.now()
            
            payment_event = AcademicEventCreate(
                title=f"Payment Due: {payment_data.get('fee_type', 'Fee Payment')}",
                description=f"Amount: ${payment_data.get('amount', 0)} - {payment_data.get('academic_year', 'Current Year')}",
                event_type="payment_due",
                start_date=due_date,
                is_all_day=True,
                academic_year_id=payment_data.get('academic_year', ''),
                class_ids=[payment_data.get('class_id')] if payment_data.get('class_id') else [],
                branch_id=payment_data.get('branch_id'),
                color="#4caf50",  # Green for payments
                source_type="payment",
                source_id=payment_data.get('id'),
                auto_generated=True,
                visibility_roles=["admin", "principal", "parent"],  # Only relevant to admin and parents
                target_audience="parents",
                send_notifications=True,
                metadata={
                    "fee_type": payment_data.get('fee_type'),
                    "amount": payment_data.get('amount'),
                    "student_id": payment_data.get('student_id'),
                    "payment_cycle": payment_data.get('payment_cycle')
                }
            )
            
            result = await self.db.academic_events.insert_one(payment_event.dict())
            payment_event_id = str(result.inserted_id)
            
            events.append(AcademicEvent(
                id=payment_event_id,
                **payment_event.dict(),
                created_at=datetime.now()
            ))
            
            # Generate overdue reminder (7 days after due date)
            overdue_date = due_date + timedelta(days=7)
            
            overdue_event = AcademicEventCreate(
                title=f"Payment Overdue: {payment_data.get('fee_type', 'Fee Payment')}",
                description=f"Overdue payment reminder - Amount: ${payment_data.get('amount', 0)}",
                event_type="deadline",
                start_date=overdue_date,
                is_all_day=True,
                academic_year_id=payment_data.get('academic_year', ''),
                class_ids=[payment_data.get('class_id')] if payment_data.get('class_id') else [],
                branch_id=payment_data.get('branch_id'),
                color="#f44336",  # Red for overdue
                source_type="payment",
                source_id=payment_data.get('id'),
                auto_generated=True,
                visibility_roles=["admin", "principal", "parent"],
                target_audience="parents",
                send_notifications=True,
                metadata={
                    "reminder_type": "payment_overdue",
                    "original_payment_id": payment_data.get('id'),
                    "days_overdue": 7
                }
            )
            
            result = await self.db.academic_events.insert_one(overdue_event.dict())
            overdue_event_id = str(result.inserted_id)
            
            events.append(AcademicEvent(
                id=overdue_event_id,
                **overdue_event.dict(),
                created_at=datetime.now()
            ))
                
        except Exception as e:
            logger.error(f"Error generating payment events: {str(e)}")
            
        return events
    
    async def generate_report_events(self, report_data: Dict[str, Any]) -> List[AcademicEvent]:
        """Generate calendar events for report generation and publication"""
        events = []
        
        try:
            # Report generation event
            generation_date = datetime.fromisoformat(report_data['scheduled_generation_date']) if report_data.get('scheduled_generation_date') else datetime.now()
            
            report_event = AcademicEventCreate(
                title=f"Report Generation: {report_data.get('report_type', 'Academic Report')}",
                description=f"Automated report generation for {report_data.get('class_name', 'selected classes')}",
                event_type="report_due",
                start_date=generation_date,
                is_all_day=True,
                academic_year_id=report_data.get('academic_year', ''),
                term_id=report_data.get('term_id'),
                class_ids=[report_data.get('class_id')] if report_data.get('class_id') else [],
                branch_id=report_data.get('branch_id'),
                color="#9c27b0",  # Purple for reports
                source_type="report",
                source_id=report_data.get('id'),
                auto_generated=True,
                visibility_roles=["admin", "principal", "teacher"],
                target_audience="staff",
                send_notifications=True,
                metadata={
                    "report_type": report_data.get('report_type'),
                    "auto_publish_to_parents": report_data.get('auto_publish_to_parents'),
                    "include_behavior_comments": report_data.get('include_behavior_comments'),
                    "include_attendance_summary": report_data.get('include_attendance_summary')
                }
            )
            
            result = await self.db.academic_events.insert_one(report_event.dict())
            report_event_id = str(result.inserted_id)
            
            events.append(AcademicEvent(
                id=report_event_id,
                **report_event.dict(),
                created_at=datetime.now()
            ))
                
        except Exception as e:
            logger.error(f"Error generating report events: {str(e)}")
            
        return events
    
    async def generate_timetable_events(self, timetable_entries: List[Dict[str, Any]], academic_year: str, branch_id: str = None) -> List[AcademicEvent]:
        """Generate calendar events from timetable entries"""
        events = []
        
        try:
            # Get unique time slots and their details
            time_slot_ids = list(set([entry.get('time_slot_id') for entry in timetable_entries if entry.get('time_slot_id')]))
            time_slots = await self.db.time_slots.find({"_id": {"$in": [ObjectId(id) for id in time_slot_ids]}}).to_list(None)
            time_slot_map = {str(slot['_id']): slot for slot in time_slots}
            
            # Get class, subject, teacher information
            class_ids = list(set([entry.get('class_id') for entry in timetable_entries if entry.get('class_id')]))
            subject_ids = list(set([entry.get('subject_id') for entry in timetable_entries if entry.get('subject_id')]))
            teacher_ids = list(set([entry.get('teacher_id') for entry in timetable_entries if entry.get('teacher_id')]))
            
            classes = await self.db.classes.find({"_id": {"$in": [ObjectId(id) for id in class_ids]}}).to_list(None) if class_ids else []
            subjects = await self.db.subjects.find({"_id": {"$in": [ObjectId(id) for id in subject_ids]}}).to_list(None) if subject_ids else []
            teachers = await self.db.teachers.find({"_id": {"$in": [ObjectId(id) for id in teacher_ids]}}).to_list(None) if teacher_ids else []
            
            class_map = {str(cls['_id']): cls for cls in classes}
            subject_map = {str(subj['_id']): subj for subj in subjects}
            teacher_map = {str(teacher['_id']): teacher for teacher in teachers}
            
            for entry in timetable_entries:
                time_slot = time_slot_map.get(entry.get('time_slot_id'))
                class_info = class_map.get(entry.get('class_id'))
                subject_info = subject_map.get(entry.get('subject_id'))
                teacher_info = teacher_map.get(entry.get('teacher_id'))
                
                if not time_slot or not class_info:
                    continue
                
                # Create title and description
                title_parts = []
                if subject_info:
                    title_parts.append(subject_info.get('subject_name', 'Subject'))
                if class_info:
                    title_parts.append(f"- {class_info.get('class_name', 'Class')}")
                
                title = " ".join(title_parts) or "Class"
                
                description_parts = []
                if teacher_info:
                    teacher_name = f"{teacher_info.get('first_name', '')} {teacher_info.get('last_name', '')}".strip()
                    if teacher_name:
                        description_parts.append(f"Teacher: {teacher_name}")
                if entry.get('room_number'):
                    description_parts.append(f"Room: {entry['room_number']}")
                if time_slot.get('period_type') and time_slot.get('period_type') != 'regular':
                    description_parts.append(f"Type: {time_slot['period_type'].title()}")
                
                description = " | ".join(description_parts) or "Class session"
                
                # Calculate next occurrence date based on day_of_week
                day_mapping = {
                    'monday': 0, 'tuesday': 1, 'wednesday': 2,
                    'thursday': 3, 'friday': 4, 'saturday': 5, 'sunday': 6
                }
                
                target_weekday = day_mapping.get(entry.get('day_of_week', '').lower())
                if target_weekday is None:
                    continue
                
                today = date.today()
                days_ahead = target_weekday - today.weekday()
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                
                next_occurrence = today + timedelta(days=days_ahead)
                
                # Create datetime objects for start and end
                start_time_str = time_slot.get('start_time', '09:00:00')
                end_time_str = time_slot.get('end_time', '10:00:00')
                
                try:
                    start_time_obj = datetime.strptime(start_time_str, "%H:%M:%S").time()
                    end_time_obj = datetime.strptime(end_time_str, "%H:%M:%S").time()
                except:
                    # Fallback to default times
                    start_time_obj = time(9, 0)
                    end_time_obj = time(10, 0)
                
                start_datetime = datetime.combine(next_occurrence, start_time_obj)
                end_datetime = datetime.combine(next_occurrence, end_time_obj)
                
                # Create calendar event
                timetable_event = AcademicEventCreate(
                    title=title,
                    description=description,
                    event_type="class",
                    start_date=start_datetime,
                    end_date=end_datetime,
                    is_all_day=False,
                    academic_year_id=academic_year,
                    class_ids=[entry.get('class_id')] if entry.get('class_id') else [],
                    branch_id=branch_id,
                    color="#2196F3",  # Blue for classes
                    source_type="timetable",
                    source_id=str(entry.get('_id', '')),
                    auto_generated=True,
                    visibility_roles=["admin", "principal", "teacher", "student", "parent"],
                    target_audience="all",
                    send_notifications=False,  # Don't send notifications for regular classes
                    recurring_pattern={
                        "type": "weekly",
                        "day_of_week": entry.get('day_of_week'),
                        "frequency": 1
                    },
                    metadata={
                        "day_of_week": entry.get('day_of_week'),
                        "period_number": time_slot.get('period_number'),
                        "period_type": time_slot.get('period_type'),
                        "subject_id": entry.get('subject_id'),
                        "teacher_id": entry.get('teacher_id'),
                        "room_number": entry.get('room_number'),
                        "class_id": entry.get('class_id'),
                        "time_slot_id": entry.get('time_slot_id')
                    }
                )
                
                # Insert into database
                result = await self.db.academic_events.insert_one(timetable_event.dict())
                event_id = str(result.inserted_id)
                
                events.append(AcademicEvent(
                    id=event_id,
                    **timetable_event.dict(),
                    created_at=datetime.now()
                ))
                
        except Exception as e:
            logger.error(f"Error generating timetable events: {str(e)}")
            
        return events
    
    async def update_events_from_source(self, source_type: str, source_id: str, updated_data: Dict[str, Any]):
        """Update auto-generated events when source data changes"""
        try:
            # Find all events generated from this source
            events = await self.db.academic_events.find({
                "source_type": source_type,
                "source_id": source_id,
                "auto_generated": True
            }).to_list(None)
            
            for event in events:
                # Update event based on source changes
                if source_type == "exam" and "exam_date" in updated_data:
                    new_date = datetime.fromisoformat(updated_data['exam_date'])
                    await self.db.academic_events.update_one(
                        {"_id": event["_id"]},
                        {"$set": {
                            "start_date": new_date,
                            "updated_at": datetime.now()
                        }}
                    )
                elif source_type == "payment" and "due_date" in updated_data:
                    new_due_date = datetime.fromisoformat(updated_data['due_date'])
                    await self.db.academic_events.update_one(
                        {"_id": event["_id"]},
                        {"$set": {
                            "start_date": new_due_date,
                            "updated_at": datetime.now()
                        }}
                    )
            
            logger.info(f"Updated {len(events)} events for {source_type} {source_id}")
            
        except Exception as e:
            logger.error(f"Error updating events from source: {str(e)}")
    
    async def delete_events_from_source(self, source_type: str, source_id: str):
        """Delete auto-generated events when source is deleted"""
        try:
            result = await self.db.academic_events.delete_many({
                "source_type": source_type,
                "source_id": source_id,
                "auto_generated": True
            })
            
            logger.info(f"Deleted {result.deleted_count} events for {source_type} {source_id}")
            
        except Exception as e:
            logger.error(f"Error deleting events from source: {str(e)}")

    async def get_events_with_role_filter(self, query_params: Dict[str, Any], user_role: str, user_id: str = None) -> List[Dict[str, Any]]:
        """Get events filtered by user role and visibility settings"""
        try:
            # Build base query
            query = {}
            
            if query_params.get('start_date'):
                query['start_date'] = {"$gte": datetime.fromisoformat(query_params['start_date'])}
            if query_params.get('end_date'):
                query['start_date'] = {**query.get('start_date', {}), "$lte": datetime.fromisoformat(query_params['end_date'])}
            
            if query_params.get('event_types'):
                query['event_type'] = {"$in": query_params['event_types']}
            
            if query_params.get('branch_id'):
                query['branch_id'] = query_params['branch_id']
            
            if query_params.get('class_ids'):
                query['class_ids'] = {"$in": query_params['class_ids']}
            
            # Apply role-based visibility
            if query_params.get('visibility_filter', True):
                query['visibility_roles'] = {"$in": [user_role]}
            
            events = await self.db.academic_events.find(query).to_list(None)
            
            # Additional filtering based on target audience
            filtered_events = []
            for event in events:
                target_audience = event.get('target_audience', 'all')
                
                if target_audience == 'all':
                    filtered_events.append(event)
                elif target_audience == 'staff' and user_role in ['admin', 'principal', 'teacher']:
                    filtered_events.append(event)
                elif target_audience == 'parents' and user_role == 'parent':
                    filtered_events.append(event)
                elif target_audience == 'students' and user_role == 'student':
                    filtered_events.append(event)
                elif target_audience == 'specific_class':
                    # Check if user is associated with the class
                    # This would need additional logic based on user's class associations
                    filtered_events.append(event)
            
            return filtered_events
            
        except Exception as e:
            logger.error(f"Error getting role-filtered events: {str(e)}")
            return []

    async def get_upcoming_events_with_role_filter(self, user_role: str, user_id: str = None, branch_id: str = None, days_ahead: int = 30) -> List[Dict[str, Any]]:
        """Get upcoming events filtered by user role and visibility settings"""
        try:
            # Get events for the next 30 days by default
            start_date = datetime.now()
            end_date = start_date + timedelta(days=days_ahead)
            
            query_params = {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'branch_id': branch_id
            }
            
            events = await self.get_events_with_role_filter(query_params, user_role, user_id)
            
            # Sort by date
            events.sort(key=lambda x: x.get('start_date', datetime.now()))
            
            return events
            
        except Exception as e:
            logger.error(f"Error getting upcoming events with role filter: {str(e)}")
            return []

    async def get_calendar_statistics(self, user_role: str, user_id: str = None, branch_id: str = None) -> Dict[str, Any]:
        """Get calendar statistics for the current user"""
        try:
            # Get current month events
            today = datetime.now()
            start_of_month = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            query_params = {
                'start_date': start_of_month.isoformat(),
                'end_date': end_of_month.isoformat(),
                'branch_id': branch_id
            }
            
            events = await self.get_events_with_role_filter(query_params, user_role, user_id)
            
            # Count events by type
            event_counts = {}
            for event in events:
                event_type = event.get('event_type', 'other')
                event_counts[event_type] = event_counts.get(event_type, 0) + 1
            
            # Get upcoming events in next 7 days
            next_week = today + timedelta(days=7)
            upcoming_query = {
                'start_date': today.isoformat(),
                'end_date': next_week.isoformat(),
                'branch_id': branch_id
            }
            
            upcoming_events = await self.get_events_with_role_filter(upcoming_query, user_role, user_id)
            
            # Get overdue events (past events that might need attention)
            overdue_query = {
                'start_date': (today - timedelta(days=7)).isoformat(),
                'end_date': today.isoformat(),
                'event_types': ['payment_due', 'deadline', 'report_due'],
                'branch_id': branch_id
            }
            
            overdue_events = await self.get_events_with_role_filter(overdue_query, user_role, user_id)
            
            return {
                'total_events_this_month': len(events),
                'upcoming_events_week': len(upcoming_events),
                'overdue_events': len(overdue_events),
                'events_by_type': event_counts,
                'most_common_event_type': max(event_counts.keys(), key=event_counts.get) if event_counts else 'none',
                'stats_generated_at': datetime.now().isoformat(),
                'period': {
                    'start_date': start_of_month.isoformat(),
                    'end_date': end_of_month.isoformat()
                }
            }
            
        except Exception as e:
            logger.error(f"Error getting calendar statistics: {str(e)}")
            return {
                'total_events_this_month': 0,
                'upcoming_events_week': 0,
                'overdue_events': 0,
                'events_by_type': {},
                'most_common_event_type': 'none',
                'stats_generated_at': datetime.now().isoformat(),
                'error': str(e)
            }

# Global instance
calendar_event_generator = CalendarEventGenerator()