import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  GraduationCap, 
  Clock, 
  Users, 
  FileCheck, 
  AlertTriangle,
  TrendingUp,
  BookOpen
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface PendingSubmission {
  id: string;
  assignment_title: string;
  student_name: string;
  subject_name: string;
  submitted_at: string;
  is_late: boolean;
  days_pending: number;
}

interface GradingStats {
  total_submissions: number;
  pending_grading: number;
  graded_today: number;
  average_grading_time: number;
  completion_rate: number;
  recent_submissions: PendingSubmission[];
  subjects_stats: Array<{
    subject_name: string;
    pending_count: number;
    total_count: number;
  }>;
}

interface TeacherGradingWidgetProps {
  className?: string;
}

const TeacherGradingWidget: React.FC<TeacherGradingWidgetProps> = ({ 
  className = "" 
}) => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['teacher-grading-stats'],
    queryFn: async () => {
      const response = await api.get('/homework/stats/teacher/grading');
      return response.data as GradingStats;
    },
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
  });

  const handleViewSubmissions = (filter?: string) => {
    const baseUrl = '/homework/submissions';
    if (filter) {
      navigate(`${baseUrl}?status=${filter}`);
    } else {
      navigate(baseUrl);
    }
  };

  const getUrgencyColor = (daysPending: number) => {
    if (daysPending >= 5) return 'text-red-600';
    if (daysPending >= 3) return 'text-orange-600';
    if (daysPending >= 1) return 'text-yellow-600';
    return 'text-blue-600';
  };

  const getCompletionColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-500';
    if (rate >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            Grading Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            Grading Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No grading data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <GraduationCap className="h-5 w-5" />
            Grading Queue
          </div>
          <Button variant="outline" size="sm" onClick={() => handleViewSubmissions()}>
            View All
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Alert for pending grading */}
        {stats.pending_grading > 0 && (
          <div className={`p-3 rounded-lg border ${
            stats.pending_grading >= 20 ? 'bg-red-50 border-red-200' :
            stats.pending_grading >= 10 ? 'bg-orange-50 border-orange-200' :
            'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${
                stats.pending_grading >= 20 ? 'text-red-600' :
                stats.pending_grading >= 10 ? 'text-orange-600' :
                'text-yellow-600'
              }`} />
              <span className="text-sm font-medium">
                {stats.pending_grading} submission{stats.pending_grading > 1 ? 's' : ''} awaiting your review
              </span>
            </div>
          </div>
        )}

        {/* Key Statistics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {stats.pending_grading}
            </div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats.graded_today}
            </div>
            <div className="text-xs text-gray-600">Today</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats.total_submissions}
            </div>
            <div className="text-xs text-gray-600">Total</div>
          </div>
        </div>

        {/* Completion Rate */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Grading Progress</span>
            <span className="text-sm font-medium text-blue-600">
              {stats.completion_rate}%
            </span>
          </div>
          <Progress 
            value={stats.completion_rate} 
            className="h-2"
            // @ts-ignore
            indicatorClassName={getCompletionColor(stats.completion_rate)}
          />
          <div className="text-xs text-gray-500 mt-1">
            {stats.total_submissions - stats.pending_grading} of {stats.total_submissions} graded
          </div>
        </div>

        {/* Average Grading Time */}
        {stats.average_grading_time > 0 && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Avg. Response Time</span>
            </div>
            <span className="text-sm font-bold text-blue-600">
              {stats.average_grading_time < 24 
                ? `${Math.round(stats.average_grading_time)}h` 
                : `${Math.round(stats.average_grading_time / 24)}d`}
            </span>
          </div>
        )}

        {/* Subject Breakdown */}
        {stats.subjects_stats && stats.subjects_stats.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <BookOpen className="h-3 w-3" />
              By Subject
            </h4>
            <div className="space-y-2">
              {stats.subjects_stats.slice(0, 3).map((subject) => (
                <div key={subject.subject_name} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{subject.subject_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {subject.pending_count}/{subject.total_count}
                    </span>
                    {subject.pending_count > 0 && (
                      <Badge variant="secondary" className="text-xs px-1 py-0">
                        {subject.pending_count}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Submissions */}
        {stats.recent_submissions && stats.recent_submissions.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <FileCheck className="h-3 w-3" />
              Recent Submissions
            </h4>
            <div className="space-y-2">
              {stats.recent_submissions.slice(0, 3).map((submission) => (
                <div key={submission.id} className="flex items-center justify-between text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{submission.assignment_title}</p>
                    <p className="text-gray-600 truncate">
                      by {submission.student_name} • {submission.subject_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {submission.is_late && (
                      <Badge variant="destructive" className="text-xs px-1 py-0">
                        Late
                      </Badge>
                    )}
                    <span className={`text-xs font-medium ${getUrgencyColor(submission.days_pending)}`}>
                      {submission.days_pending}d
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => handleViewSubmissions('submitted')}
            >
              <Users className="h-3 w-3 mr-1" />
              Grade Now
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={() => handleViewSubmissions('graded')}
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              View Graded
            </Button>
          </div>
        </div>

        {/* Performance Tip */}
        {stats.pending_grading > 10 && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
            💡 Tip: Students learn better with timely feedback. Consider setting aside dedicated grading time daily.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeacherGradingWidget;