import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useBranch } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Users, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Award,
  UserCheck,
  UserX,
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
  daily_trends: Record<string, number>;
  total_records: number;
  date_range: {
    start_date: string;
    end_date: string;
  };
}

export const AttendanceAnalytics: React.FC = () => {
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
    return <div className="text-center py-8">Loading attendance analytics...</div>;
  }

  const getAttendanceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 bg-green-50 border-green-200';
    if (rate >= 90) return 'text-blue-600 bg-blue-50 border-blue-200';
    if (rate >= 85) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (rate >= 75) return 'text-orange-600 bg-orange-50 border-orange-200';
    return 'text-red-600 bg-red-50 border-red-200';
  };

  const formatDateRange = () => {
    if (attendanceSummary?.date_range) {
      const start = new Date(attendanceSummary.date_range.start_date).toLocaleDateString();
      const end = new Date(attendanceSummary.date_range.end_date).toLocaleDateString();
      return `${start} - ${end}`;
    }
    return 'All time';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Attendance Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive attendance analysis and insights • {formatDateRange()}
          </p>
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
          className="w-72"
        />
        
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes.map((classItem: any) => (
              <SelectItem key={classItem.class_id} value={classItem.class_id}>
                {classItem.class_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceSummary?.average_attendance_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Average attendance rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceSummary?.total_students || 0}</div>
            <p className="text-xs text-muted-foreground">Students tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Absences</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceSummary?.total_absences || 0}</div>
            <p className="text-xs text-muted-foreground">Total absence records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Late Arrivals</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{attendanceSummary?.total_late_arrivals || 0}</div>
            <p className="text-xs text-muted-foreground">Students arriving late</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Perfect Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Award className="h-5 w-5 mr-2 text-gold" />
              Perfect Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceSummary?.perfect_attendance && attendanceSummary.perfect_attendance.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  {attendanceSummary.perfect_attendance.length} students with perfect attendance
                </p>
                <div className="grid gap-2 max-h-48 overflow-y-auto">
                  {attendanceSummary.perfect_attendance.map((studentId) => (
                    <div key={studentId} className="flex items-center justify-between p-2 bg-green-50 rounded-lg">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                        <span className="text-sm font-medium">{studentId}</span>
                      </div>
                      <Badge variant="outline" className="text-green-600 bg-white">
                        100%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No perfect attendance records for the selected period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Concerning Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2 text-red-600" />
              Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceSummary?.concerning_attendance && attendanceSummary.concerning_attendance.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Students with attendance below 75%
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {attendanceSummary.concerning_attendance.map((student) => (
                    <div key={student.student_id} className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                        <span className="text-sm font-medium">{student.student_id}</span>
                      </div>
                      <Badge variant="outline" className="text-red-600 bg-white">
                        {student.attendance_rate}%
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No concerning attendance patterns detected
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Class Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 mr-2" />
            Class Attendance Rates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceSummary?.class_attendance_rates && Object.keys(attendanceSummary.class_attendance_rates).length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(attendanceSummary.class_attendance_rates).map(([classId, rate]) => {
                const classInfo = classes.find((c: any) => c.class_id === classId);
                const className = classInfo?.class_name || classId;
                
                return (
                  <div key={classId} className={`p-4 rounded-lg border ${getAttendanceColor(rate)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{className}</span>
                      <Badge variant="outline" className="bg-white">
                        {rate}%
                      </Badge>
                    </div>
                    <div className="w-full bg-white/50 rounded-full h-2">
                      <div 
                        className="bg-current h-2 rounded-full opacity-60" 
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No class attendance data available
            </p>
          )}
        </CardContent>
      </Card>

      {/* Daily Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Daily Attendance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceSummary?.daily_trends && Object.keys(attendanceSummary.daily_trends).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(attendanceSummary.daily_trends).map(([day, rate]) => (
                <div key={day} className="flex items-center justify-between">
                  <span className="text-sm font-medium w-20">{day}</span>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-full bg-gray-200 rounded-full h-3 max-w-xs">
                      <div 
                        className={`h-3 rounded-full ${
                          rate >= 95 ? 'bg-green-500' : 
                          rate >= 90 ? 'bg-blue-500' : 
                          rate >= 85 ? 'bg-yellow-500' : 
                          'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(rate, 100)}%` }}
                      ></div>
                    </div>
                    <Badge variant="outline" className={getAttendanceColor(rate)}>
                      {rate}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No daily trend data available
            </p>
          )}

          <div className="mt-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Insight:</strong> Friday typically shows lower attendance rates. Consider implementing 
              engagement activities or reviewing scheduling for end-of-week classes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Summary Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">{attendanceSummary?.total_records || 0}</div>
              <p className="text-sm text-muted-foreground">Total Attendance Records</p>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">
                {attendanceSummary ? 
                  Math.round((attendanceSummary.total_records - attendanceSummary.total_absences) / attendanceSummary.total_records * 100) || 0
                  : 0}%
              </div>
              <p className="text-sm text-muted-foreground">Present Rate</p>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-lg font-bold">
                {attendanceSummary ? 
                  (attendanceSummary.total_late_arrivals / Math.max(attendanceSummary.total_records, 1) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-sm text-muted-foreground">Late Arrival Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};