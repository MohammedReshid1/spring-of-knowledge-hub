import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  BookOpen,
  Calendar,
  TrendingUp,
  ClipboardCheck,
  FileText,
  GraduationCap,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ClassStats {
  total_students: number;
  average_attendance?: number;
  average_grade?: number;
  pending_assignments?: number;
  upcoming_exams?: number;
}

interface TeacherClassCardProps {
  id: string;
  name: string;
  grade_level: string;
  subject?: string;
  subject_name?: string;
  academic_year?: string;
  current_enrollment?: number;
  stats?: ClassStats;
  onClick?: () => void;
  showActions?: boolean;
}

export const TeacherClassCard: React.FC<TeacherClassCardProps> = ({
  id,
  name,
  grade_level,
  subject,
  subject_name,
  academic_year,
  current_enrollment = 0,
  stats,
  onClick,
  showActions = true,
}) => {
  const attendanceRate = stats?.average_attendance || 0;
  const averageGrade = stats?.average_grade || 0;

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 bg-green-100';
    if (rate >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getGradeColor = (grade: number) => {
    if (grade >= 85) return 'text-green-600 bg-green-100';
    if (grade >= 70) return 'text-blue-600 bg-blue-100';
    if (grade >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-2 transition-all duration-300",
        "hover:border-blue-400 hover:shadow-2xl",
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      {/* Premium Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Top Accent Line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600" />

      <CardHeader className="relative pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-xl font-bold bg-gradient-to-r from-slate-900 to-blue-900 bg-clip-text text-transparent">
                {name}
              </CardTitle>
            </div>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-white">
                <GraduationCap className="h-3 w-3 mr-1" />
                Grade {grade_level}
              </Badge>
              {(subject || subject_name) && (
                <Badge variant="outline" className="bg-white">
                  {subject_name || subject}
                </Badge>
              )}
              {academic_year && (
                <Badge variant="outline" className="bg-white">
                  <Calendar className="h-3 w-3 mr-1" />
                  {academic_year}
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="flex items-center gap-1 text-2xl font-bold text-blue-600">
                <Users className="h-5 w-5" />
                {current_enrollment}
              </div>
              <p className="text-xs text-slate-600">Students</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Stats Section */}
        {stats && (
          <div className="grid grid-cols-2 gap-3">
            {/* Attendance */}
            {stats.average_attendance !== undefined && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Attendance</span>
                  <Badge className={cn("text-xs px-2", getAttendanceColor(attendanceRate))}>
                    {attendanceRate.toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={attendanceRate} className="h-1.5" />
              </div>
            )}

            {/* Average Grade */}
            {stats.average_grade !== undefined && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Avg. Grade</span>
                  <Badge className={cn("text-xs px-2", getGradeColor(averageGrade))}>
                    {averageGrade.toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={averageGrade} className="h-1.5" />
              </div>
            )}
          </div>
        )}

        {/* Quick Info Pills */}
        {stats && (stats.pending_assignments || stats.upcoming_exams) && (
          <div className="flex flex-wrap gap-2">
            {stats.pending_assignments !== undefined && stats.pending_assignments > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-full">
                <FileText className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-xs font-medium text-orange-900">
                  {stats.pending_assignments} Pending
                </span>
              </div>
            )}
            {stats.upcoming_exams !== undefined && stats.upcoming_exams > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-900">
                  {stats.upcoming_exams} Upcoming Exams
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-2 pt-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 group/btn hover:bg-blue-50 hover:border-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              <Link to={`/teacher-attendance?class=${id}`}>
                <ClipboardCheck className="h-4 w-4 mr-1 group-hover/btn:text-blue-600" />
                <span className="group-hover/btn:text-blue-700">Attendance</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="flex-1 group/btn hover:bg-green-50 hover:border-green-300"
              onClick={(e) => e.stopPropagation()}
            >
              <Link to={`/teacher-grading?class=${id}`}>
                <TrendingUp className="h-4 w-4 mr-1 group-hover/btn:text-green-600" />
                <span className="group-hover/btn:text-green-700">Grades</span>
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2 hover:bg-slate-100"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        )}
      </CardContent>

      {/* Hover Effect Border */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-400/30 rounded-lg pointer-events-none transition-all duration-300" />
    </Card>
  );
};
