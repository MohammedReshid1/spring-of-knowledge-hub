import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  User,
  BarChart3,
  MapPin,
  Phone
} from 'lucide-react';

interface StudentSummary {
  id: string;
  student_id: string;
  full_name: string;
  grade_level: string;
  class_name: string;
  overall_grade?: string;
  attendance_percentage: number;
  behavior_points: number;
  outstanding_balance: number;
  recent_activity: string[];
}

interface AttendanceData {
  summary: {
    total_days: number;
    days_present: number;
    days_absent: number;
    days_late: number;
    attendance_percentage: number;
    punctuality_percentage: number;
    trend: 'improving' | 'declining' | 'stable';
    current_streak: number;
    longest_streak: number;
  };
  monthly_stats: Array<{
    month: string;
    year: number;
    total_days: number;
    present_days: number;
    absent_days: number;
    late_days: number;
    percentage: number;
  }>;
  recent_attendance: Array<{
    date: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    check_in_time?: string;
    check_out_time?: string;
    remarks?: string;
    marked_by: string;
    location?: string;
  }>;
  patterns: {
    frequent_absence_days: string[];
    late_arrival_pattern: string;
    improvement_suggestions: string[];
  };
  alerts: Array<{
    id: string;
    type: 'consecutive_absence' | 'frequent_lateness' | 'pattern_concern';
    message: string;
    date: string;
    severity: 'low' | 'medium' | 'high';
    acknowledged: boolean;
  }>;
}

interface Props {
  children: StudentSummary[];
  selectedChild: string;
  onChildSelect: (childId: string) => void;
}

