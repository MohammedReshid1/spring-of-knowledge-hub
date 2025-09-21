import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRoleAccess } from '@/hooks/useRoleAccess';
import { useBranch } from '@/contexts/BranchContext';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { BranchLoadingWrapper } from '@/components/common/BranchLoadingWrapper';
import { WidgetContainer } from '@/components/dashboard/widgets/WidgetContainer';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  ClipboardCheck, 
  TrendingUp,
  Clock,
  Bell,
  FileText
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherDashboardPage = () => {
  const { user } = useAuth();
  const { isTeacher } = useRoleAccess();
  const { selectedBranch } = useBranch();

  // Fetch teacher's dashboard data
  const { 
    data: dashboardData, 
    isLoading, 
    isError,
    error 
  } = useQuery({
    queryKey: ['teacher-dashboard', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      // Try enhanced dashboard first
      const { data: enhanced, error: enhancedError } = await apiClient.getTeacherEnhancedDashboard(user.id);
      if (!enhancedError && enhanced) {
        return enhanced;
      }
      
      // Fallback to regular dashboard
      const { data: regular, error: regularError } = await apiClient.getTeacherDashboardData(user.id);
      if (regularError) throw new Error(regularError);
      return regular;
    },
    enabled: isTeacher && !!user?.id,
    staleTime: 300000, // 5 minutes
    refetchInterval: 300000
  });

  if (!isTeacher) {
    return (
      <div className="p-6">
        <Card className="p-6 text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only accessible to teachers.</p>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Dashboard</h2>
            <p className="text-gray-600">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const teacherName = dashboardData?.teacher_name || user?.full_name || 'Teacher';
  const summary = dashboardData?.summary || {
    total_classes: 0,
    total_students: 0,
    active_academic_year: '2024-2025'
  };

  return (
    <BranchLoadingWrapper loadingMessage="Loading teacher dashboard...">
      <div className="space-y-6 p-6">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Welcome, {teacherName}!</h1>
              <p className="text-blue-100">
                Ready to inspire and educate your students today
              </p>
              <p className="text-sm text-blue-200 mt-1">
                Academic Year: {summary.active_academic_year}
              </p>
            </div>
            <div className="hidden md:block">
              <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                <Calendar className="h-12 w-12 text-white mx-auto mb-2" />
                <div className="text-center text-sm">
                  {new Date().toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">My Classes</p>
                <p className="text-2xl font-bold text-blue-900">{summary.total_classes}</p>
              </div>
              <BookOpen className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Total Students</p>
                <p className="text-2xl font-bold text-green-900">{summary.total_students}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">Pending Grades</p>
                <p className="text-2xl font-bold text-orange-900">
                  {dashboardData?.pending_grades_count || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Notifications</p>
                <p className="text-2xl font-bold text-purple-900">
                  {dashboardData?.notifications_count || 0}
                </p>
              </div>
              <Bell className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/attendance">
                <ClipboardCheck className="h-6 w-6 mb-2" />
                Take Attendance
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/grades">
                <TrendingUp className="h-6 w-6 mb-2" />
                Grade Assignments
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/classes">
                <BookOpen className="h-6 w-6 mb-2" />
                View Classes
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-20 flex-col">
              <Link to="/calendar">
                <Calendar className="h-6 w-6 mb-2" />
                Schedule
              </Link>
            </Button>
          </div>
        </Card>

        {/* Recent Activities */}
        {dashboardData?.recent_activities && dashboardData.recent_activities.length > 0 && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Activities</h2>
            <div className="space-y-3">
              {dashboardData.recent_activities.slice(0, 5).map((activity: any, index: number) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.message}</p>
                    <p className="text-xs text-gray-500">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleDateString() : 'Today'}
                    </p>
                  </div>
                  {activity.class_id && (
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/classes/${activity.class_id}`}>
                        View Class
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Class Overview */}
        {dashboardData?.assigned_classes && dashboardData.assigned_classes.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">My Classes</h2>
              <Button asChild variant="outline" size="sm">
                <Link to="/classes">View All Classes</Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {dashboardData.assigned_classes.slice(0, 6).map((cls: any) => (
                <div key={cls.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900">
                      {cls.class_name || `${cls.grade_level} ${cls.subject}`}
                    </h3>
                    <Badge variant="outline">
                      {cls.current_enrollment || 0} students
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Academic Year: {cls.academic_year}</p>
                    {cls.grade_level && <p>Grade: {cls.grade_level}</p>}
                  </div>
                  <div className="mt-3 flex space-x-2">
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/classes/${cls.id}/attendance`}>
                        Attendance
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/classes/${cls.id}`}>
                        Details
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Role-Specific Widget Dashboard */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Dashboard Widgets</h2>
          <WidgetContainer />
        </div>
      </div>
    </BranchLoadingWrapper>
  );
};

export default TeacherDashboardPage;