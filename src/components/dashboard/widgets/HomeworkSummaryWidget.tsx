import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  BookOpen, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  Users,
  FileText
} from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface HomeworkStats {
  total_assignments: number;
  pending_assignments: number;
  submitted_assignments: number;
  overdue_assignments: number;
  graded_assignments: number;
  due_soon_assignments: number;
  completion_rate: number;
  average_score?: number;
  recent_assignments: Array<{
    id: string;
    title: string;
    subject_name: string;
    due_date: string;
    status: string;
    priority: string;
  }>;
}

interface HomeworkSummaryWidgetProps {
  userRole: 'student' | 'teacher' | 'parent' | 'admin';
  className?: string;
}

const HomeworkSummaryWidget: React.FC<HomeworkSummaryWidgetProps> = ({ 
  userRole, 
  className = "" 
}) => {
  const navigate = useNavigate();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['homework-summary', userRole],
    queryFn: async () => {
      let endpoint = '/homework/stats/summary';
      if (userRole === 'student') {
        endpoint = '/homework/stats/student';
      } else if (userRole === 'teacher') {
        endpoint = '/homework/stats/teacher';
      } else if (userRole === 'parent') {
        endpoint = '/homework/stats/parent';
      }
      
      const response = await api.get(endpoint);
      return response.data as HomeworkStats;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const handleViewHomework = () => {
    if (userRole === 'student') {
      navigate('/homework');
    } else if (userRole === 'teacher') {
      navigate('/homework/manage');
    } else if (userRole === 'parent') {
      navigate('/homework/parent');
    } else {
      navigate('/homework/admin');
    }
  };

  const getStatColor = (type: string, value: number) => {
    switch (type) {
      case 'overdue':
        return value > 0 ? 'text-red-600' : 'text-gray-600';
      case 'due_soon':
        return value > 0 ? 'text-orange-600' : 'text-gray-600';
      case 'completion':
        if (value >= 90) return 'text-green-600';
        if (value >= 70) return 'text-yellow-600';
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
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
            <BookOpen className="h-5 w-5" />
            Homework Overview
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
            <BookOpen className="h-5 w-5" />
            Homework Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-sm">No homework data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5" />
            {userRole === 'teacher' ? 'Teaching Overview' : 
             userRole === 'parent' ? "Children's Homework" : 
             'Homework Overview'}
          </div>
          <Button variant="outline" size="sm" onClick={handleViewHomework}>
            View All
          </Button>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Key Statistics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatColor('total', stats.total_assignments)}`}>
              {stats.total_assignments}
            </div>
            <div className="text-xs text-gray-600">
              {userRole === 'teacher' ? 'Assignments' : 'Total'}
            </div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${getStatColor('pending', stats.pending_assignments)}`}>
              {stats.pending_assignments}
            </div>
            <div className="text-xs text-gray-600">Pending</div>
          </div>
        </div>

        {/* Completion Rate Progress */}
        {userRole !== 'teacher' && (
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Completion Rate</span>
              <span className={`text-sm font-medium ${getStatColor('completion', stats.completion_rate)}`}>
                {stats.completion_rate}%
              </span>
            </div>
            <Progress 
              value={stats.completion_rate} 
              className="h-2"
              // @ts-ignore
              indicatorClassName={getCompletionColor(stats.completion_rate)}
            />
          </div>
        )}

        {/* Alert Indicators */}
        <div className="flex justify-between text-sm">
          {stats.overdue_assignments > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>{stats.overdue_assignments} Overdue</span>
            </div>
          )}
          
          {stats.due_soon_assignments > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <Clock className="h-3 w-3" />
              <span>{stats.due_soon_assignments} Due Soon</span>
            </div>
          )}
          
          {stats.graded_assignments > 0 && (
            <div className="flex items-center gap-1 text-green-600">
              <CheckCircle className="h-3 w-3" />
              <span>{stats.graded_assignments} Graded</span>
            </div>
          )}
        </div>

        {/* Average Score (for students and parents) */}
        {stats.average_score !== undefined && (
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">Average Score</span>
            </div>
            <span className="text-sm font-bold text-blue-600">
              {stats.average_score.toFixed(1)}%
            </span>
          </div>
        )}

        {/* Recent Assignments */}
        {stats.recent_assignments && stats.recent_assignments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Recent Activity
            </h4>
            <div className="space-y-2">
              {stats.recent_assignments.slice(0, 3).map((assignment) => {
                const dueDate = new Date(assignment.due_date);
                const isOverdue = isAfter(new Date(), dueDate);
                const isDueSoon = isBefore(dueDate, addDays(new Date(), 3)) && !isOverdue;
                
                return (
                  <div key={assignment.id} className="flex items-center justify-between text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{assignment.title}</p>
                      <p className="text-gray-600 truncate">{assignment.subject_name}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {assignment.priority === 'high' || assignment.priority === 'urgent' ? (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          {assignment.priority}
                        </Badge>
                      ) : null}
                      
                      {isOverdue ? (
                        <Badge variant="destructive" className="text-xs px-1 py-0">
                          Overdue
                        </Badge>
                      ) : isDueSoon ? (
                        <Badge variant="secondary" className="text-xs px-1 py-0">
                          Due Soon
                        </Badge>
                      ) : assignment.status === 'submitted' ? (
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          Submitted
                        </Badge>
                      ) : assignment.status === 'graded' ? (
                        <Badge variant="default" className="text-xs px-1 py-0">
                          Graded
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="pt-2 border-t">
          <div className="flex gap-2">
            {userRole === 'teacher' && (
              <>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate('/homework/create')}>
                  <FileText className="h-3 w-3 mr-1" />
                  New Assignment
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate('/homework/submissions')}>
                  <Users className="h-3 w-3 mr-1" />
                  Grade Work
                </Button>
              </>
            )}
            
            {userRole === 'student' && (
              <>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate('/homework?tab=pending')}>
                  <Clock className="h-3 w-3 mr-1" />
                  Pending
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => navigate('/homework?tab=graded')}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Graded
                </Button>
              </>
            )}
            
            {userRole === 'parent' && (
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate('/homework/parent')}>
                <Users className="h-3 w-3 mr-1" />
                Monitor Progress
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HomeworkSummaryWidget;