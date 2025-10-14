import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CheckCircle, AlertCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
const mockAttendanceData = {
  overall: {
    percentage: 92.5,
    present: 148,
    absent: 12,
    late: 5,
    totalDays: 160,
    trend: 'up',
    trendValue: 2.3
  },
  thisMonth: {
    percentage: 95.0,
    present: 19,
    absent: 1,
    late: 0,
    totalDays: 20
  },
  thisWeek: {
    percentage: 100.0,
    present: 5,
    absent: 0,
    late: 0,
    totalDays: 5
  },
  recentRecords: [
    { date: '2025-09-03', status: 'present', time: '08:00' },
    { date: '2025-09-02', status: 'present', time: '08:05' },
    { date: '2025-09-01', status: 'present', time: '07:58' },
    { date: '2025-08-31', status: 'absent', reason: 'Sick' },
    { date: '2025-08-30', status: 'present', time: '08:10' }
  ]
};

export const AttendanceSummaryWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useStudentAttendance } = useWidgetData();
  const { data: attendanceData, isLoading, error } = useStudentAttendance();

  if (error) {
    return <div className="text-sm text-red-500">Failed to load attendance data</div>;
  }

  const attendance = attendanceData || { overall: { percentage: 0, present: 0, absent: 0, late: 0, totalDays: 0 } };
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const { overall, thisMonth, thisWeek, recentRecords } = mockAttendanceData;

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600';
    if (percentage >= 90) return 'text-blue-600';
    if (percentage >= 80) return 'text-orange-600';
    return 'text-red-600';
  };

  const getAttendanceBadgeColor = (percentage: number) => {
    if (percentage >= 95) return 'bg-green-100 text-green-800';
    if (percentage >= 90) return 'bg-blue-100 text-blue-800';
    if (percentage >= 80) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-3 w-3 text-green-600" />;
      case 'absent': return <AlertCircle className="h-3 w-3 text-red-600" />;
      case 'late': return <Clock className="h-3 w-3 text-orange-600" />;
      default: return <CheckCircle className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'text-green-600';
      case 'absent': return 'text-red-600';
      case 'late': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Overall Attendance */}
      <div className="text-center p-3 bg-blue-50 rounded-lg">
        <Calendar className="h-6 w-6 text-blue-600 mx-auto mb-2" />
        <div className={`text-2xl font-bold ${getAttendanceColor(overall.percentage)}`}>
          {overall.percentage.toFixed(1)}%
        </div>
        <div className="text-sm text-blue-700 mb-1">Overall Attendance</div>
        <div className="flex items-center justify-center gap-1">
          {overall.trend === 'up' ? (
            <TrendingUp className="h-3 w-3 text-green-600" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-600" />
          )}
          <span className={`text-xs ${
            overall.trend === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {overall.trend === 'up' ? '+' : ''}{overall.trendValue.toFixed(1)}% this term
          </span>
        </div>
      </div>

      {/* Period Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-2 bg-green-50 rounded">
          <div className="text-center">
            <div className="text-lg font-bold text-green-900">{thisWeek.percentage.toFixed(0)}%</div>
            <div className="text-xs text-green-700">This Week</div>
            <div className="text-xs text-gray-600">{thisWeek.present}/{thisWeek.totalDays}</div>
          </div>
        </div>
        <div className="p-2 bg-purple-50 rounded">
          <div className="text-center">
            <div className="text-lg font-bold text-purple-900">{thisMonth.percentage.toFixed(0)}%</div>
            <div className="text-xs text-purple-700">This Month</div>
            <div className="text-xs text-gray-600">{thisMonth.present}/{thisMonth.totalDays}</div>
          </div>
        </div>
      </div>

      {/* Attendance Stats */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Present Days</span>
          <Badge className="bg-green-100 text-green-800">{overall.present}</Badge>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Absent Days</span>
          <Badge className="bg-red-100 text-red-800">{overall.absent}</Badge>
        </div>
        {overall.late > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Late Arrivals</span>
            <Badge className="bg-orange-100 text-orange-800">{overall.late}</Badge>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Attendance Progress</span>
          <span>{overall.present}/{overall.totalDays} days</span>
        </div>
        <Progress value={overall.percentage} className="h-2" />
      </div>

      {/* Recent Attendance */}
      <div>
        <div className="text-sm font-medium text-gray-700 mb-2">Recent Records</div>
        <div className="space-y-1">
          {recentRecords.slice(0, 4).map((record, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                {getStatusIcon(record.status)}
                <span>{new Date(record.date).toLocaleDateString()}</span>
              </div>
              <div className={`flex items-center gap-1 ${getStatusColor(record.status)}`}>
                <span className="capitalize">{record.status}</span>
                {record.time && <span>({record.time})</span>}
                {record.reason && <span>- {record.reason}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance Alerts */}
      {overall.percentage < 85 && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Attendance below required minimum (85%). Contact academic advisor.
        </div>
      )}

      {overall.percentage >= 95 && thisWeek.percentage === 100 && (
        <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <CheckCircle className="h-3 w-3 inline mr-1" />
          Perfect attendance this week! Keep up the excellent work.
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <Link 
          to="/attendance?view=detailed"
          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-center"
        >
          Detailed View
        </Link>
        <Link 
          to="/attendance?action=request-excuse"
          className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-center"
        >
          Request Excuse
        </Link>
      </div>
    </div>
  );
};