"""
Timetable export functionality for various formats
"""
import logging
import json
import csv
import io
from typing import Dict, Any, List, Optional
from datetime import datetime, date
import tempfile
import os
from bson import ObjectId

logger = logging.getLogger(__name__)

class TimetableExporter:
    """Handle timetable exports in various formats"""
    
    def __init__(self):
        self.supported_formats = ['pdf', 'excel', 'csv', 'ical', 'json']
        self.view_types = ['class', 'teacher', 'room', 'master']
    
    async def export_timetable(self, export_request, db, branch_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        Export timetable in requested format
        """
        try:
            # Validate request
            if export_request.format not in self.supported_formats:
                raise ValueError(f"Unsupported format: {export_request.format}")
            
            if export_request.view_type not in self.view_types:
                raise ValueError(f"Unsupported view type: {export_request.view_type}")
            
            # Get timetable data
            timetable_data = await self._get_timetable_data(export_request, db, branch_filter)
            
            # Generate export based on format
            if export_request.format == 'json':
                return await self._export_json(timetable_data, export_request)
            elif export_request.format == 'csv':
                return await self._export_csv(timetable_data, export_request)
            elif export_request.format == 'excel':
                return await self._export_excel(timetable_data, export_request)
            elif export_request.format == 'ical':
                return await self._export_ical(timetable_data, export_request)
            elif export_request.format == 'pdf':
                return await self._export_pdf(timetable_data, export_request)
            else:
                raise ValueError(f"Format {export_request.format} not implemented")
                
        except Exception as e:
            logger.error(f"Export failed: {str(e)}")
            raise
    
    async def _get_timetable_data(self, export_request, db, branch_filter: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve timetable data based on export request
        """
        query = {}
        
        # Apply branch filtering
        if branch_filter:
            query["branch_id"] = branch_filter
        
        # Apply date range filtering
        if export_request.date_range_start and export_request.date_range_end:
            query["created_at"] = {
                "$gte": datetime.combine(export_request.date_range_start, datetime.min.time()),
                "$lte": datetime.combine(export_request.date_range_end, datetime.max.time())
            }
        
        # Get basic data
        entries = await db.timetable_entries.find(query).to_list(None)
        time_slots = await db.time_slots.find({}).to_list(None)
        classes = await db.classes.find({}).to_list(None)
        teachers = await db.teachers.find({}).to_list(None)
        subjects = await db.subjects.find({}).to_list(None)
        rooms = await db.rooms.find({}).to_list(None)
        
        # Apply target-specific filtering
        if export_request.target_id:
            if export_request.view_type == 'class':
                entries = [e for e in entries if e.get('class_id') == export_request.target_id]
            elif export_request.view_type == 'teacher':
                entries = [e for e in entries if e.get('teacher_id') == export_request.target_id]
            elif export_request.view_type == 'room':
                entries = [e for e in entries if e.get('room_number') == export_request.target_id]
        
        # Create lookup maps
        time_slot_map = {str(slot['_id']): slot for slot in time_slots}
        class_map = {str(cls['_id']): cls for cls in classes}
        teacher_map = {str(teacher['_id']): teacher for teacher in teachers}
        subject_map = {str(subject['_id']): subject for subject in subjects}
        room_map = {room['room_number']: room for room in rooms}
        
        # Enrich entries with related data
        enriched_entries = []
        for entry in entries:
            enriched_entry = entry.copy()
            
            # Add time slot information
            time_slot = time_slot_map.get(entry.get('time_slot_id'))
            if time_slot:
                enriched_entry.update({
                    'start_time': time_slot.get('start_time'),
                    'end_time': time_slot.get('end_time'),
                    'period_number': time_slot.get('period_number'),
                    'period_type': time_slot.get('period_type')
                })
            
            # Add class information
            class_info = class_map.get(entry.get('class_id'))
            if class_info:
                enriched_entry.update({
                    'class_name': class_info.get('class_name'),
                    'grade_level': class_info.get('grade_level')
                })
            
            # Add teacher information
            teacher_info = teacher_map.get(entry.get('teacher_id'))
            if teacher_info:
                enriched_entry.update({
                    'teacher_name': f"{teacher_info.get('first_name', '')} {teacher_info.get('last_name', '')}".strip(),
                    'teacher_email': teacher_info.get('email')
                })
            
            # Add subject information
            subject_info = subject_map.get(entry.get('subject_id'))
            if subject_info:
                enriched_entry.update({
                    'subject_name': subject_info.get('subject_name'),
                    'subject_code': subject_info.get('subject_code')
                })
            
            # Add room information
            room_info = room_map.get(entry.get('room_number'))
            if room_info:
                enriched_entry.update({
                    'room_type': room_info.get('room_type'),
                    'room_capacity': room_info.get('capacity')
                })
            
            enriched_entries.append(enriched_entry)
        
        return {
            'entries': enriched_entries,
            'metadata': {
                'export_type': export_request.view_type,
                'target_id': export_request.target_id,
                'date_range_start': export_request.date_range_start.isoformat() if export_request.date_range_start else None,
                'date_range_end': export_request.date_range_end.isoformat() if export_request.date_range_end else None,
                'total_entries': len(enriched_entries),
                'generated_at': datetime.now().isoformat()
            }
        }
    
    async def _export_json(self, timetable_data: Dict[str, Any], export_request) -> Dict[str, Any]:
        """Export timetable as JSON"""
        try:
            # Create temporary file
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False)
            
            # Organize data for JSON export
            export_data = {
                'timetable': self._organize_by_schedule(timetable_data['entries']),
                'metadata': timetable_data['metadata'],
                'export_settings': {
                    'format': export_request.format,
                    'view_type': export_request.view_type,
                    'include_breaks': export_request.include_breaks,
                    'include_notes': export_request.include_notes
                }
            }
            
            json.dump(export_data, temp_file, indent=2, default=str)
            temp_file.close()
            
            filename = f"timetable_{export_request.view_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            
            return {
                'filename': filename,
                'file_path': temp_file.name,
                'download_url': f"/downloads/timetables/{filename}",
                'content_type': 'application/json'
            }
            
        except Exception as e:
            logger.error(f"JSON export failed: {str(e)}")
            raise
    
    async def _export_csv(self, timetable_data: Dict[str, Any], export_request) -> Dict[str, Any]:
        """Export timetable as CSV"""
        try:
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, newline='')
            
            # Define CSV headers
            headers = [
                'Day', 'Period', 'Start Time', 'End Time', 'Subject', 'Subject Code',
                'Teacher', 'Class', 'Room', 'Room Type'
            ]
            
            if export_request.include_notes:
                headers.append('Notes')
            
            # Add custom fields if specified
            if export_request.custom_fields:
                headers.extend(export_request.custom_fields)
            
            writer = csv.writer(temp_file)
            writer.writerow(headers)
            
            # Write data rows
            for entry in timetable_data['entries']:
                # Skip breaks if not requested
                if not export_request.include_breaks and entry.get('period_type') == 'break':
                    continue
                
                row = [
                    entry.get('day_of_week', '').title(),
                    entry.get('period_number', ''),
                    entry.get('start_time', ''),
                    entry.get('end_time', ''),
                    entry.get('subject_name', ''),
                    entry.get('subject_code', ''),
                    entry.get('teacher_name', ''),
                    entry.get('class_name', ''),
                    entry.get('room_number', ''),
                    entry.get('room_type', '')
                ]
                
                if export_request.include_notes:
                    row.append(entry.get('notes', ''))
                
                # Add custom field values
                for field in export_request.custom_fields or []:
                    row.append(entry.get(field, ''))
                
                writer.writerow(row)
            
            temp_file.close()
            
            filename = f"timetable_{export_request.view_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            
            return {
                'filename': filename,
                'file_path': temp_file.name,
                'download_url': f"/downloads/timetables/{filename}",
                'content_type': 'text/csv'
            }
            
        except Exception as e:
            logger.error(f"CSV export failed: {str(e)}")
            raise
    
    async def _export_excel(self, timetable_data: Dict[str, Any], export_request) -> Dict[str, Any]:
        """Export timetable as Excel file"""
        try:
            # This would require openpyxl or xlsxwriter
            # For now, return CSV format as fallback
            logger.warning("Excel export not fully implemented, using CSV format")
            return await self._export_csv(timetable_data, export_request)
            
        except Exception as e:
            logger.error(f"Excel export failed: {str(e)}")
            raise
    
    async def _export_ical(self, timetable_data: Dict[str, Any], export_request) -> Dict[str, Any]:
        """Export timetable as iCalendar format"""
        try:
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.ics', delete=False)
            
            # Write iCal header
            temp_file.write("BEGIN:VCALENDAR\n")
            temp_file.write("VERSION:2.0\n")
            temp_file.write("PRODID:-//School Management System//Timetable//EN\n")
            temp_file.write("CALSCALE:GREGORIAN\n")
            
            # Write events
            for entry in timetable_data['entries']:
                if not export_request.include_breaks and entry.get('period_type') == 'break':
                    continue
                
                # Generate recurring events for each day of the week
                day_mapping = {
                    'monday': 'MO', 'tuesday': 'TU', 'wednesday': 'WE',
                    'thursday': 'TH', 'friday': 'FR', 'saturday': 'SA', 'sunday': 'SU'
                }
                
                day_code = day_mapping.get(entry.get('day_of_week', '').lower())
                if not day_code:
                    continue
                
                # Create event UID
                event_uid = f"timetable-{entry.get('_id', 'unknown')}@school.edu"
                
                temp_file.write("BEGIN:VEVENT\n")
                temp_file.write(f"UID:{event_uid}\n")
                temp_file.write(f"DTSTART;TZID=UTC:{self._format_ical_time(entry.get('start_time'))}\n")
                temp_file.write(f"DTEND;TZID=UTC:{self._format_ical_time(entry.get('end_time'))}\n")
                temp_file.write(f"RRULE:FREQ=WEEKLY;BYDAY={day_code}\n")
                temp_file.write(f"SUMMARY:{entry.get('subject_name', 'Class')}\n")
                
                # Description with details
                description_parts = []
                if entry.get('teacher_name'):
                    description_parts.append(f"Teacher: {entry['teacher_name']}")
                if entry.get('room_number'):
                    description_parts.append(f"Room: {entry['room_number']}")
                if entry.get('class_name'):
                    description_parts.append(f"Class: {entry['class_name']}")
                if entry.get('notes'):
                    description_parts.append(f"Notes: {entry['notes']}")
                
                if description_parts:
                    temp_file.write(f"DESCRIPTION:{' | '.join(description_parts)}\n")
                
                if entry.get('room_number'):
                    temp_file.write(f"LOCATION:Room {entry['room_number']}\n")
                
                temp_file.write("END:VEVENT\n")
            
            temp_file.write("END:VCALENDAR\n")
            temp_file.close()
            
            filename = f"timetable_{export_request.view_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.ics"
            
            return {
                'filename': filename,
                'file_path': temp_file.name,
                'download_url': f"/downloads/timetables/{filename}",
                'content_type': 'text/calendar'
            }
            
        except Exception as e:
            logger.error(f"iCal export failed: {str(e)}")
            raise
    
    async def _export_pdf(self, timetable_data: Dict[str, Any], export_request) -> Dict[str, Any]:
        """Export timetable as PDF"""
        try:
            # This would require reportlab or similar PDF library
            # For now, return a placeholder
            logger.warning("PDF export not fully implemented")
            
            temp_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
            temp_file.write("PDF Export Placeholder\n")
            temp_file.write("Timetable data would be formatted as PDF here\n")
            temp_file.write(f"Total entries: {len(timetable_data['entries'])}\n")
            temp_file.close()
            
            filename = f"timetable_{export_request.view_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
            
            return {
                'filename': filename,
                'file_path': temp_file.name,
                'download_url': f"/downloads/timetables/{filename}",
                'content_type': 'text/plain'
            }
            
        except Exception as e:
            logger.error(f"PDF export failed: {str(e)}")
            raise
    
    def _organize_by_schedule(self, entries: List[Dict[str, Any]]) -> Dict[str, Dict[int, Dict[str, Any]]]:
        """Organize entries by day and period for structured export"""
        schedule = {}
        days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        
        # Initialize schedule structure
        for day in days:
            schedule[day] = {}
        
        # Populate schedule
        for entry in entries:
            day = entry.get('day_of_week')
            period = entry.get('period_number')
            
            if day in schedule and period is not None:
                schedule[day][period] = {
                    'subject_name': entry.get('subject_name', ''),
                    'subject_code': entry.get('subject_code', ''),
                    'teacher_name': entry.get('teacher_name', ''),
                    'room_number': entry.get('room_number', ''),
                    'start_time': entry.get('start_time', ''),
                    'end_time': entry.get('end_time', ''),
                    'notes': entry.get('notes', ''),
                    'is_lab': entry.get('resources_needed', []) and 'laboratory' in str(entry.get('resources_needed', [])).lower()
                }
        
        return schedule
    
    def _format_ical_time(self, time_str: str) -> str:
        """Format time string for iCal format"""
        try:
            # This is a simplified implementation
            # In practice, you'd need proper timezone handling
            if not time_str:
                return "000000T000000Z"
            
            # Assume today's date for recurring events
            today = date.today()
            time_obj = datetime.strptime(time_str, "%H:%M:%S").time()
            dt = datetime.combine(today, time_obj)
            
            return dt.strftime("%Y%m%dT%H%M%SZ")
            
        except:
            return "000000T000000Z"