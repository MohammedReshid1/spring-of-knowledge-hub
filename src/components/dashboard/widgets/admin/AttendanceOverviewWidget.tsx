import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, CheckCircle, AlertCircle, Calendar, TrendingUp, Users, Eye, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { WidgetProps } from '../WidgetRegistry';
import { useWidgetData } from '@/hooks/useWidgetData';
import { cn } from '@/lib/utils';

export const AttendanceOverviewWidget: React.FC<WidgetProps> = ({ config }) => {
  const { useAttendanceOverview } = useWidgetData();
  const { data: attendanceData, isLoading, error } = useAttendanceOverview();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [animatedPresentCount, setAnimatedPresentCount] = useState(0);
  const [animatedAbsentCount, setAnimatedAbsentCount] = useState(0);

  // Animated counter effect
  useEffect(() => {
    if (attendanceData && !isLoading) {
      const presentTarget = attendanceData.present_today || 0;
      const absentTarget = attendanceData.absent_today || 0;

      // Animate present count
      let presentCurrent = 0;
      const presentIncrement = Math.max(1, Math.floor(presentTarget / 20));
      const presentTimer = setInterval(() => {
        presentCurrent += presentIncrement;
        if (presentCurrent >= presentTarget) {
          presentCurrent = presentTarget;
          clearInterval(presentTimer);
        }
        setAnimatedPresentCount(presentCurrent);
      }, 50);

      // Animate absent count
      let absentCurrent = 0;
      const absentIncrement = Math.max(1, Math.floor(absentTarget / 20));
      const absentTimer = setInterval(() => {
        absentCurrent += absentIncrement;
        if (absentCurrent >= absentTarget) {
          absentCurrent = absentTarget;
          clearInterval(absentTimer);
        }
        setAnimatedAbsentCount(absentCurrent);
      }, 50);

      return () => {
        clearInterval(presentTimer);
        clearInterval(absentTimer);
      };
    }
  }, [attendanceData, isLoading]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Premium Date Header Loading */}
        <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 overflow-hidden">
          <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer"></div>
          <div className="relative text-center space-y-2">
            <div className="w-8 h-8 bg-blue-200 rounded-xl mx-auto animate-pulse"></div>
            <div className="w-24 h-4 bg-blue-200 rounded mx-auto animate-pulse"></div>
            <div className="w-32 h-3 bg-blue-200 rounded mx-auto animate-pulse"></div>
          </div>
        </div>

        {/* Premium Stats Loading */}
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200/50 overflow-hidden">
              <div className="absolute inset-0 bg-shimmer bg-[length:200%_100%] animate-shimmer"></div>
              <div className="relative space-y-3">
                <div className="w-8 h-8 bg-slate-200 rounded-xl animate-pulse"></div>
                <div className="w-12 h-6 bg-slate-200 rounded animate-pulse"></div>
                <div className="w-16 h-3 bg-slate-200 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6 rounded-2xl bg-gradient-to-br from-red-50 to-rose-50 border border-red-200/50">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <UserCheck className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-sm font-medium text-red-600">Failed to load attendance data</p>
        </div>
      </div>
    );
  }

  const attendance = attendanceData || {
    present_today: 0,
    absent_today: 0,
    attendance_rate: 0
  };

  const totalStudents = attendance.present_today + attendance.absent_today;
  const attendanceRate = Math.round(attendance.attendance_rate);

  // Get today's date
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const getAttendanceStatus = () => {
    if (attendanceRate >= 95) return { label: 'Excellent', color: 'emerald', gradient: 'from-emerald-500 to-green-500' };
    if (attendanceRate >= 90) return { label: 'Good', color: 'blue', gradient: 'from-blue-500 to-indigo-500' };
    if (attendanceRate >= 80) return { label: 'Average', color: 'amber', gradient: 'from-amber-500 to-orange-500' };
    if (attendanceRate >= 70) return { label: 'Below Average', color: 'orange', gradient: 'from-orange-500 to-red-500' };
    return { label: 'Poor', color: 'red', gradient: 'from-red-500 to-rose-500' };
  };

  const status = getAttendanceStatus();

  return (
    <div className="space-y-6">
      {/* Premium Date Header */}
      <div className="relative p-4 rounded-2xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/50 overflow-hidden group">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5"></div>
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-200/20 to-blue-200/20 rounded-full -translate-y-12 translate-x-12"></div>

        <div className="relative text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/50 group-hover:shadow-glow-blue transition-all duration-normal">
            <Calendar className="h-6 w-6 text-blue-600 animate-bounce-gentle" />
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              Today's Attendance
            </div>
            <div className="text-sm font-medium text-blue-600">{today}</div>
          </div>
        </div>
      </div>

      {/* Premium Attendance Stats */}
      <div className="grid grid-cols-2 gap-4">
        {/* Present Count */}
        <div
          className={cn(
            'group relative p-4 rounded-2xl border backdrop-blur-sm transition-all duration-normal ease-premium',
            'hover:scale-105 hover:-translate-y-1',
            'bg-gradient-to-br from-emerald-50 to-green-50',
            'border-emerald-200/50',
            hoveredCard === 'present' && 'shadow-glow-green'
          )}
          onMouseEnter={() => setHoveredCard('present')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          {/* Background gradient overlay */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br from-emerald-500 to-green-500 opacity-0 rounded-2xl transition-opacity duration-normal',
            hoveredCard === 'present' && 'opacity-5'
          )}></div>

          <div className="relative text-center space-y-3">
            <div className={cn(
              'inline-flex p-2.5 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 transition-all duration-normal',
              hoveredCard === 'present' && 'animate-bounce-gentle'
            )}>
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                {animatedPresentCount.toLocaleString()}
              </div>
              <div className="text-sm font-semibold text-emerald-700">Present</div>
            </div>
          </div>
        </div>

        {/* Absent Count */}
        <div
          className={cn(
            'group relative p-4 rounded-2xl border backdrop-blur-sm transition-all duration-normal ease-premium',
            'hover:scale-105 hover:-translate-y-1',
            'bg-gradient-to-br from-red-50 to-rose-50',
            'border-red-200/50',
            hoveredCard === 'absent' && 'shadow-glow-orange'
          )}
          onMouseEnter={() => setHoveredCard('absent')}
          onMouseLeave={() => setHoveredCard(null)}
        >
          {/* Background gradient overlay */}
          <div className={cn(
            'absolute inset-0 bg-gradient-to-br from-red-500 to-rose-500 opacity-0 rounded-2xl transition-opacity duration-normal',
            hoveredCard === 'absent' && 'opacity-5'
          )}></div>

          <div className="relative text-center space-y-3">
            <div className={cn(
              'inline-flex p-2.5 rounded-xl bg-gradient-to-br from-red-100 to-rose-100 transition-all duration-normal',
              hoveredCard === 'absent' && 'animate-bounce-gentle'
            )}>
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                {animatedAbsentCount.toLocaleString()}
              </div>
              <div className="text-sm font-semibold text-red-700">Absent</div>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Attendance Rate Display */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-gray-50 border border-slate-200/50 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-gray-500/5"></div>

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-blue-100 border border-indigo-200/50">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-lg font-bold text-slate-700">Attendance Rate</span>
            </div>
            <div className="text-right space-y-1">
              <div className={cn("text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent", status.gradient)}>
                {attendanceRate}%
              </div>
              <Badge className={cn("text-xs px-3 py-1 font-semibold",
                status.color === 'emerald' && "bg-emerald-100 text-emerald-700 border-emerald-200/50",
                status.color === 'blue' && "bg-blue-100 text-blue-700 border-blue-200/50",
                status.color === 'amber' && "bg-amber-100 text-amber-700 border-amber-200/50",
                status.color === 'orange' && "bg-orange-100 text-orange-700 border-orange-200/50",
                status.color === 'red' && "bg-red-100 text-red-700 border-red-200/50"
              )}>
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Premium Progress Bar */}
          <div className="relative">
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-slow ease-premium bg-gradient-to-r", status.gradient)}
                style={{ width: `${attendanceRate}%` }}
              >
                <div className="h-full bg-shimmer bg-[length:200%_100%] animate-shimmer opacity-30"></div>
              </div>
            </div>
            <div className="absolute inset-0 h-4 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full"></div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600 font-medium">
              {attendance.present_today} of {totalStudents} students present
            </span>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-slate-500" />
              <span className="text-slate-500">{totalStudents} total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Alert for Low Attendance */}
      {attendanceRate < 75 && (
        <div className="relative p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100">
              <AlertCircle className="h-5 w-5 text-amber-600 animate-pulse-glow" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Low Attendance Alert</p>
              <p className="text-xs text-amber-700">Consider follow-up actions to improve attendance</p>
            </div>
          </div>
        </div>
      )}

      {/* Premium Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/attendance"
          className="group flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-sm font-medium transition-all duration-normal hover:scale-105 hover:shadow-glow-blue"
        >
          <Eye className="h-4 w-4 transition-transform duration-normal group-hover:scale-110" />
          View Full Attendance
        </Link>
        {attendance.absent_today > 0 && (
          <Link
            to="/notifications?type=attendance"
            className="group flex items-center justify-center gap-2 p-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium transition-all duration-normal hover:scale-105 hover:shadow-glow-orange"
          >
            <Bell className="h-4 w-4 transition-transform duration-normal group-hover:rotate-12" />
            Notify Parents ({attendance.absent_today})
          </Link>
        )}
      </div>
    </div>
  );
};