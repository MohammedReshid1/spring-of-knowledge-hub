import { AcademicCalendar } from '@/components/calendar/AcademicCalendar';
import { useLiveData } from '@/hooks/useLiveData';

export default function CalendarPage() {
  // Enable real-time updates for calendar data
  useLiveData(['academic-calendar', 'academic-years', 'terms', 'events']);

  return <AcademicCalendar />;
}