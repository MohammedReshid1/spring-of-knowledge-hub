import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { 
  Calendar, 
  Users, 
  TrendingUp, 
  TrendingDown, 
  Clock,
  UserCheck,
  UserX,
  Award,
  AlertTriangle,
  Download
} from 'lucide-react';

interface AttendanceSummary {
  total_students: number;
  average_attendance_rate: number;
  total_absences: number;
  total_late_arrivals: number;
  perfect_attendance: string[];
  concerning_attendance: Array<{
    student_id: string;
    attendance_rate: number;
  }>;
  class_attendance_rates: Record<string, number>;
  best_performing_class: string;
  daily_trends: Record<string, number>;
}

export const AttendanceReports: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedClass, setSelectedClass] = useState<string>('');
  const { selectedBranch } = useBranch();

  const { data: attendanceSummary, isLoading } = useQuery<AttendanceSummary>({
    queryKey: ['attendance-summary-v2', dateRange, selectedClass, selectedBranch?.id],
    queryFn: async () => {
      const params = {
        ...(dateRange?.from && { start_date: dateRange.from.toISOString().split('T')[0] }),
        ...(dateRange?.to && { end_date: dateRange.to.toISOString().split('T')[0] }),
        ...(selectedClass && selectedClass !== 'all' && { class_id: selectedClass }),
        branch_id: selectedBranch?.id
      };
      
      const { data } = await apiClient.getAttendanceReportSummary(params);
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-list'],
    queryFn: async () => {
      const response = await apiClient.get('/classes');
      return response.data;
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Loading attendance reports...</div>;
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 90) return 'text-blue-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAttendanceBadge = (rate: number) => {
    if (rate >= 95) return 'bg-green-100 text-green-800';
    if (rate >= 90) return 'bg-blue-100 text-blue-800';
    if (rate >= 85) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getDayOfWeekColor = (day: string, rate: number) => {
    if (rate >= 95) return 'bg-green-50 border-green-200';
    if (rate >= 90) return 'bg-blue-50 border-blue-200';
    if (rate >= 85) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Attendance Reports</h2>
          <p className="text-muted-foreground">Track and analyze student attendance patterns</p>
        </div>
        
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <DatePickerWithRange
          date={dateRange}
          onDateChange={setDateRange}
          placeholder="Select date range"
        />

        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((cls: any) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Attendance Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Attendance</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getAttendanceColor(attendanceSummary?.average_attendance_rate || 0)}`}>
              {attendanceSummary?.average_attendance_rate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall school attendance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {attendanceSummary?.total_students || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Students tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Absences</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {attendanceSummary?.total_absences || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Days missed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {attendanceSummary?.total_late_arrivals || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Tardiness incidents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Attendance Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Daily Attendance Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceSummary?.daily_trends ? (
            <div className="grid gap-3 md:grid-cols-5">
              {Object.entries(attendanceSummary.daily_trends).map(([day, rate]) => (
                <div key={day} className={`p-4 border rounded-lg ${getDayOfWeekColor(day, rate)}`}>
                  <div className="text-center">
                    <div className="font-medium mb-1">{day}</div>
                    <div className={`text-xl font-bold ${getAttendanceColor(rate)}`}>
                      {rate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">attendance</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No daily trend data available</p>
          )}
        </CardContent>
      </Card>

      {/* Class Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2" />
            Class Attendance Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceSummary?.class_attendance_rates ? (
            <div className="space-y-3">
              {Object.entries(attendanceSummary.class_attendance_rates)
                .sort(([,a], [,b]) => b - a)
                .map(([classId, rate]) => {
                  const className = classes.find((c: any) => c.id === classId)?.name || `Class ${classId}`;
                  return (
                    <div key={classId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium">{className}</span>
                        {attendanceSummary.best_performing_class === classId && (
                          <Award className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${rate}%` }}
                          ></div>
                        </div>
                        <Badge className={getAttendanceBadge(rate)}>
                          {rate.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No class attendance data available</p>
          )}
        </CardContent>
      </Card>

      {/* Recognition and Concerns */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-green-800">
              <Award className="h-5 w-5 mr-2" />
              Perfect Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceSummary?.perfect_attendance && attendanceSummary.perfect_attendance.length > 0 ? (
              <div className="space-y-2">
                {attendanceSummary.perfect_attendance.map((studentId) => (
                  <div key={studentId} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                    <span className="text-sm font-medium">{studentId}</span>
                    <Badge className="bg-green-100 text-green-800">100%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Award className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No perfect attendance records</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Attendance Concerns
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceSummary?.concerning_attendance && attendanceSummary.concerning_attendance.length > 0 ? (
              <div className="space-y-2">
                {attendanceSummary.concerning_attendance.map((student) => (
                  <div key={student.student_id} className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded">
                    <span className="text-sm font-medium">{student.student_id}</span>
                    <Badge className="bg-red-100 text-red-800">
                      {student.attendance_rate.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <UserCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No attendance concerns</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance Health Indicators */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Health Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-green-800">Overall Health</span>
              </div>
              <p className="text-sm text-green-700">
                {(attendanceSummary?.average_attendance_rate || 0) >= 90 
                  ? 'Excellent attendance rates across the school'
                  : (attendanceSummary?.average_attendance_rate || 0) >= 85
                  ? 'Good attendance with room for improvement'
                  : 'Attendance rates need attention and intervention'
                }
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="font-medium text-blue-800">Best Day</span>
              </div>
              <p className="text-sm text-blue-700">
                {attendanceSummary?.daily_trends 
                  ? Object.entries(attendanceSummary.daily_trends)
                      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'
                  : 'No data available'
                } shows highest attendance rates
              </p>
            </div>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="font-medium text-orange-800">Action Needed</span>
              </div>
              <p className="text-sm text-orange-700">
                {(attendanceSummary?.concerning_attendance?.length || 0)} students require attendance intervention
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Report Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Users className="h-6 w-6 mb-2" />
              Detailed Student Report
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <Calendar className="h-6 w-6 mb-2" />
              Daily Attendance Log
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <AlertTriangle className="h-6 w-6 mb-2" />
              Concern Alerts
            </Button>

            <Button variant="outline" className="h-20 flex flex-col items-center justify-center">
              <TrendingUp className="h-6 w-6 mb-2" />
              Trend Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};