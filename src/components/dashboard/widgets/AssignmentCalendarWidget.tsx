import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, BookOpen } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, isBefore, isAfter, addDays } from 'date-fns';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface Assignment {
  id: string;
  title: string;
  subject_name: string;
  due_date: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  assignment_type: string;
}

interface AssignmentCalendarWidgetProps {
  userRole: 'student' | 'teacher' | 'parent' | 'admin';
  className?: string;
}

const AssignmentCalendarWidget: React.FC<AssignmentCalendarWidgetProps> = ({
  userRole,
  className = ""
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['assignments-calendar', userRole, format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const startDate = startOfMonth(currentDate);
      const endDate = endOfMonth(currentDate);
      
      let endpoint = '/homework/assignments/calendar';
      if (userRole === 'student') {
        endpoint = '/homework/assignments/student/calendar';
      } else if (userRole === 'teacher') {
        endpoint = '/homework/assignments/teacher/calendar';
      } else if (userRole === 'parent') {
        endpoint = '/homework/assignments/parent/calendar';
      }
      
      const response = await api.get(endpoint, {
        params: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString()
        }
      });
      return response.data.assignments || [];
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const monthDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentDate),
      end: endOfMonth(currentDate)
    });
  }, [currentDate]);

  const getAssignmentsForDate = (date: Date) => {
    return assignments.filter(assignment => 
      isSameDay(new Date(assignment.due_date), date)
    );
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const getDayStatus = (date: Date, dayAssignments: Assignment[]) => {
    if (dayAssignments.length === 0) return '';
    
    const now = new Date();
    const hasOverdue = dayAssignments.some(a => 
      isBefore(new Date(a.due_date), now) && a.status !== 'submitted' && a.status !== 'graded'
    );
    const hasDueToday = isSameDay(date, now) && dayAssignments.some(a => 
      a.status !== 'submitted' && a.status !== 'graded'
    );
    const hasDueSoon = isAfter(new Date(date), now) && 
      isBefore(new Date(date), addDays(now, 3)) && 
      dayAssignments.some(a => a.status !== 'submitted' && a.status !== 'graded');
    
    if (hasOverdue) return 'ring-2 ring-red-500 bg-red-50';
    if (hasDueToday) return 'ring-2 ring-orange-500 bg-orange-50';
    if (hasDueSoon) return 'ring-1 ring-yellow-500 bg-yellow-50';
    return 'bg-blue-50';
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleDayClick = (date: Date) => {
    const dayAssignments = getAssignmentsForDate(date);
    if (dayAssignments.length > 0) {
      // Navigate to homework page with date filter
      const dateStr = format(date, 'yyyy-MM-dd');
      if (userRole === 'student') {
        navigate(`/homework?date=${dateStr}`);
      } else if (userRole === 'teacher') {
        navigate(`/homework/manage?due_date=${dateStr}`);
      } else if (userRole === 'parent') {
        navigate(`/homework/parent?date=${dateStr}`);
      }
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5" />
            Assignment Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <CalendarIcon className="h-5 w-5" />
            Assignment Calendar
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
        <div className="text-sm text-gray-600">
          {format(currentDate, 'MMMM yyyy')}
        </div>
      </CardHeader>
      
      <CardContent className="p-3">
        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1 mb-4">
          {/* Day headers */}
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <div key={index} className="text-xs font-medium text-center text-gray-500 p-2">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {monthDays.map((date, index) => {
            const dayAssignments = getAssignmentsForDate(date);
            const dayStatus = getDayStatus(date, dayAssignments);
            const isCurrentDay = isToday(date);
            
            return (
              <div
                key={index}
                className={`
                  relative p-1 text-xs text-center cursor-pointer hover:bg-gray-100 rounded
                  ${isCurrentDay ? 'font-bold text-blue-600' : ''}
                  ${dayStatus}
                  ${dayAssignments.length > 0 ? 'cursor-pointer' : 'cursor-default'}
                `}
                onClick={() => handleDayClick(date)}
              >
                <div className="h-6 flex items-center justify-center">
                  {format(date, 'd')}
                </div>
                
                {/* Assignment indicators */}
                {dayAssignments.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 flex justify-center">
                    {dayAssignments.slice(0, 3).map((assignment, idx) => (
                      <div
                        key={idx}
                        className={`w-1 h-1 rounded-full mx-0.5 ${getPriorityColor(assignment.priority)}`}
                        title={`${assignment.title} - ${assignment.subject_name}`}
                      />
                    ))}
                    {dayAssignments.length > 3 && (
                      <div className="w-1 h-1 rounded-full mx-0.5 bg-gray-400" />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium">Legend:</span>
            <span className="text-gray-500">Click dates to view details</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>Urgent</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500"></div>
              <span>High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Low</span>
            </div>
          </div>
        </div>

        {/* Upcoming deadlines */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Next 7 Days
          </h4>
          
          {assignments
            .filter(assignment => {
              const dueDate = new Date(assignment.due_date);
              const now = new Date();
              return isAfter(dueDate, now) && isBefore(dueDate, addDays(now, 8));
            })
            .slice(0, 3)
            .map(assignment => (
              <div key={assignment.id} className="flex items-center justify-between text-xs mb-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{assignment.title}</p>
                  <p className="text-gray-600 truncate">{assignment.subject_name}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs px-1 py-0">
                    {format(new Date(assignment.due_date), 'MMM dd')}
                  </Badge>
                  <div 
                    className={`w-2 h-2 rounded-full ${getPriorityColor(assignment.priority)}`}
                    title={`${assignment.priority} priority`}
                  />
                </div>
              </div>
            ))
          }
          
          {assignments.filter(assignment => {
            const dueDate = new Date(assignment.due_date);
            const now = new Date();
            return isAfter(dueDate, now) && isBefore(dueDate, addDays(now, 8));
          }).length === 0 && (
            <p className="text-xs text-gray-500">No upcoming deadlines</p>
          )}
        </div>

        {/* Quick Action */}
        <div className="mt-4 pt-4 border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
            onClick={() => {
              if (userRole === 'student') {
                navigate('/homework');
              } else if (userRole === 'teacher') {
                navigate('/homework/manage');
              } else if (userRole === 'parent') {
                navigate('/homework/parent');
              }
            }}
          >
            <BookOpen className="h-3 w-3 mr-1" />
            View All Assignments
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default AssignmentCalendarWidget;