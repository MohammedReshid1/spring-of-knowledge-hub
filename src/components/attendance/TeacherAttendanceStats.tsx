import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiClient } from '@/lib/api';
import {
  CheckCircle,
  XCircle,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  BarChart3,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeacherAttendanceStatsProps {
  classId?: string;
  subjectId?: string;
  teacherId: string;
  periodDays?: number;
}

interface AttendanceAnalytics {
  period_start: string;
  period_end: string;
  total_students: number;
  total_days: number;
  average_attendance_rate: number;
  overall_attendance_rate: number;
  punctuality_rate: number;
  absence_rate: number;
  late_rate: number;
  excused_rate: number;
  unresolved_alerts: number;
  trends: {
    attendance_trend: 'improving' | 'stable' | 'declining';
    punctuality_trend: string;
    weekly_comparison: number;
    monthly_comparison: number;
  };
  top_performers: Array<{
    student_id: string;
    student_name: string;
    attendance_rate: number;
    perfect_days: number;
  }>;
  attendance_concerns: Array<{
    student_id: string;
    student_name: string;
    attendance_rate: number;
    consecutive_absences: number;
    concern_level: 'low' | 'medium' | 'high' | 'critical';
  }>;
  class_breakdown: Array<{
    class_id: string;
    class_name: string;
    total_students: number;
    attendance_rate: number;
  }>;
}

export const TeacherAttendanceStats: React.FC<TeacherAttendanceStatsProps> = ({
  classId,
  subjectId,
  teacherId,
  periodDays = 30,
}) => {
  const { data: analytics, isLoading, error } = useQuery<AttendanceAnalytics>({
    queryKey: ['attendance-analytics', classId, subjectId, teacherId, periodDays],
    queryFn: async () => {
      const params: any = {
        period_days: periodDays,
        teacher_id: teacherId,
      };
      if (classId) params.class_id = classId;
      if (subjectId) params.subject_id = subjectId;

      const response = await apiClient.getAttendanceAnalytics(params);
      if (response.error) throw new Error(response.error);
      return response.data;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span className="text-slate-600">Loading attendance statistics...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card className="border-red-200">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <p className="text-red-600 font-medium">Failed to load attendance statistics</p>
          <p className="text-slate-600 text-sm mt-2">
            {error instanceof Error ? error.message : 'Please try again later'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <div className="h-4 w-4 bg-slate-400 rounded-full" />;
  };

  const getTrendColor = (trend: string) => {
    if (trend === 'improving') return 'text-green-600 bg-green-50';
    if (trend === 'declining') return 'text-red-600 bg-red-50';
    return 'text-slate-600 bg-slate-50';
  };

  const getConcernColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Attendance Rate */}
        <Card className="border-green-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Overall Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600">
                  {analytics.overall_attendance_rate.toFixed(1)}%
                </span>
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <Progress
                value={analytics.overall_attendance_rate}
                className="h-2"
              />
              <p className="text-xs text-slate-600">
                {analytics.total_students} students tracked
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Absence Rate */}
        <Card className="border-red-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Absence Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600">
                  {analytics.absence_rate.toFixed(1)}%
                </span>
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <Progress
                value={analytics.absence_rate}
                className="h-2 bg-red-100"
              />
              <p className="text-xs text-slate-600">
                Over {analytics.total_days} days
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Punctuality Rate */}
        <Card className="border-blue-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Punctuality Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600">
                  {analytics.punctuality_rate.toFixed(1)}%
                </span>
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <Progress
                value={analytics.punctuality_rate}
                className="h-2 bg-blue-100"
              />
              <p className="text-xs text-slate-600">
                {analytics.late_rate.toFixed(1)}% late arrivals
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card className="border-orange-200/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Attendance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-orange-600">
                  {analytics.unresolved_alerts}
                </span>
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <p className="text-xs text-slate-600">
                {analytics.attendance_concerns.length} students need attention
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trend Analysis */}
      <Card className="border-purple-200/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Attendance Trends
          </CardTitle>
          <CardDescription>
            Analyzing trends over the last {periodDays} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className={cn("p-2 rounded-lg", getTrendColor(analytics.trends.attendance_trend))}>
                {getTrendIcon(analytics.trends.attendance_trend)}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Overall Trend</p>
                <p className="text-xs text-slate-600 capitalize">{analytics.trends.attendance_trend}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className={cn(
                "p-2 rounded-lg",
                analytics.trends.weekly_comparison > 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
              )}>
                {analytics.trends.weekly_comparison > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Weekly Change</p>
                <p className="text-xs text-slate-600">
                  {analytics.trends.weekly_comparison > 0 ? '+' : ''}{analytics.trends.weekly_comparison.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Students Tracked</p>
                <p className="text-xs text-slate-600">{analytics.total_students} students</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performers */}
        {analytics.top_performers.length > 0 && (
          <Card className="border-green-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Top Performers
              </CardTitle>
              <CardDescription>
                Students with excellent attendance records
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.top_performers.slice(0, 5).map((student, index) => (
                  <div
                    key={student.student_id}
                    className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200"
                  >
                    <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {student.student_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {student.perfect_days} perfect days
                      </p>
                    </div>
                    <Badge className="bg-green-600 text-white">
                      {student.attendance_rate.toFixed(1)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Attendance Concerns */}
        {analytics.attendance_concerns.length > 0 && (
          <Card className="border-red-200/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                Attendance Concerns
              </CardTitle>
              <CardDescription>
                Students requiring attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {analytics.attendance_concerns.slice(0, 5).map((student) => (
                  <div
                    key={student.student_id}
                    className="flex items-center gap-3 p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {student.student_name}
                      </p>
                      <p className="text-xs text-slate-600">
                        {student.consecutive_absences > 0 && (
                          <span>{student.consecutive_absences} consecutive absences</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-red-700">
                        {student.attendance_rate.toFixed(1)}%
                      </span>
                      <Badge className={cn("text-xs border", getConcernColor(student.concern_level))}>
                        {student.concern_level}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Class Breakdown */}
      {analytics.class_breakdown && analytics.class_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Class Breakdown
            </CardTitle>
            <CardDescription>
              Attendance rates across your classes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.class_breakdown.map((cls) => (
                <div key={cls.class_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-slate-900">{cls.class_name}</p>
                      <Badge variant="outline" className="text-xs">
                        {cls.total_students} students
                      </Badge>
                    </div>
                    <span className={cn(
                      "text-sm font-semibold",
                      cls.attendance_rate >= 90 ? "text-green-600" :
                      cls.attendance_rate >= 75 ? "text-yellow-600" :
                      "text-red-600"
                    )}>
                      {cls.attendance_rate.toFixed(1)}%
                    </span>
                  </div>
                  <Progress
                    value={cls.attendance_rate}
                    className={cn(
                      "h-2",
                      cls.attendance_rate >= 90 ? "bg-green-100" :
                      cls.attendance_rate >= 75 ? "bg-yellow-100" :
                      "bg-red-100"
                    )}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
