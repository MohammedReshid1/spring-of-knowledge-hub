import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, BookOpen, Users, MapPin, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';

export const TeacherScheduleWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useTeacherSchedule } = useWidgetData();
  const { data: schedule, isLoading, error } = useTeacherSchedule();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="p-3 bg-gray-100 rounded animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-500">Failed to load schedule</div>;
  }

  const scheduleData = schedule || [];

  const today = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center p-2 bg-blue-50 rounded-lg">
        <Calendar className="h-5 w-5 text-blue-600 mx-auto mb-1" />
        <div className="text-sm font-medium text-blue-900">Today's Schedule</div>
        <div className="text-xs text-blue-700">{today}</div>
      </div>

      {/* Schedule List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {scheduleData.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No classes scheduled for today</p>
          </div>
        ) : (
          scheduleData.map((class_, index) => {
          const isCurrentClass = class_.status === 'current';
          const isPastClass = index < scheduleData.findIndex(c => c.status === 'current');
          
          return (
            <div
              key={class_.id}
              className={`p-3 rounded-lg border transition-all ${
                isCurrentClass 
                  ? 'bg-green-50 border-green-200 shadow-md' 
                  : isPastClass
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : 'bg-white border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className={`h-4 w-4 ${
                      isCurrentClass ? 'text-green-600' : 'text-gray-500'
                    }`} />
                    <span className={`text-sm font-medium ${
                      isCurrentClass ? 'text-green-900' : 'text-gray-700'
                    }`}>
                      {class_.time}
                    </span>
                    {isCurrentClass && (
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        Current
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">{class_.subject}</span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-600">{class_.grade}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{class_.room}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    <span>{class_.students} students</span>
                  </div>
                </div>
                
                {isCurrentClass && (
                  <Link 
                    to={`/classes/${class_.id}/attendance`}
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Take Attendance
                  </Link>
                )}
              </div>
            </div>
          );
        })
      )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
        <div className="text-center p-2 bg-blue-50 rounded">
          <div className="text-lg font-bold text-blue-900">{scheduleData.length}</div>
          <div className="text-xs text-blue-700">Classes Today</div>
        </div>
        <div className="text-center p-2 bg-green-50 rounded">
          <div className="text-lg font-bold text-green-900">
            {scheduleData.reduce((sum, c) => sum + (c.students || 0), 0)}
          </div>
          <div className="text-xs text-green-700">Total Students</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Link 
          to="/classes"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          View All Classes
        </Link>
        <Link 
          to="/attendance"
          className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-center"
        >
          Attendance History
        </Link>
      </div>
    </div>
  );
};