export const AttendanceTracking: React.FC<Props> = ({ children, selectedChild, onChildSelect }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const currentChild = selectedChild ? children.find(c => c.id === selectedChild) : children[0];
  const childId = currentChild?.id || '';

  const { data: attendanceData, isLoading } = useQuery<AttendanceData>({
    queryKey: ['attendance-tracking', childId],
    queryFn: async () => {
      if (!childId) throw new Error('No student selected');
      const response = await apiClient.get(`/communication/parent-dashboard/attendance/${childId}`);
      return response.data;
    },
    enabled: !!childId,
  });

  if (!currentChild) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No student data available</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading attendance data...</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle };
      case 'late': return { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock };
      case 'absent': return { bg: 'bg-red-100', text: 'text-red-800', icon: AlertTriangle };
      case 'excused': return { bg: 'bg-blue-100', text: 'text-blue-800', icon: CheckCircle };
      default: return { bg: 'bg-gray-100', text: 'text-gray-800', icon: CalendarIcon };
    }
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
  };

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 90) return 'text-blue-600';
    if (percentage >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-800 border-red-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Attendance Tracking</h2>
          <p className="text-muted-foreground">Monitor your child's attendance patterns and punctuality</p>
        </div>
        
        {children.length > 1 && (
          <Select value={selectedChild || children[0].id} onValueChange={onChildSelect}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select a child" />
            </SelectTrigger>
            <SelectContent>
              {children.map((child) => (
                <SelectItem key={child.id} value={child.id}>
                  {child.full_name} - {child.grade_level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Student Header */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                {currentChild.full_name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 className="text-2xl font-bold">{currentChild.full_name}</h3>
                <p className="text-muted-foreground">
                  {currentChild.grade_level} - {currentChild.class_name}
                </p>
                <p className="text-sm text-muted-foreground font-mono">
                  Student ID: {currentChild.student_id}
                </p>
              </div>
            </div>
            {attendanceData?.summary && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Attendance Rate</p>
                <div className="flex items-center space-x-2">
                  <p className={`text-3xl font-bold ${getAttendanceColor(attendanceData.summary.attendance_percentage)}`}>
                    {attendanceData.summary.attendance_percentage.toFixed(1)}%
                  </p>
                  {getTrendIcon(attendanceData.summary.trend)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {attendanceData.summary.days_present}/{attendanceData.summary.total_days} days
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Attendance Alerts */}
      {attendanceData?.alerts && attendanceData.alerts.filter(alert => !alert.acknowledged).length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Attendance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendanceData.alerts
                .filter(alert => !alert.acknowledged)
                .map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded border ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{alert.message}</p>
                        <p className="text-sm opacity-80">{formatDate(alert.date)}</p>
                      </div>
                      <Badge variant="outline">{alert.severity}</Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="daily">Daily Records</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Days</p>
                    <p className="text-2xl font-bold">{attendanceData?.summary.total_days || 0}</p>
                  </div>
                  <CalendarIcon className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Present</p>
                    <p className="text-2xl font-bold text-green-600">
                      {attendanceData?.summary.days_present || 0}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Late Arrivals</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {attendanceData?.summary.days_late || 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Absent</p>
                    <p className="text-2xl font-bold text-red-600">
                      {attendanceData?.summary.days_absent || 0}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trends */}
          {attendanceData?.monthly_stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Monthly Attendance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {attendanceData.monthly_stats.slice(-6).map((month, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{month.month} {month.year}</p>
                        <p className="text-sm text-muted-foreground">
                          {month.present_days}/{month.total_days} days present
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${getAttendanceColor(month.percentage)}`}>
                          {month.percentage.toFixed(1)}%
                        </p>
                        {month.absent_days > 0 && (
                          <p className="text-sm text-red-600">{month.absent_days} absent</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Achievement Stats */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Attendance Streaks</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Current Streak</span>
                    <span className="font-bold">{attendanceData?.summary.current_streak || 0} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Longest Streak</span>
                    <span className="font-bold">{attendanceData?.summary.longest_streak || 0} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Punctuality Rate</span>
                    <span className="font-bold">{attendanceData?.summary.punctuality_percentage.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-blue-600">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <Button variant="outline" className="w-full justify-start">
                    <Phone className="h-4 w-4 mr-2" />
                    Report Absence
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Schedule Leave
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Clock className="h-4 w-4 mr-2" />
                    Late Arrival Notice
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="daily" className="space-y-6">
          {attendanceData?.recent_attendance ? (
            <div className="space-y-4">
              {attendanceData.recent_attendance.map((record, index) => {
                const statusInfo = getStatusColor(record.status);
                const StatusIcon = statusInfo.icon;
                
                return (
                  <Card key={index}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center space-x-3">
                          <StatusIcon className={`h-5 w-5 ${statusInfo.text}`} />
                          <div>
                            <p className="font-medium">{formatDate(record.date)}</p>
                            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                              {record.check_in_time && (
                                <span>In: {formatTime(record.check_in_time)}</span>
                              )}
                              {record.check_out_time && (
                                <span>Out: {formatTime(record.check_out_time)}</span>
                              )}
                              {record.location && (
                                <div className="flex items-center">
                                  <MapPin className="h-3 w-3 mr-1" />
                                  {record.location}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <Badge className={`${statusInfo.bg} ${statusInfo.text}`}>
                            {record.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Marked by: {record.marked_by}
                          </p>
                        </div>
                      </div>
                      
                      {record.remarks && (
                        <div className="mt-3 p-2 bg-gray-50 rounded">
                          <p className="text-sm text-gray-700">{record.remarks}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No attendance records available</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          {attendanceData?.patterns && (
            <>
              {/* Attendance Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle>Attendance Patterns</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {attendanceData.patterns.frequent_absence_days.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Frequent Absence Days</h4>
                        <div className="flex flex-wrap gap-2">
                          {attendanceData.patterns.frequent_absence_days.map((day, index) => (
                            <Badge key={index} variant="outline" className="bg-red-50 text-red-700">
                              {day}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {attendanceData.patterns.late_arrival_pattern && (
                      <div>
                        <h4 className="font-medium mb-2">Late Arrival Pattern</h4>
                        <p className="text-sm text-muted-foreground">
                          {attendanceData.patterns.late_arrival_pattern}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Improvement Suggestions */}
              {attendanceData.patterns.improvement_suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-blue-600">Improvement Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {attendanceData.patterns.improvement_suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-2 flex-shrink-0" />
                          <p className="text-sm">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Calendar View</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Selected Date Details</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDate ? (
                  <div className="space-y-4">
                    <p className="font-medium">{selectedDate.toLocaleDateString()}</p>
                    {attendanceData?.recent_attendance?.find(
                      record => new Date(record.date).toDateString() === selectedDate.toDateString()
                    ) ? (
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm">Attendance record available for this date</p>
                      </div>
                    ) : (
                      <div className="p-3 bg-gray-50 rounded">
                        <p className="text-sm text-muted-foreground">No attendance record for this date</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Select a date to view details</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};