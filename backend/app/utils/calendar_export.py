from typing import List, Dict, Any, Optional
from datetime import datetime, date
import uuid
import logging
from app.models.academic_calendar import CalendarExportRequest, CalendarExportResponse
from app.utils.calendar_events import calendar_event_generator

logger = logging.getLogger(__name__)

class CalendarExporter:
    """Handles calendar export in various formats"""
    
    def __init__(self):
        pass
    
    async def export_calendar(self, export_request: CalendarExportRequest) -> CalendarExportResponse:
        """Main export method that routes to specific format handlers"""
        try:
            # Get events based on request parameters
            query_params = {
                'start_date': export_request.date_range_start.isoformat() if export_request.date_range_start else None,
                'end_date': export_request.date_range_end.isoformat() if export_request.date_range_end else None,
                'event_types': export_request.include_event_types,
                'branch_id': None,  # Would need to be passed from request context
                'class_ids': export_request.class_ids,
                'visibility_filter': not export_request.include_private_events
            }
            
            events = await calendar_event_generator.get_events_with_role_filter(
                query_params, 
                export_request.user_role, 
                export_request.user_id
            )
            
            # Route to appropriate export method
            if export_request.format.lower() == 'ical':
                return await self._export_ical(events, export_request)
            elif export_request.format.lower() == 'google':
                return await self._export_google_calendar(events, export_request)
            elif export_request.format.lower() == 'outlook':
                return await self._export_outlook(events, export_request)
            else:
                raise ValueError(f"Unsupported export format: {export_request.format}")
                
        except Exception as e:
            logger.error(f"Error exporting calendar: {str(e)}")
            raise
    
    async def _export_ical(self, events: List[Dict[str, Any]], export_request: CalendarExportRequest) -> CalendarExportResponse:
        """Export events in iCal format"""
        ical_content = []
        
        # iCal header
        ical_content.extend([
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Spring of Knowledge Hub//Academic Calendar//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:PUBLISH",
            "X-WR-CALNAME:Academic Calendar",
            "X-WR-CALDESC:Academic calendar events and schedules",
            "X-WR-TIMEZONE:UTC"
        ])
        
        # Process each event
        for event in events:
            event_lines = await self._format_ical_event(event)
            ical_content.extend(event_lines)
        
        # iCal footer
        ical_content.append("END:VCALENDAR")
        
        content = "\r\n".join(ical_content)
        filename = f"academic_calendar_{datetime.now().strftime('%Y%m%d_%H%M%S')}.ics"
        
        return CalendarExportResponse(
            format="ical",
            content=content,
            filename=filename,
            mime_type="text/calendar",
            events_count=len(events),
            generated_at=datetime.now()
        )
    
    async def _format_ical_event(self, event: Dict[str, Any]) -> List[str]:
        """Format a single event for iCal"""
        lines = []
        
        # Generate unique UID
        event_uid = f"{event.get('id', uuid.uuid4())}@springofknowledgehub.com"
        
        # Start event
        lines.append("BEGIN:VEVENT")
        
        # UID
        lines.append(f"UID:{event_uid}")
        
        # DTSTAMP (creation time)
        dtstamp = datetime.now().strftime("%Y%m%dT%H%M%SZ")
        lines.append(f"DTSTAMP:{dtstamp}")
        
        # Start date/time
        start_dt = datetime.fromisoformat(event['start_date'].replace('Z', '+00:00'))
        if event.get('is_all_day', True):
            lines.append(f"DTSTART;VALUE=DATE:{start_dt.strftime('%Y%m%d')}")
        else:
            lines.append(f"DTSTART:{start_dt.strftime('%Y%m%dT%H%M%SZ')}")
        
        # End date/time (if provided)
        if event.get('end_date'):
            end_dt = datetime.fromisoformat(event['end_date'].replace('Z', '+00:00'))
            if event.get('is_all_day', True):
                lines.append(f"DTEND;VALUE=DATE:{end_dt.strftime('%Y%m%d')}")
            else:
                lines.append(f"DTEND:{end_dt.strftime('%Y%m%dT%H%M%SZ')}")
        
        # Summary (title)
        summary = self._escape_ical_text(event.get('title', 'Academic Event'))
        lines.append(f"SUMMARY:{summary}")
        
        # Description
        if event.get('description'):
            description = self._escape_ical_text(event['description'])
            lines.append(f"DESCRIPTION:{description}")
        
        # Categories
        event_type = event.get('event_type', 'event')
        lines.append(f"CATEGORIES:{event_type.upper()}")
        
        # Status
        if event_type == 'exam':
            lines.append("STATUS:CONFIRMED")
        else:
            lines.append("STATUS:TENTATIVE")
        
        # Class (priority)
        if event_type in ['exam', 'deadline']:
            lines.append("CLASS:PUBLIC")
            lines.append("PRIORITY:1")  # High priority
        else:
            lines.append("CLASS:PUBLIC")
            lines.append("PRIORITY:5")  # Normal priority
        
        # Custom properties for metadata
        metadata = event.get('metadata', {})
        if metadata:
            for key, value in metadata.items():
                if isinstance(value, (str, int, float)):
                    lines.append(f"X-ACADEMIC-{key.upper()}:{value}")
        
        # Source information
        if event.get('source_type'):
            lines.append(f"X-ACADEMIC-SOURCE:{event['source_type']}")
        
        # End event
        lines.append("END:VEVENT")
        
        return lines
    
    def _escape_ical_text(self, text: str) -> str:
        """Escape special characters for iCal format"""
        if not text:
            return ""
        
        # Replace special characters
        text = text.replace('\\', '\\\\')
        text = text.replace(',', '\\,')
        text = text.replace(';', '\\;')
        text = text.replace('\n', '\\n')
        text = text.replace('\r', '')
        
        return text
    
    async def _export_google_calendar(self, events: List[Dict[str, Any]], export_request: CalendarExportRequest) -> CalendarExportResponse:
        """Export events in Google Calendar format (CSV)"""
        csv_content = []
        
        # CSV header for Google Calendar import
        headers = [
            "Subject", "Start Date", "Start Time", "End Date", "End Time",
            "All Day Event", "Description", "Location", "Private"
        ]
        csv_content.append(",".join(headers))
        
        # Process each event
        for event in events:
            row = await self._format_google_calendar_event(event)
            csv_content.append(",".join(row))
        
        content = "\n".join(csv_content)
        filename = f"academic_calendar_google_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return CalendarExportResponse(
            format="google",
            content=content,
            filename=filename,
            mime_type="text/csv",
            events_count=len(events),
            generated_at=datetime.now()
        )
    
    async def _format_google_calendar_event(self, event: Dict[str, Any]) -> List[str]:
        """Format a single event for Google Calendar CSV"""
        start_dt = datetime.fromisoformat(event['start_date'].replace('Z', '+00:00'))
        
        row = [
            f'"{event.get("title", "Academic Event")}"',  # Subject
            start_dt.strftime('%m/%d/%Y'),  # Start Date
            "" if event.get('is_all_day') else start_dt.strftime('%I:%M:%S %p'),  # Start Time
            start_dt.strftime('%m/%d/%Y'),  # End Date (same as start for all-day events)
            "" if event.get('is_all_day') else start_dt.strftime('%I:%M:%S %p'),  # End Time
            "True" if event.get('is_all_day') else "False",  # All Day Event
            f'"{event.get("description", "")}"',  # Description
            '""',  # Location (empty for now)
            "False"  # Private
        ]
        
        return row
    
    async def _export_outlook(self, events: List[Dict[str, Any]], export_request: CalendarExportRequest) -> CalendarExportResponse:
        """Export events in Outlook format (CSV)"""
        csv_content = []
        
        # CSV header for Outlook import
        headers = [
            "Subject", "Start Date", "Start Time", "End Date", "End Time",
            "All day event", "Reminder on/off", "Reminder Date", "Reminder Time",
            "Meeting Organizer", "Required Attendees", "Optional Attendees",
            "Meeting Resources", "Billing Information", "Categories",
            "Description", "Location", "Mileage", "Priority", "Private",
            "Sensitivity", "Show time as"
        ]
        csv_content.append(",".join(headers))
        
        # Process each event
        for event in events:
            row = await self._format_outlook_event(event)
            csv_content.append(",".join(row))
        
        content = "\n".join(csv_content)
        filename = f"academic_calendar_outlook_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return CalendarExportResponse(
            format="outlook",
            content=content,
            filename=filename,
            mime_type="text/csv",
            events_count=len(events),
            generated_at=datetime.now()
        )
    
    async def _format_outlook_event(self, event: Dict[str, Any]) -> List[str]:
        """Format a single event for Outlook CSV"""
        start_dt = datetime.fromisoformat(event['start_date'].replace('Z', '+00:00'))
        
        # Determine priority based on event type
        priority = "High" if event.get('event_type') in ['exam', 'deadline'] else "Normal"
        
        # Categories
        category = event.get('event_type', 'event').title()
        
        row = [
            f'"{event.get("title", "Academic Event")}"',  # Subject
            start_dt.strftime('%m/%d/%Y'),  # Start Date
            "" if event.get('is_all_day') else start_dt.strftime('%I:%M:%S %p'),  # Start Time
            start_dt.strftime('%m/%d/%Y'),  # End Date
            "" if event.get('is_all_day') else start_dt.strftime('%I:%M:%S %p'),  # End Time
            "True" if event.get('is_all_day') else "False",  # All day event
            "True",  # Reminder on/off
            start_dt.strftime('%m/%d/%Y'),  # Reminder Date
            "09:00:00 AM",  # Reminder Time
            "Academic System",  # Meeting Organizer
            '""',  # Required Attendees
            '""',  # Optional Attendees
            '""',  # Meeting Resources
            '""',  # Billing Information
            f'"{category}"',  # Categories
            f'"{event.get("description", "")}"',  # Description
            '""',  # Location
            '""',  # Mileage
            priority,  # Priority
            "False",  # Private
            "Normal",  # Sensitivity
            "Busy"  # Show time as
        ]
        
        return row

# Global instance
calendar_exporter = CalendarExporter()