import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { 
  Clock,
  MapPin,
  BookOpen,
  Users,
  Calendar as CalendarIcon,
  Download,
  Bell,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff
} from 'lucide-react';

interface PersonalizedTimetableProps {
  userRole: string;
  userId: string;
  userName?: string;
}

interface TimetableEntry {
  id: string;
  subject_name: string;
  subject_code: string;
  teacher_name: string;
  class_name?: string;
  room_number: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  period_number: number;
  notes?: string;
  is_lab?: boolean;
  is_substitution?: boolean;
  original_teacher?: string;
}

interface WeeklySchedule {
  [day: string]: TimetableEntry[];
}

interface UpcomingClass {
  id: string;
  subject_name: string;
  teacher_name: string;
  room_number: string;
  start_time: string;
  end_time: string;
  minutes_until: number;
  is_next: boolean;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday', short: 'Mon' },
  { value: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { value: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { value: 'thursday', label: 'Thursday', short: 'Thu' },
  { value: 'friday', label: 'Friday', short: 'Fri' },
  { value: 'saturday', label: 'Saturday', short: 'Sat' }
];

export const PersonalizedTimetable: React.FC<PersonalizedTimetableProps> = ({
  userRole,
  userId,
  userName
}) => {
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [selectedDay, setSelectedDay] = useState<string>('monday');
  const [showPastClasses, setShowPastClasses] = useState(false);
  const [compactView, setCompactView] = useState(false);

  // Fetch personalized timetable
  const { data: schedule, isLoading } = useQuery<WeeklySchedule>({
    queryKey: ['personal-timetable', userId, selectedWeek],
    queryFn: async () => {
      const endpoint = userRole === 'student' 
        ? `/timetable/student/${userId}`
        : `/timetable/teacher/${userId}`;
      
      const response = await apiClient.get(endpoint);
      return response.data.entries || {};
    }
  });

  // Fetch upcoming classes
  const { data: upcomingClasses = [] } = useQuery<UpcomingClass[]>({
    queryKey: ['upcoming-classes', userId],
    queryFn: async () => {
      const response = await apiClient.get(`/timetable/upcoming/${userId}`);
      return response.data;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const isCurrentClass = (entry: TimetableEntry) => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = getCurrentTime();
    
    return entry.day_of_week === currentDay && 
           currentTime >= entry.start_time && 
           currentTime <= entry.end_time;
  };

  const isPastClass = (entry: TimetableEntry) => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const currentTime = getCurrentTime();
    
    return entry.day_of_week === currentDay && currentTime > entry.end_time;
  };

  const getTimeStatus = (entry: TimetableEntry) => {
    if (isCurrentClass(entry)) return 'current';
    if (isPastClass(entry)) return 'past';
    return 'upcoming';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'bg-green-100 border-green-500 text-green-800';
      case 'past': return 'bg-gray-100 border-gray-300 text-gray-600';
      case 'upcoming': return 'bg-blue-100 border-blue-500 text-blue-800';
      default: return 'bg-white border-gray-200 text-gray-800';
    }
  };

  const renderClassCard = (entry: TimetableEntry, status: string) => {
    if (!showPastClasses && status === 'past') return null;

    return (
      <Card key={entry.id} className={`${getStatusColor(status)} transition-all duration-200 ${compactView ? 'p-2' : ''}`}>
        <CardContent className={compactView ? "p-3" : "p-4"}>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <BookOpen className={`${compactView ? 'h-3 w-3' : 'h-4 w-4'} text-blue-600`} />
                <h3 className={`font-semibold ${compactView ? 'text-sm' : 'text-base'}`}>
                  {entry.subject_name}
                  {entry.is_lab && <span className="text-xs ml-2 px-1 py-0.5 bg-purple-200 text-purple-800 rounded">LAB</span>}
                </h3>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center text-gray-600">
                  <Clock className={`${compactView ? 'h-3 w-3' : 'h-4 w-4'} mr-2`} />
                  <span className={compactView ? 'text-xs' : 'text-sm'}>
                    {entry.start_time} - {entry.end_time}
                  </span>
                  {status === 'current' && (
                    <Badge className="ml-2 bg-green-500 text-white text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                
                {userRole === 'student' ? (
                  <div className="flex items-center text-gray-600">
                    <Users className={`${compactView ? 'h-3 w-3' : 'h-4 w-4'} mr-2`} />
                    <span className={compactView ? 'text-xs' : 'text-sm'}>
                      {entry.teacher_name}
                      {entry.is_substitution && (
                        <span className="text-orange-600 ml-1">
                          (Sub for {entry.original_teacher})
                        </span>
                      )}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center text-gray-600">
                    <Users className={`${compactView ? 'h-3 w-3' : 'h-4 w-4'} mr-2`} />
                    <span className={compactView ? 'text-xs' : 'text-sm'}>
                      {entry.class_name}
                    </span>
                  </div>
                )}
                
                <div className="flex items-center text-gray-600">
                  <MapPin className={`${compactView ? 'h-3 w-3' : 'h-4 w-4'} mr-2`} />
                  <span className={compactView ? 'text-xs' : 'text-sm'}>
                    Room {entry.room_number}
                  </span>
                </div>
                
                {entry.notes && !compactView && (
                  <div className="mt-2 text-xs text-gray-500 italic">
                    {entry.notes}
                  </div>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <div className={`text-xs text-gray-500 mb-1`}>
                Period {entry.period_number}
              </div>
              {entry.subject_code && (
                <div className="text-xs text-gray-400">
                  {entry.subject_code}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDayView = () => {
    const daySchedule = schedule?.[selectedDay] || [];
    const sortedSchedule = daySchedule.sort((a, b) => a.period_number - b.period_number);

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold capitalize">
            {DAYS_OF_WEEK.find(d => d.value === selectedDay)?.label}
          </h3>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const currentIndex = DAYS_OF_WEEK.findIndex(d => d.value === selectedDay);
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : DAYS_OF_WEEK.length - 1;
                setSelectedDay(DAYS_OF_WEEK[prevIndex].value);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const currentIndex = DAYS_OF_WEEK.findIndex(d => d.value === selectedDay);
                const nextIndex = currentIndex < DAYS_OF_WEEK.length - 1 ? currentIndex + 1 : 0;
                setSelectedDay(DAYS_OF_WEEK[nextIndex].value);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {sortedSchedule.length > 0 ? (
            sortedSchedule.map(entry => 
              renderClassCard(entry, getTimeStatus(entry))
            )
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No classes scheduled for this day</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    if (!schedule) return null;

    return (
      <div className="space-y-6">
        {DAYS_OF_WEEK.map(day => {
          const daySchedule = schedule[day.value] || [];
          const sortedSchedule = daySchedule.sort((a, b) => a.period_number - b.period_number);

          return (
            <div key={day.value}>
              <h3 className="text-lg font-semibold mb-3 flex items-center">
                {day.label}
                <span className="ml-2 text-sm text-gray-500">
                  ({sortedSchedule.length} classes)
                </span>
              </h3>
              
              {sortedSchedule.length > 0 ? (
                <div className={`grid gap-3 ${compactView ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
                  {sortedSchedule.map(entry => 
                    renderClassCard(entry, getTimeStatus(entry))
                  )}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                  No classes scheduled
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-8">Loading your timetable...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">
            {userRole === 'student' ? 'My Timetable' : 'My Teaching Schedule'}
          </h2>
          <p className="text-muted-foreground">
            {userName && `Welcome, ${userName}`}
            {upcomingClasses.length > 0 && (
              <span className="ml-2">
                • Next class in {upcomingClasses[0]?.minutes_until} minutes
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompactView(!compactView)}
          >
            {compactView ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPastClasses(!showPastClasses)}
          >
            <Clock className="h-4 w-4 mr-2" />
            {showPastClasses ? 'Hide Past' : 'Show Past'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Upcoming Classes Alert */}
      {upcomingClasses.length > 0 && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Upcoming Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingClasses.slice(0, 3).map((cls, index) => (
                <div key={cls.id} className="flex justify-between items-center p-2 bg-white rounded border">
                  <div>
                    <span className="font-medium">{cls.subject_name}</span>
                    <span className="text-sm text-gray-600 ml-2">
                      with {cls.teacher_name} in Room {cls.room_number}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {cls.start_time} - {cls.end_time}
                    </div>
                    <div className={`text-xs ${cls.is_next ? 'text-red-600' : 'text-gray-500'}`}>
                      {cls.is_next ? 'Next class' : `In ${cls.minutes_until} min`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week View</SelectItem>
                  <SelectItem value="day">Day View</SelectItem>
                </SelectContent>
              </Select>
              
              {viewMode === 'day' && (
                <Select value={selectedDay} onValueChange={setSelectedDay}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map(day => (
                      <SelectItem key={day.value} value={day.value}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-green-200 rounded border border-green-500"></div>
                <span>Current</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-blue-200 rounded border border-blue-500"></div>
                <span>Upcoming</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 bg-gray-200 rounded border border-gray-300"></div>
                <span>Past</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timetable Content */}
      <div>
        {viewMode === 'week' ? renderWeekView() : renderDayView()}
      </div>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Weekly Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {Object.values(schedule || {}).flat().length}
              </div>
              <div className="text-sm text-gray-600">Total Classes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {Object.values(schedule || {}).flat().filter(entry => 
                  new Set(Object.values(schedule || {}).flat().map(e => e.subject_name)).has(entry.subject_name)
                ).length}
              </div>
              <div className="text-sm text-gray-600">
                {userRole === 'student' ? 'Subjects' : 'Classes Teaching'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {Object.values(schedule || {}).flat().filter(entry => entry.is_lab).length}
              </div>
              <div className="text-sm text-gray-600">Lab Sessions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {upcomingClasses.length}
              </div>
              <div className="text-sm text-gray-600">Upcoming Today</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonalizedTimetable;