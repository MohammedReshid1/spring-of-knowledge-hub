import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar as CalendarIcon, Users, AlertTriangle, Clock } from 'lucide-react';
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isBefore, startOfDay } from 'date-fns';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface AttendanceCalendarViewProps {
  selectedClass?: string;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

interface DayAttendanceData {
  date: string;
  total_students: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  attendance_rate: number;
  has_alerts: boolean;
}

interface AttendanceAlert {
  id: string;
  student_id: string;
  student_name: string;
  alert_type: string;
  severity: string;
  message: string;
  date: string;
}

const AttendanceCalendarView: React.FC<AttendanceCalendarViewProps> = ({
  selectedClass,
  onDateSelect,
  className = ""
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'summary'>('calendar');

  // Fetch attendance data for the current month
  const { data: monthlyAttendance = [], isLoading: attendanceLoading } = useQuery<DayAttendanceData[]>({
    queryKey: ['attendance-calendar', calendarMonth.getFullYear(), calendarMonth.getMonth(), selectedClass],
    queryFn: async () => {
      const startDate = startOfMonth(calendarMonth);
      const endDate = endOfMonth(calendarMonth);
      
      const response = await apiClient.getAttendance({
        ...(selectedClass && selectedClass !== 'all' && { class_id: selectedClass }),
        date: format(startDate, 'yyyy-MM-dd') // This would need to be a date range in a real implementation
      });

      if (response.error) throw new Error(response.error);
      
      // Group by date and calculate daily statistics
      const dailyStats: { [key: string]: DayAttendanceData } = {};
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      
      // Initialize all days with zero data
      days.forEach(day => {
        const dateKey = format(day, 'yyyy-MM-dd');
        dailyStats[dateKey] = {
          date: dateKey,
          total_students: 0,
          present_count: 0,
          absent_count: 0,
          late_count: 0,
          attendance_rate: 0,
          has_alerts: false
        };
      });

      // Process actual attendance data
      if (response.data) {
        response.data.forEach((record: any) => {
          const dateKey = format(new Date(record.attendance_date), 'yyyy-MM-dd');
          if (!dailyStats[dateKey]) return;

          dailyStats[dateKey].total_students++;
          
          switch (record.status) {
            case 'present':
              dailyStats[dateKey].present_count++;
              break;
            case 'absent':
              dailyStats[dateKey].absent_count++;
              break;
            case 'late':
            case 'tardy':
              dailyStats[dateKey].late_count++;
              break;
          }
        });

        // Calculate attendance rates
        Object.keys(dailyStats).forEach(dateKey => {
          const day = dailyStats[dateKey];
          if (day.total_students > 0) {
            day.attendance_rate = (day.present_count / day.total_students) * 100;
          }
        });
      }

      return Object.values(dailyStats);
    },
    enabled: true,
    refetchOnWindowFocus: false,
  });

  // Fetch alerts for selected date
  const { data: dailyAlerts = [], isLoading: alertsLoading } = useQuery<AttendanceAlert[]>({
    queryKey: ['attendance-alerts', format(selectedDate, 'yyyy-MM-dd'), selectedClass],
    queryFn: async () => {
      const response = await apiClient.getAttendanceAlerts({
        // Note: The API might need to be extended to filter by date
      });

      if (response.error) throw new Error(response.error);
      return response.data?.filter((alert: any) => 
        isSameDay(new Date(alert.triggered_date || alert.date), selectedDate)
      ) || [];
    },
    enabled: !!selectedDate,
  });

  const getAttendanceForDate = (date: Date): DayAttendanceData | undefined => {
    return monthlyAttendance.find(day => isSameDay(new Date(day.date), date));
  };

  const getAttendanceColor = (attendanceRate: number): string => {
    if (attendanceRate >= 95) return 'bg-green-500';
    if (attendanceRate >= 90) return 'bg-green-400';
    if (attendanceRate >= 80) return 'bg-yellow-400';
    if (attendanceRate >= 70) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const getDayContent = (date: Date) => {
    const dayData = getAttendanceForDate(date);
    const isSelectedDate = isSameDay(date, selectedDate);
    const isCurrentDay = isToday(date);
    const isPastDate = isBefore(date, startOfDay(new Date()));
    
    if (!dayData || dayData.total_students === 0) {
      return (
        <div className={`
          w-full h-full flex items-center justify-center text-sm
          ${isSelectedDate ? 'bg-blue-100 border-2 border-blue-500' : ''}
          ${isCurrentDay ? 'font-bold text-blue-600' : ''}
          ${isPastDate && !dayData ? 'text-gray-400' : ''}
        `}>
          {date.getDate()}
        </div>
      );
    }

    const attendanceColor = getAttendanceColor(dayData.attendance_rate);

    return (
      <div className={`
        w-full h-full flex flex-col items-center justify-center text-xs
        ${isSelectedDate ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
        ${isCurrentDay ? 'font-bold' : ''}
      `}>
        <div className={`
          w-6 h-6 rounded-full flex items-center justify-center text-white text-xs
          ${attendanceColor}
        `}>
          {date.getDate()}
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {dayData.attendance_rate.toFixed(0)}%
        </div>
        {dayData.has_alerts && (
          <div className="w-2 h-2 bg-red-500 rounded-full mt-1"></div>
        )}
      </div>
    );
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateSelect?.(date);
  };

  const selectedDayData = getAttendanceForDate(selectedDate);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Premium Header */}
      <div className="relative">
        {/* Background card with glass morphism */}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/30 rounded-3xl shadow-premium"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/8 via-indigo-500/8 to-blue-500/8 rounded-3xl pointer-events-none"></div>

        <div className="relative p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 border border-purple-200/50">
                <CalendarIcon className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-slate-900 via-purple-800 to-indigo-900 bg-clip-text text-transparent">
                  Attendance Calendar
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm">
                  Interactive calendar view with daily attendance insights
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Select value={viewMode} onValueChange={(value: 'calendar' | 'summary') => setViewMode(value)}>
                <SelectTrigger className="w-36 bg-white/80 border-purple-200/50 hover:border-purple-300 shadow-sm hover:shadow-md transition-all duration-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar">Calendar View</SelectItem>
                  <SelectItem value="summary">Summary View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'calendar' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {format(calendarMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCalendarMonth(new Date())}
                    >
                      Today
                    </Button>
                  </div>
                </div>
                {/* Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>95%+</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    <span>90-94%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <span>80-89%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                    <span>70-79%</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <span>&lt;70%</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {attendanceLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  </div>
                ) : (
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && handleDateClick(date)}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    components={{
                      Day: ({ date }) => (
                        <button
                          className="w-10 h-10 p-0 hover:bg-gray-100 rounded"
                          onClick={() => handleDateClick(date)}
                        >
                          {getDayContent(date)}
                        </button>
                      )
                    }}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

          {/* Premium Daily Details */}
          <div>
            <div className="relative">
              <div className="absolute inset-0 bg-white/90 backdrop-blur-premium border border-white/40 rounded-3xl shadow-premium-lg"></div>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-green-500/5 rounded-3xl pointer-events-none"></div>

              <Card className="relative bg-transparent border-0 shadow-none">
                <CardHeader className="pb-6">
                  <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-900 via-emerald-800 to-green-900 bg-clip-text text-transparent">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </CardTitle>
                  <p className="text-slate-600 text-sm">
                    Daily attendance overview and insights
                  </p>
                </CardHeader>
              <CardContent>
                {selectedDayData ? (
                  <div className="space-y-4">
                    {/* Premium Statistics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/8 to-emerald-500/8 rounded-2xl pointer-events-none"></div>
                        <div className="relative text-center p-4">
                          <div className="text-2xl font-bold bg-gradient-to-br from-green-600 to-emerald-600 bg-clip-text text-transparent mb-1">
                            {selectedDayData.present_count}
                          </div>
                          <div className="text-xs font-medium text-slate-600">Present</div>
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-red-500/8 to-rose-500/8 rounded-2xl pointer-events-none"></div>
                        <div className="relative text-center p-4">
                          <div className="text-2xl font-bold bg-gradient-to-br from-red-600 to-rose-600 bg-clip-text text-transparent mb-1">
                            {selectedDayData.absent_count}
                          </div>
                          <div className="text-xs font-medium text-slate-600">Absent</div>
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/8 to-orange-500/8 rounded-2xl pointer-events-none"></div>
                        <div className="relative text-center p-4">
                          <div className="text-2xl font-bold bg-gradient-to-br from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-1">
                            {selectedDayData.late_count}
                          </div>
                          <div className="text-xs font-medium text-slate-600">Late</div>
                        </div>
                      </div>

                      <div className="relative group">
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-glass border border-white/40 rounded-2xl shadow-premium group-hover:shadow-premium-lg transition-shadow duration-300"></div>
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/8 to-indigo-500/8 rounded-2xl pointer-events-none"></div>
                        <div className="relative text-center p-4">
                          <div className="text-2xl font-bold bg-gradient-to-br from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                            {selectedDayData.attendance_rate.toFixed(1)}%
                          </div>
                          <div className="text-xs font-medium text-slate-600">Rate</div>
                        </div>
                      </div>
                    </div>

                    {/* Alerts */}
                    {dailyAlerts.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm flex items-center text-red-600">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Alerts ({dailyAlerts.length})
                        </h4>
                        <div className="space-y-1">
                          {dailyAlerts.slice(0, 3).map((alert) => (
                            <div key={alert.id} className="p-2 bg-red-50 rounded text-xs">
                              <div className="font-medium text-red-800">
                                {alert.student_name}
                              </div>
                              <div className="text-red-600">
                                {alert.alert_type.replace('_', ' ')}
                              </div>
                            </div>
                          ))}
                          {dailyAlerts.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
                              +{dailyAlerts.length - 3} more alerts
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDateSelect?.(selectedDate)}
                        className="w-full"
                      >
                        <Clock className="h-4 w-4 mr-2" />
                        Mark Attendance
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No attendance data for this date</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Summary View */
        <Card>
          <CardHeader>
            <CardTitle>Monthly Summary - {format(calendarMonth, 'MMMM yyyy')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-600">
                  {monthlyAttendance.reduce((sum, day) => sum + day.total_students, 0)}
                </div>
                <div className="text-sm text-blue-600">Total Records</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-600">
                  {monthlyAttendance.reduce((sum, day) => sum + day.present_count, 0)}
                </div>
                <div className="text-sm text-green-600">Present Days</div>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-3xl font-bold text-red-600">
                  {monthlyAttendance.reduce((sum, day) => sum + day.absent_count, 0)}
                </div>
                <div className="text-sm text-red-600">Absent Days</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-3xl font-bold text-yellow-600">
                  {monthlyAttendance.reduce((sum, day) => sum + day.late_count, 0)}
                </div>
                <div className="text-sm text-yellow-600">Late Arrivals</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AttendanceCalendarView;