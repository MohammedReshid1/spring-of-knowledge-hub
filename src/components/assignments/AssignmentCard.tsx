import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Assignment {
  id: string;
  title: string;
  description: string;
  class_id: string;
  class_name: string;
  subject?: string;
  due_date: Date;
  total_points: number;
  status: 'draft' | 'published' | 'closed';
  created_at: Date;
  total_students?: number;
  submitted_count?: number;
  graded_count?: number;
}

interface AssignmentCardProps {
  assignment: Assignment;
  onView?: (assignment: Assignment) => void;
  onEdit?: (assignment: Assignment) => void;
  onDelete?: (assignment: Assignment) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  onView,
  onEdit,
  onDelete,
}) => {
  const submissionRate = assignment.total_students
    ? ((assignment.submitted_count || 0) / assignment.total_students) * 100
    : 0;

  const gradingProgress = assignment.submitted_count
    ? ((assignment.graded_count || 0) / assignment.submitted_count) * 100
    : 0;

  const isOverdue = new Date(assignment.due_date) < new Date() && assignment.status === 'published';
  const isDueSoon = new Date(assignment.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) && !isOverdue;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'closed':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <Card className="group relative overflow-hidden border-2 hover:border-blue-300 hover:shadow-xl transition-all duration-300">
      {/* Premium gradient background on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      {/* Top accent line */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        assignment.status === 'published' ? 'bg-gradient-to-r from-green-600 to-emerald-600' :
        assignment.status === 'draft' ? 'bg-gradient-to-r from-gray-600 to-slate-600' :
        'bg-gradient-to-r from-blue-600 to-indigo-600'
      )} />

      <CardHeader className="relative pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="text-lg font-bold line-clamp-1">
                {assignment.title}
              </CardTitle>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
              <Badge variant="outline" className="bg-white">
                {assignment.class_name}
              </Badge>
              {assignment.subject && (
                <Badge variant="outline" className="bg-white">
                  {assignment.subject}
                </Badge>
              )}
              <Badge className={getStatusColor(assignment.status)}>
                {assignment.status}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onView && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onView(assignment);
                }}
                className="h-8 w-8 p-0"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(assignment);
                }}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(assignment);
                }}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2">
          {assignment.description}
        </p>

        {/* Due Date & Points */}
        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "p-3 rounded-lg border",
            isOverdue ? 'bg-red-50 border-red-200' :
            isDueSoon ? 'bg-yellow-50 border-yellow-200' :
            'bg-slate-50 border-slate-200'
          )}>
            <div className="flex items-center gap-2 mb-1">
              {isOverdue ? (
                <AlertCircle className="h-4 w-4 text-red-600" />
              ) : (
                <Calendar className="h-4 w-4 text-gray-600" />
              )}
              <span className="text-xs font-medium text-gray-600">Due Date</span>
            </div>
            <p className={cn(
              "text-sm font-semibold",
              isOverdue ? 'text-red-700' : isDueSoon ? 'text-yellow-700' : 'text-gray-900'
            )}>
              {format(new Date(assignment.due_date), 'MMM dd, yyyy')}
            </p>
            {isOverdue && (
              <p className="text-xs text-red-600 mt-1">Overdue</p>
            )}
            {isDueSoon && (
              <p className="text-xs text-yellow-600 mt-1">Due soon</p>
            )}
          </div>

          <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-medium text-gray-600">Points</span>
            </div>
            <p className="text-sm font-semibold text-purple-700">
              {assignment.total_points} pts
            </p>
          </div>
        </div>

        {/* Submission Progress */}
        {assignment.status === 'published' && assignment.total_students && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-700">Submissions</span>
              </div>
              <span className="text-gray-600">
                {assignment.submitted_count || 0} / {assignment.total_students}
              </span>
            </div>
            <Progress value={submissionRate} className="h-2" />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{submissionRate.toFixed(0)}% submitted</span>
              {assignment.graded_count !== undefined && (
                <span>{assignment.graded_count} graded</span>
              )}
            </div>
          </div>
        )}

        {/* Grading Progress */}
        {assignment.submitted_count && assignment.submitted_count > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-700">Grading Progress</span>
              </div>
              <span className="text-gray-600">
                {assignment.graded_count || 0} / {assignment.submitted_count}
              </span>
            </div>
            <Progress value={gradingProgress} className="h-2" />
          </div>
        )}

        {/* Quick Actions */}
        {assignment.status === 'published' && (
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 hover:bg-blue-50 hover:border-blue-300"
              onClick={() => onView?.(assignment)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Submissions
            </Button>
          </div>
        )}
      </CardContent>

      {/* Hover border effect */}
      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-400/30 rounded-lg pointer-events-none transition-all duration-300" />
    </Card>
  );
};
